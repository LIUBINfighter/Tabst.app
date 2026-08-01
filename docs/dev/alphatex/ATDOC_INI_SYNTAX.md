# ATDOC INI 分节语法（当前实现）

> **Status:** Current implementation
>
> **Scope:** Extends ATDOC v0/v0.1 (`docs/dev/alphatex/ATDOC_V0.md`,
> `ATDOC_V0_1.md`). The dotted `at.<domain>.<key>=<value>` form remains fully
> supported and can be mixed with sections.

## 1. 动机

`at.<域>.<键>=<值>` 点号三层写法对用户记忆负担大，且缺乏视觉分组。
INI 分节写法让配置块按域组织，键名更短：

```alphatex
/**
 * [player]
 * playbackSpeed=0.92
 * countInEnabled=true
 */
```

等价于：

```alphatex
/**
 * at.player.playbackSpeed=0.92
 * at.player.countInEnabled=true
 */
```

## 2. 语法

- 分节头：`[meta]` / `[display]` / `[player]` / `[coloring]` / `[staff]` /
  `[print]`，支持方括号内空白（`[ player ]`）。
- 分节内的裸键：`键=值`，等价于 `at.<分节>.<键>=值`，支持键与 `=` 之间空白。
- 分节作用域：从分节头持续到下一个分节头或文件结尾。
- 注释前缀（`*`、`//`）与点号写法一致；裸键也支持无注释前缀的行。

## 3. 解析规则

| 情形 | 行为 |
| --- | --- |
| 已知分节 + 已知键 | 映射为 `at.<分节>.<键>` 走原有 applyDirective 校验 |
| 已知分节 + 未知键 | warning `Unknown atdoc key: at.<分节>.<键>` |
| 未知分节 | warning `Unknown atdoc section: [<名>]`，该分节内裸键忽略 |
| 分节外的裸键 | 静默忽略（与旧行为一致） |
| 点号写法 | 不受分节影响，随时可用 |
| 同一键多次出现 | last wins（点号与分节混用时同样适用） |

分节名单从 `ATDOC_KEY_DEFINITIONS` 的第一段域派生，单一事实源
（`lib/atdoc.ts` 的 `getAtDocSections()`）。

## 4. cleanContent

分节头与分节内裸键行会从传给 `api.tex()` 的内容中剥离，与点号指令一致。
普通注释行保留。

## 5. 编辑器支持

- 在注释中键入 `[` 时自动补全六个分节名（`lib/alphatex-completion.ts` 的
  section 上下文）。
- 分节内裸键的逐键补全暂未实现（v1 范围外）。

## 6. 实现位置

- `lib/atdoc.ts`：`extractSectionFromLine` / `extractBareKeyFromLine` /
  `getAtDocSections` / `parseAtDoc` 单次遍历收集。
- `lib/alphatex-completion.ts`：section 补全上下文。
- `lib/atdoc.test.ts`：INI 分节解析测试。
