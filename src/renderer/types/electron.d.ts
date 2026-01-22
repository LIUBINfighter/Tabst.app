export interface FileResult {
	path: string;
	name: string;
	content: string;
	id?: string;
}

export interface SaveResult {
	success: boolean;
	error?: string;
}

export interface ElectronAPI {
	openFile: (extensions: string[]) => Promise<FileResult | null>;
	// ext: optional file extension, may be like '.md' or '.atex' or 'md'
	createFile: (ext?: string) => Promise<FileResult | null>;
	saveFile: (filePath: string, content: string) => Promise<SaveResult>;

	// 应用状态持久化
	loadAppState: () => Promise<{
		files: FileResult[];
		activeFileId: string | null;
	} | null>;
	// 仅保存元数据 id/name/path 和 activeFileId
	saveAppState: (state: {
		files: { id: string; name: string; path: string }[];
		activeFileId: string | null;
	}) => Promise<{ success: boolean; error?: string } | null>;
	// Rename: copy to new name in same directory, then delete original
	renameFile: (
		oldPath: string,
		newName: string,
	) => Promise<{
		success: boolean;
		newPath?: string;
		newName?: string;
		error?: string;
	} | null>;
	// Show file in OS file manager and select it
	revealInFolder: (
		filePath: string,
	) => Promise<{ success: boolean; error?: string } | null>;

	// Auto-update
	checkForUpdates: () => Promise<{ supported: boolean; message?: string }>;
	installUpdate: () => Promise<{ ok: boolean; message?: string }>;
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
	) => () => void;
}

declare global {
	interface Window {
		electronAPI: ElectronAPI;
	}
}
