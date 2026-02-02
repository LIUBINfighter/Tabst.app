# Tabst.app 重构报告

## 重构计划

### 目标
1. 拆解超大组件（>500行的文件）
2. 分离纯逻辑与UI逻辑
3. 重构主进程，提取可复用模块
4. 使用Effect-TS重构异步逻辑

---

## Phase 1: 修复类型依赖 ✅

### 问题
- CodeMirror相关类型缺失
- MDX类型缺失
- 部分隐式any类型

### 解决方案
```bash
pnpm add @codemirror/state @codemirror/view @codemirror/language @codemirror/autocomplete @codemirror/lint @lezer/highlight
pnpm add -D @types/mdx
```

### 结果
- 类型检查通过 ✅
- format检查通过 ✅
- lint检查通过 ✅

---

## Phase 2: 组件架构重构

### 当前问题文件

| 文件 | 行数 | 问题 |
|------|------|------|
| Preview.tsx | 1993 | 包含alphaTab API初始化、播放器控制、选区同步、主题切换、错误恢复等所有逻辑 |
| alphatex-selection-sync.ts | 1503 | 包含AST解析、遗留解析器、CodeMirror扩展、高亮逻辑 |
| PrintPreview.tsx | 841 | 打印预览、分页逻辑、字体处理混在一起 |
| PrintTracksPanel.tsx | 778 | 音轨配置面板 |
| Editor.tsx | 706 | CodeMirror初始化、LSP、语言切换 |

### 重构策略

#### 1. Preview.tsx 拆分 (1993行 → 多文件)

**新目录结构：**
```
src/renderer/components/preview/
├── index.tsx                 # Preview组件主入口 (~300行)
├── PreviewToolbar.tsx        # 工具栏组件
├── useAlphaTab.ts            # alphaTab API管理hook
├── usePlaybackControls.ts    # 播放器控制hook
├── useSelectionSync.ts       # 选区同步hook
├── useThemeSync.ts           # 主题同步hook
└── useBarColoring.ts         # 小节着色逻辑hook
```

**提取内容：**
- `findBeatInScore()` → utils/alphatab.ts
- `applyZoom()` → hooks/useAlphaTab.ts
- Bar coloring logic → hooks/useBarColoring.ts
- Playback controls → hooks/usePlaybackControls.ts
- Event listeners → hooks/useAlphaTab.ts

#### 2. alphatex-selection-sync.ts 拆分 (1503行)

**新目录结构：**
```
src/renderer/lib/alphatex/
├── parser/
│   ├── ast-parser.ts         # AST解析器
│   ├── legacy-parser.ts      # 遗留解析器
│   └── index.ts              # 统一导出
├── sync/
│   ├── selection-sync.ts     # 选区同步
│   ├── playback-sync.ts      # 播放同步
│   └── cursor-sync.ts        # 光标同步
└── codemirror/
    ├── highlight-effects.ts  # 高亮效果
    └── extensions.ts         # CodeMirror扩展
```

#### 3. PrintPreview.tsx 拆分 (841行)

**新目录结构：**
```
src/renderer/components/print/
├── index.tsx                 # PrintPreview主入口
├── PrintToolbar.tsx          # 打印工具栏
├── PrintPagination.tsx       # 分页逻辑
├── usePrintFont.ts           # 字体管理hook
└── usePrintSettings.ts       # 打印设置hook
```

#### 4. Editor.tsx 拆分 (706行)

**新目录结构：**
```
src/renderer/components/editor/
├── index.tsx                 # Editor主入口
├── EditorToolbar.tsx         # 编辑器工具栏
├── EmptyState.tsx            # 空状态显示
├── useCodeMirror.ts          # CodeMirror管理hook
├── useLSP.ts                 # LSP客户端hook
└── useFileSync.ts            # 文件同步hook
```

#### 5. Sidebar.tsx 拆分 (451行)

**新目录结构：**
```
src/renderer/components/sidebar/
├── index.tsx                 # Sidebar主入口
├── FileList.tsx              # 文件列表
├── FileItem.tsx              # 单个文件项
├── SidebarToolbar.tsx        # 侧边栏工具栏
└── useFileOperations.ts      # 文件操作hook
```

---

## Phase 3: 主进程重构

### 当前问题
- main.ts (413行) 包含所有IPC处理器
- 没有分层架构

### 新目录结构
```
src/main/
├── index.ts                  # 入口文件
├── window.ts                 # 窗口管理
├── ipc/
│   ├── index.ts              # IPC注册中心
│   ├── file-operations.ts    # 文件操作
│   ├── app-state.ts          # 应用状态
│   └── external-api.ts       # 外部API
└── services/
    ├── file-service.ts       # 文件服务
    └── update-service.ts     # 更新服务
```

---

## Phase 4: Effect-TS集成

### 目标
- 重构主进程的异步操作使用Effect
- 保持React组件干净，不使用Effect
- 重点：文件I/O、IPC通信、错误处理

### 重构文件
```
src/main/
├── effects/
│   ├── file-effects.ts       # 文件操作Effect
│   ├── ipc-effects.ts        # IPC Effect
│   └── error-handling.ts     # 错误处理
```

---

## 质量门检查点

每个Phase完成后执行：
```bash
pnpm format && pnpm check && pnpm build
```

Phase 2完成后打tag: `v0.3.2-refactored`

---

## 预期结果

### 代码质量
- 最大文件行数 < 400行
- 组件职责单一
- 逻辑与UI分离
- 更好的可测试性

### 架构改进
- 清晰的目录结构
- 可复用的hooks
- 模块化的主进程
- Effect-TS错误处理

### 维护性
- 更容易定位问题
- 更容易添加新功能
- 更容易进行单元测试
