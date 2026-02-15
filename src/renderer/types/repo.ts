/**
 * Repo 类型定义
 * Repo 元数据存储在 repo/.tabst/workspace.json
 * 全局元数据存储在 ~/.tabst/
 */

import type { StaffDisplayOptions } from "../lib/staff-config";

export interface Repo {
	id: string;
	name: string;
	path: string;
	lastOpenedAt: number;
}

export interface RepoPreferences {
	staffOptions?: StaffDisplayOptions;
	zoomPercent?: number;
	playbackSpeed?: number;
	playbackBpmMode?: boolean;
	metronomeVolume?: number;
	enableSyncScroll?: boolean;
	enableCursorBroadcast?: boolean;
	customPlayerConfig?: {
		components: Array<{
			type:
				| "staffControls"
				| "tracksControls"
				| "zoomControls"
				| "playbackSpeedControls"
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
	content?: string;
	children?: FileNode[];
	isExpanded?: boolean;
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
