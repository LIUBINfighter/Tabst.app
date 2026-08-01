# ATDOC 当前规范（Current）

> **Status:** Current implementation — 推荐使用 INI 分节写法；点号写法完全兼容。
>
> **Supersedes:** `ATDOC_V0.md`、`ATDOC_V0_1.md`（旧文档保留，标注 SUPERSEDED）。
>
> **Scope:** 当前解析器（`src/renderer/lib/atdoc.ts`）、编辑器补全
> （`lib/alphatex-completion.ts`）、预览/打印消费方的行为描述。

## 1. 什么是 ATDOC

ATDOC（AlphaTex **Do**cument **C**onfig）是 Tabst 在 AlphaTex 文件注释中声明
文档级配置的约定：控制预览、播放器、着色、谱表、打印与文件元数据。
渲染前所有 ATDOC 指令行从内容中剥离（cleanContent），AlphaTex 主体不受影响。

## 2. 语法

### 2.1 INI 分节写法（推荐）

```alphatex
/**
 * [meta]
 * title="Flower Dance"
 * tag="acoustic, guitar"
 * status=released
 *
 * [player]
 * speed=0.92
 * countIn=true
 */
```

- 分节头：`[meta]` / `[display]` / `[player]` / `[coloring]` / `[staff]` /
  `[print]`，方括号内允许空白（`[ player ]`）。
- 分节内每行 `键=值`，等价于 `at.<分节>.<键>=值`。
- 分节作用域：从分节头到下一个分节头或文件结尾。
- 注释前缀（`*` / `//`）与裸行均可，与点号写法一致。

### 2.2 点号写法（兼容，等同支持）

```alphatex
/**
 * at.meta.title="Flower Dance"
 * at.player.playbackSpeed=0.92
 */
```

`at.<域>.<键>=<值>`，随时可与分节写法混用，同一键后写者生效（last wins）。

### 2.3 快捷标签（#tag）

注释行中的 `#名字` token 会被收集为文件标签，与 `at.meta.tag` 合并去重，
供侧边栏筛选与快速切换使用。ATDOC 指令行与乐曲内容不会被误判。

### 2.4 值类型

- `true` / `false` → Boolean
- `123` / `0.75` → Number
- `'text'` / `"text"` → String（逗号分隔多值键自动拆分为列表）
- 其余作为裸字符串（枚举名等，大小写不敏感）

## 3. 键清单与别名

键元数据单一事实源：`src/renderer/data/atdoc-keys.ts`（`ATDOC_KEY_DEFINITIONS`）。

| 分节 | 键 | 别名 | 值类型 |
| --- | --- | --- | --- |
| meta | title / class / tag / alias | | string / 逗号列表 |
| meta | status | | `draft\|active\|done\|released` |
| meta | tabist | `author` | string |
| meta | app / github / license / source / release | | string / CC 枚举 |
| display | scale | `zoom` | number > 0 |
| display | layoutMode | `layout` | `Page\|Horizontal\|Parchment` |
| player | scrollMode / scrollSpeed | | 枚举 / number >= 0 |
| player | playbackSpeed | `speed` | number > 0 |
| player | volume / metronomeVolume | `metronome` | number in [0,1] |
| player | muteTracks / soloTracks | `mute` / `solo` | 非负整数列表 |
| player | countInEnabled | `countIn` | boolean |
| player | enableCursor | `cursor` | boolean |
| player | enableElementHighlighting | `highlight` | boolean |
| player | enableUserInteraction | `interaction` | boolean |
| coloring | enabled / colorizeByFret | | boolean |
| coloring | barNumberColor / staffLineColor / barSeparatorColor / noteHeadColor / fretNumberColor | | color |
| staff | showTablature | `tab` | boolean |
| staff | showStandardNotation | `notation` | boolean |
| staff | showSlash | `slash` | boolean |
| staff | showNumbered | `numbered` | boolean |
| print | zoom | | number > 0 |
| print | barsPerRow | | -1 或正整数 |
| print | stretchForce | | number >= 0 |

别名仅在 INI 分节内生效；点号写法只认规范键名。

## 4. 解析规则

| 情形 | 行为 |
| --- | --- |
| 已知分节 + 已知键（或别名） | 映射为规范 `at.<分节>.<键>` 后应用 |
| 已知分节 + 未知键 | warning `Unknown atdoc key: at.<分节>.<键>` |
| 未知分节 | warning `Unknown atdoc section: [<名>]`，该分节内裸键忽略 |
| 分节外的裸键 | 静默忽略 |
| 同一键多次出现 | last wins（点号与分节混用同样适用） |
| 空值 / 非法值 / 未知键 | 忽略并 warning，不阻断渲染 |

## 5. 渲染安全策略（cleanContent）

- 指令行（点号、分节头、分节内裸键）在传给 `api.tex()` 前剥离；
- 普通注释行保留；
- `parseAtDoc` 单次遍历同时完成：指令收集、warning、inline #tag、cleanContent。

## 6. 应用分级

### Hot（运行时直接写入）

- `playbackSpeed` / `metronomeVolume` / `countInEnabled` / `volume`

### Warm（updateSettings + render）

- `display.scale` / `display.layoutMode`
- `player.scrollMode` / `scrollSpeed` / `enableCursor` /
  `enableElementHighlighting` / `enableUserInteraction`

### Warm（轨道局部重绘）

- `staff.*` → `applyStaffConfig` + `renderTracks([firstTrack])`

### 着色与打印

- `coloring.*` → ATDOC 着色管线（非法色值仅 warning）；
- `print.*` → 打印预览初始布局参数。

### 元数据

- `meta.*` → 文件树/侧边栏/快速切换（标签、状态、标题、作者等）。

## 7. 编辑器支持

- 键入 `[` 补全六个分节名；
- 分节内键入键名按当前分节补全（含别名），`键=` 后补全枚举/布尔值；
- 键入 `at.` 走域 → 键 → 值三级分层补全（点号写法）；
- hover `at.*` 键显示描述与示例（分节裸键的 hover 暂未实现）。

## 8. Preview / Print 约束

- Preview：ATDOC 是"文档默认值"，用户底部栏操作覆盖当前会话，不回写源文件；
- PrintPreview：使用同一份解析结果，`print.*` 作为打印初始布局；
- Live Preview 与 Print 各自独立的 AlphaTabApi 实例。

## 9. 示例文件

- `docs/dev/alphatex/examples/ATDOC_INI_SAMPLE.atex` — INI 分节写法全量示例（推荐）；
- `docs/dev/alphatex/examples/ATDOC_FULL_SAMPLE.atex` — 点号写法全量示例（兼容参考）。

## 10. 实现位置

- `data/atdoc-keys.ts` — 键定义、值类型、枚举、别名；
- `lib/atdoc.ts` — 解析器、分节/别名解析、#tag、active-section 查询；
- `lib/alphatex-completion.ts` — 分节/裸键/点号补全；
- `lib/atdoc.test.ts` — 解析与分节/别名测试。
