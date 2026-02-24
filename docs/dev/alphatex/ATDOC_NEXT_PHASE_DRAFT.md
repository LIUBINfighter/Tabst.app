# ATDOC 下一阶段草案（讨论稿）

最后更新：2026-02-24

## 1. 目标

在 v0/v0.1 已经完成“可解析 + 可应用 + 可补全/hover”的基础上，下一阶段聚焦三件事：

1. **可观测性**：把 console warning 升级为编辑器内诊断反馈；
2. **优先级模型**：统一 ATDOC、用户底部栏操作、主题系统三者冲突规则；
3. **可扩展性**：引入分层 key 空间与作用域，支持后续 print/preview 分离增强。

---

## 2. 问题背景（当前状态）

当前已具备：

- ATDOC 白名单解析与 cleanContent 渲染；
- Preview/Print 应用 atdoc 设置；
- worker completion + hover；
- 与底部栏播放器关键状态（zoom/speed/metronome/countIn）联动。

当前不足：

- 解析警告仅 console 可见，用户难以感知；
- “ATDOC 默认值”与“用户手动调整”缺少显式策略（会话中覆盖关系不透明）；
- key 空间尚未支持作用域（如 preview-only / print-only / session-only）。

---

## 3. 提议范围（v0.2）

### 3.1 诊断面板（高优先）

- 在编辑区底部新增 `ATDOC Diagnostics` 区域（可折叠）；
- 展示：line/key/message/severity；
- 点击条目可定位到对应行（复用编辑器 cursor/selection 能力）。

### 3.2 优先级模型（高优先）

定义明确覆盖链：

1. Theme/系统强制（最高）
2. 用户当前会话手动操作（BottomBar/Toolbar）
3. 文档默认值（ATDOC）
4. 应用默认配置（最低）

补充规则：

- 文档重载时，若文件哈希变化，重新应用 ATDOC defaults；
- 会话中用户手动改动标记为 `dirtyByUser`，直到文件切换或 refresh 重置。

### 3.3 作用域声明（中优先）

在注释中允许可选作用域前缀（保持向后兼容）：

- `at.preview.display.scale=...`
- `at.print.zoom=...`（沿用）
- `at.session.player.playbackSpeed=...`（仅本会话）

未带作用域的 `at.*` 继续按 current behavior 处理。

---

## 4. 技术草案

### 4.1 数据层

- 扩展 `AtDocConfig`：加入 `meta`（sourceLine, scope, rawValue）；
- 增加 `AtDocDiagnostic` 类型：`warning | error | info`。

### 4.2 Store 层

- 新增 `atDocState`：
  - `lastParsedHash`
  - `appliedDefaults`
  - `userOverrides`
  - `diagnostics`

### 4.3 应用层

- `Preview.tsx` 在 `parse -> apply` 过程中写入 store diagnostics；
- `GlobalBottomBar` 修改关键值时写入 `userOverrides`；
- reload/refresh 时清理覆盖标记并按策略重放。

---

## 5. 风险与回退

- 风险：状态联动复杂度上升，需避免循环写入；
- 约束：不得引入 `as any` / `@ts-ignore`；
- 回退策略：保留 v0.1 apply path，新增逻辑以 feature flag 渐进启用。

---

## 6. 验收标准（讨论版）

1. 用户可在 UI 看见并定位 ATDOC 问题；
2. 同一个 key 在 ATDOC 与 BottomBar 冲突时行为可预测；
3. 切换文件/刷新时覆盖关系符合规则；
4. `pnpm check`、`pnpm build` 全通过。
