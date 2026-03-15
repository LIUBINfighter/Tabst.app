# 定义 Tabst 的统一产品介绍口径

## 背景
当前 Tabst 在不同位置的产品介绍不完全一致。

例如：
- `package.json` 中使用的是 “A minimal Guitar Tabs typewriter.”
- `README.md` 中使用的是 “Write guitar tabs like markdown.”
- 应用内 About 页还强调 alphaTex 写作、播放和 PDF/GP 分享

这些表述方向接近，但还没有形成统一、稳定的产品身份表达。

## 问题
用户在 GitHub README、应用内 About、未来 release 页面等入口看到的介绍不一致，会削弱产品辨识度，也会增加后续文案维护成本。

## 目标
确定一套统一的产品介绍文案，包括：
- 一句话定位
- 一段短介绍
- 一段稍长介绍

并明确这些文案分别用于哪些位置。

## 非目标
- 本 issue 不处理签名与发布流程
- 本 issue 不处理 About 页的视觉设计改版

## 产出
- 一套统一的产品介绍文案
- 文案应用位置清单：README、About、package description、release notes 等

## 验收标准
- [ ] 明确 Tabst 的一句话定位
- [ ] 明确一段 2-3 句的标准介绍
- [ ] 列出需要同步修改的所有入口
- [ ] 团队可以使用同一套文案对外描述产品

## 相关文件
- `README.md`
- `package.json`
- `src/renderer/components/settings/AboutPage.tsx`
- `src/renderer/i18n/locales/en/settings.json`
- `src/renderer/i18n/locales/zh-cn/settings.json`
