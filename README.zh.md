# Tabst

[![DOI](https://zenodo.org/badge/1133258569.svg)](https://doi.org/10.5281/zenodo.18447447)
![CI](https://img.shields.io/github/actions/workflow/status/LIUBINfighter/Tabst.app/ci.yml?branch=main)
![Release](https://img.shields.io/github/v/release/LIUBINfighter/Tabst.app)
![下载量 (总)](https://img.shields.io/github/downloads/LIUBINfighter/Tabst.app/total)
![下载量 (最新)](https://img.shields.io/github/downloads/LIUBINfighter/Tabst.app/latest/total)

Write guitar tabs like markdown.

## Feature 功能

Write. Play. Share.

高效书写alphaTex. 播放曲谱. 分享PDF/GP.

## Why Tabst 为什么我要写这个软件

向笨重的二进制和xml说不，世界属于纯文本。

既然文档写作已经有开箱即用的广大 Markdown 编辑器，追求精确排版的LaTeX和创新的Typst，为什么在吉他谱领域，还要像 word 一样在曲谱上点点点把音符连接起来？

MusiXTeX, Lilypond 在乐谱标记语言上做出了出版级的表率，而 alphaTab.js 让可交互可播放的乐谱成为可能。在 Tabst 中，我们以简单直观的语法书写 alphaTex，并轻松与朋友分享。

这只是一个开始，我的愿景是将散落为pdf/图片的曲谱们都转化为 Tabst 中存储的alphaTex. 视觉大模型（OMR光学音符识别）正在路上。

## Tech Stack 技术栈

- pnpm
- TypeScript
- Vite
- [Electron](https://www.electronjs.org/zh/docs/latest/)
- [React 19](https://zh-hans.react.dev/)
- [shadcn/ui](https://ui.shadcn.com/)
- [Tailwindcss 3](https://www.tailwindcss.cn/docs/installation) (最终还是决定换回3，v4不够稳定)
- [biome](https://biomejs.dev/guides/getting-started/)
- [Zustand](https://github.com/pmndrs/zustand)
- [Lucide Icon](https://lucide.dev/guide/packages/lucide-react)
- [alphaTex](https://www.alphatab.net/docs/alphatex/introduction)
- [alphaTab.js](https://www.alphatab.net/)
- [CodeMirror](https://codemirror.net/)

## 开发环境

MCP服务器

- [context7](https://context7.com/)
- [shadcn/ui](https://ui.shadcn.com/)

## 安装

```powershell
pnpm install
```

## 开发

```powershell
pnpm run dev  # 运行 React 开发服务器 + Electron 开发进程
```

## 构建

```powershell
pnpm run build  # 构建渲染器 + 主进程 (Vite + esbuild)
```

## 打包 (Electron Forge)

此项目使用 Electron Forge 来打包和构建可分发的安装程序。

基本命令：

```powershell
pnpm run make  # Electron Forge: 打包 + 创建安装程序
```

## CI

- ci.yml
- dependabot.yml

## 许可证

此项目采用 [MPL 2.0 license](LICENSE)。
