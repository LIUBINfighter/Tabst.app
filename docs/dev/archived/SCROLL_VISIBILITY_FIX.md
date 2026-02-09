# CodeMirror 滚动可见性检测修复

## 问题描述

在实现编辑器与乐谱的双向高亮同步功能时，发现当两个高亮位置相距较远时，自动滚动功能会失效。

### 复现步骤

1. 在编辑器中编辑一个较长的 AlphaTex 文件（多个小节）
2. 将编辑器滚动到文件顶部
3. 在乐谱预览中点击文件底部的某个音符
4. **预期行为**：编辑器应该滚动到对应小节并高亮
5. **实际行为**：高亮不出现，编辑器没有滚动

## 根本原因分析

问题出在 `scrollToPlaybackHighlight` 和 `scrollToBarHighlight` 两个函数中使用了 `coordsAtPos()` 来检测目标位置是否在可视区域内。

### 原始代码逻辑

```typescript
// 获取高亮位置的屏幕坐标
const coords = view.coordsAtPos(codeRange.from);
if (!coords) return;  // ❌ 问题在这里！

// 获取编辑器可视区域
const scrollDOM = view.scrollDOM;
const editorRect = scrollDOM.getBoundingClientRect();

// 检查高亮是否在可视区域内
const isAboveView = coords.top < editorRect.top;
const isBelowView = coords.bottom > editorRect.bottom;

if (isAboveView || isBelowView) {
    view.dispatch({
        effects: EditorView.scrollIntoView(targetPos, { ... }),
    });
}
```

### 问题分析

CodeMirror 6 使用**虚拟滚动**（virtual scrolling）来优化性能：

- 只有当前视口附近的内容会被实际渲染到 DOM 中
- 距离视口较远的内容不会被渲染，只保留占位高度

`view.coordsAtPos(pos)` 方法：

- 返回给定字符位置的**屏幕坐标**（像素坐标）
- **前提条件**：该位置必须已经被渲染到 DOM 中
- 如果位置未被渲染，返回 `null`

这就是问题所在：

```
当前视口: [1000, 2000] 字符位置
目标位置: 50000 字符位置

coordsAtPos(50000) → null  // 因为 50000 位置尚未渲染
if (!coords) return;       // 直接返回，不执行滚动！
```

## 解决方案

使用 `view.visibleRanges` 代替 `coordsAtPos` 来检测可见性。

### visibleRanges vs coordsAtPos

| 特性       | `coordsAtPos()` | `visibleRanges` |
| ---------- | --------------- | --------------- |
| 返回值     | 屏幕坐标 (px)   | 字符位置范围    |
| 未渲染位置 | 返回 `null`     | 正常工作        |
| 用途       | 精确的像素定位  | 检测可见性      |
| 性能       | 需要 DOM 查询   | 直接读取属性    |

### 修复后的代码

```typescript
const targetPos = codeRange.from;

// 🆕 使用 visibleRanges 检查位置是否在可视区域内
// 这比 coordsAtPos 更可靠，因为 coordsAtPos 对于未渲染的位置会返回 null
const { visibleRanges } = view;
const isVisible = visibleRanges.some(
  (range) => targetPos >= range.from && targetPos <= range.to
);

// 如果不在可视区域内，执行滚动
if (!isVisible) {
  view.dispatch({
    effects: EditorView.scrollIntoView(targetPos, {
      y: "center", // 或 "start"
      yMargin: 50,
    }),
  });
}
```

### visibleRanges 的结构

```typescript
// view.visibleRanges 是一个数组，每个元素表示一个连续的可见区域
interface VisibleRange {
  from: number; // 起始字符位置
  to: number; // 结束字符位置
}

// 示例
view.visibleRanges = [
  { from: 1000, to: 2500 }, // 第一个可见区域
  // 可能有多个不连续的可见区域（如折叠代码的情况）
];
```

## 修改的文件

### `src/renderer/lib/alphatex-selection-sync.ts`

修改了两个函数：

1. **`scrollToPlaybackHighlight`** - 播放时绿色高亮的滚动
2. **`scrollToBarHighlight`** - 点击乐谱时黄色小节高亮的滚动

两个函数都应用了相同的修复模式。

## 经验总结

### 何时使用 coordsAtPos

✅ 适合的场景：

- 需要精确的像素坐标（如定位弹出菜单）
- 目标位置**确定**在当前视口内
- 需要与 DOM 元素交互

### 何时使用 visibleRanges

✅ 适合的场景：

- 检测某个位置是否可见
- 目标位置可能距离当前视口很远
- 决定是否需要滚动
- 性能敏感的检查

### CodeMirror 虚拟滚动的注意事项

1. **不要假设所有内容都已渲染**
2. **DOM 查询方法可能返回 null**
3. **使用字符位置而非 DOM 元素来定位**
4. **scrollIntoView 会自动处理未渲染内容的滚动**

## 相关链接

- [CodeMirror 6 - EditorView API](https://codemirror.net/docs/ref/#view.EditorView)
- [CodeMirror 6 - Viewport](https://codemirror.net/docs/ref/#view.EditorView.viewport)
- [CodeMirror 6 - visibleRanges](https://codemirror.net/docs/ref/#view.EditorView.visibleRanges)

## 修复日期

2026-01-16
