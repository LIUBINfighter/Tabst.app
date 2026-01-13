**概览**  
此文档总结我们从 alphaTab 相关包（@coderline/alphatab-language-server）获取语言资源并把它们转换、映射到自己的 LSP Worker 与 CodeMirror 编辑器的集成流程。目标是让 CodeMirror 6 在 Electron 中为 `.atex` 提供高亮、补全、悬停等智能编辑体验。

**来源与导出**

- 包导出（主要使用）：
  - `textMateGrammar` — TextMate 语法定义（用于高亮）
  - `languageConfiguration` — 注释/括号等语言行为提示
  - `documentation` — 包含 `beatProperties`、`noteProperties`、`durationChangeProperties` 等文档数据（用于补全、hover、签名帮助）
  - 其它：`startNodeLanguageServer`, `startWebWorkerLanguageServer`（未直接采用）
- 我们选择只取“数据/定义”并自己设计 Worker 行为（包里没有用于 Worker 的明确 `/worker` 导出）。
- 本项目优先使用本地维护的 `src/renderer/data/alphatex-commands.json` 作为本地标准（local-first），其中包含 `commands` 与 `properties`。Worker 会优先读取本地 JSON 的 `commands` 与 `properties` 来提供补全与 Hover；若本地缺失某项，则使用 `@coderline/alphatab-language-server` 的 `documentation` 对应字段作为 fallback（即 local-first, upstream-fallback 的策略）。

**文件映射（关键实现位置）**

- Worker 入口（我们自建）: alphatex.worker.ts
- LSP 客户端（编辑器端的 message 层）: alphatex-lsp.ts
- CodeMirror 补全扩展: alphatex-completion.ts
- 语法高亮（TextMate + WASM）: alphatex-highlight.ts
- 编辑器集成（加载高亮、LSP、补全）: Editor.tsx

**整体集成流程（要点步骤）**

1. 从包中导入需要的资源
   - 在 Worker 或编辑器端导入 `documentation`、`textMateGrammar`、`languageConfiguration`。
   - 例如：在 Worker 中 `import { documentation } from '@coderline/alphatab-language-server'` 使用文档数据构建补全项。

2. 语法高亮（TextMate + WASM）
   - 把 `textMateGrammar` 交给 `vscode-oniguruma`（WASM）做词法解析，然后映射为 CodeMirror 语法高亮扩展。
   - onig.wasm 已经放在 public 以保证路径稳定（开发/生产一致）。
   - 高亮实现：`getAlphaTexHighlight()`（alphatex-highlight.ts）加载 WASM、映射 grammar 到 CodeMirror，并作为拦截过滤的 fallback。

3. Web Worker LSP（我们自建）
   - 为什么自建：包没有 `worker` 导出或预打包的浏览器 worker，因此我们在 alphatex.worker.ts 自建 Worker。
   - Worker 的职责：处理 JSON-RPC 请求（`initialize`、`textDocument/completion`、`textDocument/hover` 等示例），并优先从本地 `src/renderer/data/alphatex-commands.json`（包含 `commands` 与 `properties`）提取补全与悬停信息；若本地缺失某项，则回退至 `@coderline/alphatab-language-server` 的 `documentation` 作为 fallback。
   - Worker 中实现的关键函数：
     - `getWordAtPosition(text, position)`：用于定位光标处的当前单词（示例实现）。
     - `getCompletions(word)`：从 `documentation.beatProperties|noteProperties|durationChangeProperties` 搜索匹配并构建 LSP completion items。
     - `handleCompletion(params)`：把 `getCompletions()` 的结果包装成 LSP style 返回（`items, isIncomplete`）。
     - `handleInitialize()`：返回 capability（`completionProvider`、`hoverProvider` 等）。
   - Worker 响应为标准 JSON-RPC 2.0（`id`, `result` 或 `error`）。

4. 编辑器端 LSP 客户端（transport & message routing）
   - `createAlphaTexLSPClient()`（alphatex-lsp.ts）：
     - 懒加载 Worker（`new Worker(new URL('../workers/alphatex.worker.ts', import.meta.url))`）。
     - 提供 `send()`、`onMessage()`、`request()`、`close()`。
     - `request()` 分配 `id`、在 `messageListeners` 注册回调，等待 Worker 返回并 resolve/reject promise（带超时）。
   - 此层把编辑器的 LSP 请求转发给 Worker 并返回结果给 Editor 扩展。

5. CodeMirror 补全扩展 & 编辑器注册
   - alphatex-completion.ts：实现 `createAlphaTexCompletionSource(lspClient)`，它将调用 `lspClient.request('textDocument/completion', params)` 获取 LSP 补全项并转换为 CodeMirror 兼容格式（`label`, `detail`, `info`, `apply`）。
   - Editor.tsx：
     - 根据文件类型（`filePath.endsWith('.atex')`）选择加载 AlphaTex 高亮和 LSP 扩展。
     - 初始化 LSP 客户端并 send `initialize`（示例）。
     - 将 `autocompletion` 扩展添加到 Editor 的 `extensions`。

**示例消息流程（补全）**

1. 用户光标驻留并触发补全（显式 Ctrl+Space 或自动触发）。
2. CodeMirror 的补全 Source 调用 `lspClient.request('textDocument/completion', { textDocument, position })`。
3. LSP 客户端给 Worker 发 JSON-RPC 请求（含 `id`）。
4. Worker 在 `handleCompletion` 中基于 `documentation` 查找匹配，返回 LSP completion items。
5. LSP 客户端接收到响应并将结果转换为 CodeMirror 格式后展示。

**转换映射（文档 => 补全项）**

- 我们把本地 `commandsJSON.properties`（优先）或 `documentation.*Properties`（fallback）（每项含 `property`, `shortDescription`, `longDescription`, `snippet`, `signatures`）映射：
  - `label` = `prop.property` 或 `prop.snippet`
  - `detail` = `(beat property)` 或 `(note property)` 等
  - `documentation` = `shortDescription` 或 `longDescription`（作为 Markdown 内容）
- 在编辑器端，将 LSP `item.documentation.value` 显示为 `info`（CodeMirror 弹窗/悬停）。

**已实现的功能**

- AlphaTex 语法高亮（基础）
- Worker 基础 LSP（`initialize`, `completion`, `hover` 占位）
- 编辑器客户端 LSP 请求/响应路由（`request()`）
- CodeMirror 补全扩展（调用 Worker补全）
- Autocomplete 展示基于 `documentation` 的候选项

**当前限制 / 未完全覆盖**

- 文档同步（`textDocument/didOpen` / `didChange`）未实现：Worker 不能获取最新文件内容，因此 `handleCompletion()` 无法精确基于文件上下文提取当前字词（现在基于示例或空 word）。
- `hover` / `signatureHelp` / `diagnostics` 仍是占位或未实现完整逻辑。

---

## 未完成 / 推荐的改进项（详细）

下面列出更具体的改进要求、实现建议和优先级，便于逐步完善 LSP 功能。按优先级执行可更快实现可见的编辑器体验提升。

### 1) 文档同步（重要/必须）

- 目标：实现 `textDocument/didOpen`, `textDocument/didChange`, `textDocument/didClose`，在 Worker 端维护文档缓存，以便对 `position` 做精确解析。
- 建议实现步骤：
  - 在编辑器端（`alphatex-lsp.ts`）监控 `EditorState` 变化并发送 `didOpen`/`didChange` 请求。
  - 在 Worker 中，维护 `documents: Map<string, string>`，并在 `didOpen`/`didChange` 更新缓存。
  - 在 `handleCompletion` 时，从 `documents[textDocument.uri]` 获取最新文本并使用 `getWordAtPosition()` 完整计算当前光标单词。

### 2) 精确补全（中/高）

- 目标：让 `handleCompletion` 基于当前文档上下文、光标位置以及前后 token 提供更高质量的候选项。
- 建议实现步骤：
  - 使用 `documents[uri]` 提取光标位置上下文并计算 `word` 与 `scope`（是否在命令、属性或时值段）。
  - 根据 `scope` 优先选择 `beatProperties`、`noteProperties` 或 `durationChangeProperties`。
  - 支持 `completion.resolve` 以在选中后返回更完整文档信息。

### 3) Hover 与 Signature Help（中）

- 目标：在悬停显示文档 `shortDescription`/`longDescription`，在参数输入时显示签名帮助。
- 建议实现步骤：
  - Worker 实现 `textDocument/hover`：定位当前 token，查找 `documentation.*Properties.get(token)` 并返回 Markdown 内容。
  - Worker 实现 `textDocument/signatureHelp`：使用 `documentation.*Properties.signatures` 中的 `parameters` 描述签名。

### 4) Diagnostics（中）

- 目标：提供语法警告/错误，可能通过 Pull 或 Publish 两种方式实现。
- 建议实现步骤：
  - 初期使用 Pull Diagnostics（编辑器主动请求），在 Worker 中提供一个 `textDocument/diagnostic` 处理函数，返回数组形式的 diagnostic 信息。
  - 中期改进为 Publish Diagnostics（Worker 在检测到更改后主动推送），节省 Editor 的主动查询开销并提供更实时诊断。

### 5) 文档与文法完整覆盖（中/低）

- 目标：把 `documentation` 的所有字段（如 `signatures`, `examples`）映射到 LSP/补全/hover/文档引用中，使用户能在编辑器中获取完整帮助。
- 建议实现步骤：
  - 补全项 `documentation` 使用 `longDescription` 或带 `examples` 的 Markdown 块以提高可读性。
  - 在 `alphatex-highlight.ts` 映射 `textMateGrammar` 到 CodeMirror scope（更细粒度的语法高亮）。

### 6) 性能与打包（低）

- 目标：减小 Worker 打包体积、延迟加载文档数据。
- 建议实现步骤：
  - 将 `documentation` 分割：按分类（beat, note, duration）做动态导入或单独 asset，Worker 在需要时加载（`import()`）。
  - 在 `vite.config.ts` 中配置 `build.rollupOptions.output.manualChunks` 把 Worker/Docs 拆成单独 chunk，避免主包膨胀。
  - 考虑使用 `Compress` 或二进制序列化（JSON -> BSON / binary）来优化大数据传输。

### 7) 测试、覆盖率与可观测性（重要）

- 目标：为 LSP 的关键功能编写单元与集成测试，并记录 metrics（Worker 启动时间、平均请求延迟等）。
- 建议测试用例：
  - 补全：在多种位置触发 `completion` 并断言返回项中包含预期 `label`。
  - Hover：断言 `hover` 返回 `shortDescription` 或 `longDescription`。
  - 文档同步：编辑文件并检查 Worker 缓存内容同步是否正确。

### 8) API 与功能一致性（低）

- 目标：在 Worker 层实现与 LSP 标准一致的 API（`initialize`, `shutdown`, `textDocument/didOpen`, `.../didChange` ...），后期兼容 `vscode-languageserver-node` 的行为。

---

## 实现建议与消息示例

下面给出几段 JSON-RPC 消息样本与伪代码，方便实现参考。

1. `textDocument/didOpen` - 编辑器发送

```json
{
  "jsonrpc": "2.0",
  "method": "textDocument/didOpen",
  "params": {
    "textDocument": {
      "uri": "file:///main.atex",
      "languageId": "alphatex",
      "version": 1,
      "text": "...文件内容..."
    }
  }
}
```

Worker 端伪代码

```ts
function handleDidOpen(params) {
  documents.set(params.textDocument.uri, params.textDocument.text);
}
```

2. `textDocument/didChange` - 编辑器发送（部分或全量）

```json
{
  "jsonrpc": "2.0",
  "method": "textDocument/didChange",
  "params": {
    "textDocument": { "uri": "file:///main.atex", "version": 2 },
    "contentChanges": [{ "text": "..." }]
  }
}
```

Worker 端伪代码

```ts
function handleDidChange(params) {
  // 这里可以支持增量或全量替换
  const change = params.contentChanges[0];
  documents.set(params.textDocument.uri, change.text);
}
```

3. `textDocument/completion` 请求/响应（示例）

```json
// 请求
{ "jsonrpc": "2.0", "id": 3, "method": "textDocument/completion", "params": { "textDocument": { "uri": "file:///main.atex" }, "position": { "line": 10, "character": 4 } } }

// Worker 响应
{ "jsonrpc": "2.0", "id": 3, "result": { "isIncomplete": false, "items": [{ "label": "f", "kind": 7, "detail": "(beat property)", "documentation": { "kind": "markdown", "value": "Fade-In" } }] } }
```

4. `textDocument/hover` 请求/响应

```json
// 请求
{ "jsonrpc": "2.0", "id": 4, "method": "textDocument/hover", "params": { "textDocument": { "uri": "file:///main.atex" }, "position": { "line": 2, "character": 4 } } }

// 响应
{ "jsonrpc": "2.0", "id": 4, "result": { "contents": [{ "kind": "markdown", "value": "**f** - Fade-In: Adds a fade-in effect." }] } }
```

5. `textDocument/publishDiagnostics` 示例（Worker或Service推送）

```json
{
  "jsonrpc": "2.0",
  "method": "textDocument/publishDiagnostics",
  "params": {
    "uri": "file:///main.atex",
    "diagnostics": [
      {
        "range": {
          "start": { "line": 2, "character": 4 },
          "end": { "line": 2, "character": 7 }
        },
        "severity": 1,
        "message": "Unknown property 'zz'"
      }
    ]
  }
}
```

---

## 测试与验证步骤（快速上手）

1. 启动（开发）

```powershell
pnpm install
pnpm dev
```

2. 打开 Electron 应用或在浏览器中访问渲染端，打开一个 `.atex` 文件。
3. 在编辑器中测试：
   - 补全：在文本中输入 `f`、`fo` 或 `\` 并触发补全（Ctrl+Space），验证返回项；
   - Hover：将鼠标悬停在某个属性上，检查 Markdown 文档显示；
   - 诊断：添加语法错误 (例如 `zz`) 并观察 diagnostics 推送（暂未完全部署）。

4. 性能测试与打包：
   - 执行 `pnpm build` 并检查 `dist` 中 `alphatex.worker-*.js` 的大小；
   - 若过大，按“性能建议”拆分文档加载或优化构建。

---

## 结语

我们已经实现了可用的 AlphaTex 编辑器集成原型（高亮 + 基本 LSP + 补全），并实现了从 `@coderline/alphatab-language-server` 提取文档/语法数据并在 Worker 中进行转换与服务的流程。接下来的工作是集中在“同步/精确补全、悬停、诊断”上，以将当前原型升级为接近 VSCode 的完整体验。

如果你同意，我可以优先实现 `textDocument/didOpen/didChange`（Worker 端文档缓存）和基于位置的精确补全，随后添加 hover 与 diagnostics。
