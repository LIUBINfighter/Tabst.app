# 📝 工程日志：编辑器聚焦时禁用播放器与自动滚动

**日期**：2026-01-22  
**分支**：`dev`  
**作者**：GitHub Copilot

---

## 背景

在编写 AlphaTex 的过程中，编辑器内容更新会触发 alphaTab 重新渲染，导致预览区滚动条被强制拉回到顶部（通常回到首小节）。

期望行为：**编辑器输入时不强制滚动预览**，并在编辑器聚焦时禁用播放器（含光标/高亮/交互），避免播放相关逻辑干扰视图稳定性。

---

## 目标

1. **编辑器聚焦时禁用播放器**（核心设置）：通过 `settings.player.enablePlayer` 及相关光标/高亮开关。
2. **编辑器聚焦时禁用自动滚动**：关闭 player 的滚动目标与滚动模式，避免更新曲谱时回到顶部。
3. **失焦后恢复原配置**：恢复之前的滚动元素与滚动模式。

---

## 实现概览

### 1) 新增焦点状态

在全局状态中记录编辑器是否聚焦：

- `editorHasFocus: boolean`
- `setEditorHasFocus(hasFocus: boolean)`

文件：

- src/renderer/store/appStore.ts

### 2) Editor 内部监听焦点

使用 `EditorView.dom` 的 `focusin/focusout` 事件设置 `editorHasFocus`，并在销毁时清理监听。

文件：

- src/renderer/components/Editor.tsx

### 3) Preview 中切换 core/player 设置

当 `editorHasFocus` 变化时：

- 关闭 player：
  - `settings.player.enablePlayer = false`
  - `settings.player.enableCursor = false`
  - `settings.player.enableAnimatedBeatCursor = false`
  - `settings.player.enableElementHighlighting = false`
  - `settings.player.enableUserInteraction = false`
- 禁用滚动：
  - 保存原始 `player.scrollElement` 与 `player.scrollMode`
  - `player.scrollElement = undefined`
  - `player.scrollMode = ScrollMode.Off`
- 调用 `api.updateSettings()` 和 `api.render()` 使设置生效
- 额外处理：停止播放、清理高亮、隐藏自绘光标层

文件：

- src/renderer/components/Preview.tsx

---

## 关键代码片段

### Focus → 禁用 player + 滚动

```ts
settings.player.enablePlayer = false;
settings.player.enableCursor = false;
settings.player.enableAnimatedBeatCursor = false;
settings.player.enableElementHighlighting = false;
settings.player.enableUserInteraction = false;

savedPlayerScrollRef.current = {
  scrollElement: settings.player.scrollElement ?? null,
  scrollMode: settings.player.scrollMode,
};
settings.player.scrollElement = undefined;
settings.player.scrollMode = ScrollMode.Off;

api.updateSettings?.();
api.render?.();
```

### Blur → 恢复滚动配置

```ts
if (savedPlayerScrollRef.current) {
  settings.player.scrollElement =
    savedPlayerScrollRef.current.scrollElement ?? undefined;
  settings.player.scrollMode =
    savedPlayerScrollRef.current.scrollMode ?? settings.player.scrollMode;
  savedPlayerScrollRef.current = null;
}
```

---

## 影响范围

- ✅ 编辑器输入时预览不再跳到顶部
- ✅ 编辑器聚焦时禁用播放器及播放相关交互/光标/高亮
- ✅ 失焦后恢复播放器滚动行为

---

## 相关参考

- alphaTab Player Settings（`enablePlayer`, `scrollMode`, `scrollElement`）
  - https://www.alphatab.net/docs/reference/types/json/playersettingsjson
  - https://www.alphatab.net/docs/reference/settings/player/enableplayer

---

## 备注

- 若未来需要“输入时仍允许播放但不滚动”，可以仅关闭 `player.scrollElement` 与 `scrollMode`，保留 `enablePlayer` 与 `enableCursor`。
- 如果仍出现滚动跳动，可在 `scoreLoaded` 或 `renderFinished` 后强制恢复 `scrollTop`。
