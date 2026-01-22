import { contextBridge, ipcRenderer } from "electron";

export interface FileResult {
	path: string;
	name: string;
	content: string;
}

export interface SaveResult {
	success: boolean;
	error?: string;
}

contextBridge.exposeInMainWorld("electronAPI", {
	// 打开文件选择器
	openFile: (extensions: string[]): Promise<FileResult | null> =>
		ipcRenderer.invoke("open-file", extensions),

	// 创建新文件, ext 可选, 例如 '.md' 或 '.atex'
	createFile: (ext?: string): Promise<FileResult | null> =>
		ipcRenderer.invoke("create-file", ext),

	// 保存文件
	saveFile: (filePath: string, content: string): Promise<SaveResult> =>
		ipcRenderer.invoke("save-file", filePath, content),

	// 应用状态持久化：读取和写入已打开/创建文件的元数据
	loadAppState: (): Promise<{
		files: FileResult[];
		activeFileId: string | null;
	} | null> => ipcRenderer.invoke("load-app-state"),

	saveAppState: (state: {
		files: { id: string; name: string; path: string }[];
		activeFileId: string | null;
	}) => ipcRenderer.invoke("save-app-state", state),

	// 重命名（复制并删除原文件）
	renameFile: (oldPath: string, newName: string) =>
		ipcRenderer.invoke("rename-file", oldPath, newName),

	// 在系统文件管理器中显示并选中文件
	revealInFolder: (filePath: string) =>
		ipcRenderer.invoke("reveal-in-folder", filePath),
	// Read asset (ArrayBuffer / Uint8Array) via main process for packaged app
	readAsset: (relPath: string): Promise<Uint8Array> =>
		ipcRenderer.invoke("read-asset", relPath),

	// Auto-update
	checkForUpdates: (): Promise<{ supported: boolean; message?: string }> =>
		ipcRenderer.invoke("check-for-updates"),
	installUpdate: (): Promise<{ ok: boolean; message?: string }> =>
		ipcRenderer.invoke("install-update"),
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
});
