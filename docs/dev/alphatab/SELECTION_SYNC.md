# 选区同步技术文档

## alphaTab 1.8.0 Selection API 迁移指南

**背景**：在 1.8.0 版本中，alphaTab 标准化了选区（Selection）逻辑。我们不再需要强转 `any` 去访问 `_selectionStart` 或 `_cursorSelectRange` 等私有属性。现在有了官方的事件驱动 API。

### 核心逻辑变动

| 操作              | 旧方式 (HACK) ❌                   | 新方式 (API) ✅                                   |
| ----------------- | ---------------------------------- | ------------------------------------------------- |
| **监听选区变化**  | 劫持/重写 `api._cursorSelectRange` | 监听 `api.playbackRangeHighlightChanged`          |
| **更新高亮区域**  | 修改 `_selectionStart` 属性        | 调用 `api.highlightPlaybackRange(start, end)`     |
| **确认/提交选区** | 手动计算 Range                     | 调用 `api.applyPlaybackRangeFromHighlight()`      |
| **获取坐标**      | 手动计算 DOM 偏移                  | 直接从 Event 对象拿 `realBounds` / `visualBounds` |

### 代码实现模式

#### Step A: 渲染手柄 (View Layer)

```typescript
// 监听选区高亮变化事件
api.playbackRangeHighlightChanged.on((e) => {
  // 1. 如果没有选区，隐藏手柄
  if (!e.startBeat || !e.endBeat) {
    hideHandles();
    return;
  }

  // 2. 直接获取精准坐标 (无需手动计算缩放)
  const startX = e.startBeatBounds.realBounds.x;
  const endX = e.endBeatBounds.realBounds.x + e.endBeatBounds.realBounds.w;
  const topY = e.startBeatBounds.barBounds.masterBarBounds.visualBounds.y;

  // 3. 更新 DOM
  updateSelectionHandles(startX, endX, topY);
});
```

#### Step B: 交互逻辑 (Controller Layer)

```typescript
// 拖拽手柄时
function onHandleDrag(e, type: "start" | "end") {
  const hoverBeat = getBeatAtPos(e.x, e.y);
  if (!hoverBeat) return;

  if (type === "start") {
    api.highlightPlaybackRange(hoverBeat, currentEndBeat);
  } else {
    api.highlightPlaybackRange(currentStartBeat, hoverBeat);
  }
}

// 拖拽结束时
function onDragEnd() {
  api.applyPlaybackRangeFromHighlight();
}
```

---

## 选区同步架构设计

### 目标

实现 alphaTab 乐谱与 CodeMirror 编辑器之间的**双向选区同步**：

1. **乐谱 → 编辑器**：在乐谱上选择音符/小节时，编辑器中对应的 AlphaTex 代码高亮
2. **编辑器 → 乐谱**：点击编辑器代码时，乐谱滚动并高亮到对应位置
3. **播放跟随高亮**：播放时，编辑器实时高亮当前播放的音符（绿色）

### 架构图

```
┌─────────────────────────────────────────────────────────────────────┐
│                           Zustand Store                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐      │
│  │ scoreSelection  │  │  editorCursor   │  │  playbackBeat   │      │
│  │ (乐谱选区)      │  │ (编辑器光标)    │  │ (播放位置)      │      │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘      │
└───────────┼────────────────────┼────────────────────┼───────────────┘
            │                    │                    │
            ▼                    ▼                    ▼
┌───────────────────┐  ┌───────────────────┐  ┌───────────────────┐
│    Preview.tsx    │  │    Editor.tsx     │  │    Preview.tsx    │
│ playbackRange     │  │ cursor tracking   │  │ playedBeatChanged │
│ HighlightChanged  │  │ extension         │  │ event             │
└───────────────────┘  └───────────────────┘  └───────────────────┘
            │                    │                    │
            ▼                    ▼                    ▼
┌───────────────────┐  ┌───────────────────┐  ┌───────────────────┐
│  Editor 蓝色高亮   │  │  Preview 高亮     │  │  Editor 绿色高亮   │
│  (选区同步)        │  │  (反向同步)       │  │  (播放跟随)        │
└───────────────────┘  └───────────────────┘  └───────────────────┘
```

---

## AlphaTex 解析器

### 基于 AST 的解析（推荐）

使用 alphaTab 内置的 `AlphaTexParser` 进行 AST 解析：

```typescript
import * as alphaTab from "@coderline/alphatab";

const parser = new alphaTab.importer.alphaTex.AlphaTexParser(text);
parser.mode = alphaTab.importer.alphaTex.AlphaTexParseMode.Full;
const scoreNode = parser.read();

// AST 结构：
// scoreNode.bars -> AlphaTexBarNode[]
//   bar.beats -> AlphaTexBeatNode[]
//     beat.notes / beat.rest
//     beat.start?.offset, beat.end?.offset (精确源码位置)
```

**优势**：
- AST 节点包含精确的 `start.offset` 和 `end.offset`
- 复用 alphaTab 经过大量测试的解析逻辑
- AST 解析失败时自动回退到自定义解析器

### 解析结果结构

```typescript
interface BeatCodePosition {
  barIndex: number;      // 小节索引 (0-based)
  beatIndex: number;     // Beat 在小节内的索引
  startOffset: number;   // 代码起始位置
  endOffset: number;     // 代码结束位置
}
```

---

## 编辑器光标同步问题修复

### 问题描述

当编辑器光标移动到新位置时：
- ✅ 小节号红色高亮正常更新
- ✅ 播放器光标位置正常同步
- ✅ 播放器选区高亮正常更新
- ❌ **编辑器中的蓝色选区高亮（`scoreSelection`）持续存在，无法清除**

### 根本原因

`highlightPlaybackRange()` 会触发**多次** `playbackRangeHighlightChanged` 事件。最后一次事件触发时标志已重置，导致误判为用户手动选择。

### 解决方案：双重检查机制

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

if (isFromEditorCursor) {
  clearScoreSelection();  // 清除选区
  return;
}
```

### 延长标志保持时间

```typescript
// 旧代码（太快重置）
requestAnimationFrame(() => {
  setTimeout(() => {
    isHighlightFromEditorCursorRef.current = false;
  }, 0);
});

// 新代码（延迟 200ms）
setTimeout(() => {
  isHighlightFromEditorCursorRef.current = false;
  setTimeout(() => {
    lastEditorCursorSelectionRef.current = null;
  }, 100);
}, 200);
```

---

## 关键技术要点

### 1. 清除选区的时机

除了编辑器光标移动时清除，还在以下时机清除：

- **内容变化时**（文件切换）
- **播放开始时**
- **点击乐谱时**
- **编辑器光标在无效位置时**

### 2. CodeMirror 并发装饰更新保护

```typescript
function safeDispatch(view: EditorView, effect: StateEffect<...>) {
  if (!view?.dom || !document.contains(view.dom)) return;
  requestAnimationFrame(() => {
    try {
      view.dispatch({ effects: effect });
    } catch (err) {
      console.error("[SelectionSync] Failed to dispatch:", err);
    }
  });
}
```

### 3. 高亮样式

```css
/* 选区高亮 - 蓝色 */
.cm-score-selection-highlight {
  background-color: hsl(var(--primary) / 0.25);
  box-shadow: 0 0 0 1px hsl(var(--primary) / 0.4);
}

/* 播放高亮 - 绿色 */
.cm-playback-highlight {
  background-color: hsl(142 76% 36% / 0.3);
  box-shadow: 0 0 0 1px hsl(142 76% 36% / 0.5);
}
```

---

## 相关文件

| 文件                                          | 职责                                                       |
| --------------------------------------------- | ---------------------------------------------------------- |
| `src/renderer/store/appStore.ts`              | `scoreSelection`, `editorCursor`, `playbackBeat` 状态      |
| `src/renderer/lib/alphatex-selection-sync.ts` | 核心同步逻辑：解析器、高亮扩展、位置映射                   |
| `src/renderer/components/Preview.tsx`         | 监听 alphaTab 事件，更新 store                             |
| `src/renderer/components/Editor.tsx`          | 监听 store 变化，更新 CodeMirror 高亮                      |

---

## 测试用例

| 输入                   | 期望 Bar:Beat | 说明                       |
| ---------------------- | ------------- | -------------------------- |
| `0.6 2.5 3.2 \|`       | 0:0, 0:1, 0:2 | 基础音符                   |
| `:8 0.6 2.5 \|`        | 0:0, 0:1      | 时值修饰符被跳过           |
| `(0.1 0.6) 2.5 \|`     | 0:0, 0:1      | 和弦作为整体               |
| `:8(3.2 0.3) 2.5 \|`   | 0:0, 0:1      | 紧凑写法，高亮 `(3.2 0.3)` |
| `r.4 0.6 \|`           | 0:0, 0:1      | 休止符是有效 beat          |

---

## 后续优化方向

1. **性能优化**：对于大型文件，考虑增量解析而非全量解析
2. **更精确的位置映射**：支持 Note 级别（当前是 Beat 级别）
3. **多音轨支持**：当前只处理第一个音轨
4. **错误容错**：解析失败时的优雅降级
