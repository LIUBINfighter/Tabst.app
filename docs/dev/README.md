# Tabst 开发文档

本目录包含 Tabst 项目的开发技术文档，按功能模块组织。

> **提示**：文档按重要性排序，新手建议按顺序阅读。

---

## 📁 文档结构

### alphatab/ - alphaTab 集成

alphaTab 乐谱渲染引擎的集成文档。

| 文档 | 内容 | 推荐阅读 |
|------|------|----------|
| [ARCHITECTURE.md](./alphatab/ARCHITECTURE.md) | 系统架构分析（Worker 缓存、颜色配置流） | ⭐⭐⭐⭐⭐ |
| [THEME_SWITCH_GUIDE.md](./alphatab/THEME_SWITCH_GUIDE.md) | 主题切换完全指南（重建机制、tracks 参数问题） | ⭐⭐⭐⭐⭐ |
| [REBUILD_MECHANISMS.md](./alphatab/REBUILD_MECHANISMS.md) | 5 层重建/刷新机制详解 | ⭐⭐⭐⭐ |
| [TRACKS_CONFIGURATION.md](./alphatab/TRACKS_CONFIGURATION.md) | Tracks 参数保存/恢复方案 | ⭐⭐⭐⭐ |
| [SELECTION_SYNC.md](./alphatab/SELECTION_SYNC.md) | 选区同步技术文档（Selection API、编辑器同步） | ⭐⭐⭐⭐ |

**快速入口**：
- 第一次了解 alphaTab 集成？→ [ARCHITECTURE.md](./alphatab/ARCHITECTURE.md)
- 修改主题切换逻辑？→ [THEME_SWITCH_GUIDE.md](./alphatab/THEME_SWITCH_GUIDE.md)
- 实现选区同步功能？→ [SELECTION_SYNC.md](./alphatab/SELECTION_SYNC.md)

---

### alphatex/ - AlphaTex 编辑器

AlphaTex 编辑器实现文档。

| 文档 | 内容 |
|------|------|
| [LSP_INTEGRATION.md](./alphatex/LSP_INTEGRATION.md) | LSP Worker、语法高亮、自动补全集成 |

---

### ops/ - 运维与工程

项目运维、部署、重构相关文档。

| 文档 | 内容 |
|------|------|
| [AUTO_UPDATE.md](./ops/AUTO_UPDATE.md) | 自动更新实现（electron-builder + electron-updater） |
| [REFACTORING.md](./ops/REFACTORING.md) | Effect-TS 重构总结 |
| [SECURITY.md](./ops/SECURITY.md) | 安全审计记录 |

---

### roadmap/ - 未来规划

未完成的功能规划。

| 文档 | 内容 |
|------|------|
| [I18N_PLAN.md](./roadmap/I18N_PLAN.md) | 国际化适配计划 |
| [CHORD_DIAGRAMS.md](./roadmap/CHORD_DIAGRAMS.md) | 和弦图显示方案 |

---

### archived/ - 归档

当前活跃的开发文档（完成后归档）。

| 文档 | 内容 |
|------|------|
| `REPO_FEATURE_HANDOFF.md` | Repo 功能交接文档 |
| `REPO_REFACTOR_CONTEXT.md` | Repo 重构上下文 |

---

## 🚀 常见任务

### 任务 1：修改暗色主题的颜色

1. 编辑 `src/renderer/index.css` 中的 `.dark` 区块
2. 修改 `--alphatab-*` CSS 变量值
3. 颜色自动被 `getAlphaTabColorsForTheme()` 读取

参考：[THEME_SWITCH_GUIDE.md](./alphatab/THEME_SWITCH_GUIDE.md)

### 任务 2：调试主题切换问题

1. 检查是否调用了 `destroy()`
2. 验证新的 `settings` 对象包含新颜色
3. 检查是否使用了 `trackConfigRef` 保存 tracks 配置

参考：[THEME_SWITCH_GUIDE.md#故障排查](./alphatab/THEME_SWITCH_GUIDE.md#故障排查)

### 任务 3：实现选区同步功能

1. 监听 `api.playbackRangeHighlightChanged` 事件
2. 使用 AST 解析器获取代码位置
3. 通过 CodeMirror Decoration 实现高亮

参考：[SELECTION_SYNC.md](./alphatab/SELECTION_SYNC.md)

---

## 🔗 外部参考

- [alphaTab 官方文档](https://www.alphatab.net/)
- [alphaTab GitHub](https://github.com/CoderLine/alphaTab)
- [CodeMirror 6 文档](https://codemirror.net/)
- [Effect-TS 文档](https://effect.website/)

---

## 📝 文档维护

- **新增文档**：请按功能放入对应子目录
- **文档更新**：修改后请在文档头部更新日期
- **过时文档**：确认无用后可移入 `archived/` 或直接删除

---

**最后更新**：2026-02-09
