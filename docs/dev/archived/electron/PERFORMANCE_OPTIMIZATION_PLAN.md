# Tabst 性能与打包优化完整方案（审阅稿）

> **已归档 / Electron 时代文档**
>
> 本文基于迁移前的桌面运行时架构撰写，不再代表当前 Tauri-first 主线实现。
> 如需开展新的性能工作，请以当前 `src-tauri/`、`src/renderer/` 与 `docs/dev/TAURI_MIGRATION_STATUS.md` 为准重新建立基线。

> 更新时间：2026-02-27  
> 目标：解决“轻微迟滞感”，从**内存占用、事件处理、渲染链路、打包体积与启动速度**四个维度系统优化。

---

## 1. 当前架构研究（基于仓内代码）

本节是对当前实现的“现状快照”，用于解释为什么会产生体感迟滞。

### 1.1 应用分层与关键链路

- **Main 进程（Electron）**：`src/main/main.ts`
  - 负责窗口创建、IPC 注册、Repo 文件监听（`start-repo-watch` / `stop-repo-watch`）。
- **Preload 边界**：`src/main/preload.ts`
  - 通过 `contextBridge.exposeInMainWorld` 暴露 `electronAPI`，主-渲染通道较清晰。
- **Renderer（React + Zustand + CodeMirror + alphaTab）**：
  - 应用入口：`src/renderer/App.tsx`
  - 编辑器：`src/renderer/components/Editor.tsx`
  - 预览渲染核心：`src/renderer/components/Preview.tsx`
  - 打印预览：`src/renderer/components/PrintPreview.tsx`
  - 全局状态：`src/renderer/store/appStore.ts`
- **Worker**：`src/renderer/workers/alphatex.worker.ts`
  - AlphaTex LSP 计算在 Worker 内处理，方向正确。

### 1.2 已确认的性能敏感点（代码证据）

1. **Preview 过于重型（多 effect + 复杂生命周期）**
   - 文件：`src/renderer/components/Preview.tsx`
   - 观察：组件体量很大，且存在 `// @ts-nocheck`；包含大量 `useEffect`、事件绑定与 AlphaTab API 生命周期逻辑。

2. **主题切换需要销毁并重建 AlphaTab API（架构既定）**
   - 文件：`src/renderer/components/Preview.tsx`
   - 说明：该行为是项目既有设计（AGENTS.md 也明确），但它带来一次明显“重建成本”。

3. **Editor 与 Preview 双向同步链路复杂**
   - 文件：`src/renderer/components/Editor.tsx`、`Preview.tsx`
   - 观察：编辑光标、播放高亮、选区同步都在高频路径上，若无节流会放大重渲染。

4. **App 层存在多组 window 级事件监听和文件变更刷新逻辑**
   - 文件：`src/renderer/App.tsx`
   - 观察：`keydown/dragover/drop/paste` + repo watch 回调都集中在入口层，刷新频率控制是关键。

5. **全局 Zustand 状态面较大，渲染订阅点多**
   - 文件：`src/renderer/store/appStore.ts` + 多组件 `useAppStore` 订阅
   - 观察：Playback / Cursor / Workspace / FileTree 等高频状态并存，若 selector 粒度不当会引发级联渲染。

6. **构建配置以可用为主，尚未深度分包**
   - 文件：`vite.config.ts`
   - 观察：当前未见 `manualChunks` 等明确分包策略；重依赖（如 alphaTab）可能与主渲染包耦合过深。

7. **打包链路存在 Forge + electron-builder 并行能力**
   - 文件：`package.json`、`forge.config.cjs`
   - 观察：当前可用，但建议收敛策略以降低维护和产物行为差异。

---

## 2. 外部最佳实践（Electron / React / Vite）

### 2.1 Electron（官方实践）

- 避免阻塞主进程；重任务移至 Worker/异步链路。
- IPC 优先 `invoke/handle` 异步模式，避免同步阻塞调用。
- 保持 `contextIsolation`、最小化 preload 暴露面。
- 启动期延迟非关键任务（lazy init），避免首屏竞争。
- 生产环境持续做 CPU/Heap profile，避免“凭感觉优化”。

### 2.2 React 19（官方方向）

- 优先保证组件纯度，减少不必要渲染。
- 对高成本视图采用切分与懒加载（`React.lazy` / Suspense）。
- 对输入与非紧急渲染使用并发能力（如 transition/deferred）。
- 通过 Profiler 定位真实热点，再决定 memo / callback / 结构拆分。

### 2.3 Vite（官方方向）

- 使用动态导入和 chunk 策略做明确分包。
- 减少首包体积，重模块按路由/功能延迟加载。
- 持续做构建产物分析（bundle analyzer）并设阈值。

---

## 3. 完整优化方案（可执行路线图）

> 原则：**先可观测，再改造；先低风险高收益，再结构性重构。**

## Phase 0（1-2 天）：建立基线与观测能力（必须先做）

### 目标

把“迟滞感”转成可量化指标，避免无效优化。

### 任务

1. 建立基线数据（开发 + 打包后各一组）：
   - 冷启动到可编辑时间（TTI）
   - 首次打开大谱面时间
   - 播放中 UI 帧稳定性（是否掉帧）
   - 渲染进程内存（初始 / 5 分钟编辑 / 15 分钟播放）

2. 增加轻量 profiling 脚本：
   - 记录关键操作耗时（加载文件、`api.tex`、主题切换重建）。
   - 在开发态输出性能日志（避免生产噪音）。

### 验收

- 形成一份 baseline 表格（可放 `docs/dev/ops/`）。

---

## Phase 1（3-5 天）：低风险高收益优化

### 1) 渲染层减压：拆分与懒加载

- 对非首屏必要区域做懒加载：
  - `PrintPreview`
  - `SettingsView`
  - `TutorialView` 中重内容块
- 目标：减少初始 JS 执行体积与主线程竞争。

### 2) 打包分块策略（Vite）

- 在 `vite.config.ts` 增加 `rollupOptions.output.manualChunks`：
  - `alphatab` 独立 chunk
  - `react-vendor` / `ui-vendor` 分块
- 目标：首包缩小，二次访问更快。

### 3) 事件处理“收口”

- 梳理 `App.tsx` 的 window 级事件监听：
  - 统一注册/注销规范
  - 明确节流窗口（fs 变更合并）
- 目标：降低高频事件导致的刷新抖动。

### 4) Zustand 订阅优化

- 优先在高频组件（`GlobalBottomBar`, `Preview`, `Editor`）做 selector 粒度治理：
  - 避免无关状态触发重渲染
  - 引入浅比较/派生选择器（按组件场景）
- 目标：播放与编辑并行时减少级联更新。

### Phase 1 验收指标（建议）

- 冷启动可交互时间下降 **15%+**
- 首次加载大谱面下降 **20%+**
- 播放中明显掉帧频率下降（体感 + profiler 双确认）

---

## Phase 2（5-8 天）：结构性优化（中风险）

### 1) Preview 生命周期降复杂度

- 将 `Preview.tsx` 中“初始化/同步/事件绑定/错误恢复”拆成独立 hooks。
- 目标：降低单组件复杂度，减少 effect 相互干扰。

### 2) 同步链路分级

- 编辑器输入 -> 预览刷新路径采用“优先级分层”：
  - 输入反馈优先（光标与文本）
  - 乐谱重排次优先（可延后批处理）
- 目标：输入不卡手，重渲染在后台吸收。

### 3) 文件树与仓库监听策略优化

- 对 watcher 事件做更稳定的合并窗口与去重策略。
- 大目录场景下，避免每次都触发全量树刷新。

### 4) Type Safety 清债（Preview）

- 移除 `Preview.tsx` 的 `@ts-nocheck`（分步完成）。
- 意义：减少隐藏错误导致的性能/稳定性回归风险。

### Phase 2 验收指标（建议）

- 长时会话（30 分钟）内存增幅收敛（例如下降 **20%+**）
- 主题切换重建体感更平滑（可通过耗时日志量化）

---

## Phase 3（可选）：打包与发布工程化

1. 统一打包主链路（Forge 或 builder 选主、另一条降级）。
2. 在 CI 加入 bundle 大小阈值检查。
3. 产物结构治理：文档/source map/非必要资源纳入策略控制。

---

## 4. 优先级矩阵（建议落地顺序）

| 优先级 | 事项 | 收益 | 风险 |
|---|---|---:|---:|
| P0 | 基线观测与指标化 | 极高 | 低 |
| P1 | 懒加载 + manualChunks | 高 | 低 |
| P1 | 事件处理收口与节流 | 高 | 低 |
| P1 | Zustand 高频订阅治理 | 高 | 中 |
| P2 | Preview 结构拆分 | 中-高 | 中 |
| P2 | 同步链路分级调度 | 中-高 | 中 |
| P2 | 移除 `@ts-nocheck` | 中 | 中 |
| P3 | 打包链路收敛 + CI 阈值 | 中 | 低 |

---

## 5. 风险与回滚策略

- **风险 A：alphaTab 生命周期改动导致功能回归**
  - 策略：每步改动都保留旧路径开关，先灰度验证。

- **风险 B：分包后动态加载时序问题**
  - 策略：增加加载态与失败兜底，保证编辑器始终可用。

- **风险 C：状态订阅优化引发 UI 不更新**
  - 策略：为关键交互写回归用例（播放控制、轨道切换、光标同步）。

---

## 6. 建议的实施清单（按周）

### Week 1

- 完成 Phase 0 基线
- 落地懒加载与 manualChunks 初版
- 提交第一轮性能对比报告

### Week 2

- Zustand 高频订阅优化
- App 事件处理收口
- 完成第二轮对比报告

### Week 3

- Preview 生命周期模块化改造
- 清理 `@ts-nocheck` 的第一阶段
- 完成稳定性回归与最终报告

---

## 7. 结论

Tabst 当前架构方向是正确的（Worker 化、主渲染边界清晰、AlphaTab 重建机制明确），迟滞感主要来自**高复杂组件生命周期 + 高频同步链路 + 首包/运行时竞争**的叠加。  
按照本方案分阶段执行，预期能在**不牺牲功能完整性**前提下，显著改善启动、编辑与播放过程中的流畅度与稳定性。
