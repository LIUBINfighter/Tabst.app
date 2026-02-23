# Roadmap 规划

This file now tracks roadmap items with checkboxes.
本文件现在使用复选框跟踪路线图事项。

## Future Planning / 未来规划（按类别分组 + 优先级）

- **WIP**: currently focused in-progress items / 当前重点推进项
- **Next**: next release candidates / 下个阶段候选项
- **Later**: longer-term initiatives / 中长期规划项

### A. Core Stability & Consistency / 核心稳定性与一致性
- [ ] [WIP] Preview/Playback Sync Stability / 预览与播放同步稳定性
- [ ] [WIP] Print Preview Consistency / 打印预览一致性
- [ ] [WIP] Theme System (Light/Dark + Font Adaptation) / 主题系统（明暗色适配 + 字体适配）
- [ ] [Next] Custom Font / 自定义字体
- [ ] [Next] Score Coloring / 乐谱着色

### B. Editor Core Capabilities / 编辑器核心能力
- [ ] [WIP] Editor AST Enhancements / 编辑器 AST 增强
- [ ] [Next] Editor Linter/Formatter / 编辑器 Linter/Formatter
- [ ] [Next] Editor AlphaTex Templates / 编辑器 AlphaTex 模版
- [ ] [Later] atdoc metadata comments (/** */) / atdoc 元数据批注（/** */）

### C. Import/Export & Sharing / 导入导出与分享
- [ ] [Next] GP File Import (Guitar Pro -> alphaTex) / GP 文件导入（Guitar Pro -> alphaTex）
- [ ] [Next] Image/Card Export for Sharing / 图片/卡片导出（分享功能）
- [ ] [Later] OMR Import (Image -> alphaTex) / OMR 导入（图片 -> alphaTex）

### D. Audio & Rendering Customization / 音频与渲染自定义
- [ ] [Next] Custom SoundFont (.sf*) / 自定义 SoundFont（.sf* 文件）

### E. Tutorial & Learning Experience / 教程与学习体验
- [ ] [Next] Tutorial System Upgrade (Learning + Developer Editions) / 教程系统升级（学习版 + 开发版）
- [ ] [Next] Interactive Tutorial Components / 教程内可交互练习组件

##  Feature Tree 功能树

```text
Tabst User Operation Path Tree / 用户操作路径总树
├─ 0. Launch App / 启动应用
│  ├─ Restore app/repo/file state / 恢复应用/仓库/文件状态
│  ├─ Warm up AlphaTex highlight + LSP worker / 预热 AlphaTex 高亮与 LSP Worker
│  └─ Start repo filesystem watch for external changes / 启动仓库文件系统监听（外部改动自动感知）
├─ 1. Enter Workspace Mode / 进入工作区模式
│  ├─ editor / 编辑器
│  │  ├─ Empty state (open sidebar / tutorial / settings) / 空态引导（展开侧栏 / 教程 / 设置）
│  │  ├─ .atex file → split layout (Editor + Preview) / .atex 文件 → 双栏（编辑器 + 预览）
│  │  └─ non-.atex file → editor only / 非 .atex 文件 → 仅编辑器
│  ├─ tutorial / 教程
│  └─ settings / 设置
├─ 2. Repo & File Management (Sidebar) / 仓库与文件管理（侧栏）
│  ├─ Select / switch / add repo / 选择 / 切换 / 添加仓库
│  ├─ Browse tree (expand/collapse + keyboard) / 文件树浏览（展开/折叠 + 键盘操作）
│  ├─ Create .atex / .md / folder / 新建 .atex / .md / 文件夹
│  ├─ Open file and hydrate content from disk / 打开文件并从磁盘加载内容
│  ├─ Rename / move (drag-drop) / delete / 重命名 / 拖拽移动 / 删除
│  ├─ Reveal in folder / copy path / 在系统文件管理器中定位 / 复制路径
│  └─ Theme toggle (light/dark/system) / 主题切换（亮色/暗色/跟随系统）
├─ 3. Editing Flow (CodeMirror) / 编辑流程（CodeMirror）
│  ├─ Text editing / 文本编辑
│  ├─ LSP language features / LSP 语言能力
│  ├─ Debounced autosave / 防抖自动保存
│  ├─ Selection & playback highlight sync / 选区与播放高亮同步
│  └─ Editor focus state sync / 编辑器焦点状态同步
├─ 4. Preview & Playback (alphaTab) / 预览与播放（alphaTab）
│  ├─ AlphaTex rendering / AlphaTex 渲染
│  ├─ Editor ↔ Score selection sync / 编辑器 ↔ 乐谱选区同步
│  ├─ Playback state/cursor sync / 播放状态/光标同步
│  ├─ TAB/Staff toggle / TAB/五线谱切换
│  ├─ Zoom / speed / metronome controls / 缩放 / 速度 / 节拍器控制
│  ├─ Tracks panel / 轨道面板
│  ├─ Parse error recovery / 解析错误恢复
│  └─ Theme-driven API rebuild with track config restore / 主题切换触发 API 重建并恢复轨道配置
├─ 5. Global Bottom Bar / 全局底部栏
│  ├─ Editor + .atex: full playback control set / 编辑模式 + .atex：完整播放控制
│  ├─ Tutorial mode: prev/next tutorial navigation / 教程模式：上一节/下一节导航
│  └─ Settings mode: page-aware controls / 设置模式：按页面显示对应控制
├─ 6. Export & Print / 导出与打印
│  ├─ Export MIDI / WAV / GP7 / 导出 MIDI / WAV / GP7
│  └─ Print preview subsystem (isolated alphaTab API) / 打印预览子系统（独立 alphaTab API）
├─ 7. Tutorial System / 教程系统
│  ├─ Load MDX first, fallback to Markdown / 优先加载 MDX，回退 Markdown
│  ├─ Keyboard navigation (Esc / ← / →) / 键盘导航（Esc / ← / →）
│  └─ Close back to editor / 关闭后返回编辑模式
├─ 8. Settings System / 设置系统
│  ├─ Appearance / 外观
│  ├─ Playback / 播放
│  ├─ Updates / 更新
│  └─ About / 关于
└─ 9. Update System / 更新系统
   ├─ Check for updates / 检查更新
   ├─ Fetch and parse releases feed / 拉取并解析版本发布源
   ├─ Update toast event stream / 更新状态 Toast 事件流
   └─ Install update and restart app / 安装更新并重启应用
```
