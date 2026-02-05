# Renderer 重构计划与进度

本文档记录 Renderer 层重构的优先级、步骤与实施状态。

## 一、优先级与顺序

| 顺序 | 模块 | 目标 | 状态 |
|------|------|------|------|
| 1 | Preview.tsx | 接入/复用 hooks 与 lib，拆分子 hooks 与 UI | 进行中（子 hook 已完成） |
| 2 | alphatex-selection-sync | 按职责拆成 3–4 个模块 | ✅ 完成 |
| 3 | GlobalBottomBar | 按模式拆分或抽 useBottomBarContent | ✅ 完成 |
| 4 | PrintPreview / PrintTracksPanel | 统一 Staff 配置，拆 hooks 与子组件 | 进行中（Staff 类型已统一） |
| 5 | Editor / Sidebar | hooks 与 lib 抽离 | ✅ 完成 |

## 二、已实施项

### 2.1 Lib 抽离（Preview 相关）

- **alphatab-beat-utils.ts**：`findBeatInScore(score, barIndex, beatIndex)`，供 Preview 与选区/播放同步使用。
- **alphatab-bar-highlight.ts**：小节高亮与颜色恢复逻辑（`clearBarNumberColor`、`safeSetColor`、`sanitizeAllBarStyles`、`applyThemeColorsToPreviousBars`、`applyEditorBarNumberColor`），依赖 `themeManager` 与 alphaTab 类型。

### 2.2 alphatex-selection-sync 拆分

- **alphatex-parse-positions.ts**：AST/后备解析、`ParseResult`/`BeatCodePosition`/`CodeRange`、`parseBeatPositions`、`offsetToLineCol`/`lineColToOffset`、`getBarRanges`。
- **alphatex-cursor-tracking.ts**：`createCursorTrackingExtension`，依赖 `findBeatAtPosition`。
- **alphatex-playback-sync.ts**：`createPlaybackSyncExtension`、`mapPlaybackToCodeRange`、`updateEditorPlaybackHighlight`、播放/小节高亮 StateField 与滚动辅助。
- **alphatex-selection-sync.ts**：保留 `mapSelectionToCodeRange`、`findBeatAtPosition`、`createSelectionSyncExtension`、`updateEditorSelectionHighlight` 及选区 StateField，并 re-export 上述模块以保持现有导入兼容。

### 2.3 GlobalBottomBar

- 按模式拆分为：`TutorialBottomBar`、`SettingsBottomBar`、`EditorBottomBar`；主组件只负责布局与模式选择。

### 2.4 Preview

- 使用 `lib/alphatab-beat-utils` 的 `findBeatInScore`。
- 使用 `lib/alphatab-bar-highlight` 的小节着色与恢复逻辑。
- 抽出 **PreviewToolbar.tsx**：TopBar 上的导出（MIDI/WAV/GP）、打印按钮。

### 2.5 Editor

- **lib/editor-extensions.ts**：`createThemeExtension`、`createAlphaTexExtensions`。
- **hooks/useEditorTheme.ts**：主题 Compartment 与 dark 模式观察。
- **hooks/useEditorLSP.ts**：LSP 客户端与语言扩展加载。

### 2.6 Sidebar

- **hooks/useFileOperations.ts**：`handleOpenFile`、`handleNewFile`、重命名相关。
- **FileTreeItem.tsx**：单文件项 + 重命名。
- **SidebarCommands.tsx** / **SidebarBottomBar**：顶部命令与底部栏（教程、设置）。

### 2.7 Preview 子 hook（本轮完成）

- **hooks/usePreviewBarHighlight.ts**：小节号高亮与主题恢复（已有）。
- **hooks/usePreviewSelectionSync.ts**：编辑器光标 → 曲谱选区/播放范围/播放器光标/滚动。
- **hooks/usePreviewErrorRecovery.ts**：解析超时检测、上次有效乐谱保存与恢复（`scheduleTexTimeout`、`onError`、`onScoreLoadedMatch` 等）。

### 2.8 Staff 配置统一（本轮完成）

- **lib/staff-config.ts**：新增 `StaffConfigWithIndex`（`{ staffIndex } & Required<StaffDisplayOptions>`），供 PrintTracksPanel 与主预览统一类型。
- **PrintTracksPanel**：谱表配置改为使用 `StaffConfigWithIndex`，与 `StaffDisplayOptions` 对齐。

## 三、待办（后续可选）

1. **Preview 完全接入 useAlphaTab**：由当前自管 init/theme/content 改为使用 useAlphaTab 提供 containerRef/scrollHostRef/apiRef、初始化与主题重建，通过 onApiReady 挂载播放/选区/光标等监听（工作量大，可选）。
2. **PrintPreview**：抽取 usePrintAlphaTab、usePrintPagination 等 hook，拆分子 UI 组件（可选）。

## 四、质量门

每次重构后运行：

```bash
pnpm format
pnpm check
```
