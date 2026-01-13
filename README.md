# Tabst.app

Write guitar tabs like markdown.

## 技术栈

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

## 开发环境

MCP服务器

- context7
- shadcn/ui

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
