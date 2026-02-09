# Tabst Repo 管理重构 - 开发上下文文档

## 📌 项目背景

将 Tabst 从扁平文件列表升级为 Obsidian 风格的 Vault（Repo）管理模式，支持：
1. 多 Repo（工作区）管理
2. 文件夹树形结构浏览
3. 右键菜单操作（Obsidian/shadcn/ui 风格）
4. Repo 底部栏切换

## ✅ 已完成工作

### 1. 类型定义 (src/renderer/types/repo.ts)
```typescript
// 已创建文件，包含：
- Repo: { id, name, path, lastOpenedAt }
- RepoMetadata: { id, name, openedAt, expandedFolders }
- FileNode: { id, name, path, type: 'file'|'folder', content?, children?, isExpanded? }
- DeleteBehavior: 'system-trash' | 'repo-trash' | 'ask-every-time'
- ScanDirectoryResult: { nodes: FileNode[], expandedFolders: string[] }
```

### 2. Store 更新 (src/renderer/store/appStore.ts)
```typescript
// 已更新，新增状态：
- repos: Repo[]
- activeRepoId: string | null
- fileTree: FileNode[]
- deleteBehavior: DeleteBehavior

// 新增 Actions：
- addRepo(path, name?), removeRepo(id), switchRepo(id), updateRepoName(id, name), loadRepos()
- expandFolder(path), collapseFolder(path), refreshFileTree(), getFileNodeById(id)
- setDeleteBehavior(behavior)

// 辅助函数：
- findNodeById(nodes, id): 递归查找节点
- updateNodeExpanded(nodes, path, isExpanded): 递归更新展开状态
- flattenFileNodes(nodes): 将树扁平化为 FileItem[] 以兼容旧代码
```

### 3. Preload 更新 (src/main/preload.ts)
```typescript
// 已添加 IPC 接口：
- scanDirectory(path): Promise<ScanDirectoryResult>
- loadRepos(): Promise<Repo[]>
- saveRepos(repos): Promise<void>
- loadWorkspaceMetadata(repoPath): Promise<RepoMetadata>
- saveWorkspaceMetadata(repoPath, metadata): Promise<void>
- deleteFile(filePath, behavior): Promise<{success, error}>
```

## 🚧 待完成工作（按优先级排序）

### P0: Main 进程 IPC 实现

#### 3.1 更新 file-system.ts
文件路径：`src/main/effects/file-system.ts`

需要添加：
```typescript
// 1. 获取全局元数据目录 (~/.tabst)
export const getGlobalMetadataDir = (): Effect.Effect<string, FileSystemError>

// 2. 读取 Repo 列表
export const readRepos = (): Effect.Effect<Repo[], FileSystemError>

// 3. 写入 Repo 列表
export const writeRepos = (repos: Repo[]): Effect.Effect<void, FileSystemError>

// 4. 读取 Repo workspace 元数据
export const readWorkspaceMetadata = (repoPath: string): Effect.Effect<RepoMetadata | null, FileSystemError>

// 5. 写入 Repo workspace 元数据
export const writeWorkspaceMetadata = (repoPath: string, metadata: RepoMetadata): Effect.Effect<void, FileSystemError>

// 6. 扫描目录（核心）
export const scanDirectory = (dirPath: string): Effect.Effect<ScanDirectoryResult, FileSystemError>
// - 支持的扩展名：.atex, .gp, .gp3, .gp4, .gp5, .gpx
// - 递归扫描子文件夹
// - 忽略以 . 开头的隐藏文件夹
// - 文件夹默认折叠（isExpanded: false）
// - 返回 expandedFolders 列表（用于恢复状态）

// 7. 删除文件到系统回收站
export const moveToSystemTrash = (filePath: string): Effect.Effect<void, FileSystemError>

// 8. 删除文件到 Repo 回收站 (~/.tabst/.trash/{repoName}/)
export const moveToRepoTrash = (filePath: string, repoPath: string): Effect.Effect<void, FileSystemError>
```

#### 3.2 创建 repo-operations-effect.ts
文件路径：`src/main/ipc/repo-operations-effect.ts`

需要实现：
```typescript
// 处理 scan-directory IPC
export async function handleScanDirectoryEffect(
  _event: Electron.IpcMainInvokeEvent,
  dirPath: string
): Promise<ScanDirectoryResult | null>

// 处理 load-repos IPC
export async function handleLoadReposEffect(): Promise<Repo[]>

// 处理 save-repos IPC
export async function handleSaveReposEffect(
  _event: Electron.IpcMainInvokeEvent,
  repos: Repo[]
): Promise<void>

// 处理 load-workspace-metadata IPC
export async function handleLoadWorkspaceMetadataEffect(
  _event: Electron.IpcMainInvokeEvent,
  repoPath: string
): Promise<RepoMetadata | null>

// 处理 save-workspace-metadata IPC
export async function handleSaveWorkspaceMetadataEffect(
  _event: Electron.IpcMainInvokeEvent,
  repoPath: string,
  metadata: RepoMetadata
): Promise<void>

// 处理 delete-file IPC
export async function handleDeleteFileEffect(
  _event: Electron.IpcMainInvokeEvent,
  filePath: string,
  behavior: DeleteBehavior
): Promise<{ success: boolean; error?: string }>
```

#### 3.3 更新 main.ts
文件路径：`src/main/main.ts`

在文件末尾添加 IPC handler 注册：
```typescript
import {
  handleScanDirectoryEffect,
  handleLoadReposEffect,
  handleSaveReposEffect,
  handleLoadWorkspaceMetadataEffect,
  handleSaveWorkspaceMetadataEffect,
  handleDeleteFileEffect,
} from "./ipc/repo-operations-effect";

// 在现有的 ipcMain.handle 之后添加：
ipcMain.handle("scan-directory", handleScanDirectoryEffect);
ipcMain.handle("load-repos", handleLoadReposEffect);
ipcMain.handle("save-repos", handleSaveReposEffect);
ipcMain.handle("load-workspace-metadata", handleLoadWorkspaceMetadataEffect);
ipcMain.handle("save-workspace-metadata", handleSaveWorkspaceMetadataEffect);
ipcMain.handle("delete-file", handleDeleteFileEffect);
```

### P0: UI 组件实现

#### 3.4 创建右键菜单组件
文件路径：`src/renderer/components/FileContextMenu.tsx`

功能：
- 基于 shadcn/ui ContextMenu
- 菜单项：打开、重命名、在文件夹中显示、复制路径、删除
- 删除项显示为红色（destructive）
- 支持键盘快捷键提示

```typescript
interface FileContextMenuProps {
  children: React.ReactNode;
  node: FileNode;
  onOpen: () => void;
  onRename: () => void;
  onReveal: () => void;
  onCopyPath: () => void;
  onDelete: () => void;
}
```

#### 3.5 更新 FileTreeItem 组件
文件路径：`src/renderer/components/FileTreeItem.tsx`

修改：
- 移除现有的 hover 按钮（重命名、在文件夹中显示）
- 添加右键菜单支持
- 支持文件夹展开/折叠图标
- 支持缩进（16px/级）
- 支持文件夹双击展开/折叠

#### 3.6 创建 FileTree 组件
文件路径：`src/renderer/components/FileTree.tsx`

功能：
- 递归渲染 FileNode 树
- 处理文件夹展开/折叠
- 处理文件选中
- 空状态显示

#### 3.7 更新 Sidebar 组件
文件路径：`src/renderer/components/Sidebar.tsx`

修改：
- 使用新的 FileTree 组件替换现有的 files.map
- 支持空 Repo 状态

#### 3.8 更新 SidebarBottomBar 组件
文件路径：`src/renderer/components/SidebarCommands.tsx`

修改：
- 添加 Repo 选择器下拉菜单
- 显示当前 Repo 名称
- 支持切换 Repo
- 支持添加新 Repo

```typescript
// 底部栏新布局：
[Repo 名称 ▼] [切换 Repo] | [Tutorial] [Settings]
```

#### 3.9 创建删除对话框组件
文件路径：`src/renderer/components/DeleteConfirmDialog.tsx`

功能：
- 首次删除时显示选项：
  1. 直接移至系统回收站（不再询问）
  2. 移至 ~/.tabst/.trash/{repoName}/（不再询问）
  3. 每次都单独决定
- 记住用户选择
- 支持取消操作

### P1: 其他功能

#### 3.10 设置页文件收集和迁移
文件路径：在 Settings 组件中添加

功能：
- 收集按钮：扫描当前已打开但不在 Repo 中的文件，复制到 ~/.tabst/orphaned/{timestamp}/
- 迁移按钮：将 orphaned 文件迁移到指定 Repo

## 📁 文件结构

```
src/
├── main/
│   ├── main.ts                      # 需更新：注册新 IPC handlers
│   ├── preload.ts                   # ✅ 已更新
│   ├── effects/
│   │   ├── file-system.ts           # 需更新：添加目录扫描功能
│   │   └── ...
│   └── ipc/
│       ├── file-operations-effect.ts
│       ├── misc-operations-effect.ts
│       └── repo-operations-effect.ts # 需创建
├── renderer/
│   ├── components/
│   │   ├── FileContextMenu.tsx       # 需创建
│   │   ├── FileTree.tsx              # 需创建
│   │   ├── FileTreeItem.tsx          # 需更新
│   │   ├── Sidebar.tsx               # 需更新
│   │   ├── SidebarCommands.tsx       # 需更新
│   │   └── DeleteConfirmDialog.tsx   # 需创建
│   ├── store/
│   │   └── appStore.ts               # ✅ 已更新
│   └── types/
│       └── repo.ts                   # ✅ 已创建
```

## 🔧 技术细节

### 目录扫描逻辑
1. 使用 fs.readdirSync 读取目录
2. 过滤掉以 . 开头的隐藏文件/文件夹
3. 对于文件夹：递归扫描
4. 对于文件：检查扩展名是否在支持列表中
5. 支持的扩展名：`.atex`, `.gp`, `.gp3`, `.gp4`, `.gp5`, `.gpx`
6. 返回树形结构，文件夹默认折叠

### 元数据持久化
- 全局 Repo 列表：`~/.tabst/repos.json`
- Repo 元数据：`{repoPath}/.tabst/workspace.json`
- 用户偏好：`~/.tabst/settings.json`（包含 deleteBehavior）
- Repo 回收站：`~/.tabst/.trash/{repoName}/`
- 孤儿文件：`~/.tabst/orphaned/{timestamp}/`

### 状态管理
- Repo 列表：Zustand store + 持久化到主进程
- 文件树：Zustand store（不持久化，启动时扫描）
- 文件夹展开状态：保存在 Repo 元数据中

## ⚠️ 注意事项

1. **保持代码风格一致**：
   - 使用 Effect.ts 处理异步操作
   - 使用 Zustand 管理状态
   - 使用 shadcn/ui 组件
   - 遵循 Biome 代码规范

2. **向后兼容**：
   - 保留 `files` 数组以兼容现有代码
   - 使用 `flattenFileNodes` 转换

3. **错误处理**：
   - 所有 IPC 调用都要处理失败情况
   - 文件操作失败要显示用户友好的错误信息

4. **性能考虑**：
   - 目录扫描可能在大型仓库中较慢，考虑添加加载状态
   - 使用并发限制（参考现有代码中的 `{ concurrency: 5 }`）

## 🧪 测试要点

1. 添加/删除/切换 Repo
2. 文件夹展开/折叠
3. 右键菜单所有功能
4. 删除文件的不同选项
5. 重启后恢复 Repo 和文件夹状态

## 📋 最终检查清单

- [ ] file-system.ts 添加目录扫描功能
- [ ] 创建 repo-operations-effect.ts
- [ ] main.ts 注册新 IPC handlers
- [ ] 创建 FileContextMenu 组件
- [ ] 更新 FileTreeItem 组件
- [ ] 创建 FileTree 组件
- [ ] 更新 Sidebar 组件
- [ ] 更新 SidebarBottomBar 组件
- [ ] 创建 DeleteConfirmDialog 组件
- [ ] 运行 `pnpm format`
- [ ] 运行 `pnpm check`
