# WKWebView 音频在显示器/系统睡眠后失效诊断报告

> **Status:** Active — 2026-08-02 诊断结论，与当前 `dev` 分支实现（
> `fix/audio-focus-stutter` 之后）一致。结论与数据来自真实运行实例的实测，
> 不是推测。

## 背景

用户报告两类问题：

1. **卡顿**：播放中窗口失焦再聚焦（切到 Finder 再切回）时，可听到明显的
   音频断续。同行诊断报告定位到 4 个音频生命周期问题（详见后文）。
2. **无声**：长期不操作（去干别的事情或单纯待机）后，再点击播放没有声音。

修复卡顿后，无声问题回归——本报告记录了为定位无声根因所做的完整诊断，
以及两个问题最终统一的根因。

## 诊断方法

- 环境：`pnpm dev:tauri` 运行的 debug 构建（`target/debug/tabst-tauri`），
  MCP Bridge 注入（`tauri-plugin-mcp-bridge`，端口 9223）。
- 工具：
  - Tauri MCP（DOM 操作、真实鼠标事件点击、webview console 日志读取）
  - `osascript`（Finder 窗口切换、按 PID 激活指定实例窗口）
  - `pmset displaysleepnow`（显示器睡眠模拟）
  - `afplay`（系统音频健康检查）
- 测量指标：
  - 播放进度条 tick 值是否随时间推进（`input[type=range]` 的 value）
  - console 日志中的 `api.play() invoked {didPlay, isReadyForPlayback, tickPosition}`
  - 探针日志 `audio recovery {initialState, finalState, didAttemptActivation}`（
    恢复流程中读取的 AudioContext 状态）
- 注意：**本机同时安装了 release 版 Tabst（`/Applications/Tabst.app`）与
  dev 版**，两者同名。窗口切换实验必须按 PID 激活 dev 实例
  （`System Events` → `set frontmost of first process whose unix id is <PID>`），
  否则事件会落到 release 窗口。

## 实验矩阵与结果

### A. 窗口失焦/返回（页面事件路径）

| 实验 | 结果 |
| --- | --- |
| 播放中切到 Finder 15 秒再切回 | 正常（播放继续，无中断） |
| 播放中失焦 5 分钟（Finder 前台，系统未睡眠）再切回 | 正常（tick 持续推进） |
| 停止播放 → 空闲 5 分钟 → 切回 → 点播放 | 正常（tick 从 0 推进） |

结论：**窗口失焦级 idle 不影响音频**。`focus`/`visibilitychange` 触发的
恢复路径（协调器 `createPlaybackAudioRefreshCoordinator`）工作正常，
`AudioContext` 在这些场景下保持 `running`。

### B. 显示器睡眠（`pmset displaysleepnow`，2 分钟）

| 实验 | 结果 |
| --- | --- |
| 唤醒后点播放 | **卡死**：`api.play() invoked {didPlay:true, isReadyForPlayback:true, tickPosition:472081}`，tick 不再推进（= 无声） |
| 卡死后页面 `location.reload()`（全新 API + 全新 worklet） | 依然卡死 |
| 卡死后把 outputMode 切回 `WebAudioScriptProcessor`（HMR 重建 API） | 依然卡死 |
| 卡死后杀 `WebContent` 进程（期望 WebKit 自动重生） | webview 页面挂起，不自动恢复 |
| **完全重启 app（新 webview 进程）** | **恢复**（tick 正常推进） |

### C. 关键探针数据（卡死现场）

```
audio recovery {"didAttemptActivation":false,"initialState":"running","finalState":"running"}
api.play() invoked {"didPlay":true,"isReadyForPlayback":true,"tickPosition":472081}
```

- `AudioContext.state` = `running`（不是 suspended/interrupted/closed）
- `isReadyForPlayback` = `true`（`isReady && isSoundFontLoaded && _isMidiLoaded`
  全是静态标志，睡眠不影响）
- `play()` 返回 `true`，合成器状态 `Playing`，但 tick 不推进
- 系统音频正常（`afplay /System/Library/Sounds/Ping.aiff` 有声音）

## 根因结论

**macOS 显示器/系统睡眠后，WKWebView 的音频输出子系统（webview 进程级）
损坏：`AudioContext` 状态仍为 `running`，但音频输出（worklet 样本请求或
ScriptProcessor 回调）不再工作，alphaTab 合成器没有样本请求驱动，
tick 停止推进。**

- 与 `outputMode` 无关（worklet 与 ScriptProcessor 在睡眠后同样失效）。
- 与 SoundFont 加载无关（重载字体、重建 API、页面 reload 均无法恢复）。
- 唯一有效恢复手段：**重启 webview 进程（即重启应用）**。
- 该缺陷由 WebKit 的 sleep/wake 音频会话恢复问题导致，页面内 JS 无法绕过。

### 与历史修复的关系

旧代码（0.7.0-rc.1 之前）在 `refreshPlaybackAudioPipeline` 里设置了
"空闲超过 2 分钟就重载 SoundFont"（`AUDIO_IDLE_REFRESH_THRESHOLD_MS`），
当时被认为修复了"长期不操作后无声"。本诊断证明该修复**从未真正解决无声**
——重载 SoundFont 是页面内操作，对 webview 进程级损坏无效。它只是引入了
副作用：每次长 idle 返回都会触发 31MB SoundFont 重载（`loadSoundFont` 内部
先 `pause()`），叠加 focus/visibility 双恢复与 150ms 等待，成为卡顿的
主要来源。

因此：卡顿修复（删除 idle 重载、single-flight、running 不等待）是正确的；
无声回归只是因为旧补丁本就没治本。

## 已实施修复（`fix/audio-focus-stutter`）

1. 删除 `outputMode: WebAudioScriptProcessor` 强制，恢复 alphaTab 默认
   worklet 优先、自动降级。
2. `prepareAlphaTabAudioForPlayback`：`running` 直接返回（不调用 activate、
   不白等 150ms）；`suspended/interrupted` 单次恢复；`closed` 报告不可恢复。
3. 新增 `preview-audio-refresh.ts` 协调器：focus/visibilitychange 共用
   single-flight 恢复入口；仅在 `closed` 或"激活尝试未到 running"时重载
   SoundFont；idle 时长本身不再触发任何操作。
4. `loadSoundFontFromUrl`：`append=false`（替换而非堆积）+ per-URL in-flight
   去重。

## 后续修复方向（睡眠场景）

页面内无法恢复 webview 音频，方案为"检测 + 提示 + 手动重启"：

1. **播放自愈检测**：`play()` 后约 2 秒验证 tick 是否推进；播放中恢复时
   检查 tick 是否停滞（stalled）。
2. **级联恢复**：先 resume（覆盖窗口失焦场景）→ 重载 SoundFont（低成本
   尝试一次）→ 仍卡死则判定为 webview 音频失效。
3. **用户提示 + 手动重启**：弹窗提示"音频输出异常"，提供重启应用按钮
   （Rust `restart_app` 命令：spawn 当前可执行文件后退出，工作区经 autosave
   与会话恢复机制还原）。不自动重启。

## 复现路径（回归验证用）

1. `pnpm dev:tauri` 启动 dev 构建，打开任意长曲目播放。
2. `pmset displaysleepnow`，等待 2 分钟以上。
3. 唤醒显示器（任意鼠标/键盘活动），点击播放。
4. 预期：tick 卡死（无声）→ 出现恢复提示 → 点击重启按钮 → 重启后播放正常。

## 相关文件

- `src/renderer/lib/alphatab-config.ts` — 播放器配置（outputMode）
- `src/renderer/lib/player-audio-recovery.ts` — AudioContext 恢复逻辑
- `src/renderer/lib/preview-audio-refresh.ts` — 刷新协调器（single-flight）
- `src/renderer/components/Preview.tsx` — 播放/恢复编排
- `src/renderer/lib/assets.ts` — SoundFont 加载（append=false + 去重）
- `src-tauri/src/power_commands.rs` — 既有 keep-awake 命令（同目录参考）
