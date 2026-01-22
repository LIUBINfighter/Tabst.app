# 行间指法图（Chord Diagram Above Staff）

## 现状（alphaTab 默认行为）

- **行间和弦名（文字）**：支持。需要在 beat 上使用 `{ch "Am"}`，并开启 `notation.elements.effectChordNames`。
- **行间指法图（格子图）**：不支持。`notation.elements.chordDiagrams` 只控制**曲谱开头**的和弦图列表。

## Tabst 当前能力

- Tabst 目前使用 `@coderline/alphatab`（预编译包），只能通过配置/AlphaTex 控制显示项。
- 因此 **无法仅靠配置** 实现“每个 beat 上方显示完整指法图”。

## 如果必须要行间指法图

- **方案 A（推荐）**：fork/patch alphaTab，把行间效果从 `TextGlyph` 换成 `ChordDiagramGlyph`，并修复 `ChordDiagramGlyph` 在 EffectBarRenderer 下 `width` 被覆盖导致的布局/线条缺失问题。
  - 参考：[`alphaTab #1812`](https://github.com/CoderLine/alphaTab/issues/1812)
- **方案 B**：Tabst 自己做 overlay（在渲染后按 beat 坐标叠加绘制指法图），需要自行处理碰撞、滚动/缩放同步等问题。

