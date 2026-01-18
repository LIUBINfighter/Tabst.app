Bottom bar 控件重排说明

目的

- 使底栏的控件顺序更直观：从“描述/显示”到“播放控制”，方便用户在演奏场景下快速找到相关操作。

规则（从左到右 / 视觉上从右往左）

- 显示什么：四谱表控件（StaffControls，最左）
- 显示多大：缩放顺序为 缩小（Minus） → 缩放输入（%） → 放大（Plus）
- 怎么显示：滚动模式切换（Scroll Mode）
- 播放控制：播放/暂停（Play/Pause） → 停止（Stop，最右）

要点

- 这些控件只在 `.atex` 文件中显示（预览上下文）。
- 交互通过 `Preview` 注册的 `playerControls`（play/pause/stop/scroll/applyZoom）与 `useAppStore` 同步，保证控件可以在 `GlobalBottomBar` 调用而不直接持有 AlphaTab API。
- 逻辑说明简短且易懂：先决定“要显示什么/如何显示/尺寸”，再对演奏进行控制。

示例：
视觉（右→左）： Stop ⏹️ | Play/Pause ▶️/⏸️ | Scroll 🌊 | Plus ➕ | % | Minus ➖ | StaffControls 🎚️（最左）

维护：如果需要调整顺序或新增控件，请在 `src/renderer/components/GlobalBottomBar.tsx` 和 `src/renderer/components/Preview.tsx` 中同时更新注册与 UI。
