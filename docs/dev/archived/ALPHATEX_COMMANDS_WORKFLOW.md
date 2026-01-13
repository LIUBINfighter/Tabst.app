---
title: "AlphaTex Commands Workflow（本地优先 + 上游回退策略）"
description: >
  说明如何在本地管理 AlphaTex 的命令（commands）和属性（properties），
  以 `src/renderer/data/alphatex-commands.json` 作为本地标准（local-first），
  Worker 在运行时优先引用本地 JSON 的 `commands` 与 `properties`，找不到时再 fallback 到
  `@coderline/alphatab-language-server` 的 `documentation`。
author: "开发者文档"
version: "1.0"
date: "2025-12-12"
---

# AlphaTex Commands Workflow（本地优先 + 上游回退）

## 概述

此文档说明如何在本地维护 `alphatex-commands.json`（命令 + 属性）作为 AlphaTex 编辑体验（补全/悬停等）的“单一本地来源”。Worker 在运行时会优先读取此 JSON 的 `commands` 与 `properties` 列表来生成补全/hover 内容；若某条本地记录不存在，则回退至 `@coderline/alphatab-language-server` 的 `documentation.*Fields`（即 local-first + upstream-fallback）。

本文件适合给需要定制或维护 AlphaTex 补全行为的开发人员查看。

---

## 相关文件与模块（快速映射）

- 本地数据（优先）
```src/renderer/data/alphatex-commands.json#L1-L48
```
- Worker（runtime）
```src/renderer/workers/alphatex.worker.ts#L46-L96
src/renderer/workers/alphatex.worker.ts#L99-L124
src/renderer/workers/alphatex.worker.ts#L179-L197
src/renderer/workers/alphatex.worker.ts#L207-L312
```
- 生成脚本（可生成/合并存在与 local JSON）
```scripts/generate-alphatex-commands.js#L337-L350
```
- Frontend (LSP client / CodeMirror completion mapping)
```src/renderer/lib/alphatex-lsp.ts#L30-L38
src/renderer/lib/alphatex-completion.ts#L26-L46
src/renderer/lib/alphatex-completion.ts#L71-L79
src/renderer/components/Editor.tsx#L161-L176
```

---

## 目标

- 把 `src/renderer/data/alphatex-commands.json` 作为本地优先的源（commands + properties），使开发者可以在本地进行任意定制。
- 保留 `@coderline/alphatab-language-server` 的 `documentation` 作为 fallback，以确保当 local 不完整时仍能提供上游覆盖。
- 使 worker 在运行时依据 local-first policy 生成 LSP-like completion items（`label, detail, documentation, insertText`）。

---

## 数据模型（JSON 结构示例）

下面演示一个最小的 JSON 样例；为了清楚说明结构，下例为演示用途（你可以直接编辑 `src/renderer/data/alphatex-commands.json`）：

```/dev/null/ALPHATEX_COMMANDS_EXAMPLE.json#L1-L40
{
  "commands": [
    {
      "name": "title",
      "label": "\\title",
      "detail": "Set song title",
      "documentation": "Sets the title of the song.",
      "insertText": "\\title ${1:title}"
    }
  ],
  "properties": [
    {
      "name": "f",
      "label": "f",
      "detail": "Fade-in intensity (beat property)",
      "documentation": "Fade-in intensity for beats; value range 0-100",
      "insertText": "f ${1:amount}"
    }
  ]
}
```

说明：
- `commands` 中的 `label` 通常以反斜杠开头（`\title`），`name` 为无反斜杠形式（`title`）。
- `properties` 的 `label` 通常就是就地显示的文本（例如 `f`）。
- `insertText` 为补全插入值，支持 snippet 样式(如 `${1}` 占位符)，但 snippet 扩展需前端识别。
- 若 `commandsJSON` 中某项字段缺失，worker 会尝试从 `documentation` 中读取对应字段填补。

---

## 运行时行为（Worker 细节）

Worker 在初始化和补全请求中将执行下面步骤：

1. 在 Worker 启动时，优先从 `src/renderer/data/alphatex-commands.json` 读取 `commands` 与 `properties`（本地 override）。这些项会被转换为内部 `commandsRegistry` 与 `propertiesRegistry`（并用 Map 做快速 Lookup）。
   - 代码参考（加载 local `commands`）：
```src/renderer/workers/alphatex.worker.ts#L71-L96
```
   - 代码参考（加载 local `properties`）：
```src/renderer/workers/alphatex.worker.ts#L99-L124
```

2. 对于缺失的项（本地没有），Worker 会回退到 `documentation.*` 字段（上游）。
   - 代码参考（从文档中构建 fallback `properties`）：
```src/renderer/workers/alphatex.worker.ts#L179-L197
```

3. 当用户触发补全（例如输入 `\` 或 `f`）时：
   - `createAlphaTexCompletionSource`（Editor 端）会调用 `lspClient.request("textDocument/completion", ...)`，并将当前 `prefix` 发送给 Worker；
   - Worker 在 `getCompletions(word)` 中先使用 `propertiesRegistry` 查找（本地优先），若没找到再基于 `documentation.*Properties`（上游 fallback）以及命令 registry (`commandsRegistry`) 生成候选（包含 `label`, `detail`, `documentation`, `insertText` 字段）。
   - 代码参考（getCompletions 的整体实现）：
```src/renderer/workers/alphatex.worker.ts#L207-L312
```

4. Hover 与文档显示：
   - Worker 在 `handleHover` 中优先检查本地 `propertiesByName` / `commandsByName`，显示 local JSON 的 `documentation` 字段；若 local 没有则使用 upstream 文档。
   - 代码参考（handleHover）：
```src/renderer/workers/alphatex.worker.ts#L398-L412
```

---

## 开发者工作流（如何做本地自定义）

1. 编辑本地 JSON（作为 authoritative source）：
   - 文件路径：`src/renderer/data/alphatex-commands.json`；
   - 增加或修改 `commands` 与 `properties`。例如添加一个新的 `properties` 或覆盖上游的 `commands`。

2. （可选但建议）使用生成器刷新/生成参考：
   - 运行：`pnpm generate:commands` 将根据 upstream `documentation` 生成 `alphatex-commands.generated.json`;
   - 运行：`pnpm generate:commands --merge` 可以将结果和本地文件合并并保留本地 override；
   - 生成脚本文件： `scripts/generate-alphatex-commands.js`；
```scripts/generate-alphatex-commands.js#L337-L350
```

3. 本地开发与验证：
   - 启动应用或渲染端：`pnpm dev`；
   - 打开 `.atex` 文件并触发补全（例如：输入 `\`，或在 beat 内容处输入 `f`）以验证本地 `alphatex-commands.json` 的改动是否生效；
   - 悬停验证：将鼠标悬停在被改动的命令/属性上，确认文档被正确显示（优先来自 local JSON）。

4. 提交 PR：
   - 编写变更描述，说明为什么需要 local override 或新增某个 property；
   - 在 PR 描述里建议同时更新 `alphatex-commands.generated.json`（如果需要）并在 `scripts/generate-alphatex-commands.js` 中记录改动的缘由（如果上游与本地冲突，应说明）。

---

## 测试与验收建议

手动验证要点：

- Local 优先：在 `alphatex-commands.json` 添加或修改一个命令 `\foo` 或属性 `x`，重启并确认补全结果优先显示 local JSON 的文本和 `documentation`。
- Fallback 行为：删除 local JSON 中某条记录，然后确认 Worker 能够使用 upstream docs 提供相同（或类似）补全项。
- insertText：编写一个带 snippet 占位符（例如 `${1:name}`）的 `insertText`，验证 CodeMirror 的 apply 行为是否能插入（或扩展）该内容（如需 snippet 展开，则需要 editor 端支持 snippet 扩展）。
- Hover：悬停命令/属性，查看显示的 `documentation` 是否为 local 或 fallbacks。

可创建自动测试流程（建议）：
- 编写一个小型测试 harness 来模拟 Worker 请求（或封装 `getCompletions()` 为可测试导出）；
- 编写测试用例覆盖 local-first 与 fallback 的场景；
- 把生成脚本加入 CI 流程以保证监控 upstream 变化。

---

## 实现细节与注意事项

- 名称大小写与重复：
  - Worker 以 `lowercased name` 为 key（`commandsByName` / `propertiesByName`），并且在生成候选时执行去重（按 `label` 去重）；
- 命令与属性命名冲突：
  - 如果命令与属性具有同名（例如 `foo` 同时为命令与 property），目前 Worker 建议以 `commands` 为优先（你可以按需调整 `handleHover` 或 `getCompletions` 的优先顺序），但建议避免这种命名冲突；
- insertText 为 snippet：
  - 前端 `createAlphaTexCompletionSource` 会把 `insertText` 传入 `apply`。如果需要 snippet 扩展（光标占位/跳转），需要额外支持 CodeMirror snippet 插件；
- 生成器作用：
  - `scripts/generate-alphatex-commands.js` 做的是生成 / 合并 upstream 与 local 的 JSON；建议把它作为同步 upstream 的工具（不是直接运行时依赖）。

---

## 常见问题（FAQ）

Q: 是否必须在 `commandsJSON` 中同时维护 `properties`？
A: 不必须。Worker 会从 local JSON 获取 `properties`（若存在），若 local 缺失则 fallback 到 upstream `documentation.*Properties`。但建议对与项目相关的任何自定义（重要属性或行为）都写入 `commandsJSON.properties` 用于统一管理。

Q: 如何决定本地覆盖是否需要提交至 upstream？
A: 当 local JSON 中有内容是修复上游错误或新增属性/命令（与 upstream 行为不同），建议在 PR 中记录该差异，并且考虑把更改提交给上游（如果是通用改动）。 maintainers 也可以在本地文档中备注原因。

---

## 后续改进建议（可供采纳）

- CI 集成：自动运行 `pnpm generate:commands --merge` 且将 `alphatex-commands.generated.json` 更新到分支（或检视 diff），以便容易同步 upstream 变更；
- Snippet 支持：在 frontend 为 `insertText` 支持 snippet 展开，提升编辑体验；
- 增加更细粒度的测试：模拟 LSP 完成并断言 local-first/fallback 行为；
- 在 Editor 端提供“重载本地数据” Demo（或 devtools）帮助较快验证 JSON 变更。

---

## 变更记录（简要）
- v1.0 — 本地优先实现（commands + properties），worker 优先从 local JSON 读取并 fallback 到 upstream；生成脚本保留为合并/参考工具（2025-12-12）。

---

如果你希望，我可以接下来：
1. 把 `alphatex.worker.ts` 的优先读取（local-first）实现写成一段更清晰的伪代码供 Review；
2. 添加对应的验证/集成测试；
3. 把 `scripts/generate-alphatex-commands.js` 与 CI 集成（例如在 PR 时 check upstream diffs）。

你想让我先做哪一项？