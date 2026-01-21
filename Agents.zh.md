# AGENTS.md

## 1. 项目概览

**Tabst** 是一个基于 Electron + React 的吉他谱编辑器/播放器。它将乐谱视为 Markdown 代码（AlphaTex），并使用 **alphaTab** 引擎进行渲染和播放。

### 核心技术栈

- **运行时**: Electron (Main Process), React 19 (Renderer).
- **语言**: TypeScript (Strict mode).
- **包管理**: pnpm.
- **乐谱引擎**: alphaTab (及 `@coderline/alphatab`).
- **编辑器**: CodeMirror 6 (Custom LSP, Highlighting, Autocomplete).
- **UI**: Tailwind CSS v3, Shadcn/UI, Lucide React.
- **状态管理**: Zustand.
- **工具链**: Vite, Biome (用于 Lint/Format).

## 2. 代码规范与行为准则

### 通用规则

- **代码风格**: 必须遵循 Biome 规范（见 `biome.json`）。不要使用 Prettier 或 ESLint 的规则建议。
- **组件**: 使用函数式组件 + Hooks。
- **导入**: 优先使用绝对路径（如 `@/renderer/...`）或相对路径保持清晰。
- **UI 组件**: 优先复用 `src/renderer/components/ui/` 下的组件。

### 状态管理 (Zustand)

- 全局状态（文件列表、播放状态、选区、缩放）必须通过 `useAppStore` (`src/renderer/store/appStore.ts`) 管理。
- **不要**在组件内部使用 `useState` 管理应该跨组件共享的数据（如播放进度）。

### AlphaTab 集成

这是一个高度复杂的集成点，请严格遵守以下规则：

1.  **API 实例**: `AlphaTabApi` 通常通过 `useRef` 持有 (`apiRef.current`)，不要放入 React State。
2.  **Worker 通信**: 渲染和音频解码在 Web Worker 中运行。
3.  **配置更新**:
    - **轻量更新**: 如切换单轨显示 (TAB/五线谱)，使用 `api.renderTracks()`.
    - **内容更新**: 使用 `api.tex(content)`.
    - **主题/深层配置更新**: **必须销毁并重建 API** (`destroy()` -> `new AlphaTabApi()`)。单纯调用 `render()` **无效**，因为 Worker 会缓存初始化时的颜色配置。

## 3. 已知问题与架构决策 (Memory Bank)

> 请在修改相关逻辑前阅读此部分，避免回归已知 Bug。

### A. 主题切换与 API 重建

- **上下文**: `src/renderer/components/Preview.tsx`
- **规则**: 当从亮色切换到暗色主题时，必须完全销毁旧 API 并创建新 API 以传递新的颜色配置给 Worker。
- **注意**: 重建时**必须**保存并恢复用户的 Tracks 显示配置（如是否显示六线谱/简谱）。请参考 `docs/dev/TRACKS_PARAMETER_FIX.md`。

### B. 编辑器与乐谱同步 (Selection Sync)

- **上下文**: `src/renderer/lib/alphatex-selection-sync.ts`
- **规则**:
  - 使用 alphaTab 内置的 `AlphaTexParser` (AST) 来计算 Beat 在源码中的位置，**不要**尝试手写正则解析复杂的 AlphaTex 语法。
  - **CodeMirror 滚动**: 使用 `view.visibleRanges` 而非 `coordsAtPos` 来检测可见性，因为 CodeMirror 使用虚拟滚动，未渲染区域无法获取坐标。

### C. 打印功能

- **上下文**: `src/renderer/components/PrintPreview.tsx`
- **规则**:
  - 打印预览使用独立的 `AlphaTabApi` 实例。
  - **字体加载**: 必须使用绝对 URL 加载 `Bravura` 字体。
  - **样式注入**: 必须显式注入 CSS 规则 `.at-surface .at { font-size: 34px !important; }`，否则在 Scale=1.0 时音符会渲染得极小。

### D. LSP 与 Worker

- **上下文**: `src/renderer/workers/alphatex.worker.ts`
- **规则**:
  - 补全和 Hover 优先读取本地 `src/renderer/data/alphatex-commands.json`，其次回退到上游文档。
  - 所有的 LSP 消息处理都在 Worker 内部完成，通过 `postMessage` 与主线程通信。

## 4. 常用命令

- **安装依赖**: `pnpm install`
- **启动开发环境**: `pnpm run dev` (同时启动 React 和 Electron)
- **代码检查与修复**: `pnpm check` (运行 Biome)
- **格式化**: `pnpm format`
- **打包**: `pnpm package`

## 5. 目录结构说明

- `src/main`: Electron 主进程代码 (文件 I/O, 窗口管理).
- `src/renderer`: React 前端代码.
  - `components/Editor.tsx`: CodeMirror 编辑器集成.
  - `components/Preview.tsx`: alphaTab 渲染核心容器.
  - `lib/`: 核心逻辑库 (LSP, Parsers, Theme Managers).
  - `store/`: Zustand store.
  - `workers/`: AlphaTex LSP Worker.
  - `data/`: 静态数据 (命令定义, 和弦库).
