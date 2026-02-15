# 和弦图显示方案

## 行间指法图（Chord Diagram Above Staff）

### 现状（alphaTab 默认行为）

- **行间和弦名（文字）**：支持。需要在 beat 上使用 `{ch "Am"}`，并开启 `notation.elements.effectChordNames`。
- **行间指法图（格子图）**：不支持。`notation.elements.chordDiagrams` 只控制**曲谱开头**的和弦图列表。

### Tabst 当前能力

- Tabst 目前使用 `@coderline/alphatab`（预编译包），只能通过配置/AlphaTex 控制显示项。
- 因此 **无法仅靠配置** 实现"每个 beat 上方显示完整指法图"。

### 如果必须要行间指法图

- **方案 A（推荐）**：fork/patch alphaTab，把行间效果从 `TextGlyph` 换成 `ChordDiagramGlyph`，并修复 `ChordDiagramGlyph` 在 EffectBarRenderer 下 `width` 被覆盖导致的布局/线条缺失问题。
  - 参考：[alphaTab #1812](https://github.com/CoderLine/alphaTab/issues/1812)
- **方案 B**：Tabst 自己做 overlay（在渲染后按 beat 坐标叠加绘制指法图），需要自行处理碰撞、滚动/缩放同步等问题。

---

## 行间和弦 vs 曲谱开头和弦图

### 两种用法

| 用途           | AlphaTex 写法                    | 显示位置               | 配置项               |
|----------------|----------------------------------|------------------------|----------------------|
| 和弦图列表     | `\chord "C" 0 1 0 2 3 x` 等      | 曲谱**开头**指法图列表 | `notation.elements.chordDiagrams` |
| **行间和弦**   | 在对应 beat 上加 `{ch "Am"}`     | 每个 **beat 上方**     | `notation.elements.effectChordNames` |

### 行间和弦正确写法

- 用 **`{ch "和弦名"}`** 写在**具体音符/和弦的 beat** 上，该 beat 上方才会显示和弦名。
- 仅写 `\chord "Am" 0 1 2 3 4 5` 而不在乐谱中的 beat 上写 `{ch "Am"}`，则只会出现在**曲谱开头的和弦图列表**，不会出现在行间。

### 示例

```alphatex
\chord "Am" 0 1 2 3 4 5
\chord "C" 0 1 0 2 3 x
\tempo 90
.
(0.1 1.2 2.3 3.4 4.5 5.6){ch "Am"} (0.1 1.2 2.3 3.4 4.5 5.6)*3 |
(0.1 1.2 0.3 2.4 3.5 x.6){ch "C"} (0.1 1.2 0.3 2.4 3.5 x.6)*3 |
```

- `\chord`：定义指法，用于顶部列表（以及可选的指法引用）。
- `{ch "Am"}` / `{ch "C"}`：在对应 beat 上标注，**行间**显示和弦**名**（文字）。

### 行间：和弦名 vs 指法图

| 行间显示     | alphaTab 默认 | 说明 |
|--------------|---------------|------|
| **和弦名**   | ✅ 支持        | `effectChordNames` + `{ch "..."}`，显示如 `Am`、`C` 等文字。 |
| **指法图**   | ❌ 不支持      | 每个 beat 上方显示指法图（格子图）需修改 alphaTab 源码。 |

若要在**五线谱上方**显示**指法图**而非仅文字，需改 `ChordsEffectInfo` 用 `ChordDiagramGlyph` 替代 `TextGlyph`，并处理 `ChordDiagramGlyph` 的 `width` 被 EffectBarRenderer 覆盖导致的布局问题。详见 [alphaTab #1812](https://github.com/CoderLine/alphaTab/issues/1812)（[Need help displaying chord diagrams above staff](https://github.com/CoderLine/alphaTab/issues/1812)）。

### Preview 默认配置

`createPreviewSettings` 已默认开启：

- `chordDiagrams: true`：显示曲谱开头的和弦图列表。
- `effectChordNames: true`：显示行间和弦名（需在 beat 上使用 `{ch "..."}`）。

## 参考

- [Beat Effects > Chords](https://www.alphatab.net/docs/alphatex/beat-effects#chords)
- `alphaTab.model.Chord`：`showDiagram`、`showName`、`showFingering` 等。
- [alphaTab #1812](https://github.com/CoderLine/alphaTab/issues/1812)：五线谱上方显示指法图（需改 ChordsEffectInfo / ChordDiagramGlyph）。
