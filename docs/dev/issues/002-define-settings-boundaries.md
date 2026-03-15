# 定义全局设置、工作区设置与会话状态的边界

## 背景
当前项目已经有设置页和设置持久化逻辑，但“全局设置”和“工作区设置”的边界还不够清晰。

现有实现中，`global-settings` 实际更偏向工作区优先、旧全局设置兜底。

## 问题
如果不尽早定义设置分层，后续新增设置项时容易出现：
- 同一个设置到底是全局还是工作区级别不明确
- 用户切换 repo 后设置行为不符合预期
- 存储结构越来越难维护

## 目标
定义清晰的设置分层规则，至少区分：
- 全局设置
- 工作区设置
- 会话状态

并明确每一类适合承载哪些字段。

## 非目标
- 本 issue 不要求一次性实现所有迁移
- 本 issue 不新增大量设置项
- 本 issue 不处理签名或更新流程

## 产出
- 设置分层规则文档
- 当前已有设置项的归类结果
- 后续新增设置项的归类原则

## 验收标准
- [ ] 明确哪些设置属于全局
- [ ] 明确哪些设置属于工作区
- [ ] 明确哪些字段只是会话态，不应长期持久化
- [ ] 为未来新增设置项提供统一判断标准

## 相关文件
- `src/renderer/lib/global-settings.ts`
- `src-tauri/src/settings_commands.rs`
- `src/renderer/store/appStore.ts`
- `src/renderer/store/themeStore.ts`
- `src/renderer/types/settings.ts`
- `src/renderer/types/repo.ts`
