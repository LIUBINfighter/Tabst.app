# Renderer 重构计划与进度

本文档记录 Renderer 层重构的优先级、步骤与实施状态。

## 一、优先级与顺序

| 顺序 | 模块 | 目标 | 状态 |
|------|------|------|------|
| 1 | Preview.tsx | 接入/复用 hooks 与 lib，拆分子 hooks 与 UI | 进行中 |
| 2 | alphatex-selection-sync | 按职责拆成 3–4 个模块 | 进行中 |
| 3 | GlobalBottomBar | 按模式拆分或抽 useBottomBarContent | 待办 |
| 4 | PrintPreview / PrintTracksPanel | 统一 Staff 配置，拆 hooks 与子组件 | 待办 |
| 5 | Editor / Sidebar | hooks 与 lib 抽离 | 待办 |

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

## 三、后续可做（未在本轮实施）

- Preview 完全接入 `useAlphaTab`（需 hook 暴露 `apiRef` 并统一初始化/主题/错误恢复）。
- `usePreviewBarHighlight`、`usePreviewSelectionSync`、`usePreviewErrorRecovery` 等子 hook 进一步拆分。
- PrintPreview/PrintTracksPanel 统一 Staff 配置与 hooks。
- Editor：`useEditorTheme`、`useEditorLSP`，扩展迁移到 `lib/editor-extensions.ts`。
- Sidebar：`useFileOperations`、`FileTreeItem`、`SidebarCommands`。

## 四、质量门

每次重构后运行：

```bash
pnpm format
pnpm check
```
