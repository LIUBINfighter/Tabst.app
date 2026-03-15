# 明确 About 页与 Updates 页应承载的信息结构

## 背景
当前 About 页已经包含版本号、GitHub 链接、alphaTab 致谢和 README 内容；Updates 页也已经具备检查更新和展示 release feed 的能力。

## 问题
虽然基础功能已存在，但 About 和 Updates 仍更偏“功能页面”，还没有完全定义清楚它们各自应该向用户传达哪些核心信息。

例如：
- About 页应展示哪些产品与项目信息
- Updates 页应展示哪些版本与更新状态信息
- README、About、Release Notes 之间如何避免职责重叠

## 目标
明确 About 页与 Updates 页各自的信息结构和职责边界。

## 非目标
- 本 issue 不处理签名与发布可信链
- 本 issue 不要求立即完成视觉 redesign
- 本 issue 不要求一次性改完所有文案

## 产出
- About 页信息结构清单
- Updates 页信息结构清单
- README / About / Release Notes 的职责边界说明

## 验收标准
- [ ] 明确 About 页的核心信息项
- [ ] 明确 Updates 页的核心信息项
- [ ] 明确哪些内容应留在 README，哪些应进入应用内页面
- [ ] 后续实现可据此拆成更小 issue

## 相关文件
- `src/renderer/components/settings/AboutPage.tsx`
- `src/renderer/components/settings/UpdatesPage.tsx`
- `README.md`
- `src/renderer/i18n/locales/en/settings.json`
- `src/renderer/i18n/locales/zh-cn/settings.json`
- `src/renderer/i18n/locales/en/updates.json`
- `src/renderer/i18n/locales/zh-cn/updates.json`
