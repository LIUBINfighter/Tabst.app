# ATDOC Coloring 草案（v0.2 Draft）

最后更新：2026-02-24

## 1. 目标

为 ATDOC 增加可控、可回退的曲谱着色能力：

1. 文档内声明着色意图（默认配置）；
2. 不开放任意路径写入，仅白名单 key；
3. 与现有主题重建机制兼容。

---

## 2. 新增命名空间

`at.coloring.*`

### 支持键（Draft）

- `at.coloring.enabled`（boolean）
- `at.coloring.barNumberColor`（string，颜色值）
- `at.coloring.staffLineColor`（string，颜色值）
- `at.coloring.barSeparatorColor`（string，颜色值）
- `at.coloring.noteHeadColor`（string，颜色值）
- `at.coloring.fretNumberColor`（string，颜色值）
- `at.coloring.colorizeByFret`（boolean）

颜色值优先支持：`#RRGGBB` / `#RGB` / alphaTab 可接受的 `Color.fromJson` 输入。

---

## 3. 应用策略

### 3.1 触发点

- 在 `scoreLoaded` 后应用到 score model style（Bar/Note 层）；
- 若应用了样式，触发一次 `api.render()`。

### 3.2 覆盖顺序

1. `colorizeByFret=true` 时，按 fret 区间着色优先于统一 note/fret 颜色；
2. 统一颜色（noteHeadColor/fretNumberColor）次之；
3. 未设置 key 不改动原样式。

### 3.3 风险边界

- ATDOC 不处理 `display.resources.*`，避免与主题重建机制冲突；
- 无效颜色值仅 warning，不抛错，不阻断渲染。

---

## 4. 示例

```alphatex
/**
 * at.coloring.enabled=true
 * at.coloring.barNumberColor=#ef4444
 * at.coloring.staffLineColor=#334155
 * at.coloring.barSeparatorColor=#64748b
 * at.coloring.noteHeadColor=#22c55e
 * at.coloring.fretNumberColor=#38bdf8
 * at.coloring.colorizeByFret=false
 */
```

---

## 5. 下一步（讨论项）

- 增加 `at.coloring.scope`（preview / print / both）；
- 增加 `at.coloring.palette.*`（可命名调色板）；
- 增加 overlay 层（boundsLookup）用于临时高亮，不触发 render。
