# Tabst 开发文档

这里是 Tabst 当前工程知识、领域说明、运行手册、计划和历史材料的导航入口。
代码和配置始终是最终事实来源；文档应明确区分当前实现、草案、阶段报告和归档快照。

## 从这里开始

1. [架构总览](./architecture/OVERVIEW.md)：先建立 Renderer、AlphaTex、alphaTab、Tauri、
   持久化、Cloud、打印和构建链路的整体心智模型。
2. [根目录 AGENTS.md](../../AGENTS.md)：了解稳定约束、状态所有权、跨层修改清单和验证要求。
3. [根目录 README](../../README.md#development)：安装、开发、测试和构建入口。

如果文档与实现冲突，先核对文档引用的 source-of-truth 文件，再更新文档或将其标记为历史材料。

## 文档状态约定

| 状态 | 含义 |
| --- | --- |
| Current | 描述当前实现和长期合同 |
| Draft | 尚未接受或完成的设计草案 |
| Active plan | 正在执行的计划，完成条件应明确 |
| Completed | 已完成计划，保留用于理解迁移和兼容背景 |
| Historical | 某个时间点的报告或快照，不用于指导当前实现 |
| Superseded | 已被另一篇文档或当前实现替代 |

目录名只能提供初步线索；计划、报告和归档文档仍应在正文顶部明确写出状态。

## 当前架构

| 文档 | 内容 |
| --- | --- |
| [architecture/OVERVIEW.md](./architecture/OVERVIEW.md) | 当前系统总览、运行时边界、数据流、状态所有权和修改入口 |

新的跨域架构说明应优先补充到 `architecture/`。只有当主题足够独立、总览无法清楚承载时，
再新增专题架构文档。

## alphaTab 集成

alphaTab 当前文档按用途拆为架构说明和故障排查。正式 live Preview 的事实来源是
`Preview.tsx + usePreview* + lib helpers`；`useAlphaTab.ts` 当前没有生产调用方，不应当作正式
生命周期合同。

| 文档 | 状态与内容 |
| --- | --- |
| [PREVIEW_LIFECYCLE.md](./architecture/PREVIEW_LIFECYCLE.md) | Current：live、print、tutorial 三种宿主，刷新操作、重建、状态恢复、staff 合同和错误恢复 |
| [EDITOR_PREVIEW_SYNC.md](./architecture/EDITOR_PREVIEW_SYNC.md) | Current：AST 位置映射、Selection、编辑器光标广播和播放高亮 |
| [DEBUG_ALPHATAB.md](./runbooks/DEBUG_ALPHATAB.md) | Current：渲染、主题、staff、Selection、播放和打印故障排查 |

常见代码入口：

- Live Preview 生命周期：`src/renderer/components/Preview.tsx`、`src/renderer/hooks/usePreview*`
- 创建配置与资源：`src/renderer/lib/alphatab-config.ts`、`resourceLoaderService.ts`
- 主题与颜色：`src/renderer/lib/theme-system/`、`src/renderer/lib/themeManager.ts`
- Staff 配置：`src/renderer/lib/staff-config.ts`、`preview-session-controller.ts`
- 位置与选区：`src/renderer/lib/alphatex-parse-positions.ts`、`alphatex-selection-sync.ts`
- 打印：`src/renderer/components/PrintPreview.tsx`

旧的主题重建、tracks 配置和 Selection 迁移文档已收敛。只有仍有独立追溯价值的 staff 方案
和 alphaTab 1.8 Selection 迁移保留在 `archived/alphatab/`。

## AlphaTex 与 ATDOC

`alphatex/` 同时包含当前实现说明、已完成的版本设计和下一阶段草案。阅读时要关注文件顶部状态
和代码现实，不要把带有 `DRAFT`、`V0` 或 `V0_1` 的文件自动视为当前完整规范。

| 文档 | 状态与内容 |
| --- | --- |
| [LSP_INTEGRATION.md](./alphatex/LSP_INTEGRATION.md) | Worker LSP、补全、Hover 和诊断实现背景；部分 roadmap 段落可能已过期 |
| [ATDOC_HIERARCHICAL_AUTOCOMPLETE_SPEC.md](./alphatex/ATDOC_HIERARCHICAL_AUTOCOMPLETE_SPEC.md) | 已实现的分层补全设计记录 |
| [ATDOC_INI_SYNTAX.md](./alphatex/ATDOC_INI_SYNTAX.md) | 当前实现的 INI 分节语法（`[player]` + 短键） |
| [ATDOC_V0.md](./alphatex/ATDOC_V0.md) | ATDOC v0 语法和应用约束记录 |
| [ATDOC_V0_1.md](./alphatex/ATDOC_V0_1.md) | completion/hover 扩展阶段设计记录 |
| [ATDOC_NEXT_PHASE_DRAFT.md](./alphatex/ATDOC_NEXT_PHASE_DRAFT.md) | 下一阶段讨论草案 |
| [ATDOC_COLORING_DRAFT.md](./alphatex/ATDOC_COLORING_DRAFT.md) | ATDOC 着色草案 |

当前实现入口：

- `src/renderer/workers/alphatex.worker.ts`
- `src/renderer/lib/alphatex-lsp.ts`
- `src/renderer/lib/alphatex-completion.ts`
- `src/renderer/lib/atdoc.ts`
- `src/renderer/data/atdoc-keys.ts`
- `src/renderer/data/alphatex-commands.json`

## 运维、安全和发布

`ops/` 保存 updater、安全审计和工程重构材料。运行发布操作前，应同时核对 `package.json`、
`src-tauri/tauri.conf.json` 和 `.github/workflows/`。

| 文档 | 内容 |
| --- | --- |
| [TAURI_AUTO_UPDATE.md](./ops/TAURI_AUTO_UPDATE.md) | 当前 Tauri updater 发布与校验流程 |
| [AUTO_UPDATE.md](./ops/AUTO_UPDATE.md) | 自动更新背景说明，使用前与当前 Tauri 流程对照 |
| [SECURITY.md](./ops/SECURITY.md) | 安全审计记录 |
| [REFACTORING.md](./ops/REFACTORING.md) | Effect-TS 重构阶段总结 |

当前发布能力以 `.github/workflows/` 为准。存在 workflow 文件不代表对应平台当前启用了自动发布。

## Roadmap 和待处理问题

`roadmap/` 描述尚未完成的功能方向；`issues/` 保存需要继续决策或实施的具体问题记录。
它们不是当前实现合同。

### Roadmap

- [I18N_PLAN.md](./roadmap/I18N_PLAN.md)
- [CHORD_DIAGRAMS.md](./roadmap/CHORD_DIAGRAMS.md)

### Issues

- [001-unify-product-messaging.md](./issues/001-unify-product-messaging.md)
- [002-define-settings-boundaries.md](./issues/002-define-settings-boundaries.md)
- [003-inventory-settings-pages-and-items.md](./issues/003-inventory-settings-pages-and-items.md)
- [004-define-about-and-updates-information-architecture.md](./issues/004-define-about-and-updates-information-architecture.md)
- [005-macos-release-blocked-by-gatekeeper-v0.6.8.md](./issues/005-macos-release-blocked-by-gatekeeper-v0.6.8.md)

## 阶段报告

`reports/` 保存某个时间点的审计或阶段结果。报告提供历史证据，不应覆盖当前架构说明。

| 文档 | 内容 |
| --- | --- |
| [GROUNDING_REPORT.md](./reports/GROUNDING_REPORT.md) | 2026-02 文档与代码一致性审计 |
| [REFACTOR_SPEED_PHASE_REPORT.md](./reports/REFACTOR_SPEED_PHASE_REPORT.md) | refactor/speed 阶段性能与稳定性结果 |

## 已完成计划

完成但仍有兼容和迁移参考价值的实施计划放在 `plans/completed/`。

- [WORKSPACE_PERSISTENCE_UNIFICATION.md](./plans/completed/WORKSPACE_PERSISTENCE_UNIFICATION.md)

新的计划应写明 owner、状态、完成条件和最终应更新的 architecture/runbook 文档。完成后移入
`plans/completed/`，不要继续留在开发文档根目录。

## 历史归档

`archived/` 中的材料只用于追溯历史，不作为当前开发指南。

| 目录或文档 | 内容 |
| --- | --- |
| [archived/electron/README.md](./archived/electron/README.md) | Electron 时代归档入口 |
| [archived/tauri/PHASE_1_MIGRATION_REPORT.md](./archived/tauri/PHASE_1_MIGRATION_REPORT.md) | Tauri Phase 1 迁移完成快照 |
| [archived/ia/INFORMATION_ARCHITECTURE_SNAPSHOT.md](./archived/ia/INFORMATION_ARCHITECTURE_SNAPSHOT.md) | 过去某个版本的 UI 信息架构观察快照 |
| [archived/alphatab/TRACKS_CONFIGURATION_PROPOSALS.md](./archived/alphatab/TRACKS_CONFIGURATION_PROPOSALS.md) | Historical：staff 配置保存的 A/B/C 候选设计与实际演化 |
| [archived/alphatab/SELECTION_API_1_8_MIGRATION.md](./archived/alphatab/SELECTION_API_1_8_MIGRATION.md) | Historical：从私有字段迁移到 alphaTab 1.8 Selection API |

归档文件中的旧路径、旧模块和旧验证结果可以保留，但文件顶部必须明确 Historical 状态，
并指向当前架构入口。

## 按任务查找

| 任务 | 先看文档 | 再看代码 |
| --- | --- | --- |
| 理解应用启动和工作区模式 | [架构总览](./architecture/OVERVIEW.md) | `main.tsx`、`App.tsx`、`appStore.ts` |
| 修改 AlphaTex 补全或 Hover | [LSP_INTEGRATION.md](./alphatex/LSP_INTEGRATION.md) | Worker、LSP client、command JSON |
| 修改源码与乐谱同步 | [Editor 与 Preview 同步](./architecture/EDITOR_PREVIEW_SYNC.md) | parse positions、selection/cursor/playback 模块 |
| 修改主题和乐谱颜色 | [Preview 生命周期](./architecture/PREVIEW_LIFECYCLE.md#theme-and-deep-rebuilds) | theme system、themeManager、Preview |
| 修改 Preview 生命周期 | [Preview 生命周期](./architecture/PREVIEW_LIFECYCLE.md) | `Preview.tsx`、`usePreview*` |
| 排查 alphaTab 问题 | [alphaTab 调试运行手册](./runbooks/DEBUG_ALPHATAB.md) | Preview、PrintPreview、theme、selection、playback |
| 修改打印 | [架构总览](./architecture/OVERVIEW.md#print-pipeline) | PrintWindow、PrintPreview、print helpers |
| 新增桌面命令 | [根 AGENTS](../../AGENTS.md#new-or-changed-desktop-api) | Rust command、lib.rs、adapter、typing |
| 修改 updater 或发布 | [TAURI_AUTO_UPDATE.md](./ops/TAURI_AUTO_UPDATE.md) | Tauri config、updater commands、workflows |
| 查看迁移历史 | [Tauri Phase 1 报告](./archived/tauri/PHASE_1_MIGRATION_REPORT.md) | 当前实现仍以代码为准 |

## 文档维护规则

- README 负责产品和快速上手；架构细节放在 `architecture/`。
- Architecture 只描述当前实现，不混入未接受计划和阶段报告。
- Draft、计划、报告和归档必须明确状态。
- 动态版本、脚本和 workflow 状态应链接 source of truth，不在多篇文档中手工复制。
- 修改运行时边界、状态所有权、生命周期、持久化格式、安全规则或发布操作时，应同步文档。
- 普通局部重构不需要新增架构文档。
- 移动文档后必须更新全仓引用，并运行 `pnpm docs:check`。
- 删除历史材料前，确认其中没有仍有价值的兼容、迁移或故障背景。

## 验证

```powershell
pnpm docs:check
git diff --check
```

涉及代码、配置或运行时行为时，还要执行根 `AGENTS.md` 中对应范围的验证命令。

## 外部参考

- [alphaTab 官方文档](https://www.alphatab.net/)
- [alphaTab GitHub](https://github.com/CoderLine/alphaTab)
- [CodeMirror 6 文档](https://codemirror.net/)
- [Tauri 2 文档](https://tauri.app/)
