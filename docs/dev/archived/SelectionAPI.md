# 🚀 alphaTab 1.8.0 迁移指南：Selection API

**背景**：在 1.8.0 版本中，alphaTab 终于把选区（Selection）逻辑标准化了。
**核心变更**：我们不再需要强转 `any` 去访问 `_selectionStart` 或 `_cursorSelectRange` 等私有属性。现在有了官方的事件驱动 API。

### 1. 核心逻辑变动 (TL;DR)

| 操作              | 旧方式 (HACK) ❌                   | 新方式 (API) ✅                                   |
| ----------------- | ---------------------------------- | ------------------------------------------------- |
| **监听选区变化**  | 劫持/重写 `api._cursorSelectRange` | 监听 `api.playbackRangeHighlightChanged`          |
| **更新高亮区域**  | 修改 `_selectionStart` 属性        | 调用 `api.highlightPlaybackRange(start, end)`     |
| **确认/提交选区** | 手动计算 Range                     | 调用 `api.applyPlaybackRangeFromHighlight()`      |
| **获取坐标**      | 手动计算 DOM 偏移                  | 直接从 Event 对象拿 `realBounds` / `visualBounds` |

---

### 2. 代码实现模式

#### Step A: 渲染手柄 (View Layer)

不要再去轮询或者 Hook 内部方法，直接订阅事件来更新 UI。

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

  // 注意：Y轴建议使用 barBounds (小节边界) 以保证视觉整洁
  const topY = e.startBeatBounds.barBounds.masterBarBounds.visualBounds.y;

  // 3. 更新你的 DOM (Vue/React Ref)
  updateSelectionHandles(startX, endX, topY);
});
```

#### Step B: 交互逻辑 (Controller Layer)

当用户拖拽手柄时，调用新 API 更新引擎状态。

```typescript
// 伪代码：在 mousemove 事件中
function onHandleDrag(e, type: "start" | "end") {
  // 1. 通过坐标获取鼠标下的 Beat (API 提供)
  const hoverBeat = getBeatAtPos(e.x, e.y);
  if (!hoverBeat) return;

  // 2. 告诉引擎：临时高亮这个范围 (尚未提交)
  if (type === "start") {
    // 保持当前的结束点，更新开始点
    api.highlightPlaybackRange(hoverBeat, currentEndBeat);
  } else {
    // 保持当前的开始点，更新结束点
    api.highlightPlaybackRange(currentStartBeat, hoverBeat);
  }
}

// 伪代码：在 mouseup 事件中
function onDragEnd() {
  // 3. 提交更改：将当前的高亮状态应用为正式的播放范围
  api.applyPlaybackRangeFromHighlight();
}
```

### 3. 给 Alphatex 编辑器的特别提示

- **双向绑定更简单了**：
  `e.startBeat` 和 `e.endBeat` 现在是标准的 `Beat` 对象。
  你可以直接读取 `beat.index` 或 `beat.startTick`，用来反向定位编辑器里的 AlphaTex 代码行数，实现 **"乐谱选中 -> 代码高亮"**。
- **缩放适配**：
  底层 `Bounds` 类新增了 `scaleWith()` 方法。虽然 API 返回的 `realBounds` 通常已经处理了坐标，但如果你在做 Canvas 自定义绘制，留意一下这个缩放系数。

---

**参考文件**：
具体的 DOM 操作细节，可以直接 Copy 官方最新的参考实现：
`packages/playground/select-handles.ts` (PR #2418)

```ts
import type * as alphaTab from "@coderline/alphatab";

interface HandleDragState {
  isDragging: "start" | "end" | undefined;
}

function createSelectionHandles(element: HTMLElement): {
  startHandle: HTMLElement;
  endHandle: HTMLElement;
} {
  const handleWrapper = document.createElement("div");
  handleWrapper.classList.add("at-selection-handles");
  element.insertBefore(handleWrapper, element.querySelector("at-surface"));

  const startHandle = document.createElement("div");
  startHandle.classList.add("at-selection-handle", "at-selection-handle-start");
  handleWrapper.appendChild(startHandle);

  const endHandle = document.createElement("div");
  endHandle.classList.add("at-selection-handle", "at-selection-handle-end");
  handleWrapper.appendChild(endHandle);

  return { startHandle, endHandle };
}

function setupHandleDrag(
  element: HTMLElement,
  handle: HTMLElement,
  dragState: HandleDragState,
  type: HandleDragState["isDragging"],
  onMove: (e: MouseEvent) => void,
  onDragEnd: (e: MouseEvent) => void
) {
  handle.addEventListener(
    "mousedown",
    (e) => {
      e.preventDefault();
      element.classList.add("at-selection-handle-drag");
      handle.classList.add("at-selection-handle-drag");
      dragState.isDragging = type;
    },
    false
  );
  document.addEventListener(
    "mousemove",
    (e) => {
      if (dragState.isDragging !== type) {
        return;
      }
      e.preventDefault();
      onMove(e);
    },
    true
  );
  document.addEventListener(
    "mouseup",
    (e) => {
      if (dragState.isDragging !== type) {
        return;
      }
      e.preventDefault();
      dragState.isDragging = undefined;
      element.classList.remove("at-selection-handle-drag");
      handle.classList.remove("at-selection-handle-drag");
      onDragEnd(e);
    },
    true
  );
}

function getRelativePosition(
  parent: HTMLElement,
  e: MouseEvent
): { relX: number; relY: number } {
  const parentPos = parent.getBoundingClientRect();
  const parentLeft: number =
    parentPos.left + parent.ownerDocument!.defaultView!.pageXOffset;
  const parentTop: number =
    parentPos.top + parent.ownerDocument!.defaultView!.pageYOffset;

  const relX = e.pageX - parentLeft;
  const relY = e.pageY - parentTop;

  return { relX, relY };
}

function getBeatFromEvent(
  element: HTMLElement,
  api: alphaTab.AlphaTabApi,
  e: MouseEvent
): alphaTab.model.Beat | undefined {
  const { relX, relY } = getRelativePosition(element, e);
  const beat = api.boundsLookup?.getBeatAtPos(relX, relY);
  if (!beat) {
    return undefined;
  }

  const bounds = api.boundsLookup!.findBeat(beat);
  if (!bounds) {
    return undefined;
  }

  // only snap to beat beat if we are over the whitespace after the beat
  const visualBoundsEnd = bounds.visualBounds.x + bounds.visualBounds.w;
  const realBoundsEnd = bounds.realBounds.x + bounds.realBounds.w;
  if (relX < visualBoundsEnd || relX > realBoundsEnd) {
    return undefined;
  }

  return beat;
}

export function setupSelectionHandles(
  element: HTMLElement,
  api: alphaTab.AlphaTabApi
) {
  const { startHandle, endHandle } = createSelectionHandles(element);

  // listen to selection range changes to place handles
  let currentHighlight: alphaTab.PlaybackHighlightChangeEventArgs | undefined;
  api.playbackRangeHighlightChanged.on((e) => {
    currentHighlight = e;
    // no selection
    if (!e.startBeat || !e.endBeat) {
      startHandle.classList.remove("active");
      endHandle.classList.remove("active");
      return;
    }

    startHandle.classList.add("active");
    startHandle.style.left = `${e.startBeatBounds!.realBounds.x}px`;
    startHandle.style.top = `${e.startBeatBounds!.barBounds.masterBarBounds.visualBounds.y}px`;
    startHandle.style.height = `${e.startBeatBounds!.barBounds.masterBarBounds.visualBounds.h}px`;

    endHandle.classList.add("active");
    endHandle.style.left = `${e.endBeatBounds!.realBounds.x + e.endBeatBounds!.realBounds.w}px`;
    endHandle.style.top = `${e.endBeatBounds!.barBounds.masterBarBounds.visualBounds.y}px`;
    endHandle.style.height = `${e.endBeatBounds!.barBounds.masterBarBounds.visualBounds.h}px`;
  });

  // setup dragging of handles
  const dragState: HandleDragState = { isDragging: undefined };

  setupHandleDrag(
    element,
    startHandle,
    dragState,
    "start",
    (e) => {
      if (!currentHighlight?.startBeat) {
        return;
      }

      const beat = getBeatFromEvent(element, api, e);
      if (!beat) {
        return;
      }

      api.highlightPlaybackRange(beat, currentHighlight.endBeat!);
    },
    () => {
      api.applyPlaybackRangeFromHighlight();
    }
  );

  setupHandleDrag(
    element,
    endHandle,
    dragState,
    "end",
    (e) => {
      if (!currentHighlight?.startBeat) {
        return;
      }

      const beat = getBeatFromEvent(element, api, e);
      if (!beat) {
        return;
      }

      api.highlightPlaybackRange(currentHighlight!.startBeat!, beat);
    },
    () => {
      api.applyPlaybackRangeFromHighlight();
    }
  );
}
```
