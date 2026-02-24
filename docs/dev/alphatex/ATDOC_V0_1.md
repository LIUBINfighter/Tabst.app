# ATDOC v0.1 设计与实现说明

最后更新：2026-02-24

## 1. 目标

v0.1 在 v0 基础上补齐“可写性”：

1. 保持 v0 的安全白名单与稳定渲染；
2. 增加编辑阶段的提示能力（completion + hover）；
3. 提供可直接复制运行的完整 `.atex` 示例。

---

## 2. 与 v0 的差异

### 2.1 新增能力

- AlphaTex worker completion：输入 `at.` 时可补全 ATDOC keys；
- AlphaTex worker hover：光标停留在 `at.*` key 上显示文档；
- 明确 `at.*` key 元数据中心（key/type/description/example）。

### 2.2 不变约束

- 仍然只允许白名单 key；
- 仍然会在 `api.tex()` 前剥离 ATDOC 指令行；
- 未知 key / 非法值仍然 warning，不会中断渲染。

---

## 3. 数据模型（v0.1）

新增中心定义文件：

- `src/renderer/data/atdoc-keys.ts`

包含：

- `ATDOC_KEY_DEFINITIONS`
- `AtDocKeyDefinition`
- 枚举值常量（layout/scroll）

用途：

1. Parser/validator 共用同一 key 清单；
2. Worker completion/hover 共用同一 key 清单；
3. 降低“规范与实现漂移”风险。

---

## 4. 编辑器行为

### 4.1 Completion

- 触发：当前 token 前缀是 `at.`；
- 输出：所有匹配 key；
- 插入文本：`key=${1:value}` snippet 样式，值模板随类型变化。

### 4.2 Hover

- 触发：光标落在完整 `at.*` key；
- 输出：
  - key 名称
  - 描述
  - 示例

---

## 5. 实现边界

v0.1 **不做**：

- 复杂 AST 级诊断面板（仅 console warning）；
- UI 侧 ATDOC inspector；
- 自动修复或回写源文本；
- 开放 rebuild 级配置键。

---

## 6. 验证清单

1. 在注释内输入 `at.` 可看到补全；
2. hover `at.display.scale` 可见解释；
3. 未知 key（如 `at.foo.bar`）不会崩溃，仅 warning；
4. Preview 与 Print 都使用 cleanContent 渲染；
5. v0 既有 key 行为与构建流程保持通过。
