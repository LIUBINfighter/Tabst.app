# Tabst Information Architecture Archive

**Date / 日期**: 2026-03-22  
**Status / 状态**: Archive snapshot based on Tauri MCP interaction test / 基于 Tauri MCP 交互测试的归档快照

## Purpose / 目的

This note records the current information architecture observed from the running Tauri app.  
本文记录当前运行中的 Tauri 应用所呈现的信息架构。

It is intentionally short and should be treated as an implementation-facing archive, not a final product spec.  
本文刻意保持简短，应视为面向实现的归档记录，而不是最终产品规范。

## Primary Areas / 一级区域

### 1. Main Workspace / 主工作区

- Core job: write, inspect, preview, and play AlphaTex tabs.
- 核心任务：编写、检查、预览并播放 AlphaTex 谱面。
- Observed layout: file/content list on the left, editor in the center, preview on the right, transport and playback controls at the bottom.
- 观察到的布局：左侧文件/内容列表，中部编辑器，右侧预览，底部播放与传输控制。

### 2. Tutorial / 教程

- Core job: onboard new users and teach AlphaTex progressively.
- 核心任务：帮助新用户上手，并循序渐进教授 AlphaTex。
- Observed structure: audience switcher, language switcher, chapter navigation, previous/next navigation, and interactive AlphaTex playground examples.
- 观察到的结构：受众切换、语言切换、章节导航、前后页导航，以及交互式 AlphaTex playground 示例。

### 3. Settings / 设置

- Core job: tune playback behavior and UI behavior.
- 核心任务：调整播放行为与界面行为。
- Observed structure: categorized settings pages such as appearance, playback, commands, templates, shortcuts, updates, roadmap, and about.
- 观察到的结构：按分类组织的设置页，例如外观、播放、命令、模板、快捷键、更新、路线图和关于。

### 4. Source Control / 版本控制

- Core job: manage repo state without leaving the app.
- 核心任务：不离开应用即可管理仓库状态。
- Observed structure: branch indicator, changed-file list, per-file stage toggle, sync action, stage-all action, commit message input, commit action, and diff panel.
- 观察到的结构：分支指示、改动文件列表、单文件暂存开关、同步、全部暂存、提交信息输入框、提交动作以及差异面板。

## Core User Routes / 核心用户路线

### Route A: Learn the product / 学习产品

- Open `Tutorial`.
- 进入 `教程`。
- Read welcome content.
- 阅读欢迎内容。
- Move chapter by chapter through AlphaTex topics.
- 按章节学习 AlphaTex 主题。
- Use embedded examples to connect syntax and notation.
- 通过嵌入示例把语法和谱面结果关联起来。

### Route B: Create and refine tabs / 创作并打磨谱面

- Select an existing tab or create/open one from the main workspace.
- 在主工作区选择现有谱面，或新建/打开谱面。
- Edit AlphaTex in the center editor.
- 在中间编辑器中修改 AlphaTex。
- Inspect notation in the preview pane.
- 在预览区检查谱面结果。
- Use playback controls to validate rhythm and flow.
- 使用播放控件验证节奏与整体流动。

### Route C: Tune playback experience / 调整播放体验

- Open `Settings`.
- 进入 `设置`。
- Visit playback-related controls.
- 查看与播放相关的控制项。
- Adjust options such as keep-awake, drag seeking, editor sync, and preview cursor broadcast.
- 调整常亮、拖动定位、编辑器同步和预览光标广播等选项。

### Route D: Manage project state / 管理项目状态

- Open `Source Control`.
- 进入 `版本控制`。
- Review changed files and status codes.
- 查看改动文件和状态码。
- Stage selectively or stage all.
- 按需暂存或全部暂存。
- Enter a commit message and prepare a commit.
- 输入提交信息并准备提交。

## Product Reading / 产品解读

- Tabst is not only an editor. It is a combined workspace for learning, authoring, playback, and repo management.
- Tabst 不只是编辑器，而是把学习、创作、播放和仓库管理组合在一起的工作台。
- The strongest IA split today is: `Workspace / Tutorial / Settings / Source Control`.
- 当前最清晰的信息架构分层是：`工作区 / 教程 / 设置 / 版本控制`。
- This structure supports both beginners and repeat creators.
- 这种结构同时服务新手用户和高频创作者。

## Current Risks / 当前风险

- The preview pipeline continuously logs `Could not load font 'alphaTab'`, which suggests a rendering resource problem still exists.
- 预览链路持续输出 `Could not load font 'alphaTab'`，说明渲染资源问题仍然存在。
- Tutorial playback controls were visible and clickable, but playback-state confirmation remains incomplete from logs alone.
- 教程中的播放控件可见且可点击，但仅从日志看，播放状态确认仍不充分。

## Suggested Follow-up / 建议后续工作

- Produce a fuller journey map from first-run to repeat daily use.
- 从首次使用到日常复用，整理更完整的用户旅程图。
- Resolve the alphaTab font-loading issue before treating preview/playback routes as fully healthy.
- 在把预览/播放路线视为完全健康之前，先解决 alphaTab 字体加载问题。
- Convert this archive into a maintained IA spec only if navigation boundaries are expected to change.
- 只有在导航边界预计继续变化时，再把本文升级为持续维护的 IA 规范。
