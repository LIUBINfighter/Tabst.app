import { contextBridge, ipcRenderer } from "electron";
import type { FileNode, Repo, RepoMetadata } from "../renderer/types/repo";

export interface FileResult {
	path: string;
	name: string;
	content: string;
}

export interface SaveResult {
	success: boolean;
	error?: string;
}

export interface ScanDirectoryResult {
	nodes: FileNode[];
	expandedFolders: string[];
}

contextBridge.exposeInMainWorld("electronAPI", {
	openFile: (extensions: string[]): Promise<FileResult | null> =>
		ipcRenderer.invoke("open-file", extensions),

	selectFolder: (): Promise<string | null> =>
		ipcRenderer.invoke("select-folder"),

	// 创建新文件, ext 可选, 例如 '.md' 或 '.atex'
	createFile: (
		ext?: string,
		targetDirectory?: string,
	): Promise<FileResult | null> =>
		ipcRenderer.invoke("create-file", ext, targetDirectory),

	// 创建新文件夹
	createFolder: (
		folderName?: string,
		targetDirectory?: string,
	): Promise<{ path: string; name: string } | null> =>
		ipcRenderer.invoke("create-folder", folderName, targetDirectory),

	// 保存文件
	saveFile: (filePath: string, content: string): Promise<SaveResult> =>
		ipcRenderer.invoke("save-file", filePath, content),

	// 应用状态持久化：读取和写入已打开/创建文件的元数据
	loadAppState: (): Promise<{
		files: FileResult[];
		activeRepoId?: string | null;
		activeFileId: string | null;
	} | null> => ipcRenderer.invoke("load-app-state"),

	saveAppState: (state: {
		files: { id: string; name: string; path: string }[];
		activeRepoId?: string | null;
		activeFileId: string | null;
	}) => ipcRenderer.invoke("save-app-state", state),

	// 重命名（复制并删除原文件）
	renameFile: (oldPath: string, newName: string) =>
		ipcRenderer.invoke("rename-file", oldPath, newName),

	movePath: (sourcePath: string, targetFolderPath: string) =>
		ipcRenderer.invoke("move-path", sourcePath, targetFolderPath),

	// 在系统文件管理器中显示并选中文件
	revealInFolder: (filePath: string) =>
		ipcRenderer.invoke("reveal-in-folder", filePath),
	// Read asset (ArrayBuffer / Uint8Array) via main process for packaged app
	readAsset: (relPath: string): Promise<Uint8Array> =>
		ipcRenderer.invoke("read-asset", relPath),

	readFile: (filePath: string): Promise<{ content: string; error?: string }> =>
		ipcRenderer.invoke("read-file", filePath),

	// ===== Repo 管理 =====
	// 扫描目录，返回文件树
	scanDirectory: (path: string): Promise<ScanDirectoryResult | null> =>
		ipcRenderer.invoke("scan-directory", path),

	// 加载全局 Repo 列表
	loadRepos: (): Promise<Repo[]> => ipcRenderer.invoke("load-repos"),

	// 保存全局 Repo 列表
	saveRepos: (repos: Repo[]): Promise<void> =>
		ipcRenderer.invoke("save-repos", repos),

	// 加载 Repo 元数据
	loadWorkspaceMetadata: (repoPath: string): Promise<RepoMetadata | null> =>
		ipcRenderer.invoke("load-workspace-metadata", repoPath),

	// 保存 Repo 元数据
	saveWorkspaceMetadata: (
		repoPath: string,
		metadata: RepoMetadata,
	): Promise<void> =>
		ipcRenderer.invoke("save-workspace-metadata", repoPath, metadata),

	// 删除文件（根据用户偏好）
	deleteFile: (
		filePath: string,
		behavior: "system-trash" | "repo-trash" | "ask-every-time",
		repoPath?: string,
	): Promise<{ success: boolean; error?: string }> =>
		ipcRenderer.invoke("delete-file", filePath, behavior, repoPath),

	// Repo 文件系统监听（用于外部变更实时同步）
	startRepoWatch: (
		repoPath: string,
	): Promise<{ success: boolean; error?: string }> =>
		ipcRenderer.invoke("start-repo-watch", repoPath),
	stopRepoWatch: (): Promise<{ success: boolean }> =>
		ipcRenderer.invoke("stop-repo-watch"),
	onRepoFsChanged: (
		callback: (event: {
			repoPath: string;
			eventType: string;
			changedPath?: string;
		}) => void,
	) => {
		const listener = (_event: Electron.IpcRendererEvent, payload: unknown) => {
			callback(
				payload as {
					repoPath: string;
					eventType: string;
					changedPath?: string;
				},
			);
		};
		ipcRenderer.on("repo-fs-changed", listener);
		return () => ipcRenderer.removeListener("repo-fs-changed", listener);
	},

	// Auto-update
	checkForUpdates: (): Promise<{ supported: boolean; message?: string }> =>
		ipcRenderer.invoke("check-for-updates"),
	installUpdate: (): Promise<{ ok: boolean; message?: string }> =>
		ipcRenderer.invoke("install-update"),
	getAppVersion: (): Promise<string> => ipcRenderer.invoke("get-app-version"),
	// Fetch GitHub releases RSS feed
	fetchReleasesFeed: (): Promise<{
		success: boolean;
		data?: string;
		error?: string;
	}> => ipcRenderer.invoke("fetch-releases-feed"),
	onUpdateEvent: (
		callback: (event: {
			type:
				| "checking"
				| "available"
				| "not-available"
				| "progress"
				| "downloaded"
				| "error";
			version?: string;
			releaseNotes?: string | null;
			percent?: number;
			transferred?: number;
			total?: number;
			message?: string;
		}) => void,
	) => {
		const listener = (_event: Electron.IpcRendererEvent, payload: unknown) => {
			callback(
				payload as {
					type:
						| "checking"
						| "available"
						| "not-available"
						| "progress"
						| "downloaded"
						| "error";
					version?: string;
					releaseNotes?: string | null;
					percent?: number;
					transferred?: number;
					total?: number;
					message?: string;
				},
			);
		};
		ipcRenderer.on("update-event", listener);
		return () => ipcRenderer.removeListener("update-event", listener);
	},

	// ===== Global Settings (.tabst/settings.json) =====
	loadGlobalSettings: (): Promise<{
		success: boolean;
		data?: unknown;
		error?: string;
	}> => ipcRenderer.invoke("load-global-settings"),
	saveGlobalSettings: (
		settings: unknown,
	): Promise<{
		success: boolean;
		error?: string;
	}> => ipcRenderer.invoke("save-global-settings", settings),
});
