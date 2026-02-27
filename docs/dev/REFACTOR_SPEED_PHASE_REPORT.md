# refactor/speed 阶段性优化报告（Phase Summary）

更新时间：2026-02-27

---

## 1. 范围与目标

本阶段聚焦三个方向：

1. **可重复测量体系**（从“体感”变成“可量化数据”）
2. **Preview 生命周期与事件链稳定性**（减少重建/监听相关不稳定）
3. **打包体积热点优化**（优先处理 `vendor-syntax`）

---

## 2. 本阶段关键改动（refactor/speed）

### A. 测量与压测能力建设

- 新增基线脚本：
  - `scripts/collect-week1-baseline.mjs`
  - `scripts/run-multi-baseline.mjs`
  - `scripts/run-long-session-stress.mjs`
  - `scripts/summarize-long-session.mjs`
- 新增命令：
  - `pnpm baseline:week1`
  - `pnpm baseline:multi`
  - `pnpm stress:long`
  - `pnpm stress:summary`
- 数据沉淀（已写入 `docs/dev/ops/`，并已加入 `.gitignore`）

### B. Preview 稳定性重构

- 拆分并抽象生命周期逻辑：
  - `usePreviewApiLifecycle`
  - `usePreviewEventBindings`
  - `usePreviewLifecycleTelemetry`
- 关键优化：
  - 统一 API destroy/rebuild 入口，减少重复路径
  - 主题重建加入节流，降低重入风险
  - 对播放状态写入加入去重（`isPlaying/cursor/progress`）
  - `tex()` 重复内容抑制，降低无效渲染

### C. syntax 包体积优化

- `CodeBlock.tsx` 从全量 Prism 入口改为 `prism-light`
- 仅注册实际常用语言：`ts/js/json/markdown`（`alphatex` 继续映射 markdown）

---

## 3. 数据结果（核心）

## 3.1 打包体积

- `vendor-syntax`：
  - 优化前：`1,795,074` bytes
  - 优化后：`212,980` bytes
  - 下降：约 **88.1%**

## 3.2 性能基线（5 轮，多次复测）

以 `week2-baseline` 作为参考基线，对比 `final-opt-summary`：

- `cold_domcl` mean：`342.46ms`（较基线下降约 `139.14ms`）
- `cold_load` mean：`343.68ms`（较基线下降约 `424.02ms`）
- `heap_delta` mean：`452,652.8`（较基线 `2,959,128` 明显收敛）

说明：

- 冷启动时序优化稳定有效；
- 内存增长速度相比早期阶段明显改善；
- listeners 指标仍存在离群场景，需要继续做分场景定位。

---

## 4. 风险与未完成事项

1. `vendor-alphatab` 仍是超大块（库本身重量级 + 主路径依赖广泛）。
2. Preview 的类型债仍未完全清完（`@ts-nocheck` 未完全移除）。
3. listeners 在特定场景仍可能出现高值样本，需要进一步归因。

---

## 5. 下一阶段规划（建议）

1. **listeners 离群专项（P0）**
   - 增加按事件名统计（bind/unbind 次数 + 存活监听数）
   - 分场景压测：editor-only / tutorial-only / print-toggle / theme-toggle

2. **Preview 类型清债（P1）**
   - 分段移除 `@ts-nocheck`
   - 优先事件层和 rebuild 分支，降低维护风险

3. **alphaTab 体积治理（P1）**
   - 继续按访问路径切分 tutorial/playground 与主编辑路径
   - 目标是降低 `vendor-alphatab` 对冷路径的影响

4. **CI 性能门禁（P2）**
   - 将 `baseline:multi` 结果纳入阈值（cold_load / heap_delta / listeners P95）

---

## 6. English Executive Summary

On `refactor/speed`, we delivered a measurable performance phase: repeatable profiling pipelines, major `Preview` lifecycle stabilization, and targeted bundle optimization.

Key outcomes:

- `vendor-syntax` dropped from **1,795,074 B** to **212,980 B** (~**88.1%** reduction).
- 5-run baseline vs week2 baseline shows consistent cold-start gains:
  - `cold_domcl` mean: **342.46ms** (about **-139ms**)
  - `cold_load` mean: **343.68ms** (about **-424ms**)
  - `heap_delta` mean reduced substantially.

Remaining priorities are listener outlier diagnosis, finishing `Preview` type-hardening, and further reducing `vendor-alphatab` impact on cold paths.
