/**
 * Repo 类型定义
 * Repo 元数据存储在 repo/.tabst/workspace.json
 * 全局元数据存储在 ~/.tabst/
 */

import type { StaffDisplayOptions } from "../lib/staff-config";
import type { ThemePreference } from "./settings";

export interface Repo {
	id: string;
	name: string;
	path: string;
	lastOpenedAt: number;
}

export interface RepoPreferences {
	locale?: "en" | "zh-cn";
	deleteBehavior?: DeleteBehavior;
	theme?: ThemePreference;
	disabledCommandIds?: string[];
	pinnedCommandIds?: string[];
	commandMruIds?: string[];
	templateFilePaths?: string[];
	commandShortcuts?: Record<string, string[]>;
	staffOptions?: StaffDisplayOptions;
	zoomPercent?: number;
	playbackSpeed?: number;
	masterVolume?: number;
	playbackBpmMode?: boolean;
	metronomeVolume?: number;
	countInEnabled?: boolean;
	enableKeepAwakeDuringPlayback?: boolean;
	enablePlaybackProgressBar?: boolean;
	enablePlaybackProgressSeek?: boolean;
	enableSyncScroll?: boolean;
	enableCursorBroadcast?: boolean;
	resourceAssetOverrides?: {
		bravuraFontUrl?: string;
		soundFontUrl?: string;
	};
	customPlayerConfig?: {
		components: Array<{
			type:
				| "bpmControls"
				| "metronomeGroupControls"
				| "staffControls"
				| "tracksControls"
				| "volumeControls"
				| "zoomControls"
				| "playbackSpeedControls"
				| "playbackProgress"
				| "playbackTransport";
			enabled: boolean;
			label: string;
			description: string;
		}>;
	};
}

export interface RepoMetadata {
	id: string;
	name: string;
	openedAt: number;
	expandedFolders: string[];
	preferences?: RepoPreferences;
	activeFilePath?: string | null;
	workspaceMode?:
		| "editor"
		| "enjoy"
		| "tutorial"
		| "settings"
		| "git"
		| "cloud";
	activeSettingsPageId?: string | null;
	activeTutorialId?: string | null;
	activeCloudObjectId?: string | null;
	tutorialAudience?: "user" | "power-user" | "developer";
}

/**
 * 文件树节点类型
 */
export type FileNodeType = "file" | "folder";

export interface FileNode {
	id: string;
	name: string;
	path: string;
	type: FileNodeType;
	mtimeMs?: number;
	content?: string;
	children?: FileNode[];
	isExpanded?: boolean;
}

/**
 * 树节点的 ATDOC 元数据缓存（从文件内容解析，独立于打开的文档集合）。
 * key 为 normalized path。
 */
export interface FileMeta {
	metaClass?: string[];
	metaTags?: string[];
	metaStatus?: "draft" | "active" | "done" | "released";
	metaTabist?: string;
	metaApp?: string;
	metaGithub?: string;
	metaLicense?:
		| "CC0-1.0"
		| "CC-BY-4.0"
		| "CC-BY-SA-4.0"
		| "CC-BY-NC-4.0"
		| "CC-BY-NC-SA-4.0"
		| "CC-BY-ND-4.0"
		| "CC-BY-NC-ND-4.0";
	metaSource?: string;
	metaRelease?: string;
	metaAlias?: string[];
	metaTitle?: string;
}

/**
 * 用户删除偏好设置
 */
export type DeleteBehavior = "system-trash" | "repo-trash" | "ask-every-time";

export interface UserPreferences {
	deleteBehavior: DeleteBehavior;
}

/**
 * 扫描目录结果
 */
export interface ScanDirectoryResult {
	nodes: FileNode[];
	expandedFolders: string[];
}
