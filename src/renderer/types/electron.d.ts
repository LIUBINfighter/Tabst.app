import type { FileNode, Repo, RepoMetadata } from "./repo";

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

export interface ScanDirectoryResult {
	nodes: FileNode[];
	expandedFolders: string[];
}

export interface RepoFsChangedEvent {
	repoPath: string;
	eventType: string;
	changedPath?: string;
}

export interface ElectronAPI {
	openFile: (extensions: string[]) => Promise<FileResult | null>;
	createFile: (
		ext?: string,
		preferredDir?: string,
	) => Promise<FileResult | null>;
	createFolder: (
		folderName?: string,
		preferredDir?: string,
	) => Promise<{ path: string; name: string } | null>;
	saveFile: (filePath: string, content: string) => Promise<SaveResult>;

	loadAppState: () => Promise<{
		files: FileResult[];
		activeRepoId?: string | null;
		activeFileId: string | null;
	} | null>;
	saveAppState: (state: {
		files: { id: string; name: string; path: string }[];
		activeRepoId?: string | null;
		activeFileId: string | null;
	}) => Promise<{ success: boolean; error?: string } | null>;
	renameFile: (
		oldPath: string,
		newName: string,
	) => Promise<{
		success: boolean;
		newPath?: string;
		newName?: string;
		error?: string;
	} | null>;
	movePath: (
		sourcePath: string,
		targetFolderPath: string,
	) => Promise<{
		success: boolean;
		newPath?: string;
		newName?: string;
		error?: string;
	} | null>;
	revealInFolder: (
		filePath: string,
	) => Promise<{ success: boolean; error?: string } | null>;
	readAsset: (relPath: string) => Promise<Uint8Array>;
	selectFolder: () => Promise<string | null>;
	readFile: (filePath: string) => Promise<{ content: string; error?: string }>;

	scanDirectory: (path: string) => Promise<ScanDirectoryResult | null>;
	loadRepos: () => Promise<Repo[]>;
	saveRepos: (repos: Repo[]) => Promise<void>;
	loadWorkspaceMetadata: (repoPath: string) => Promise<RepoMetadata | null>;
	saveWorkspaceMetadata: (
		repoPath: string,
		metadata: RepoMetadata,
	) => Promise<void>;
	deleteFile: (
		filePath: string,
		behavior: "system-trash" | "repo-trash" | "ask-every-time",
		repoPath?: string,
	) => Promise<{ success: boolean; error?: string }>;

	startRepoWatch: (
		repoPath: string,
	) => Promise<{ success: boolean; error?: string }>;
	stopRepoWatch: () => Promise<{ success: boolean }>;
	onRepoFsChanged: (
		callback: (event: RepoFsChangedEvent) => void,
	) => () => void;

	// Auto-update
	checkForUpdates: () => Promise<{ supported: boolean; message?: string }>;
	installUpdate: () => Promise<{ ok: boolean; message?: string }>;
	getAppVersion: () => Promise<string>;
	fetchReleasesFeed: () => Promise<{
		success: boolean;
		data?: string;
		error?: string;
	}>;
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

	// Global settings (.tabst/settings.json)
	loadGlobalSettings: () => Promise<{
		success: boolean;
		data?: unknown;
		error?: string;
	}>;
	saveGlobalSettings: (settings: unknown) => Promise<{
		success: boolean;
		error?: string;
	}>;
}

declare global {
	interface Window {
		electronAPI: ElectronAPI;
	}
}
