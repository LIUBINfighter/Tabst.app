# Workspace Persistence Unification Plan (Legacy Cutover + Tauri)

## 1. 目标与约束

### 目标
- 除了 **Repo 列表索引**（机器级）外，所有状态持久化统一到 `repo/.tabst/`。
- 迁移前后的桌面壳层采用一致的状态语义与数据结构。
- 保留向后兼容读取能力，避免升级后用户状态丢失。

### 约束
- **唯一机器级持久化**：`~/.tabst/repos.json`（仅用于“机器知道有哪些 repo”）
- 其余状态（主题、语言、删除策略、播放设置、命令设置、模板、会话位置等）全部 repo 级。

---

## 2. 迁移前现状（已完成功能清单）

### 2.1 机器级持久化
- `~/.tabst/repos.json`
  - Repo 列表、名称、路径、`lastOpenedAt`
- `~/.tabst/settings.json`
  - 语言 `locale`
  - 删除策略 `deleteBehavior`
  - 主题 `theme`（UI/Editor/mode）
- `<userData>/app-state.json`
  - `activeRepoId`
  - `activeFileId`
  - 文件列表（id/name/path）

### 2.2 Repo 级持久化（已存在）
- `repo/.tabst/workspace.json`
  - `expandedFolders`
  - `preferences`（已覆盖大量功能）：
    - 播放相关：`zoomPercent`/`playbackSpeed`/`masterVolume`/`playbackBpmMode`/`metronomeVolume`/`countInEnabled`
    - 播放增强：`enablePlaybackProgressBar`/`enablePlaybackProgressSeek`/`enableSyncScroll`/`enableCursorBroadcast`
    - 命令管理：`disabledCommandIds`/`pinnedCommandIds`/`commandMruIds`
    - 模板管理：`templateFilePaths`
    - 快捷键：`commandShortcuts`
    - 底栏配置：`customPlayerConfig`

### 2.3 已识别问题
- 状态分散在三处：`settings.json` + `app-state.json` + `workspace.json`。
- 语义上“工作区状态”与“机器偏好”耦合不清，迁移/备份不直观。
- 迁移前后虽已对齐接口，但历史上存在桥接参数/运行时识别分叉风险。

---

## 3. 统一后的目标模型

## 3.1 Machine Scope（仅一项）
- `~/.tabst/repos.json`
  - 只保留 repo 索引能力。

## 3.2 Workspace Scope（主存储）
- `repo/.tabst/workspace.json`
  - `expandedFolders`
  - `preferences`（继续承载设置页相关项，并扩展）
    - 新增：`locale`、`deleteBehavior`、`theme`
  - `session`（新增，会话状态）
    - `activeFilePath`
    - `workspaceMode`
    - `activeSettingsPageId`
    - `activeTutorialId`
    - `tutorialAudience`

---

## 4. 迁移策略（无感升级）

### 读取优先级
1. 先读 `repo/.tabst/workspace.json`
2. 若缺字段，再从旧位置兜底：
   - `~/.tabst/settings.json`
   - `<userData>/app-state.json`
3. 最后落默认值

### 写入策略
- 新版本只写 `repo/.tabst/workspace.json`（`~/.tabst/repos.json`除外）
- 不再写旧的 `settings.json` / `app-state.json`

### 向后兼容
- 保留旧 API（`load/saveGlobalSettings`, `load/saveAppState`）用于兼容调用路径。
- 语义迁移到 workspace 文件（实现层可重定向或由 renderer 改走 workspace metadata）。

---

## 5. 实施步骤

1. **Schema 扩展**
   - 扩展 `RepoPreferences` 支持 `locale/deleteBehavior/theme`
   - 扩展 `RepoMetadata` 支持会话字段（active file/mode/settings/tutorial）

2. **Renderer 持久化收敛**
   - `global-settings` helper 改为读写 workspace metadata
   - `scheduleSaveAppState` 改为保存 workspace session
   - `initialize/switchRepo` 从 workspace metadata 恢复会话

3. **迁移前后同步语义**
   - 两端都以 `workspace.json` 为非 repo-list 状态源
   - 保持 `repos.json` 机器级唯一索引

4. **验证与回归**
   - 单测覆盖：参数映射、runtime 判定、workspace 状态序列化
   - 集成验证：切 repo / 恢复 active file / 设置页项持久化

---

## 6. 风险与缓解

- 并发写入冲突
  - 缓解：保留去抖写、读-合并-写流程，尽量最小化覆盖面
- 旧版本回退后状态不一致
  - 缓解：读取兼容旧文件，必要时保留旧文件不主动删除
- 无 active repo 时主题/语言无来源
  - 缓解：使用默认值，进入 repo 后再 hydrate

---

## 7. 完成标准

- [x] `repos.json` 仍在机器级，且仅用于 repo 索引
- [x] 其余状态通过 renderer 统一落 `repo/.tabst/workspace.json`
- [x] 迁移前后的桌面壳层共享同一 `workspace.json` 语义（通过统一 bridge + metadata schema）
- [x] 保留 legacy 读取兜底（旧全局 settings 作为读取 fallback）
- [x] lint/typecheck/tests/build 全部通过

---

## 8. 已完成改造摘要

1. 新增 `active-repo-context`，为 settings helper 提供当前 workspace 上下文。
2. `global-settings` helper 改为读写 `load/saveWorkspaceMetadata`，不再写全局 settings 文件。
3. `appStore` 的会话持久化从 `saveAppState` 切换为 `workspace metadata session`（active file/mode/settings/tutorial）。
4. `initialize` 不再依赖 `app-state.json` 恢复；改为按最近 repo + workspace metadata 恢复。
5. `RepoMetadata` schema 在 TS 与 Rust 同步扩展，支持会话字段。
6. 增加单测覆盖 workspace-backed settings 行为，增加 Rust roundtrip 测试覆盖新 metadata 字段。
