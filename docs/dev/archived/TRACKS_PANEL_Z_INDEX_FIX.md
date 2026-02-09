# Tracks Panel 盖住播放器光标的层级修复

## 背景与现象

在预览界面打开「音轨选择面板」（TracksPanel）时，面板会被 alphaTab 播放器光标覆盖：

- 黄色半透明小节光标（bar cursor）覆盖面板内容
- 蓝色竖条节拍光标（beat cursor）穿透面板

这导致面板的交互和可读性受影响。

## 根因分析

- alphaTab 在构建光标容器 `.at-cursors` 时，使用了内联样式将其层级设置为 `z-index: 1000`。
- 证据：在 `public/assets/alphaTab.min.js` 的 `createCursors()` 中可以搜索到：
  - 关键词：`createCursors`、`at-cursors`、`zIndex="1000"`
  - 该容器作为光标父级，覆盖其下所有光标元素；即使子元素的 `z-index` 值较小，父容器的 `z-index: 1000` 仍会使整体处于非常高的层级。
- 我们的 TracksPanel 初始为 `z-30`（后来升到 `z-50`），在同一堆叠上下文下仍低于 `z-index: 1000` 的光标容器。

补充：我们在 2026-02 暂时关闭了 Preview 组件里的「自定义播放器光标」DOM（保留代码但注释关闭），但 alphaTab 自带的光标仍然存在且层级更高。

## 修复方案

将 TracksPanel 的层级提升到显式高于 `1000`，采用 Tailwind 的任意值语法：

- 文件： [src/renderer/components/TracksPanel.tsx](../../src/renderer/components/TracksPanel.tsx)
- 变更：

```diff
- <div className="... z-50">
+ <div className="... z-[2001]">
```

选择 `2001` 的原因：

- 明确高于 alphaTab 的 `1000`，避免未来把其它浮层也提到 `1000+` 后再次冲突
- 留出一定增长空间，避免与可能的打印预览、对话框等浮层相互竞争

## 验证步骤

1. 启动应用，打开任意乐谱，在 Preview 里开始播放以确保光标出现
2. 打开 TracksPanel（音轨选择面板）
3. 面板应完整覆盖所有光标与乐谱元素，交互正常、无被遮挡现象

若需进一步确认：

- 在开发者工具中选中 `.at-cursors` 节点，查看其 `z-index: 1000` 内联样式
- 选中音轨面板的根 div，确认计算后的 `z-index: 2001`

## 相关改动与注意事项

- 暂时关闭了 Preview 中自定义播放器光标的 DOM 与位移动画逻辑（仅注释，无删除），避免与 alphaTab 光标产生重复视觉；需要时可随时开启。
- 未修改 `alphaTab.min.js`，因为第三方库的内联样式由库控制；通过提高我们的面板层级即可稳定覆盖。
- 若将来有其它浮层（例如打印设置、导出弹窗等）也需要覆盖光标，建议统一采用 `z-[2001]` 或建立统一层级约定表以避免冲突。

## 结论

问题的根因是 alphaTab 光标容器使用了内联 `z-index: 1000`。通过将 TracksPanel 的层级提升到 `z-[2001]`，已确保音轨面板能稳定盖住所有播放器光标，恢复交互与可读性。
