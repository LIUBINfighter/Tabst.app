# ATDOC v0 规范（Tabst）

最后更新：2026-02-24

## 1. 目标

ATDOC 是 Tabst 在 AlphaTex 文件中的文档级配置约定，用于：

1. 在谱面文件内声明预览/打印的默认参数；
2. 将配置安全映射到 alphaTab（`settings.*` 与少量运行时 API）；
3. 保持 AlphaTex 主体可解析、可渲染、可打印。

ATDOC v0 采用**白名单键**与**分级应用策略**，禁止任意动态路径赋值。

---

## 2. 语法

### 2.1 支持的注释容器

- `/* ... */`
- `/** ... */`
- `// ...`

### 2.2 指令格式

每行一个 KV：

```text
at.<namespace>.<key>=<value>
```

示例：

```alphatex
/**
 * at.display.scale=0.75
 * at.player.scrollMode=OffScreen
 * at.player.playbackSpeed=0.9
 * at.staff.showTablature=true
 * at.print.barsPerRow=4
 */
\title "Demo"
.
3.3 2.3 0.3 0.4 |
```

### 2.3 值类型

- `true` / `false` → Boolean
- `123` / `0.75` → Number
- `'text'` / `"text"` → String
- 其余作为裸字符串（用于枚举名等）

### 2.4 冲突规则

- 同一 key 多次出现：**last wins**（最后一条覆盖前面）。
- 非法值或未知 key：忽略并记录 warning，不阻断渲染。

---

## 3. 命名空间与白名单（v0）

### 3.1 `at.display.*`

- `at.display.scale` → `settings.display.scale`（number，>0）
- `at.display.layoutMode` → `settings.display.layoutMode`
  - 允许值：`Page | Horizontal | Parchment`（大小写不敏感）

### 3.2 `at.player.*`

- `at.player.scrollMode` → `settings.player.scrollMode`
  - 允许值：`Off | Continuous | OffScreen | Smooth`
- `at.player.scrollSpeed` → `settings.player.scrollSpeed`（number，>=0）
- `at.player.playbackSpeed` → `api.playbackSpeed`（number，>0）
- `at.player.metronomeVolume` → `api.metronomeVolume`（number，0~1 建议）
- `at.player.countInEnabled` → `api.countInVolume`（boolean 映射到 1/0）
- `at.player.enableCursor` → `settings.player.enableCursor`（boolean）
- `at.player.enableElementHighlighting` → `settings.player.enableElementHighlighting`（boolean）
- `at.player.enableUserInteraction` → `settings.player.enableUserInteraction`（boolean）

### 3.3 `at.staff.*`

- `at.staff.showTablature` → `Staff.showTablature`
- `at.staff.showStandardNotation` → `Staff.showStandardNotation`
- `at.staff.showSlash` → `Staff.showSlash`
- `at.staff.showNumbered` → `Staff.showNumbered`

由 `applyStaffConfig` 应用，并调用 `renderTracks`。

### 3.4 `at.print.*`

- `at.print.zoom`（number，>0）
- `at.print.barsPerRow`（number，-1 或正整数）
- `at.print.stretchForce`（number，>=0）

---

## 4. 应用分级（v0）

### Hot

- 直接运行时写入并生效：
  - `playbackSpeed`
  - `metronomeVolume`
  - `countInEnabled`

### Warm

- 修改 `settings` 后 `updateSettings()` + `render()`：
  - `display.scale`
  - `display.layoutMode`
  - `player.scrollMode`
  - `player.scrollSpeed`
  - `player.enableCursor`
  - `player.enableElementHighlighting`
  - `player.enableUserInteraction`

### Warm（轨道局部重绘）

- `staff.*` 通过 `applyStaffConfig` + `renderTracks([firstTrack])`

### Rebuild（文档规则，v0 不由 ATDOC 自动触发）

以下类别仍需遵循现有重建机制：

- 主题颜色（`display.resources.*`）
- worker / font / player mode 等初始化级参数

ATDOC v0 不开放上述 key。

---

## 5. 渲染安全策略

ATDOC 指令在传递给 `api.tex()` 前会被剥离：

1. 解析注释中的 `at.*` 行；
2. 从文本中移除指令行（保留普通 AlphaTex 内容）；
3. 使用 clean AlphaTex 进行 `tex()`。

目的：

- 降低 parser 行为变化带来的兼容风险；
- 保持谱面语义与渲染输入稳定。

---

## 6. Preview / Print 行为约束

### Preview

- ATDOC 作为“文档默认值”；
- 用户在 UI 上的实时操作可覆盖当前会话状态；
- 不会回写源文件。

### PrintPreview

- 使用同一份 ATDOC 解析结果；
- `at.print.*` 作为打印初始布局参数。

---

## 7. 错误处理

- 解析失败：忽略该条指令，继续渲染。
- 类型不匹配：忽略该条并 warning。
- 未知 key：忽略并 warning。
- 任何情况下不得让 ATDOC 导致 preview 崩溃。

---

## 8. 未来扩展（v1+）

- 增加 `at.notation.*` 白名单；
- 增加可视化诊断面板（而不只 console warning）；
- 增加“预览专用 / 打印专用 / 全局”作用域声明；
- 可选支持 ATDOC 自动补全与 hover。
