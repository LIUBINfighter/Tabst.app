# Selection API 编辑器光标同步问题修复

**日期**: 2024  
**问题**: 编辑器光标移动时，蓝色选区高亮（`scoreSelection`）持续存在，无法正确清除  
**状态**: ✅ 已修复

---

## 1. 问题描述

### 1.1 现象

当编辑器光标移动到新位置时：
1. ✅ 小节号红色高亮正常更新
2. ✅ 播放器光标位置正常同步
3. ✅ 播放器选区高亮正常更新
4. ❌ **编辑器中的蓝色选区高亮（`scoreSelection`）持续存在，无法清除**

### 1.2 影响

- 用户手动选择的选区（蓝色高亮）在编辑器光标移动后仍然显示
- 视觉上造成混淆，无法区分当前编辑器光标位置和之前的选区
- 影响用户体验

---

## 2. 技术背景

### 2.1 Selection API 工作流程

```
编辑器光标移动
  ↓
Preview.tsx: useEffect([editorCursor])
  ↓
1. clearScoreSelection()          // 清除旧的选区
2. highlightPlaybackRange()        // 设置新的高亮范围
  ↓
触发 playbackRangeHighlightChanged 事件
  ↓
事件处理函数中：
  - 检查 isHighlightFromEditorCursorRef
  - 如果是编辑器触发 → 跳过设置 scoreSelection
  - 如果是用户手动选择 → 设置 scoreSelection
  ↓
Editor.tsx: useEffect([_scoreSelection])
  ↓
updateEditorSelectionHighlight()  // 更新编辑器蓝色高亮
```

### 2.2 关键代码位置

- **Preview.tsx**: `useEffect(() => { /* editorCursor sync */ }, [editorCursor])`
- **Preview.tsx**: `api.playbackRangeHighlightChanged?.on((e) => { /* event handler */ })`
- **Editor.tsx**: `useEffect(() => { /* scoreSelection highlight */ }, [_scoreSelection])`
- **alphatex-selection-sync.ts**: `updateEditorSelectionHighlight()`

---

## 3. Debug 过程

### 3.1 初始假设

最初认为问题在于：
1. 清除选区的时机不对
2. 事件处理函数中的标志检查有问题

### 3.2 添加调试日志

在关键位置添加了详细的调试日志：

```typescript
// Preview.tsx - 编辑器光标同步
console.debug("[Preview] Clearing scoreSelection before applying new highlight");
console.debug("[Preview] Setting isHighlightFromEditorCursorRef to true");
console.debug("[Preview] Calling highlightPlaybackRange");

// Preview.tsx - 事件处理
console.debug("[Preview] playbackRangeHighlightChanged event fired:", {
  isHighlightFromEditorCursor: isHighlightFromEditorCursorRef.current,
  currentScoreSelection: useAppStore.getState().scoreSelection,
});

// Editor.tsx - 选区高亮更新
console.debug("[Editor] scoreSelection changed, updating highlight");
```

### 3.3 关键日志分析

从日志中发现了问题的根源：

```
[Preview] Setting isHighlightFromEditorCursorRef to true
[Preview] Calling highlightPlaybackRange for bar 1
[Preview] playbackRangeHighlightChanged event fired: {isHighlightFromEditorCursor: true}  ✅ 第一次事件，正确跳过
[Preview] After highlightPlaybackRange, scoreSelection: null
[Preview] Resetting isHighlightFromEditorCursorRef to false
[Preview] playbackRangeHighlightChanged event fired: {isHighlightFromEditorCursor: false} ❌ 第二次事件，标志已重置！
[Preview] Selection changed (user selection): Bar 1:0 -> Bar 1:7  ❌ 误判为用户选择
[Editor] scoreSelection changed, updating highlight  ❌ 设置了蓝色高亮
```

**问题根源**：
- `highlightPlaybackRange()` 会触发**多次** `playbackRangeHighlightChanged` 事件
- 第一次事件触发时，`isHighlightFromEditorCursorRef.current` 为 `true`，正确跳过
- 但后续事件（可能是渲染完成后触发）触发时，标志已经被重置为 `false`
- 导致最后一次事件被误判为"用户手动选择"，设置了 `scoreSelection`

---

## 4. 最终解决方案

### 4.1 双重检查机制

实现了双重检查机制，不仅检查标志位，还检查选区是否匹配最后一次编辑器光标选区：

```typescript
// 记录最后一次由编辑器光标触发的选区信息
const lastEditorCursorSelectionRef = useRef<{
  startBarIndex: number;
  endBarIndex: number;
} | null>(null);

// 在调用 highlightPlaybackRange 前记录
lastEditorCursorSelectionRef.current = {
  startBarIndex: bar.index,
  endBarIndex: bar.index,
};

// 在事件处理中双重检查
const isFromEditorCursor =
  isHighlightFromEditorCursorRef.current ||
  (lastEditorCursorSelectionRef.current &&
   startBarIndex === lastEditorCursorSelectionRef.current.startBarIndex &&
   endBarIndex === lastEditorCursorSelectionRef.current.endBarIndex);
```

### 4.2 延长标志保持时间

将标志重置的延迟从 `requestAnimationFrame + setTimeout(0)` 改为 `setTimeout(200)`，给 alphaTab 的渲染和事件触发留出足够时间：

```typescript
// 旧代码
requestAnimationFrame(() => {
  setTimeout(() => {
    isHighlightFromEditorCursorRef.current = false;
  }, 0);
});

// 新代码
setTimeout(() => {
  isHighlightFromEditorCursorRef.current = false;
  setTimeout(() => {
    lastEditorCursorSelectionRef.current = null;
  }, 100);
}, 200);
```

### 4.3 清除选区的时机

确保在获取到新光标所在小节之后，立即清除旧的选区高亮：

```typescript
// 从当前乐谱中查找对应的 Beat
const beat = findBeatInScore(score, editorCursor.barIndex, editorCursor.beatIndex);

if (beat) {
  // 🆕 在获取到新光标所在小节之后，立即清除旧的选区高亮
  // 这样可以在应用新样式和设置新选区之前清除旧状态
  useAppStore.getState().clearScoreSelection();
  
  // 然后应用新样式、设置播放器光标、设置新选区...
}
```

---

## 5. 完整实现

### 5.1 关键代码片段

**Preview.tsx - 编辑器光标同步**：

```typescript
// 1. 获取新光标所在小节
const beat = findBeatInScore(score, editorCursor.barIndex, editorCursor.beatIndex);

if (beat) {
  // 2. 立即清除旧的选区高亮
  useAppStore.getState().clearScoreSelection();
  
  // 3. 应用新小节曲谱样式
  applyEditorBarNumberColor(api, editorCursor.barIndex);
  
  // 4. 同步播放器光标位置
  // ...
  
  // 5. 设置新的光标选区
  if (typeof api.highlightPlaybackRange === "function") {
    // 设置标志
    isHighlightFromEditorCursorRef.current = true;
    
    // 记录选区信息
    lastEditorCursorSelectionRef.current = {
      startBarIndex: bar.index,
      endBarIndex: bar.index,
    };
    
    // 调用 API（会触发事件）
    api.highlightPlaybackRange(firstBeatInBar, lastBeatInBar);
    
    // 延迟重置标志
    setTimeout(() => {
      isHighlightFromEditorCursorRef.current = false;
      setTimeout(() => {
        lastEditorCursorSelectionRef.current = null;
      }, 100);
    }, 200);
  }
}
```

**Preview.tsx - 事件处理**：

```typescript
api.playbackRangeHighlightChanged?.on((e) => {
  const { setScoreSelection, clearScoreSelection } = useAppStore.getState();
  
  if (!e.startBeat || !e.endBeat) {
    clearScoreSelection();
    return;
  }
  
  const startBarIndex = e.startBeat.voice?.bar?.index ?? 0;
  const endBarIndex = e.endBeat.voice?.bar?.index ?? startBarIndex;
  
  // 🆕 双重检查：标志位 + 选区匹配
  const isFromEditorCursor =
    isHighlightFromEditorCursorRef.current ||
    (lastEditorCursorSelectionRef.current &&
     startBarIndex === lastEditorCursorSelectionRef.current.startBarIndex &&
     endBarIndex === lastEditorCursorSelectionRef.current.endBarIndex);
  
  if (isFromEditorCursor) {
    // 清除选区，跳过设置
    clearScoreSelection();
    return;
  }
  
  // 用户手动选择，设置 scoreSelection
  setScoreSelection({ ... });
});
```

### 5.2 清除选区的其他时机

除了编辑器光标移动时清除，还在以下时机清除：

1. **内容变化时**（文件切换）：
   ```typescript
   useEffect(() => {
     useAppStore.getState().clearScoreSelection();
     // ... 更新内容
   }, [content]);
   ```

2. **播放开始时**：
   ```typescript
   play: () => {
     useAppStore.getState().clearScoreSelection();
     // ... 开始播放
   }
   ```

3. **点击乐谱时**：
   ```typescript
   api.beatMouseDown?.on(() => {
     useAppStore.getState().clearScoreSelection();
     // ... 更新光标位置
   });
   ```

4. **编辑器光标在无效位置时**：
   ```typescript
   if (!beat) {
     useAppStore.getState().clearScoreSelection();
   }
   ```

---

## 6. 关键技术要点

### 6.1 alphaTab Selection API 特性

- `highlightPlaybackRange()` 会触发 `playbackRangeHighlightChanged` 事件
- 事件可能触发**多次**（包括渲染完成后）
- 事件是**异步**的，可能在调用 API 后延迟触发

### 6.2 React Refs 的使用

使用 `useRef` 存储标志和选区信息，避免在事件处理中访问过期的状态：

```typescript
const isHighlightFromEditorCursorRef = useRef(false);
const lastEditorCursorSelectionRef = useRef<{...} | null>(null);
```

### 6.3 时序控制

- 标志设置：在调用 API **之前**设置
- 标志重置：使用 `setTimeout(200)` 延迟重置，给事件处理足够时间
- 选区记录：在标志重置后 100ms 再清除，确保所有事件都能检查到

### 6.4 双重检查机制

即使标志已重置，通过检查选区是否匹配最后一次编辑器光标选区，仍能正确识别：

```typescript
const isFromEditorCursor =
  isHighlightFromEditorCursorRef.current ||  // 方式1：标志位
  (lastEditorCursorSelectionRef.current &&    // 方式2：选区匹配
   startBarIndex === lastEditorCursorSelectionRef.current.startBarIndex &&
   endBarIndex === lastEditorCursorSelectionRef.current.endBarIndex);
```

---

## 7. 测试验证

### 7.1 测试场景

1. ✅ 编辑器光标移动到新位置 → 蓝色选区被清除
2. ✅ 编辑器光标移动到无效位置 → 蓝色选区被清除
3. ✅ 文件切换 → 蓝色选区被清除
4. ✅ 播放开始 → 蓝色选区被清除
5. ✅ 点击乐谱 → 蓝色选区被清除
6. ✅ 用户手动选择 → 蓝色选区正常显示
7. ✅ 多次事件触发 → 蓝色选区不会被误设置

### 7.2 验证方法

通过浏览器控制台的调试日志验证：
- 检查 `playbackRangeHighlightChanged` 事件的触发次数
- 检查 `isHighlightFromEditorCursor` 标志的状态
- 检查 `scoreSelection` 的值变化
- 检查 `updateEditorSelectionHighlight` 的调用参数

---

## 8. 相关文档

- `docs/dev/SelectionAPI.md` - alphaTab Selection API 迁移指南
- `docs/dev/SELECTION_SYNC_IMPLEMENTATION.md` - 选区同步实现细节
- `docs/dev/BAR_NUMBER_HIGHLIGHT_FIX.md` - 小节号高亮修复

---

## 9. 总结

### 9.1 问题根源

`highlightPlaybackRange()` 会触发多次 `playbackRangeHighlightChanged` 事件，最后一次事件触发时标志已重置，导致误判为用户手动选择。

### 9.2 解决方案

1. **双重检查机制**：标志位 + 选区匹配
2. **延长标志保持时间**：从 `requestAnimationFrame + setTimeout(0)` 改为 `setTimeout(200)`
3. **记录选区信息**：用于在标志重置后仍能识别编辑器触发的选区

### 9.3 关键经验

- alphaTab 的事件可能触发多次，需要考虑时序问题
- 使用双重检查机制可以提高可靠性
- 调试日志是定位异步时序问题的关键工具

---

**修复完成日期**: 2024  
**修复人员**: AI Assistant  
**代码位置**: `src/renderer/components/Preview.tsx`
