# Tabst Repo 功能问题总结与交接文档

## 问题概述

Repo (Vault) 管理功能已基本实现，但存在一个关键问题：**选择 Repo 后，侧边栏文件点击无法在 Editor/Preview 中显示内容**。

## 现象

1. **初始状态（正常）**：
   - 应用刚打开时，从 `app-state.json` 加载之前保存的文件（如"天空之城指弹.atex"）
   - Editor 和 Preview 正常显示内容

2. **选择 Repo 后（异常）**：
   - 侧边栏正确显示文件树
   - 点击文件后，Editor 和 Preview 显示空白
   - 标题栏正确显示文件名

## 已实现功能

### Main Process
- [x] `file-system.ts`: 添加 Repo 管理函数
  - `getGlobalMetadataDir()` - ~/.tabst
  - `readRepos()` / `writeRepos()` - 全局 Repo 列表
  - `readWorkspaceMetadata()` / `writeWorkspaceMetadata()` - 单个 Repo 元数据
  - `scanDirectory()` - 递归扫描支持文件
  - `moveToSystemTrash()` / `moveToRepoTrash()` - 删除功能
- [x] `repo-operations-effect.ts`: IPC handlers
- [x] `main.ts`: 注册所有 IPC handlers

### UI Components
- [x] `FileContextMenu.tsx` - 右键菜单
- [x] `FileTree.tsx` / `FileTreeItem.tsx` - 递归文件树
- [x] `Sidebar.tsx` - 集成 FileTree
- [x] `SidebarCommands.tsx` - Repo 选择器
- [x] `DeleteConfirmDialog.tsx` - 删除确认

### Store
- [x] `appStore.ts`: Repo 状态管理
  - `repos`, `activeRepoId`, `fileTree`
  - `addRepo`, `removeRepo`, `switchRepo`
  - 去重逻辑（防止重复添加同一路径）
  - 自动使用文件夹名作为 Repo 名称

### Bug Fixes Applied
1. **addFile state 丢失** - 已修复，使用 `...state` 保留其他状态
2. **Sidebar 闭包问题** - 已修复，使用 `getState()` 获取最新状态
3. **FileTreeItem 重复 setActiveFile** - 已修复，移除了组件内的调用
4. **Repo 去重** - 已添加，标准化路径后检查重复
5. **Repo 显示名称** - 已修复，使用文件夹名而非全路径

## 问题分析

### 当前数据流

```
点击文件 (Sidebar.tsx handleFileSelect)
  ↓
检查文件是否已存在于 files 数组
  ↓ (如果不存在)
调用 electronAPI.readFile(node.path) 读取内容
  ↓
addFile(file) 添加到 store
  ↓
setActiveFile(node.id) 设置激活文件
  ↓
setWorkspaceMode("editor")
```

### 预期行为
- `addFile()` 将文件添加到 `files` 数组
- `setActiveFile()` 设置 `activeFileId`
- Editor 组件通过 `files.find(f => f.id === activeFileId)` 获取当前文件
- 显示文件内容

### 实际行为
- 文件被添加到 store（已验证）
- `activeFileId` 被设置（已验证）
- 但 Editor 找不到文件或文件内容为空

## 可能的根本原因

### 1. ID 不匹配问题 ⚠️ 最可能
`scanDirectory` 使用文件 **完整路径** 作为 `FileNode.id`：
```typescript
const id = fullPath; // /home/user/Documents/song.atex
```

但之前保存的文件可能使用不同的 ID（如 `crypto.randomUUID()`）。

如果同一个文件：
- 之前通过 "打开文件" 添加，ID 是随机 UUID
- 现在通过 Repo 扫描，ID 是文件路径

这会导致 `files.find(f => f.id === activeFileId)` 找不到文件！

### 2. 异步时序问题
`addFile` 和 `setActiveFile` 是异步的 store 更新，Editor 可能在状态更新完成前就尝试读取。

### 3. Zustand 选择器问题
Editor 使用：
```typescript
const activeFileId = useAppStore((s) => s.activeFileId);
const files = useAppStore((s) => s.files);
const activeFile = files.find((f) => f.id === activeFileId);
```

这创建了两个独立的订阅，`files` 和 `activeFileId` 可能不是同一时刻的状态。

## 建议的排查方向

### 1. 验证 ID 一致性（高优先级）
在以下位置添加 console.log：
- `Sidebar.tsx` handleFileSelect: 打印 `node.id`
- `appStore.ts` addFile: 打印添加的 file.id
- `Editor.tsx`: 打印 `activeFileId` 和所有文件的 id 列表

确认点击文件时的 ID 与 store 中的 ID 匹配。

### 2. 简化 store 选择器
Editor 应该直接使用：
```typescript
const activeFile = useAppStore((s) => 
  s.files.find((f) => f.id === s.activeFileId)
);
```
而不是分开获取 `files` 和 `activeFileId`。

### 3. 检查 initialize 逻辑
`initialize()` 从 `app-state.json` 加载旧文件，可能与新 Repo 系统冲突：
- 旧文件的 ID 是 UUID
- 新文件的 ID 是路径
- 两者可能指向同一个物理文件但 ID 不同

### 4. 验证 readFile IPC
确保 `window.electronAPI.readFile()` 正确返回文件内容：
```typescript
const result = await window.electronAPI.readFile(node.path);
console.log("readFile result:", result); // 应该包含 content
```

## 相关文件

- `src/main/effects/file-system.ts` - 文件系统操作
- `src/main/ipc/repo-operations-effect.ts` - Repo IPC
- `src/renderer/store/appStore.ts` - 状态管理
- `src/renderer/components/Sidebar.tsx` - 侧边栏逻辑
- `src/renderer/components/FileTreeItem.tsx` - 文件项组件
- `src/renderer/components/Editor.tsx` - 编辑器
- `src/renderer/types/repo.ts` - 类型定义

## 快速测试步骤

1. 清空应用状态：删除 `~/.tabst/` 和 app userData 目录
2. 重新启动应用
3. 添加一个 Repo
4. 点击文件，打开 DevTools 查看 console
5. 检查：
   - node.id 是什么？
   - addFile 后的 files 数组？
   - Editor 中的 activeFileId？
   - activeFile 是否存在？

## 未完成的工作

- [ ] 文件删除功能（Trash）
- [ ] 文件重命名
- [ ] 新建文件集成到 Repo
- [ ] i18n 翻译键值
- [ ] 错误处理和用户提示

---

**Last Updated**: 2026-02-09
**Status**: 功能实现完成，但文件点击显示问题未解决
**Priority**: High - 核心功能阻塞
