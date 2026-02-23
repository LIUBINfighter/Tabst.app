# Roadmap 规划

This file now tracks roadmap items with checkboxes.
本文件现在使用复选框跟踪路线图事项。

✅ Completed / 已完成
🚧 WIP / 未完成

## Feature Tree 功能树

```text
Tabst User Operation Path Tree
├─ 0. Launch App
│  ├─ Restore app/repo/file state
│  ├─ Warm up AlphaTex highlight + LSP worker
│  └─ Start repo filesystem watch for external changes
├─ 1. Enter Workspace Mode
│  ├─ editor
│  │  ├─ Empty state (open sidebar / tutorial / settings)
│  │  ├─ .atex file → split layout (Editor + Preview)
│  │  └─ non-.atex file → editor only
│  ├─ tutorial
│  └─ settings
├─ 2. Repo & File Management (Sidebar)
│  ├─ Select / switch / add repo
│  ├─ Browse tree (expand/collapse + keyboard)
│  ├─ Create .atex / .md / folder
│  ├─ Open file and hydrate content from disk
│  ├─ Rename / move (drag-drop) / delete
│  ├─ Reveal in folder / copy path
│  └─ Theme toggle (light/dark/system)
├─ 3. Editing Flow (CodeMirror)
│  ├─ Text editing
│  ├─ LSP language features
│  ├─ Debounced autosave
│  ├─ Selection & playback highlight sync
│  └─ Editor focus state sync
├─ 4. Preview & Playback (alphaTab)
│  ├─ AlphaTex rendering
│  ├─ Editor ↔ Score selection sync
│  ├─ Playback state/cursor sync
│  ├─ TAB/Staff toggle
│  ├─ Zoom / speed / metronome controls
│  ├─ Tracks panel
│  ├─ Parse error recovery
│  └─ Theme-driven API rebuild with track config restore
├─ 5. Global Bottom Bar
│  ├─ Editor + .atex: full playback control set
│  ├─ Tutorial mode: prev/next tutorial navigation
│  └─ Settings mode: page-aware controls
├─ 6. Export & Print
│  ├─ Export MIDI / WAV / GP7
│  └─ Print preview subsystem (isolated alphaTab API)
├─ 7. Tutorial System
│  ├─ Load MDX first, fallback to Markdown
│  ├─ Keyboard navigation (Esc / ← / →)
│  └─ Close back to editor
├─ 8. Settings System
│  ├─ Appearance
│  ├─ Playback
│  ├─ Updates
│  └─ About
└─ 9. Update System
   ├─ Check for updates
   ├─ Fetch and parse releases feed
   ├─ Update toast event stream
   └─ Install update and restart app
```

```text
Tabst 用户操作路径总树
├─ 0. 启动应用
│  ├─ 恢复应用/仓库/文件状态
│  ├─ 预热 AlphaTex 高亮与 LSP Worker
│  └─ 启动仓库文件系统监听（外部改动自动感知）
├─ 1. 进入工作区模式
│  ├─ editor
│  │  ├─ 空态引导（展开侧栏 / 教程 / 设置）
│  │  ├─ .atex 文件 → 双栏（编辑器 + 预览）
│  │  └─ 非 .atex 文件 → 仅编辑器
│  ├─ tutorial
│  └─ settings
├─ 2. 仓库与文件管理（侧栏）
│  ├─ 选择 / 切换 / 添加仓库
│  ├─ 文件树浏览（展开/折叠 + 键盘操作）
│  ├─ 新建 .atex / .md / 文件夹
│  ├─ 打开文件并从磁盘加载内容
│  ├─ 重命名 / 拖拽移动 / 删除
│  ├─ 在系统文件管理器中定位 / 复制路径
│  └─ 主题切换（亮色/暗色/跟随系统）
├─ 3. 编辑流程（CodeMirror）
│  ├─ 文本编辑
│  ├─ LSP 语言能力
│  ├─ 防抖自动保存
│  ├─ 选区与播放高亮同步
│  └─ 编辑器焦点状态同步
├─ 4. 预览与播放（alphaTab）
│  ├─ AlphaTex 渲染
│  ├─ 编辑器 ↔ 乐谱选区同步
│  ├─ 播放状态/光标同步
│  ├─ TAB/五线谱切换
│  ├─ 缩放 / 速度 / 节拍器控制
│  ├─ 轨道面板
│  ├─ 解析错误恢复
│  └─ 主题切换触发 API 重建并恢复轨道配置
├─ 5. 全局底部栏
│  ├─ 编辑模式 + .atex：完整播放控制
│  ├─ 教程模式：上一节/下一节导航
│  └─ 设置模式：按页面显示对应控制
├─ 6. 导出与打印
│  ├─ 导出 MIDI / WAV / GP7
│  └─ 打印预览子系统（独立 alphaTab API）
├─ 7. 教程系统
│  ├─ 优先加载 MDX，回退 Markdown
│  ├─ 键盘导航（Esc / ← / →）
│  └─ 关闭后返回编辑模式
├─ 8. 设置系统
│  ├─ 外观
│  ├─ 播放
│  ├─ 更新
│  └─ 关于
└─ 9. 更新系统
   ├─ 检查更新
   ├─ 拉取并解析版本发布源
   ├─ 更新状态 Toast 事件流
   └─ 安装更新并重启应用
```
