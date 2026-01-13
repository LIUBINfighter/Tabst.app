# Barlines：修复说明与迁移到 ViewPlugin 的计划 📋

## 概要 ✅

记录对 `alphatex-barlines` 插件的临时修复（降低 CodeMirror 因装饰更新而崩溃的概率），并给出将插件迁移到 `ViewPlugin`、实现请求取消与位置映射的详细步骤与验收标准。

---

## 复现（已观测到的错误）

- 控制台常见错误：
  - `Cannot read properties of null (reading 'append')`（在 CodeMirror internals）
  - `Cannot destructure property 'tile' of 'parents.pop(...)' as it is undefined`（Tile/DocView 更新相关）

复现场景：在 `.atex` 文件中**在最后一行频繁点击或移动光标**，或在 LSP 返回 barlines 结果到达时文档已被快速修改。

---

## 根本原因分析 🔍

1. 异步 LSP 响应与当前文档/视图不一致：LSP 基于旧文本返回位置，当响应到达时文档发生了变更，位置越界或顺序不一致。
2. RangeSetBuilder 的不变性（严格递增位置）被破坏，导致构造出的 DecorationSet 在内部结构上不合法，进而让 CodeMirror 在构建 tiles/DOM 时崩溃。
3. 异步回调在视图被销毁/从 DOM 中移除后仍尝试 dispatch，触发 null 访问（例如 append）。

---

## 已实施的临时修复（已提交） ✅

文件：`src/renderer/lib/alphatex-barlines.ts`

具体改动：

- 在处理 LSP 返回前检查 `update.view` 是否存在且 `view.dom` 在 `document` 中，避免向已销毁或脱离 DOM 的视图派发事务。
- 在添加 Decoration 后，使用 `lastPos = pos + 1`（记录实际插入位置），保证 RangeSetBuilder 的严格递增顺序。
- 在 `builder.finish()` 外层加 try/catch，若构建失败则回退到旧的 decorations（避免把非法 DecorationSet 写入 EditorState 并触发更深层错误）。
- 改进了错误处理与日志（避免未定义 `err` 的引用，避免静默失败）。

短期效果：显著降低了崩溃概率并在大多数 race 情况下避免 editor internals 抛出异常。

---

## 验证步骤（建议） ✅

1. 打开 AlphaTex (`.atex`) 文件并频繁移动光标、快速输入/删除。确保 DevTools 打开查看控制台。
2. 验证在此前能重现的问题场景下不再出现 `tile` / `append` / `null` 等相关错误。
3. 复查 bar numbers 的呈现正确性（不缺行、不错位）。

若出现问题，请保存最近的堆栈与复现步骤（文件内容片段、是否空文件、是否同时切换文件等）。

---

## 为彻底根治的迁移计划（迁移到 ViewPlugin + 请求取消与位置映射）🚀

目标：把 barlines 更新逻辑从当前基于 StateField + updateListener 的实现迁移成基于 `ViewPlugin` 的实现，并实现对异步请求的取消、响应的版本验证与位置映射，以保证在快节奏编辑场景下的数据一致性与稳定性。

优先级与阶段划分：

### 阶段 0（已完成） - 防护修复

- 视图存在性检查、lastPos 修正及 finish() 容错（已合入）。

### 阶段 1（高优先） - 请求取消与文档版本验证（建议优先实现）

- 在发起每次请求时生成 `requestId` 或使用 `AbortController`。
- 若文档变化则取消/中止上一次请求或者在响应到达时比对 `requestId`/docVersion，仅在匹配时应用返回。
- 验收：在快速编辑与频繁请求情形下，不会应用过期响应导致的 decorations。

示意伪码：

```ts
let requestId = 0;
function scheduleUpdate(view) {
  currentController?.abort();
  const id = ++requestId;
  const controller = new AbortController();
  currentController = controller;
  fetchBrlines(docText, { signal: controller.signal })
    .then((res) => {
      if (id !== requestId) return; // 过期
      apply(res);
    })
    .catch((e) => {
      if (e.name !== "AbortError") console.error(e);
    });
}
```

### 阶段 2（中优先） - 迁移到 ViewPlugin 并绑定生命周期

- 把 barlines 的更新逻辑迁移到 `ViewPlugin`，在 `destroy()` 时取消控制器并清理定时器。
- ViewPlugin 的 `update()` 用以判断是否需要触发新的请求（例如：docChanged / viewportChanged / selectionChanged）。
- 验收：在切页、关闭或重建 view 时不再发生向已销毁 view 的派发。

示意伪码（结构）：

```ts
const barlinesPlugin = ViewPlugin.fromClass(
  class {
    constructor(view) {
      this.view = view;
      this.requestId = 0;
    }
    update(update) {
      if (update.docChanged) this.schedule();
    }
    schedule() {
      /* 发起请求，处理中止逻辑 */
    }
    destroy() {
      this.currentController?.abort();
    }
  }
);
```

### 阶段 3（中低优先） - 位置映射与可视范围限制

- 当 LSP 返回基于旧文档位置的数据时，尝试使用事务映射（若可用）将旧位置转为当前位置；对不可映射或越界的位置丢弃。
- 仅为可见行或与光标邻近行更新 decorations（降低更新量、减少暴露面）。
- 验收：在复杂并发编辑场景中没有出现不合法 DecorationSet 或 tile 错误，同时能保持 UI 准确性。

### 阶段 4（测试与监控）

- 添加集成测试覆盖“快速编辑 + LSP 响应延迟”场景（可使用 JSDOM / headless 环境做回归）。
- 增加运行期指标与日志（响应 id、被丢弃的过期响应数、异常计数）。

---

## 估算 & 验收条件 🧾

- 阶段 1（取消 + 版本验证）：约半天 - 1 天，风险低，收益高。
- 阶段 2（迁移到 ViewPlugin）：1~2 天，需较多验证并更新测试。
- 阶段 3（映射 + 可见范围优化）：1~2 天视复杂度。

验收条件（至少）:

- 在快速光标移动/频繁编辑下不再出现原始异常堆栈。
- decorations 的渲染准确（无重复/错位/越界）。
- 在 view destroy 时没有未处理的异步回调导致报错。

---

## 后续任务清单（建议）

- [ ] 实现请求取消 + requestId/docVersion 验证（高优先）
- [ ] 将插件迁移到 ViewPlugin 并管理生命周期（中优先）
- [ ] 添加位置映射逻辑并限制只更新可见范围（中优先）
- [ ] 写集成测试与运行期监控（中优先）

---

如果你认可这个文档和计划，我可以：

- 先实现阶段 1（request cancel + docVersion 验证）并提交 PR；
- 随后把插件迁移到 ViewPlugin（阶段 2），并在每个阶段都做验证与测试。

如需我现在开始实现阶段 1，请回复“开始阶段 1”。
