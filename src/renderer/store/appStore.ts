import { create } from "zustand";
import { DEFAULT_SANDBOX_ATEX_CONTENT } from "../data/default-sandbox-content";
import i18n, { type Locale } from "../i18n";
import { setActiveRepoContext } from "../lib/active-repo-context";
import { extractAtDocFileMeta } from "../lib/atdoc";
import { loadGlobalSettings, saveGlobalSettings } from "../lib/global-settings";
import { sanitizeShortcutList } from "../lib/shortcut-utils";
import type { StaffDisplayOptions } from "../lib/staff-config";
import {
	isTemplateCandidatePath,
	sanitizeTemplatePathList,
} from "../lib/template-utils";
import type { TutorialAudience } from "../lib/tutorial-loader";
import {
	loadWorkspaceMetadata,
	updateWorkspaceMetadata,
} from "../lib/workspace-metadata-store";

import {
	type CreateDatasetInput,
	type CreateSampleInput,
	type DatasetExportResult,
	type DatasetListEntry,
	type DatasetManifest,
	type LoadedSample,
	normalizeLoadedDataset,
	normalizeLoadedSample,
	normalizeSampleManifest,
	normalizeSampleSummary,
	type SampleManifest,
	type SampleSummary,
	type SaveSampleArtifactInput,
	type UpdateSampleInput,
} from "../types/dataset";
import type {
	GitDiffResult,
	GitSelectedChange,
	GitStatusSummary,
} from "../types/git";
import type {
	DeleteBehavior,
	FileNode,
	Repo,
	RepoPreferences,
} from "../types/repo";
import { useThemeStore } from "./themeStore";

/**
 * 获取初始语言设置
 * 优先从 i18n.language 读取（它已经从 localStorage 初始化过了）
 * 这确保 appStore.locale 与 i18n.language 保持同步
 */
function getInitialLocale(): Locale {
	const lng = i18n.language;
	if (lng === "en" || lng === "zh-cn") return lng;
	return "zh-cn";
}

function isSameStringList(a: string[] | undefined, b: string[] | undefined) {
	if (!a && !b) return true;
	if (!a || !b) return false;
	if (a.length !== b.length) return false;
	for (let i = 0; i < a.length; i += 1) {
		if (a[i] !== b[i]) return false;
	}
	return true;
}

const DEFAULT_SANDBOX_REPO_NAME = "Sandbox";

const DEFAULT_SANDBOX_README_CONTENT = `# Tabst Sandbox

Welcome to the default sandbox.

- Start with \`sandbox.atex\` to learn AlphaTex basics.
- Keep notes in this \`README.md\` file.
- Official repository: https://github.com/LIUBINfighter/Tabst.app
`;

interface SandboxSeedFile {
	content: string;
	ext: ".atex" | ".md";
	name: string;
}

const DEFAULT_SANDBOX_FILES: SandboxSeedFile[] = [
	{
		name: "sandbox.atex",
		ext: ".atex",
		content: DEFAULT_SANDBOX_ATEX_CONTENT,
	},
	{
		name: "README.md",
		ext: ".md",
		content: DEFAULT_SANDBOX_README_CONTENT,
	},
];

async function seedSandboxFile(
	directoryPath: string,
	seed: SandboxSeedFile,
): Promise<void> {
	const created = await window.desktopAPI.createFile(seed.ext, directoryPath);
	if (!created) return;

	let targetPath = created.path;
	try {
		const renamed = await window.desktopAPI.renameFile(created.path, seed.name);
		if (renamed?.success && renamed.newPath) {
			targetPath = renamed.newPath;
		}
	} catch (error) {
		console.error("Failed to rename sandbox file:", error);
	}

	const saveResult = await window.desktopAPI.saveFile(targetPath, seed.content);
	if (!saveResult.success) {
		console.error("Failed to seed sandbox file:", saveResult.error);
	}
}

async function createDefaultSandboxRepo(): Promise<Repo | null> {
	try {
		const folder = await window.desktopAPI.createFolder(
			DEFAULT_SANDBOX_REPO_NAME,
		);
		if (!folder) return null;

		for (const seed of DEFAULT_SANDBOX_FILES) {
			await seedSandboxFile(folder.path, seed);
		}

		return {
			id: crypto.randomUUID(),
			name: folder.name,
			path: folder.path,
			lastOpenedAt: Date.now(),
		};
	} catch (error) {
		console.error("Failed to create default sandbox repo:", error);
		return null;
	}
}

/**
 * @deprecated 使用 FileNode 替代
 */
export interface FileItem {
	id: string;
	name: string;
	path: string;
	content: string;
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
	/** Whether `content` is hydrated from disk/user input (vs empty placeholder from file tree scan). */
	contentLoaded?: boolean;
}

/**
 * Score selection information - for synchronizing selection between Preview and Editor
 * Uses alphaTab 1.8.0 Selection API
 */
export interface ScoreSelectionInfo {
	/** Start beat's bar index (0-based) */
	startBarIndex: number;
	/** Start beat's index within bar (0-based) */
	startBeatIndex: number;
	/** End beat's bar index (0-based) */
	endBarIndex: number;
	/** End beat's index within bar (0-based) */
	endBeatIndex: number;
}

/**
 * Editor cursor position information - for reverse sync to score
 */
export interface EditorCursorInfo {
	/** Cursor line (0-based) */
	line: number;
	/** Cursor column (0-based) */
	column: number;
	/** Corresponding bar index (0-based), -1 means unknown */
	barIndex: number;
	/** Corresponding beat index (0-based), -1 means unknown */
	beatIndex: number;
	/** Whether triggered by document change (e.g., input/paste) */
	fromDocChange?: boolean;
}

/**
 * 播放位置信息 - 用于播放时同步高亮
 */
export interface PlaybackBeatInfo {
	/** 小节索引 (0-based) */
	barIndex: number;
	/** Beat 索引 (0-based) */
	beatIndex: number;
}

/**
 * 播放器组件类型定义
 */
export type PlayerComponentType =
	| "playbackProgress"
	| "staffControls"
	| "tracksControls"
	| "zoomControls"
	| "bpmControls"
	| "volumeControls"
	| "metronomeGroupControls"
	| "playbackTransport"
	| "playbackSpeedControls";

/**
 * 播放器组件配置项
 */
export interface PlayerComponentConfig {
	/** 组件类型 */
	type: PlayerComponentType;
	/** 是否启用 */
	enabled: boolean;
	/** 显示名称 */
	label: string;
	/** 描述 */
	description: string;
}

/**
 * 自定义播放器配置
 */
export interface CustomPlayerConfig {
	/** 组件顺序列表 */
	components: PlayerComponentConfig[];
}

const DEFAULT_PLAYER_COMPONENTS: PlayerComponentConfig[] = [
	{
		type: "playbackProgress",
		enabled: true,
		label: "Playback Progress",
		description: "Draggable playback timeline",
	},
	{
		type: "staffControls",
		enabled: true,
		label: "Staff Controls",
		description: "TAB/Staff display toggle",
	},
	{
		type: "tracksControls",
		enabled: false,
		label: "Track Controls",
		description: "Track selection panel toggle",
	},
	{
		type: "zoomControls",
		enabled: true,
		label: "Zoom Controls",
		description: "Zoom in/out and percentage input",
	},
	{
		type: "bpmControls",
		enabled: true,
		label: "BPM Controls",
		description: "BPM/Playback speed selector",
	},
	{
		type: "volumeControls",
		enabled: true,
		label: "Volume Controls",
		description: "Master volume slider",
	},
	{
		type: "metronomeGroupControls",
		enabled: true,
		label: "Metronome Group",
		description: "Metronome, count-in, and metronome-only controls",
	},
	{
		type: "playbackTransport",
		enabled: true,
		label: "Transport Controls",
		description: "Play, pause, stop, refresh, and playback settings",
	},
];

function clonePlayerComponents(
	components: readonly PlayerComponentConfig[],
): PlayerComponentConfig[] {
	return components.map((component) => ({ ...component }));
}

function createDefaultCustomPlayerConfig(): CustomPlayerConfig {
	return {
		components: clonePlayerComponents(DEFAULT_PLAYER_COMPONENTS),
	};
}

function isSupportedPlayerComponentType(
	type: unknown,
): type is PlayerComponentType {
	return (
		type === "playbackProgress" ||
		type === "staffControls" ||
		type === "tracksControls" ||
		type === "zoomControls" ||
		type === "bpmControls" ||
		type === "volumeControls" ||
		type === "metronomeGroupControls" ||
		type === "playbackTransport" ||
		type === "playbackSpeedControls"
	);
}

function normalizeCustomPlayerConfig(input: unknown): CustomPlayerConfig {
	if (!input || typeof input !== "object") {
		return createDefaultCustomPlayerConfig();
	}

	const rawComponents = (input as { components?: unknown }).components;
	if (!Array.isArray(rawComponents)) {
		return createDefaultCustomPlayerConfig();
	}

	const templateByType = new Map(
		DEFAULT_PLAYER_COMPONENTS.map((component) => [component.type, component]),
	);
	const normalized: PlayerComponentConfig[] = [];
	const seen = new Set<PlayerComponentType>();

	const pushFromTemplate = (
		type: Exclude<PlayerComponentType, "playbackSpeedControls">,
		enabledOverride?: boolean,
		labelOverride?: string,
		descriptionOverride?: string,
	) => {
		if (seen.has(type)) return;
		const template = templateByType.get(type);
		if (!template) return;
		normalized.push({
			type,
			enabled:
				typeof enabledOverride === "boolean"
					? enabledOverride
					: template.enabled,
			label: labelOverride || template.label,
			description: descriptionOverride || template.description,
		});
		seen.add(type);
	};

	for (const rawComponent of rawComponents) {
		if (!rawComponent || typeof rawComponent !== "object") continue;
		const candidate = rawComponent as {
			type?: unknown;
			enabled?: unknown;
			label?: unknown;
			description?: unknown;
		};
		const type = candidate.type;
		if (!isSupportedPlayerComponentType(type)) continue;

		const enabled =
			typeof candidate.enabled === "boolean" ? candidate.enabled : undefined;
		const label =
			typeof candidate.label === "string" ? candidate.label : undefined;
		const description =
			typeof candidate.description === "string"
				? candidate.description
				: undefined;

		if (type === "playbackSpeedControls") {
			pushFromTemplate("bpmControls", enabled);
			pushFromTemplate("volumeControls", enabled);
			pushFromTemplate("metronomeGroupControls", enabled);
			continue;
		}

		pushFromTemplate(type, enabled, label, description);
	}

	for (const component of DEFAULT_PLAYER_COMPONENTS) {
		if (seen.has(component.type)) continue;
		normalized.push({ ...component });
		seen.add(component.type);
	}

	return { components: normalized };
}

export interface PlayerControls {
	play?: () => void;
	pause?: () => void;
	stop?: () => void;
	refresh?: () => void;
	seekPlaybackPosition?: (tick: number) => void;
	applyZoom?: (percent: number) => void;
	applyPlaybackSpeed?: (speed: number) => void;
	setMasterVolume?: (volume: number) => void;
	setMetronomeVolume?: (volume: number) => void;
	setCountInEnabled?: (enabled: boolean) => void;
	setScoreTracksMuted?: (muted: boolean) => void;
}

type WorkspaceMode =
	| "editor"
	| "enjoy"
	| "tutorial"
	| "settings"
	| "git"
	| "dataset";

type DatasetFeedbackKind = "success" | "error";

interface DatasetFeedback {
	kind: DatasetFeedbackKind;
	message: string;
}

interface AppState {
	// ===== Repo 管理 =====
	repos: Repo[];
	activeRepoId: string | null;
	fileTree: FileNode[];
	// 保留 files 以兼容现有代码，实际使用 fileTree
	files: FileItem[];
	// 用户偏好设置
	deleteBehavior: DeleteBehavior;
	setDeleteBehavior: (behavior: DeleteBehavior) => void;

	// Repo Actions
	addRepo: (path: string, name?: string) => Promise<void>;
	removeRepo: (id: string) => void;
	switchRepo: (id: string) => Promise<void>;
	updateRepoName: (id: string, name: string) => void;
	loadRepos: () => Promise<void>;

	// FileTree Actions
	expandFolder: (path: string) => void;
	collapseFolder: (path: string) => void;
	refreshFileTree: () => Promise<void>;
	getFileNodeById: (id: string) => FileNode | undefined;

	// 当前选中的文件
	activeFileId: string | null;

	// 🆕 音轨面板显示状态
	isTracksPanelOpen: boolean;
	setTracksPanelOpen: (open: boolean) => void;
	toggleTracksPanel: () => void;

	// 🆕 乐谱选区状态 - 用于 Preview ↔ Editor 双向同步
	scoreSelection: ScoreSelectionInfo | null;

	// 🆕 编辑器光标位置 - 用于 Editor → Preview 反向同步
	editorCursor: EditorCursorInfo | null;

	// 🆕 播放位置 - 用于播放时编辑器跟随高亮
	playbackBeat: PlaybackBeatInfo | null;

	// 🆕 播放器光标位置 - 暂停时也保留，用于显示黄色小节高亮
	playerCursorPosition: PlaybackBeatInfo | null;
	playbackPositionTick: number;
	playbackEndTick: number;
	playbackPositionMs: number;
	playbackEndMs: number;
	// 🆕 编辑器焦点状态（用于控制 player enable）
	editorHasFocus: boolean;
	setEditorHasFocus: (hasFocus: boolean) => void;
	// 🆕 Player UI / remote controls
	playerControls: PlayerControls | null;
	registerPlayerControls: (controls: PlayerControls) => void;
	unregisterPlayerControls: () => void;
	playerIsPlaying: boolean;
	setPlayerIsPlaying: (v: boolean) => void;
	zoomPercent: number;
	setZoomPercent: (v: number) => void;
	playbackSpeed: number;
	setPlaybackSpeed: (v: number) => void;
	masterVolume: number;
	setMasterVolume: (v: number) => void;
	metronomeOnlyMode: boolean;
	setMetronomeOnlyMode: (v: boolean) => void;
	/** 播放模式：true= BPM 模式, false = 倍速模式 */
	playbackBpmMode: boolean;
	setPlaybackBpmMode: (v: boolean) => void;

	/** 由当前加载乐谱解析出的初始 BPM（若可用） */
	songInitialBpm: number | null;
	setSongInitialBpm: (v: number | null) => void;

	/** 节拍器音量 (0-1) */
	metronomeVolume: number;
	setMetronomeVolume: (v: number) => void;

	countInEnabled: boolean;
	setCountInEnabled: (v: boolean) => void;
	enableKeepAwakeDuringPlayback: boolean;
	setEnableKeepAwakeDuringPlayback: (v: boolean) => void;
	enablePlaybackProgressBar: boolean;
	setEnablePlaybackProgressBar: (v: boolean) => void;
	enablePlaybackProgressSeek: boolean;
	setEnablePlaybackProgressSeek: (v: boolean) => void;

	/** 是否启用编辑器播放同步滚动 */
	enableSyncScroll: boolean;
	setEnableSyncScroll: (v: boolean) => void;

	// 是否启用编辑器光标广播到Preview
	enableCursorBroadcast: boolean;
	setEnableCursorBroadcast: (v: boolean) => void;

	// 🆕 自定义播放器配置
	customPlayerConfig: CustomPlayerConfig;
	setCustomPlayerConfig: (config: CustomPlayerConfig) => void;
	updatePlayerComponentOrder: (components: PlayerComponentConfig[]) => void;
	togglePlayerComponent: (type: PlayerComponentType) => void;

	// 🆕 alphaTab API / score 生命周期标识
	apiInstanceId: number;
	scoreVersion: number;
	editorRefreshVersion: number;
	bottomBarRefreshVersion: number;
	bumpApiInstanceId: () => void;
	bumpScoreVersion: () => void;
	bumpEditorRefreshVersion: () => void;
	bumpBottomBarRefreshVersion: () => void;
	workspaceMode: WorkspaceMode;
	setWorkspaceMode: (mode: WorkspaceMode) => void;
	gitStatus: GitStatusSummary | null;
	gitStatusLoading: boolean;
	gitStatusError: string | null;
	gitSelectedChange: GitSelectedChange | null;
	gitDiff: GitDiffResult | null;
	gitDiffLoading: boolean;
	gitDiffError: string | null;
	gitCommitMessage: string;
	gitActionLoading: boolean;
	gitActionError: string | null;
	setGitCommitMessage: (message: string) => void;
	refreshGitStatus: () => Promise<void>;
	selectGitChange: (change: GitSelectedChange | null) => Promise<void>;
	toggleGitStage: (
		change: GitSelectedChange,
		nextStaged: boolean,
	) => Promise<void>;
	addAllGitChanges: () => Promise<boolean>;
	syncGitPull: () => Promise<boolean>;
	commitGitChanges: () => Promise<boolean>;
	clearGitState: () => void;
	datasetList: DatasetListEntry[];
	datasetListLoading: boolean;
	datasetListError: string | null;
	datasetLoading: boolean;
	datasetError: string | null;
	datasetActiveId: string | null;
	datasetActive: DatasetManifest | null;
	datasetSamples: SampleSummary[];
	datasetActiveSampleId: string | null;
	datasetActiveSample: SampleManifest | null;
	datasetSampleLoading: boolean;
	datasetSourceText: string;
	datasetSourceSavedText: string;
	datasetSourceDirty: boolean;
	datasetMutationLoading: boolean;
	datasetMutationError: string | null;
	datasetFeedback: DatasetFeedback | null;
	datasetLastExport: DatasetExportResult | null;
	listDatasets: () => Promise<void>;
	createDataset: (input: CreateDatasetInput) => Promise<boolean>;
	loadDataset: (datasetId: string) => Promise<boolean>;
	createSample: (input: CreateSampleInput) => Promise<boolean>;
	loadSample: (sampleId: string) => Promise<boolean>;
	clearDatasetActiveSample: () => void;
	setDatasetSourceText: (sourceText: string) => void;
	saveDatasetSampleSource: () => Promise<boolean>;
	saveDatasetArtifact: (input: SaveSampleArtifactInput) => Promise<boolean>;
	updateDatasetSample: (update: UpdateSampleInput) => Promise<boolean>;
	exportDatasetJsonl: () => Promise<boolean>;
	clearDatasetFeedback: () => void;
	clearDatasetState: () => void;

	// 🆕 第一个谱表显示选项
	firstStaffOptions: StaffDisplayOptions | null;

	// 🆕 待处理的谱表选项切换
	pendingStaffToggle: keyof StaffDisplayOptions | null;

	// 教程选择（用于侧边栏与教程视图间同步）
	activeTutorialId: string | null;
	setActiveTutorialId: (id: string | null) => void;
	tutorialAudience: TutorialAudience;
	setTutorialAudience: (audience: TutorialAudience) => void;
	// 设置页选择（用于侧边栏与设置视图间同步）
	activeSettingsPageId: string | null;
	setActiveSettingsPageId: (id: string | null) => void;

	// i18n 语言
	locale: "en" | "zh-cn";
	setLocale: (locale: "en" | "zh-cn") => void;
	disabledCommandIds: string[];
	setCommandEnabled: (commandId: string, enabled: boolean) => void;
	pinnedCommandIds: string[];
	setCommandPinned: (commandId: string, pinned: boolean) => void;
	commandMruIds: string[];
	recordCommandUsage: (commandId: string) => void;
	templateFilePaths: string[];
	setFileTemplate: (filePath: string, enabled: boolean) => void;
	toggleFileTemplate: (filePath: string) => void;
	remapTemplatePaths: (oldPrefix: string, newPrefix: string) => void;
	commandShortcuts: Record<string, string[]>;
	setCommandShortcuts: (commandId: string, shortcuts: string[]) => void;
	resetCommandShortcuts: (commandId: string) => void;
	// Actions
	addFile: (file: FileItem) => void;
	removeFile: (id: string) => void;
	renameFile: (id: string, newName: string) => Promise<boolean>;
	setActiveFile: (id: string | null) => void;
	updateFileContent: (id: string, content: string) => void;
	setFileMeta: (
		id: string,
		metaClass: string[],
		metaTags: string[],
		metaStatus?: "draft" | "active" | "done" | "released",
		metaTabist?: string,
		metaApp?: string,
		metaGithub?: string,
		metaLicense?:
			| "CC0-1.0"
			| "CC-BY-4.0"
			| "CC-BY-SA-4.0"
			| "CC-BY-NC-4.0"
			| "CC-BY-NC-SA-4.0"
			| "CC-BY-ND-4.0"
			| "CC-BY-NC-ND-4.0",
		metaSource?: string,
		metaRelease?: string,
		metaAlias?: string[],
		metaTitle?: string,
	) => void;
	setFileMetaByPath: (
		path: string,
		metaClass: string[],
		metaTags: string[],
		metaStatus?: "draft" | "active" | "done" | "released",
		metaTabist?: string,
		metaApp?: string,
		metaGithub?: string,
		metaLicense?:
			| "CC0-1.0"
			| "CC-BY-4.0"
			| "CC-BY-SA-4.0"
			| "CC-BY-NC-4.0"
			| "CC-BY-NC-SA-4.0"
			| "CC-BY-ND-4.0"
			| "CC-BY-NC-ND-4.0",
		metaSource?: string,
		metaRelease?: string,
		metaAlias?: string[],
		metaTitle?: string,
	) => void;
	getActiveFile: () => FileItem | undefined;

	// 🆕 选区操作
	setScoreSelection: (selection: ScoreSelectionInfo | null) => void;
	clearScoreSelection: () => void;

	// 🆕 编辑器光标操作
	setEditorCursor: (cursor: EditorCursorInfo | null) => void;

	// 🆕 播放位置操作
	setPlaybackBeat: (beat: PlaybackBeatInfo | null) => void;
	clearPlaybackBeat: () => void;

	// 🆕 播放器光标位置操作（暂停时也保留）
	setPlayerCursorPosition: (position: PlaybackBeatInfo | null) => void;
	setPlaybackProgress: (progress: {
		positionTick: number;
		endTick: number;
		positionMs: number;
		endMs: number;
	}) => void;
	resetPlaybackProgress: () => void;
	/**
	 * 🆕 清除"播放相关"高亮状态，回到无高亮状态
	 * - 清除绿色当前 beat 高亮
	 * - 清除黄色小节高亮（依赖 playerCursorPosition）
	 */
	clearPlaybackHighlights: () => void;

	/**
	 * 🆕 清除所有高亮（选区 + 播放），回到无高亮状态
	 */
	clearAllHighlights: () => void;

	// 🆕 谱表选项操作
	setFirstStaffOptions: (options: StaffDisplayOptions | null) => void;
	toggleFirstStaffOption: (key: keyof StaffDisplayOptions) => void;
	requestStaffToggle: (key: keyof StaffDisplayOptions) => void;

	// 初始化，从主进程读取持久化状态
	initialize: () => Promise<void>;
}

// 递归查找文件节点
function findNodeById(nodes: FileNode[], id: string): FileNode | undefined {
	for (const node of nodes) {
		if (node.id === id) return node;
		if (node.children) {
			const found = findNodeById(node.children, id);
			if (found) return found;
		}
	}
	return undefined;
}

// 递归更新节点展开状态
function updateNodeExpanded(
	nodes: FileNode[],
	path: string,
	isExpanded: boolean,
): FileNode[] {
	return nodes.map((node) => {
		if (node.path === path) {
			return { ...node, isExpanded };
		}
		if (node.children) {
			return {
				...node,
				children: updateNodeExpanded(node.children, path, isExpanded),
			};
		}
		return node;
	});
}

function collectExpandedFolders(nodes: FileNode[]): string[] {
	const result: string[] = [];
	const walk = (n: FileNode[]) => {
		for (const node of n) {
			if (node.type === "folder") {
				if (node.isExpanded) result.push(node.path);
				if (node.children) walk(node.children);
			}
		}
	};
	walk(nodes);
	return result;
}

function toSampleSummary(sample: SampleManifest): SampleSummary {
	const normalizedSample = normalizeSampleManifest(sample);
	return {
		id: normalizedSample.id,
		title: normalizedSample.title,
		tags: normalizedSample.tags,
		reviewStatus: normalizedSample.reviewStatus,
		reviewNotes: normalizedSample.reviewNotes,
		metadata: normalizedSample.metadata,
		source: normalizedSample.source,
		artifacts: normalizedSample.artifacts,
		createdAt: normalizedSample.createdAt,
		updatedAt: normalizedSample.updatedAt,
	};
}

function sortSampleSummaries(samples: SampleSummary[]): SampleSummary[] {
	// Keep manifest/insertion order stable.
	// Do not reorder by timestamps, so saving/updating a sample won't move it.
	return samples.map(normalizeSampleSummary);
}

function upsertSampleSummary(
	samples: SampleSummary[],
	sample: SampleManifest,
): SampleSummary[] {
	const nextSummary = normalizeSampleSummary(toSampleSummary(sample));
	const normalizedSamples = samples.map(normalizeSampleSummary);
	const currentIndex = normalizedSamples.findIndex(
		(entry) => entry.id === nextSummary.id,
	);
	if (currentIndex < 0) {
		return [...normalizedSamples, nextSummary];
	}
	const nextSamples = [...normalizedSamples];
	nextSamples[currentIndex] = nextSummary;
	return nextSamples;
}

// In-memory cache to speed up "switching between samples repeatedly".
// This avoids re-reading sample manifests/source files from disk during fast tabbing.
const DATASET_SAMPLE_CACHE_MAX_ENTRIES = 200;
const datasetSampleCache = new Map<string, LoadedSample>();

function normalizeRepoPathForCache(repoPath: string): string {
	return repoPath.replace(/\\/g, "/");
}

function makeDatasetSampleCacheKey(
	repoPath: string,
	datasetId: string,
	sampleId: string,
): string {
	return `${normalizeRepoPathForCache(repoPath)}::${datasetId}::${sampleId}`;
}

function getCachedDatasetSample(key: string): LoadedSample | null {
	const cached = datasetSampleCache.get(key);
	if (!cached) return null;
	// Touch for LRU.
	datasetSampleCache.delete(key);
	datasetSampleCache.set(key, cached);
	return cached;
}

function setCachedDatasetSample(key: string, value: LoadedSample): void {
	// Keep insertion order as LRU.
	if (datasetSampleCache.has(key)) datasetSampleCache.delete(key);
	datasetSampleCache.set(key, value);
	if (datasetSampleCache.size <= DATASET_SAMPLE_CACHE_MAX_ENTRIES) return;

	const lruKey = datasetSampleCache.keys().next().value;
	if (typeof lruKey === "string") {
		datasetSampleCache.delete(lruKey);
	}
}

function createInitialDatasetState() {
	return {
		datasetList: [] as DatasetListEntry[],
		datasetListLoading: false,
		datasetListError: null as string | null,
		datasetLoading: false,
		datasetError: null as string | null,
		datasetActiveId: null as string | null,
		datasetActive: null as DatasetManifest | null,
		datasetSamples: [] as SampleSummary[],
		datasetActiveSampleId: null as string | null,
		datasetActiveSample: null as SampleManifest | null,
		datasetSampleLoading: false,
		datasetSourceText: "",
		datasetSourceSavedText: "",
		datasetSourceDirty: false,
		datasetMutationLoading: false,
		datasetMutationError: null as string | null,
		datasetFeedback: null as DatasetFeedback | null,
		datasetLastExport: null as DatasetExportResult | null,
	};
}

async function mergeAndSaveWorkspacePreferences(partial: RepoPreferences) {
	const state = useAppStore.getState();
	const repo = state.repos.find((r) => r.id === state.activeRepoId);
	if (!repo) return;
	try {
		await updateWorkspaceMetadata(repo, (existing) => ({
			id: repo.id,
			name: repo.name,
			openedAt: Date.now(),
			expandedFolders:
				existing?.expandedFolders ?? collectExpandedFolders(state.fileTree),
			preferences: { ...(existing?.preferences ?? {}), ...partial },
			activeFilePath: existing?.activeFilePath ?? null,
			workspaceMode: existing?.workspaceMode,
			activeSettingsPageId: existing?.activeSettingsPageId ?? null,
			activeTutorialId: existing?.activeTutorialId ?? null,
			tutorialAudience: existing?.tutorialAudience,
		}));
	} catch (e) {
		console.error("saveWorkspacePreferences failed", e);
	}
}

const EXPANDED_FOLDERS_SAVE_DEBOUNCE_MS = 250;
const expandedFoldersSaveTimers = new Map<string, number>();
const APP_STATE_SAVE_DEBOUNCE_MS = 180;
const appStateSaveTimers = new Map<string, number>();
let isRestoringAppState = false;

interface WorkspaceSessionSnapshot {
	activeFilePath: string | null;
	workspaceMode: AppState["workspaceMode"];
	activeSettingsPageId: string | null;
	activeTutorialId: string | null;
	tutorialAudience: AppState["tutorialAudience"];
	datasetActiveId: string | null;
	datasetActiveSampleId: string | null;
}

function scheduleSaveAppState() {
	if (isRestoringAppState) return;

	const state = useAppStore.getState();
	const repo = state.repos.find(
		(candidate) => candidate.id === state.activeRepoId,
	);
	if (!repo) return;

	const key = repo.path;
	const previousTimer = appStateSaveTimers.get(key);
	if (typeof previousTimer === "number") {
		window.clearTimeout(previousTimer);
	}

	const activeFilePath =
		state.files.find((file) => file.id === state.activeFileId)?.path ?? null;
	const snapshot: WorkspaceSessionSnapshot = {
		activeFilePath,
		workspaceMode: state.workspaceMode,
		activeSettingsPageId: state.activeSettingsPageId,
		activeTutorialId: state.activeTutorialId,
		tutorialAudience: state.tutorialAudience,
		datasetActiveId: state.datasetActiveId,
		datasetActiveSampleId: state.datasetActiveSampleId,
	};
	const expandedFallback = collectExpandedFolders(state.fileTree);

	const timer = window.setTimeout(() => {
		appStateSaveTimers.delete(key);
		void saveWorkspaceSessionForRepo(repo, snapshot, expandedFallback);
	}, APP_STATE_SAVE_DEBOUNCE_MS);

	appStateSaveTimers.set(key, timer);
}

async function saveWorkspaceSessionForRepo(
	repo: Repo,
	snapshot: WorkspaceSessionSnapshot,
	expandedFallback: string[],
) {
	try {
		await updateWorkspaceMetadata(repo, (existing) => ({
			id: existing?.id ?? repo.id,
			name: existing?.name ?? repo.name,
			openedAt: Date.now(),
			expandedFolders: existing?.expandedFolders ?? expandedFallback,
			preferences: existing?.preferences,
			activeFilePath: snapshot.activeFilePath,
			workspaceMode: snapshot.workspaceMode,
			activeSettingsPageId: snapshot.activeSettingsPageId,
			activeTutorialId: snapshot.activeTutorialId,
			tutorialAudience: snapshot.tutorialAudience,
			datasetActiveId: snapshot.datasetActiveId,
			datasetActiveSampleId: snapshot.datasetActiveSampleId,
		}));
	} catch (error) {
		console.error("saveWorkspaceSession failed:", error);
	}
}

async function saveExpandedFoldersForRepo(
	repo: Repo,
	expandedFolders: string[],
) {
	try {
		await updateWorkspaceMetadata(repo, (existing) => ({
			id: repo.id,
			name: repo.name,
			openedAt: Date.now(),
			expandedFolders,
			preferences: existing?.preferences,
			activeFilePath: existing?.activeFilePath ?? null,
			workspaceMode: existing?.workspaceMode,
			activeSettingsPageId: existing?.activeSettingsPageId ?? null,
			activeTutorialId: existing?.activeTutorialId ?? null,
			tutorialAudience: existing?.tutorialAudience,
		}));
	} catch (e) {
		console.error("saveExpandedFolders failed", e);
	}
}

function scheduleSaveExpandedFolders() {
	const s = useAppStore.getState();
	const repo = s.repos.find((r) => r.id === s.activeRepoId);
	if (!repo) return;

	const key = repo.path;
	const expandedAtSchedule = collectExpandedFolders(s.fileTree);
	const prevTimer = expandedFoldersSaveTimers.get(key);
	if (typeof prevTimer === "number") {
		window.clearTimeout(prevTimer);
	}

	const timer = window.setTimeout(() => {
		expandedFoldersSaveTimers.delete(key);
		void saveExpandedFoldersForRepo(repo, expandedAtSchedule);
	}, EXPANDED_FOLDERS_SAVE_DEBOUNCE_MS);

	expandedFoldersSaveTimers.set(key, timer);
}

export const useAppStore = create<AppState>((set, get) => ({
	// ===== Repo 初始状态 =====
	repos: [],
	activeRepoId: null,
	fileTree: [],
	deleteBehavior: "ask-every-time",
	setDeleteBehavior: (behavior) => {
		set({ deleteBehavior: behavior });
		void saveGlobalSettings({ deleteBehavior: behavior });
	},
	...createInitialDatasetState(),

	// ===== Repo Actions =====
	addRepo: async (path: string, name?: string) => {
		const { repos } = get();

		const normalizedPath = path.replace(/\\/g, "/");
		const existingRepo = repos.find(
			(r) => r.path.replace(/\\/g, "/") === normalizedPath,
		);

		if (existingRepo) {
			await get().switchRepo(existingRepo.id);
			return;
		}

		const pathParts = path.split(/[\\/]/);
		const folderName =
			pathParts[pathParts.length - 1] ||
			pathParts[pathParts.length - 2] ||
			"Untitled";

		const newRepo: Repo = {
			id: crypto.randomUUID(),
			name: name || folderName,
			path,
			lastOpenedAt: Date.now(),
		};

		set((state) => {
			const newRepos = [...state.repos, newRepo];
			try {
				window.desktopAPI?.saveRepos?.(newRepos);
			} catch {}
			return { repos: newRepos, activeRepoId: newRepo.id };
		});

		await get().switchRepo(newRepo.id);
	},

	removeRepo: (id: string) => {
		const state = get();
		const newRepos = state.repos.filter((repo) => repo.id !== id);
		const removedActiveRepo = state.activeRepoId === id;
		const newActiveId =
			state.activeRepoId === id
				? newRepos.length > 0
					? newRepos[0].id
					: null
				: state.activeRepoId;
		const nextDatasetState = removedActiveRepo
			? createInitialDatasetState()
			: {
					datasetList: state.datasetList,
					datasetListLoading: state.datasetListLoading,
					datasetListError: state.datasetListError,
					datasetLoading: state.datasetLoading,
					datasetError: state.datasetError,
					datasetActiveId: state.datasetActiveId,
					datasetActive: state.datasetActive,
					datasetSamples: state.datasetSamples,
					datasetActiveSampleId: state.datasetActiveSampleId,
					datasetActiveSample: state.datasetActiveSample,
					datasetSampleLoading: state.datasetSampleLoading,
					datasetSourceText: state.datasetSourceText,
					datasetSourceSavedText: state.datasetSourceSavedText,
					datasetSourceDirty: state.datasetSourceDirty,
					datasetMutationLoading: state.datasetMutationLoading,
					datasetMutationError: state.datasetMutationError,
					datasetFeedback: state.datasetFeedback,
					datasetLastExport: state.datasetLastExport,
				};
		const nextActiveRepoContext =
			newRepos.find((repo) => repo.id === newActiveId) ?? null;

		try {
			window.desktopAPI?.saveRepos?.(newRepos);
		} catch {}

		set({
			repos: newRepos,
			activeRepoId: newActiveId,
			fileTree: newActiveId ? state.fileTree : [],
			files: newActiveId ? state.files : [],
			gitStatus: newActiveId ? state.gitStatus : null,
			gitStatusError: newActiveId ? state.gitStatusError : null,
			gitStatusLoading: false,
			gitSelectedChange: newActiveId ? state.gitSelectedChange : null,
			gitDiff: newActiveId ? state.gitDiff : null,
			gitDiffLoading: false,
			gitDiffError: newActiveId ? state.gitDiffError : null,
			gitCommitMessage: newActiveId ? state.gitCommitMessage : "",
			gitActionLoading: false,
			gitActionError: newActiveId ? state.gitActionError : null,
			...nextDatasetState,
		});
		setActiveRepoContext(
			nextActiveRepoContext
				? {
						id: nextActiveRepoContext.id,
						name: nextActiveRepoContext.name,
						path: nextActiveRepoContext.path,
					}
				: null,
		);
		scheduleSaveAppState();
	},

	switchRepo: async (id: string) => {
		const repo = get().repos.find((r) => r.id === id);
		if (!repo) return;

		try {
			const result = await window.desktopAPI?.scanDirectory?.(repo.path);
			if (result) {
				setActiveRepoContext({ id: repo.id, name: repo.name, path: repo.path });
				set((state) => {
					const newRepos = state.repos.map((r) =>
						r.id === id ? { ...r, lastOpenedAt: Date.now() } : r,
					);
					try {
						window.desktopAPI?.saveRepos?.(newRepos);
					} catch {}
					const baseState = {
						repos: newRepos,
						activeRepoId: id,
						fileTree: result.nodes,
						files: flattenFileNodes(result.nodes),
						templateFilePaths: [],
						commandShortcuts: {},
						activeFileId: null,
						workspaceMode: "editor" as const,
						activeSettingsPageId: null,
						activeTutorialId: "user-readme",
						tutorialAudience: "user" as const,
						scoreSelection: null,
						playbackBeat: null,
						playerCursorPosition: null,
						gitStatus: null,
						gitStatusLoading: false,
						gitStatusError: null,
						gitSelectedChange: null,
						gitDiff: null,
						gitDiffLoading: false,
						gitDiffError: null,
						gitCommitMessage: "",
						gitActionLoading: false,
						gitActionError: null,
						...createInitialDatasetState(),
					};
					return baseState;
				});
				scheduleSaveAppState();

				// hydrate workspace preferences and expanded folders
				try {
					const meta = await loadWorkspaceMetadata(repo.path);
					if (meta) {
						// apply expanded folders
						if (meta.expandedFolders?.length) {
							for (const p of meta.expandedFolders) {
								set((state) => ({
									fileTree: updateNodeExpanded(state.fileTree, p, true),
								}));
							}
						}
						// apply preferences
						const prefs = meta.preferences ?? {};
						if (typeof prefs.zoomPercent === "number") {
							set({ zoomPercent: prefs.zoomPercent });
							get().playerControls?.applyZoom?.(prefs.zoomPercent);
						}
						if (typeof prefs.playbackSpeed === "number") {
							set({ playbackSpeed: prefs.playbackSpeed });
							get().playerControls?.applyPlaybackSpeed?.(prefs.playbackSpeed);
						}
						if (typeof prefs.masterVolume === "number") {
							set({ masterVolume: prefs.masterVolume });
							get().playerControls?.setMasterVolume?.(prefs.masterVolume);
						}
						if (typeof prefs.playbackBpmMode === "boolean") {
							set({ playbackBpmMode: prefs.playbackBpmMode });
						}
						if (typeof prefs.metronomeVolume === "number") {
							set({ metronomeVolume: prefs.metronomeVolume });
							get().playerControls?.setMetronomeVolume?.(prefs.metronomeVolume);
						}
						if (typeof prefs.countInEnabled === "boolean") {
							set({ countInEnabled: prefs.countInEnabled });
							get().playerControls?.setCountInEnabled?.(prefs.countInEnabled);
						}
						if (typeof prefs.enableKeepAwakeDuringPlayback === "boolean") {
							set({
								enableKeepAwakeDuringPlayback:
									prefs.enableKeepAwakeDuringPlayback,
							});
						}
						if (typeof prefs.enablePlaybackProgressBar === "boolean") {
							set({
								enablePlaybackProgressBar: prefs.enablePlaybackProgressBar,
							});
						}
						if (typeof prefs.enablePlaybackProgressSeek === "boolean") {
							set({
								enablePlaybackProgressSeek: prefs.enablePlaybackProgressSeek,
							});
						}
						if (typeof prefs.enableSyncScroll === "boolean") {
							set({ enableSyncScroll: prefs.enableSyncScroll });
						}
						if (typeof prefs.enableCursorBroadcast === "boolean") {
							set({ enableCursorBroadcast: prefs.enableCursorBroadcast });
						}
						if (Array.isArray(prefs.disabledCommandIds)) {
							set({
								disabledCommandIds: prefs.disabledCommandIds.filter(
									(id): id is string => typeof id === "string",
								),
							});
						}
						if (Array.isArray(prefs.pinnedCommandIds)) {
							set({
								pinnedCommandIds: prefs.pinnedCommandIds.filter(
									(id): id is string => typeof id === "string",
								),
							});
						}
						if (Array.isArray(prefs.commandMruIds)) {
							set({
								commandMruIds: prefs.commandMruIds
									.filter((id): id is string => typeof id === "string")
									.slice(0, 30),
							});
						}
						if (Array.isArray(prefs.templateFilePaths)) {
							set({
								templateFilePaths: sanitizeTemplatePathList(
									prefs.templateFilePaths.filter(
										(path): path is string => typeof path === "string",
									),
								),
							});
						}
						if (
							prefs.commandShortcuts &&
							typeof prefs.commandShortcuts === "object"
						) {
							const nextShortcuts: Record<string, string[]> = {};
							for (const [commandId, rawShortcuts] of Object.entries(
								prefs.commandShortcuts,
							)) {
								if (!Array.isArray(rawShortcuts)) continue;
								const shortcuts = sanitizeShortcutList(
									rawShortcuts.filter(
										(shortcut): shortcut is string =>
											typeof shortcut === "string",
									),
								);
								nextShortcuts[commandId] = shortcuts;
							}
							set({ commandShortcuts: nextShortcuts });
						}
						set({
							customPlayerConfig: normalizeCustomPlayerConfig(
								prefs.customPlayerConfig,
							),
						});
						if (prefs.locale === "en" || prefs.locale === "zh-cn") {
							set({ locale: prefs.locale });
							void i18n.changeLanguage(prefs.locale).catch((error) => {
								console.error(
									"Failed to hydrate locale from workspace:",
									error,
								);
							});
						}
						if (
							prefs.deleteBehavior === "system-trash" ||
							prefs.deleteBehavior === "repo-trash" ||
							prefs.deleteBehavior === "ask-every-time"
						) {
							set({ deleteBehavior: prefs.deleteBehavior });
						}
						if (
							prefs.theme?.uiThemeId &&
							prefs.theme.editorThemeId &&
							(prefs.theme.mode === "light" ||
								prefs.theme.mode === "dark" ||
								prefs.theme.mode === "system")
						) {
							const themeStore = useThemeStore.getState();
							themeStore.setCombinedTheme({
								uiThemeId: prefs.theme.uiThemeId,
								editorThemeId: prefs.theme.editorThemeId,
							});
							themeStore.setThemeMode(prefs.theme.mode);
						}

						if (
							typeof prefs.locale !== "string" ||
							typeof prefs.deleteBehavior !== "string" ||
							!prefs.theme
						) {
							const migratedSettings = await loadGlobalSettings();
							void mergeAndSaveWorkspacePreferences({
								locale: migratedSettings.locale,
								deleteBehavior: migratedSettings.deleteBehavior,
								theme: migratedSettings.theme,
							});
						}

						set({
							workspaceMode: meta.workspaceMode ?? "editor",
							activeSettingsPageId: meta.activeSettingsPageId ?? null,
							activeTutorialId: meta.activeTutorialId ?? "user-readme",
							tutorialAudience: meta.tutorialAudience ?? "user",
						});

						// Dataset workspace hydration: restore last active dataset/sample
						// only when the user was last in dataset mode.
						if (meta.workspaceMode === "dataset") {
							const datasetId =
								typeof meta.datasetActiveId === "string"
									? meta.datasetActiveId
									: null;
							const sampleId =
								typeof meta.datasetActiveSampleId === "string"
									? meta.datasetActiveSampleId
									: null;

							if (datasetId) {
								try {
									await get().loadDataset(datasetId);
									if (sampleId) {
										await get().loadSample(sampleId);
									}
								} catch (error) {
									console.error("Failed to hydrate dataset workspace:", error);
								}
							}
						}

						if (meta.activeFilePath) {
							const normalizedPath = normalizePathForCompare(
								meta.activeFilePath,
							);
							const targetFile = get().files.find(
								(file) => normalizePathForCompare(file.path) === normalizedPath,
							);

							if (targetFile) {
								if (!targetFile.contentLoaded) {
									try {
										const readResult = await window.desktopAPI.readFile(
											targetFile.path,
										);
										if (!readResult.error) {
											set((current) => ({
												files: current.files.map((file) =>
													file.id === targetFile.id
														? {
																...file,
																content: readResult.content,
																contentLoaded: true,
															}
														: file,
												),
											}));
										}
									} catch (error) {
										console.error(
											"Failed to hydrate active file content from workspace:",
											error,
										);
									}
								}

								set({ activeFileId: targetFile.id });
							}
						}
					} else {
						// initialize workspace metadata
						const themeStore = useThemeStore.getState();
						const currentState = get();
						await updateWorkspaceMetadata(repo, (existing) => {
							if (existing) return existing;

							return {
								id: repo.id,
								name: repo.name,
								openedAt: Date.now(),
								expandedFolders: [],
								preferences: {
									locale: currentState.locale,
									deleteBehavior: currentState.deleteBehavior,
									theme: {
										uiThemeId: themeStore.currentUITheme,
										editorThemeId: themeStore.currentEditorTheme,
										mode: themeStore.themeMode,
									},
								},
								activeFilePath: null,
								workspaceMode: "editor",
								activeSettingsPageId: null,
								activeTutorialId: "user-readme",
								tutorialAudience: "user",
								datasetActiveId: null,
								datasetActiveSampleId: null,
							};
						});
					}
				} catch (e) {
					console.error("hydrate workspace failed", e);
				}
			}
		} catch (err) {
			console.error("Failed to scan directory:", err);
		}
	},

	updateRepoName: (id: string, name: string) => {
		const state = get();
		const newRepos = state.repos.map((repo) =>
			repo.id === id ? { ...repo, name } : repo,
		);
		try {
			window.desktopAPI?.saveRepos?.(newRepos);
		} catch {}

		set({ repos: newRepos });
		const activeRepo = newRepos.find((repo) => repo.id === state.activeRepoId);
		if (activeRepo) {
			setActiveRepoContext({
				id: activeRepo.id,
				name: activeRepo.name,
				path: activeRepo.path,
			});
		}
	},

	loadRepos: async () => {
		try {
			const repos = await window.desktopAPI?.loadRepos?.();
			if (repos) {
				set({ repos });
			}
		} catch (err) {
			console.error("Failed to load repos:", err);
		}
	},

	// ===== FileTree Actions =====
	expandFolder: (path: string) => {
		set((state) => ({
			fileTree: updateNodeExpanded(state.fileTree, path, true),
		}));
		scheduleSaveExpandedFolders();
	},

	collapseFolder: (path: string) => {
		set((state) => ({
			fileTree: updateNodeExpanded(state.fileTree, path, false),
		}));
		scheduleSaveExpandedFolders();
	},

	refreshFileTree: async () => {
		const state = get();
		const { activeRepoId, repos, files, activeFileId } = state;
		if (!activeRepoId) return;

		const repo = repos.find((r) => r.id === activeRepoId);
		if (!repo) return;

		try {
			const result = await window.desktopAPI?.scanDirectory?.(repo.path);
			if (result) {
				const nextTree = result.nodes;
				const nextFiles = reconcileFilesWithTree(nextTree, files);

				const previousActivePath = files.find(
					(f) => f.id === activeFileId,
				)?.path;
				const nextActiveFileId = resolveActiveFileId(
					nextFiles,
					activeFileId,
					previousActivePath,
				);

				set({
					fileTree: nextTree,
					files: nextFiles,
					activeFileId: nextActiveFileId,
				});
				scheduleSaveAppState();
			}
		} catch (err) {
			console.error("Failed to refresh file tree:", err);
		}
	},

	getFileNodeById: (id: string) => {
		return findNodeById(get().fileTree, id);
	},

	// ===== 兼容旧代码 =====
	files: [],
	activeFileId: null,
	isTracksPanelOpen: false,
	setTracksPanelOpen: (open) => set({ isTracksPanelOpen: open }),
	toggleTracksPanel: () =>
		set((state) => ({ isTracksPanelOpen: !state.isTracksPanelOpen })),
	scoreSelection: null,
	editorCursor: null,
	playbackBeat: null,
	playerCursorPosition: null,
	playbackPositionTick: 0,
	playbackEndTick: 0,
	playbackPositionMs: 0,
	playbackEndMs: 0,
	editorHasFocus: false,
	setEditorHasFocus: (hasFocus) => set({ editorHasFocus: hasFocus }),
	playerControls: null,
	registerPlayerControls: (controls) => set({ playerControls: controls }),
	unregisterPlayerControls: () => set({ playerControls: null }),
	playerIsPlaying: false,
	setPlayerIsPlaying: (v) => set({ playerIsPlaying: v }),
	zoomPercent: 60,
	setZoomPercent: (v) => {
		set({ zoomPercent: v });
		void mergeAndSaveWorkspacePreferences({ zoomPercent: v });
	},
	playbackSpeed: 1.0,
	setPlaybackSpeed: (v) => {
		set({ playbackSpeed: v });
		void mergeAndSaveWorkspacePreferences({ playbackSpeed: v });
	},
	masterVolume: 1.0,
	setMasterVolume: (v) => {
		const clamped = Math.max(0, Math.min(1, v));
		set({ masterVolume: clamped });
		void mergeAndSaveWorkspacePreferences({ masterVolume: clamped });
	},
	metronomeOnlyMode: false,
	setMetronomeOnlyMode: (v) => {
		set({ metronomeOnlyMode: v });
	},

	// 默认为 BPM 模式
	playbackBpmMode: true,
	setPlaybackBpmMode: (v) => {
		set({ playbackBpmMode: v });
		void mergeAndSaveWorkspacePreferences({ playbackBpmMode: v });
	},

	// 初始 BPM（由 Preview 在加载/渲染后填充）
	songInitialBpm: null,
	setSongInitialBpm: (v) => set({ songInitialBpm: v }),

	metronomeVolume: 0,
	setMetronomeVolume: (v) => {
		set({ metronomeVolume: v });
		void mergeAndSaveWorkspacePreferences({ metronomeVolume: v });
	},
	countInEnabled: false,
	setCountInEnabled: (v) => {
		set({ countInEnabled: v });
		void mergeAndSaveWorkspacePreferences({ countInEnabled: v });
	},
	enableKeepAwakeDuringPlayback: true,
	setEnableKeepAwakeDuringPlayback: (v) => {
		set({ enableKeepAwakeDuringPlayback: v });
		void mergeAndSaveWorkspacePreferences({ enableKeepAwakeDuringPlayback: v });
	},
	enablePlaybackProgressBar: true,
	setEnablePlaybackProgressBar: (v) => {
		set({ enablePlaybackProgressBar: v });
		void mergeAndSaveWorkspacePreferences({ enablePlaybackProgressBar: v });
	},
	enablePlaybackProgressSeek: true,
	setEnablePlaybackProgressSeek: (v) => {
		set({ enablePlaybackProgressSeek: v });
		void mergeAndSaveWorkspacePreferences({ enablePlaybackProgressSeek: v });
	},
	// 是否启用编辑器播放同步滚动
	enableSyncScroll: false,
	setEnableSyncScroll: (v) => {
		set({ enableSyncScroll: v });
		void mergeAndSaveWorkspacePreferences({ enableSyncScroll: v });
	},
	// 是否启用编辑器光标广播到Preview
	enableCursorBroadcast: false,
	setEnableCursorBroadcast: (v) => {
		set({ enableCursorBroadcast: v });
		void mergeAndSaveWorkspacePreferences({ enableCursorBroadcast: v });
	},

	customPlayerConfig: createDefaultCustomPlayerConfig(),
	setCustomPlayerConfig: (config) => {
		const normalized = normalizeCustomPlayerConfig(config);
		set({ customPlayerConfig: normalized });
		void mergeAndSaveWorkspacePreferences({ customPlayerConfig: normalized });
	},
	updatePlayerComponentOrder: (components) => {
		const normalized = normalizeCustomPlayerConfig({ components });
		set((state) => ({
			customPlayerConfig: {
				...state.customPlayerConfig,
				components: normalized.components,
			},
		}));
		const next = {
			...get().customPlayerConfig,
			components: normalized.components,
		};
		void mergeAndSaveWorkspacePreferences({ customPlayerConfig: next });
	},
	togglePlayerComponent: (type) => {
		const linkedTypes =
			type === "playbackSpeedControls"
				? (["bpmControls", "volumeControls", "metronomeGroupControls"] as const)
				: ([type] as const);

		set((state) => ({
			customPlayerConfig: (() => {
				const targetSet = new Set<PlayerComponentType>(linkedTypes);
				const targetComponents = state.customPlayerConfig.components.filter(
					(comp) => targetSet.has(comp.type),
				);
				const shouldEnable = !targetComponents.every((comp) => comp.enabled);
				const nextComponents = state.customPlayerConfig.components.map(
					(comp) =>
						targetSet.has(comp.type)
							? { ...comp, enabled: shouldEnable }
							: comp,
				);

				return {
					...state.customPlayerConfig,
					components: nextComponents,
				};
			})(),
		}));
		void mergeAndSaveWorkspacePreferences({
			customPlayerConfig: get().customPlayerConfig,
		});
	},
	apiInstanceId: 0,
	scoreVersion: 0,
	editorRefreshVersion: 0,
	bottomBarRefreshVersion: 0,
	bumpApiInstanceId: () =>
		set((state) => ({ apiInstanceId: state.apiInstanceId + 1 })),
	bumpScoreVersion: () =>
		set((state) => ({ scoreVersion: state.scoreVersion + 1 })),
	bumpEditorRefreshVersion: () =>
		set((state) => ({ editorRefreshVersion: state.editorRefreshVersion + 1 })),
	bumpBottomBarRefreshVersion: () =>
		set((state) => ({
			bottomBarRefreshVersion: state.bottomBarRefreshVersion + 1,
		})),
	workspaceMode: "editor",
	setWorkspaceMode: (mode: WorkspaceMode) => {
		set({ workspaceMode: mode });
		scheduleSaveAppState();
	},
	gitStatus: null,
	gitStatusLoading: false,
	gitStatusError: null,
	gitSelectedChange: null,
	gitDiff: null,
	gitDiffLoading: false,
	gitDiffError: null,
	gitCommitMessage: "",
	gitActionLoading: false,
	gitActionError: null,
	setGitCommitMessage: (message) => set({ gitCommitMessage: message }),
	refreshGitStatus: async () => {
		const state = get();
		const activeRepo = state.repos.find(
			(repo) => repo.id === state.activeRepoId,
		);
		if (!activeRepo) {
			set({
				gitStatus: null,
				gitStatusLoading: false,
				gitStatusError: null,
				gitSelectedChange: null,
				gitDiff: null,
				gitDiffLoading: false,
				gitDiffError: null,
				gitActionError: null,
			});
			return;
		}

		set({ gitStatusLoading: true, gitStatusError: null });
		try {
			const result = await window.desktopAPI.getGitStatus(activeRepo.path);
			if (!result.success || !result.data) {
				set({
					gitStatusLoading: false,
					gitStatus: null,
					gitStatusError: result.error ?? "Failed to load git status",
					gitSelectedChange: null,
					gitDiff: null,
					gitDiffLoading: false,
					gitDiffError: null,
					gitActionError: null,
				});
				return;
			}

			const nextStatus = result.data;
			const selected = get().gitSelectedChange;
			let selectedStillExists = true;
			if (selected) {
				const list =
					selected.group === "staged"
						? nextStatus.staged
						: selected.group === "unstaged"
							? nextStatus.unstaged
							: selected.group === "untracked"
								? nextStatus.untracked
								: nextStatus.conflicted;
				selectedStillExists = list.some(
					(item) =>
						item.path === selected.path &&
						(item.fromPath ?? "") === (selected.fromPath ?? ""),
				);
			}

			set({
				gitStatus: nextStatus,
				gitStatusLoading: false,
				gitStatusError: null,
				gitSelectedChange: selectedStillExists ? selected : null,
				gitDiff: selectedStillExists ? get().gitDiff : null,
				gitDiffError: selectedStillExists ? get().gitDiffError : null,
				gitDiffLoading: selectedStillExists ? get().gitDiffLoading : false,
			});
		} catch (error) {
			set({
				gitStatusLoading: false,
				gitStatusError:
					error instanceof Error ? error.message : "Failed to load git status",
				gitStatus: null,
				gitSelectedChange: null,
				gitDiff: null,
				gitDiffError: null,
				gitDiffLoading: false,
				gitActionError: null,
			});
		}
	},
	selectGitChange: async (change) => {
		const state = get();
		const activeRepo = state.repos.find(
			(repo) => repo.id === state.activeRepoId,
		);
		if (!activeRepo) {
			set({
				gitSelectedChange: null,
				gitDiff: null,
				gitDiffError: null,
				gitDiffLoading: false,
				gitActionError: null,
			});
			return;
		}

		if (!change) {
			set({
				gitSelectedChange: null,
				gitDiff: null,
				gitDiffError: null,
				gitDiffLoading: false,
				gitActionError: null,
			});
			return;
		}

		set({
			gitSelectedChange: change,
			gitDiff: null,
			gitDiffError: null,
			gitDiffLoading: true,
			gitActionError: null,
		});

		try {
			const diffResult = await window.desktopAPI.getGitDiff(
				activeRepo.path,
				change.path,
				change.group,
			);

			if (!diffResult.success || !diffResult.data) {
				set({
					gitDiffLoading: false,
					gitDiff: null,
					gitDiffError: diffResult.error ?? "Failed to load diff",
					gitActionError: null,
				});
				return;
			}

			set({
				gitDiffLoading: false,
				gitDiff: diffResult.data,
				gitDiffError: null,
			});
		} catch (error) {
			set({
				gitDiffLoading: false,
				gitDiff: null,
				gitDiffError:
					error instanceof Error ? error.message : "Failed to load diff",
				gitActionError: null,
			});
		}
	},
	toggleGitStage: async (change, nextStaged) => {
		const state = get();
		const activeRepo = state.repos.find(
			(repo) => repo.id === state.activeRepoId,
		);
		if (!activeRepo) {
			set({ gitActionError: "No active repository", gitActionLoading: false });
			return;
		}

		set({ gitActionLoading: true, gitActionError: null });
		try {
			const result = nextStaged
				? await window.desktopAPI.stageGitFile(activeRepo.path, change.path)
				: await window.desktopAPI.unstageGitFile(activeRepo.path, change.path);

			if (!result.success) {
				set({
					gitActionLoading: false,
					gitActionError: result.error ?? "Failed to update staged state",
				});
				return;
			}

			set({ gitActionLoading: false, gitActionError: null });
			await get().refreshGitStatus();

			const nextGroup = nextStaged ? "staged" : "unstaged";
			await get().selectGitChange({
				group: nextGroup,
				path: change.path,
				fromPath: change.fromPath,
			});
		} catch (error) {
			set({
				gitActionLoading: false,
				gitActionError:
					error instanceof Error
						? error.message
						: "Failed to update staged state",
			});
		}
	},
	addAllGitChanges: async () => {
		const state = get();
		const activeRepo = state.repos.find(
			(repo) => repo.id === state.activeRepoId,
		);
		if (!activeRepo) {
			set({ gitActionError: "No active repository", gitActionLoading: false });
			return false;
		}

		set({ gitActionLoading: true, gitActionError: null });
		try {
			const result = await window.desktopAPI.stageAllGitChanges(
				activeRepo.path,
			);
			if (!result.success) {
				set({
					gitActionLoading: false,
					gitActionError: result.error ?? "Failed to stage all changes",
				});
				return false;
			}

			set({ gitActionLoading: false, gitActionError: null });
			await get().refreshGitStatus();
			return true;
		} catch (error) {
			set({
				gitActionLoading: false,
				gitActionError:
					error instanceof Error
						? error.message
						: "Failed to stage all changes",
			});
			return false;
		}
	},
	syncGitPull: async () => {
		const state = get();
		const activeRepo = state.repos.find(
			(repo) => repo.id === state.activeRepoId,
		);
		if (!activeRepo) {
			set({ gitActionError: "No active repository", gitActionLoading: false });
			return false;
		}

		set({ gitActionLoading: true, gitActionError: null });
		try {
			const result = await window.desktopAPI.syncGitPull(activeRepo.path);
			if (!result.success) {
				set({
					gitActionLoading: false,
					gitActionError: result.error ?? "Failed to sync from remote",
				});
				return false;
			}

			set({ gitActionLoading: false, gitActionError: null });
			await get().refreshGitStatus();
			return true;
		} catch (error) {
			set({
				gitActionLoading: false,
				gitActionError:
					error instanceof Error ? error.message : "Failed to sync from remote",
			});
			return false;
		}
	},
	commitGitChanges: async () => {
		const state = get();
		const activeRepo = state.repos.find(
			(repo) => repo.id === state.activeRepoId,
		);
		const message = state.gitCommitMessage.trim();

		if (!activeRepo) {
			set({ gitActionError: "No active repository" });
			return false;
		}

		if (!message) {
			set({ gitActionError: "Commit message is required" });
			return false;
		}

		set({ gitActionLoading: true, gitActionError: null });
		try {
			const result = await window.desktopAPI.commitGitChanges(
				activeRepo.path,
				message,
			);
			if (!result.success) {
				set({
					gitActionLoading: false,
					gitActionError: result.error ?? "Failed to commit changes",
				});
				return false;
			}

			set({
				gitActionLoading: false,
				gitActionError: null,
				gitCommitMessage: "",
				gitSelectedChange: null,
				gitDiff: null,
				gitDiffError: null,
				gitDiffLoading: false,
			});
			await get().refreshGitStatus();
			return true;
		} catch (error) {
			set({
				gitActionLoading: false,
				gitActionError:
					error instanceof Error ? error.message : "Failed to commit changes",
			});
			return false;
		}
	},
	clearGitState: () =>
		set({
			gitStatus: null,
			gitStatusLoading: false,
			gitStatusError: null,
			gitSelectedChange: null,
			gitDiff: null,
			gitDiffLoading: false,
			gitDiffError: null,
			gitCommitMessage: "",
			gitActionLoading: false,
			gitActionError: null,
		}),
	listDatasets: async () => {
		const state = get();
		const activeRepo = state.repos.find(
			(repo) => repo.id === state.activeRepoId,
		);
		if (!activeRepo) {
			set(createInitialDatasetState());
			return;
		}

		set({
			datasetListLoading: true,
			datasetListError: null,
		});

		try {
			const result = await window.desktopAPI.listDatasets(activeRepo.path);
			if (!result.success || !result.data) {
				set({
					datasetList: [],
					datasetListLoading: false,
					datasetListError: result.error ?? "Failed to list datasets",
				});
				return;
			}

			const nextList = result.data;
			set((current) => {
				const activeDatasetStillExists =
					current.datasetActiveId !== null &&
					nextList.some(
						(entry) => entry.dataset.id === current.datasetActiveId,
					);

				if (activeDatasetStillExists) {
					return {
						datasetList: nextList,
						datasetListLoading: false,
						datasetListError: null,
					};
				}

				return {
					datasetList: nextList,
					datasetListLoading: false,
					datasetListError: null,
					datasetLoading: false,
					datasetError: null,
					datasetActiveId: null,
					datasetActive: null,
					datasetSamples: [],
					datasetActiveSampleId: null,
					datasetActiveSample: null,
					datasetSampleLoading: false,
					datasetSourceText: "",
					datasetSourceSavedText: "",
					datasetSourceDirty: false,
					datasetMutationError: null,
					datasetFeedback: null,
					datasetLastExport: null,
				};
			});
		} catch (error) {
			set({
				datasetListLoading: false,
				datasetListError:
					error instanceof Error ? error.message : "Failed to list datasets",
			});
		}
	},
	createDataset: async (input) => {
		const state = get();
		const activeRepo = state.repos.find(
			(repo) => repo.id === state.activeRepoId,
		);
		if (!activeRepo) {
			set({
				datasetMutationError: "No active repository",
				datasetFeedback: {
					kind: "error",
					message: "Select a repository before creating a dataset.",
				},
			});
			return false;
		}

		if (input.name.trim().length === 0) {
			set({
				datasetMutationError: "Dataset name is required",
				datasetFeedback: {
					kind: "error",
					message: "Dataset name is required.",
				},
			});
			return false;
		}

		set({
			datasetMutationLoading: true,
			datasetMutationError: null,
			datasetFeedback: null,
		});

		try {
			const result = await window.desktopAPI.createDataset(
				activeRepo.path,
				input,
			);
			if (!result.success || !result.data) {
				set({
					datasetMutationLoading: false,
					datasetMutationError: result.error ?? "Failed to create dataset",
					datasetFeedback: {
						kind: "error",
						message: result.error ?? "Failed to create dataset.",
					},
				});
				return false;
			}

			const createdDataset = result.data;
			set({
				datasetMutationLoading: false,
				datasetMutationError: null,
				datasetFeedback: {
					kind: "success",
					message: `Created dataset "${createdDataset.name}".`,
				},
			});

			await get().listDatasets();
			await get().loadDataset(createdDataset.id);
			return true;
		} catch (error) {
			set({
				datasetMutationLoading: false,
				datasetMutationError:
					error instanceof Error ? error.message : "Failed to create dataset",
				datasetFeedback: {
					kind: "error",
					message:
						error instanceof Error
							? error.message
							: "Failed to create dataset.",
				},
			});
			return false;
		}
	},
	loadDataset: async (datasetId) => {
		const state = get();
		const activeRepo = state.repos.find(
			(repo) => repo.id === state.activeRepoId,
		);
		if (!activeRepo) {
			set({ datasetError: "No active repository" });
			return false;
		}

		set({
			datasetLoading: true,
			datasetError: null,
			datasetActiveId: datasetId,
			datasetActiveSampleId: null,
			datasetActiveSample: null,
			datasetSampleLoading: false,
			datasetSourceText: "",
			datasetSourceSavedText: "",
			datasetSourceDirty: false,
			datasetLastExport: null,
		});

		try {
			const result = await window.desktopAPI.loadDataset(
				activeRepo.path,
				datasetId,
			);
			if (!result.success || !result.data) {
				set({
					datasetLoading: false,
					datasetError: result.error ?? "Failed to load dataset",
					datasetSamples: [],
					datasetActiveSampleId: null,
					datasetActiveSample: null,
					datasetSourceText: "",
					datasetSourceSavedText: "",
					datasetSourceDirty: false,
				});
				return false;
			}

			const loadedDataset = normalizeLoadedDataset(result.data);
			set({
				datasetLoading: false,
				datasetError: null,
				datasetActiveId: loadedDataset.dataset.id,
				datasetActive: loadedDataset.dataset,
				datasetSamples: sortSampleSummaries(loadedDataset.samples),
				datasetActiveSampleId: null,
				datasetActiveSample: null,
				datasetSourceText: "",
				datasetSourceSavedText: "",
				datasetSourceDirty: false,
				datasetMutationError: null,
			});
			return true;
		} catch (error) {
			set({
				datasetLoading: false,
				datasetError:
					error instanceof Error ? error.message : "Failed to load dataset",
				datasetSamples: [],
				datasetActiveSampleId: null,
				datasetActiveSample: null,
				datasetSourceText: "",
				datasetSourceSavedText: "",
				datasetSourceDirty: false,
			});
			return false;
		}
	},
	createSample: async (input) => {
		const state = get();
		const activeRepo = state.repos.find(
			(repo) => repo.id === state.activeRepoId,
		);
		const datasetId = state.datasetActiveId;
		if (!activeRepo || !datasetId) {
			set({
				datasetMutationError: "No active dataset",
				datasetFeedback: {
					kind: "error",
					message: "Select a dataset before creating a sample.",
				},
			});
			return false;
		}

		const titleText = input.title?.trim() ?? "";
		const sourceText = input.sourceText?.trim() ?? "";
		if (titleText.length === 0 && sourceText.length === 0) {
			set({
				datasetMutationError: "Sample title is required",
				datasetFeedback: {
					kind: "error",
					message: "Sample title or source is required.",
				},
			});
			return false;
		}

		set({
			datasetMutationLoading: true,
			datasetMutationError: null,
			datasetFeedback: null,
		});

		try {
			const result = await window.desktopAPI.createSample(
				activeRepo.path,
				datasetId,
				input,
			);
			if (!result.success || !result.data) {
				set({
					datasetMutationLoading: false,
					datasetMutationError: result.error ?? "Failed to create sample",
					datasetFeedback: {
						kind: "error",
						message: result.error ?? "Failed to create sample.",
					},
				});
				return false;
			}

			const loadedSample = normalizeLoadedSample(result.data);
			const alreadyExists = state.datasetSamples.some(
				(sample) => sample.id === loadedSample.sample.id,
			);
			set((current) => ({
				datasetMutationLoading: false,
				datasetMutationError: null,
				datasetFeedback: {
					kind: "success",
					message: `Created sample "${loadedSample.sample.title}".`,
				},
				datasetActiveSampleId: loadedSample.sample.id,
				datasetActiveSample: loadedSample.sample,
				datasetSampleLoading: false,
				datasetSourceText: loadedSample.sourceText,
				datasetSourceSavedText: loadedSample.sourceText,
				datasetSourceDirty: false,
				datasetSamples: upsertSampleSummary(
					current.datasetSamples,
					loadedSample.sample,
				),
				datasetList: current.datasetList.map((entry) =>
					entry.dataset.id === loadedSample.sample.datasetId
						? {
								...entry,
								sampleCount: alreadyExists
									? entry.sampleCount
									: entry.sampleCount + 1,
							}
						: entry,
				),
			}));
			return true;
		} catch (error) {
			set({
				datasetMutationLoading: false,
				datasetMutationError:
					error instanceof Error ? error.message : "Failed to create sample",
				datasetFeedback: {
					kind: "error",
					message:
						error instanceof Error ? error.message : "Failed to create sample.",
				},
			});
			return false;
		}
	},
	loadSample: async (sampleId) => {
		const state = get();
		const activeRepo = state.repos.find(
			(repo) => repo.id === state.activeRepoId,
		);
		if (!activeRepo || !state.datasetActiveId) {
			set({
				datasetMutationError: "No active dataset",
				datasetSampleLoading: false,
			});
			return false;
		}

		const repoPath = activeRepo.path;
		const datasetId = state.datasetActiveId;
		const cacheKey = makeDatasetSampleCacheKey(repoPath, datasetId, sampleId);
		const cached = getCachedDatasetSample(cacheKey);

		if (cached) {
			set((current) => ({
				datasetSampleLoading: false,
				datasetMutationError: null,
				datasetFeedback: null,
				datasetActiveSampleId: cached.sample.id,
				datasetActiveSample: cached.sample,
				datasetSourceText: cached.sourceText,
				datasetSourceSavedText: cached.sourceText,
				datasetSourceDirty: false,
				datasetSamples: upsertSampleSummary(
					current.datasetSamples,
					cached.sample,
				),
			}));
			return true;
		}

		// Optimistically update selected sample id so rapid tabbing doesn't feel delayed.
		// (We still keep the old sample content until the new one resolves.)
		set({
			datasetSampleLoading: true,
			datasetMutationError: null,
			datasetFeedback: null,
			datasetActiveSampleId: sampleId,
		});

		try {
			const result = await window.desktopAPI.loadSample(
				repoPath,
				datasetId,
				sampleId,
			);
			if (!result.success || !result.data) {
				const current = get();
				const isStillSelected =
					current.datasetActiveId === datasetId &&
					current.datasetActiveSampleId === sampleId;
				if (isStillSelected) {
					set({
						datasetSampleLoading: false,
						datasetMutationError: result.error ?? "Failed to load sample",
						datasetFeedback: {
							kind: "error",
							message: result.error ?? "Failed to load sample.",
						},
					});
				}
				return false;
			}

			const loadedSample = normalizeLoadedSample(result.data);

			setCachedDatasetSample(cacheKey, loadedSample);

			// If user has switched to another sample while we were loading,
			// avoid overriding the UI state with stale results.
			const current = get();
			const isStillSelected =
				current.datasetActiveId === datasetId &&
				current.datasetActiveSampleId === sampleId;

			set((prev) => {
				const nextDatasetSamples = upsertSampleSummary(
					prev.datasetSamples,
					loadedSample.sample,
				);

				if (!isStillSelected) {
					return {
						datasetSamples: nextDatasetSamples,
					};
				}

				return {
					datasetSampleLoading: false,
					datasetMutationError: null,
					datasetActiveSampleId: loadedSample.sample.id,
					datasetActiveSample: loadedSample.sample,
					datasetSourceText: loadedSample.sourceText,
					datasetSourceSavedText: loadedSample.sourceText,
					datasetSourceDirty: false,
					datasetSamples: nextDatasetSamples,
				};
			});

			return true;
		} catch (error) {
			// Avoid showing an error for stale loads if the user has already
			// moved on to another sample.
			const current = get();
			const isStillSelected =
				current.datasetActiveId === datasetId &&
				current.datasetActiveSampleId === sampleId;

			if (isStillSelected) {
				set({
					datasetSampleLoading: false,
					datasetMutationError:
						error instanceof Error ? error.message : "Failed to load sample",
					datasetFeedback: {
						kind: "error",
						message:
							error instanceof Error ? error.message : "Failed to load sample.",
					},
				});
			}
			return false;
		}
	},
	clearDatasetActiveSample: () => {
		set({
			datasetActiveSampleId: null,
			datasetActiveSample: null,
			datasetSampleLoading: false,
			datasetSourceText: "",
			datasetSourceSavedText: "",
			datasetSourceDirty: false,
			datasetMutationLoading: false,
			datasetMutationError: null,
			datasetFeedback: null,
		});
	},
	setDatasetSourceText: (sourceText) => {
		set((state) => ({
			datasetSourceText: sourceText,
			datasetSourceDirty: sourceText !== state.datasetSourceSavedText,
		}));
	},
	saveDatasetSampleSource: async () => {
		const state = get();
		const activeRepo = state.repos.find(
			(repo) => repo.id === state.activeRepoId,
		);
		if (!activeRepo || !state.datasetActiveId || !state.datasetActiveSampleId) {
			set({
				datasetMutationError: "No active sample",
				datasetFeedback: {
					kind: "error",
					message: "Select a sample before saving source.",
				},
			});
			return false;
		}

		const datasetIdAtStart = state.datasetActiveId;
		const sampleIdAtStart = state.datasetActiveSampleId;

		if (!state.datasetSourceDirty) {
			set({
				datasetMutationError: null,
				datasetFeedback: {
					kind: "success",
					message: "Source is already up to date.",
				},
			});
			return true;
		}

		set({
			datasetMutationLoading: true,
			datasetMutationError: null,
			datasetFeedback: null,
		});

		try {
			const result = await window.desktopAPI.saveSampleSource(
				activeRepo.path,
				datasetIdAtStart,
				sampleIdAtStart,
				state.datasetSourceText,
			);

			if (!result.success || !result.data) {
				set({
					datasetMutationLoading: false,
					datasetMutationError: result.error ?? "Failed to save source",
					datasetFeedback: {
						kind: "error",
						message: result.error ?? "Failed to save source.",
					},
				});
				return false;
			}

			const loadedSample = normalizeLoadedSample(result.data);
			// Always refresh cache for the sample we just saved.
			// Otherwise switching away and back can show stale cached source text.
			const cacheKey = makeDatasetSampleCacheKey(
				activeRepo.path,
				datasetIdAtStart,
				sampleIdAtStart,
			);
			setCachedDatasetSample(cacheKey, loadedSample);

			const current = get();
			const isStillSelected =
				current.datasetActiveId === datasetIdAtStart &&
				current.datasetActiveSampleId === sampleIdAtStart;

			set((prev) => {
				const nextSamples = upsertSampleSummary(
					prev.datasetSamples,
					loadedSample.sample,
				);

				if (!isStillSelected) {
					return {
						datasetMutationLoading: false,
						datasetMutationError: null,
						datasetFeedback: null,
						datasetSamples: nextSamples,
					};
				}

				return {
					datasetMutationLoading: false,
					datasetMutationError: null,
					datasetFeedback: {
						kind: "success",
						message: "Source saved.",
					},
					datasetActiveSampleId: loadedSample.sample.id,
					datasetActiveSample: loadedSample.sample,
					datasetSourceText: loadedSample.sourceText,
					datasetSourceSavedText: loadedSample.sourceText,
					datasetSourceDirty: false,
					datasetSamples: nextSamples,
				};
			});

			return isStillSelected;
		} catch (error) {
			set({
				datasetMutationLoading: false,
				datasetMutationError:
					error instanceof Error ? error.message : "Failed to save source",
				datasetFeedback: {
					kind: "error",
					message:
						error instanceof Error ? error.message : "Failed to save source.",
				},
			});
			return false;
		}
	},
	saveDatasetArtifact: async (input) => {
		const state = get();
		const activeRepo = state.repos.find(
			(repo) => repo.id === state.activeRepoId,
		);
		if (!activeRepo || !state.datasetActiveId || !state.datasetActiveSampleId) {
			set({
				datasetMutationError: "No active sample",
				datasetFeedback: {
					kind: "error",
					message: "Select a sample before saving an artifact.",
				},
			});
			return false;
		}

		const datasetIdAtStart = state.datasetActiveId;
		const sampleIdAtStart = state.datasetActiveSampleId;

		set({
			datasetMutationLoading: true,
			datasetMutationError: null,
			datasetFeedback: null,
		});

		try {
			const result = await window.desktopAPI.saveSampleArtifact(
				activeRepo.path,
				datasetIdAtStart,
				sampleIdAtStart,
				input,
			);

			if (!result.success || !result.data) {
				set({
					datasetMutationLoading: false,
					datasetMutationError:
						result.error ?? "Failed to save dataset artifact",
					datasetFeedback: {
						kind: "error",
						message: result.error ?? "Failed to save dataset artifact.",
					},
				});
				return false;
			}

			const loadedSample = normalizeLoadedSample(result.data);

			// Always refresh cache for the sample we just updated.
			// Otherwise switching away and back can show stale artifact.state.
			const cacheKey = makeDatasetSampleCacheKey(
				activeRepo.path,
				datasetIdAtStart,
				sampleIdAtStart,
			);
			setCachedDatasetSample(cacheKey, loadedSample);

			const current = get();
			const isStillSelected =
				current.datasetActiveId === datasetIdAtStart &&
				current.datasetActiveSampleId === sampleIdAtStart;

			set((currentState) => {
				const nextDatasetSamples = upsertSampleSummary(
					currentState.datasetSamples,
					loadedSample.sample,
				);

				if (!isStillSelected) {
					return {
						datasetMutationLoading: false,
						datasetMutationError: null,
						datasetFeedback: {
							kind: "success",
							message: `Saved ${String(input.artifactKind).toUpperCase()} artifact.`,
						},
						datasetSamples: nextDatasetSamples,
					};
				}

				return {
					datasetMutationLoading: false,
					datasetMutationError: null,
					datasetFeedback: {
						kind: "success",
						message: `Saved ${String(input.artifactKind).toUpperCase()} artifact.`,
					},
					datasetActiveSampleId: loadedSample.sample.id,
					datasetActiveSample: loadedSample.sample,
					datasetSourceText: loadedSample.sourceText,
					datasetSourceSavedText: loadedSample.sourceText,
					datasetSourceDirty: false,
					datasetSamples: nextDatasetSamples,
				};
			});
			return true;
		} catch (error) {
			set({
				datasetMutationLoading: false,
				datasetMutationError:
					error instanceof Error
						? error.message
						: "Failed to save dataset artifact",
				datasetFeedback: {
					kind: "error",
					message:
						error instanceof Error
							? error.message
							: "Failed to save dataset artifact.",
				},
			});
			return false;
		}
	},
	updateDatasetSample: async (update) => {
		const state = get();
		const activeRepo = state.repos.find(
			(repo) => repo.id === state.activeRepoId,
		);
		if (!activeRepo || !state.datasetActiveId || !state.datasetActiveSampleId) {
			set({
				datasetMutationError: "No active sample",
				datasetFeedback: {
					kind: "error",
					message: "Select a sample before updating metadata.",
				},
			});
			return false;
		}

		const datasetIdAtStart = state.datasetActiveId;
		const sampleIdAtStart = state.datasetActiveSampleId;

		set({
			datasetMutationLoading: true,
			datasetMutationError: null,
			datasetFeedback: null,
		});

		try {
			const result = await window.desktopAPI.updateSample(
				activeRepo.path,
				datasetIdAtStart,
				sampleIdAtStart,
				update,
			);

			if (!result.success || !result.data) {
				set({
					datasetMutationLoading: false,
					datasetMutationError: result.error ?? "Failed to update sample",
					datasetFeedback: {
						kind: "error",
						message: result.error ?? "Failed to update sample.",
					},
				});
				return false;
			}

			const loadedSample = normalizeLoadedSample(result.data);
			// Always refresh cache for the sample we just updated.
			// Otherwise switching away and back can show stale cached source text.
			const cacheKey = makeDatasetSampleCacheKey(
				activeRepo.path,
				datasetIdAtStart,
				sampleIdAtStart,
			);
			setCachedDatasetSample(cacheKey, loadedSample);

			const current = get();
			const isStillSelected =
				current.datasetActiveId === datasetIdAtStart &&
				current.datasetActiveSampleId === sampleIdAtStart;

			set((prev) => {
				const nextSamples = upsertSampleSummary(
					prev.datasetSamples,
					loadedSample.sample,
				);

				if (!isStillSelected) {
					return {
						datasetMutationLoading: false,
						datasetMutationError: null,
						datasetFeedback: null,
						datasetSamples: nextSamples,
					};
				}

				const nextSavedSource = loadedSample.sourceText;
				const nextSourceText = prev.datasetSourceDirty
					? prev.datasetSourceText
					: loadedSample.sourceText;
				const nextSourceDirty = nextSourceText !== nextSavedSource;

				return {
					datasetMutationLoading: false,
					datasetMutationError: null,
					datasetFeedback: {
						kind: "success",
						message: "Sample metadata updated.",
					},
					datasetActiveSampleId: loadedSample.sample.id,
					datasetActiveSample: loadedSample.sample,
					datasetSourceText: nextSourceText,
					datasetSourceSavedText: nextSavedSource,
					datasetSourceDirty: nextSourceDirty,
					datasetSamples: nextSamples,
				};
			});

			return isStillSelected;
		} catch (error) {
			set({
				datasetMutationLoading: false,
				datasetMutationError:
					error instanceof Error ? error.message : "Failed to update sample",
				datasetFeedback: {
					kind: "error",
					message:
						error instanceof Error ? error.message : "Failed to update sample.",
				},
			});
			return false;
		}
	},
	exportDatasetJsonl: async () => {
		const state = get();
		const activeRepo = state.repos.find(
			(repo) => repo.id === state.activeRepoId,
		);
		if (!activeRepo || !state.datasetActiveId) {
			set({
				datasetMutationError: "No active dataset",
				datasetFeedback: {
					kind: "error",
					message: "Select a dataset before exporting.",
				},
			});
			return false;
		}

		set({
			datasetMutationLoading: true,
			datasetMutationError: null,
			datasetFeedback: null,
		});

		try {
			const result = await window.desktopAPI.exportDatasetJsonl(
				activeRepo.path,
				state.datasetActiveId,
			);
			if (!result.success || !result.data) {
				set({
					datasetMutationLoading: false,
					datasetMutationError: result.error ?? "Failed to export dataset",
					datasetFeedback: {
						kind: "error",
						message: result.error ?? "Failed to export dataset.",
					},
				});
				return false;
			}

			const exportResult = result.data;
			set({
				datasetMutationLoading: false,
				datasetMutationError: null,
				datasetLastExport: exportResult,
				datasetFeedback: {
					kind: "success",
					message: `Exported ${exportResult.exportedCount} sample(s) to ${exportResult.relativePath}.`,
				},
			});
			return true;
		} catch (error) {
			set({
				datasetMutationLoading: false,
				datasetMutationError:
					error instanceof Error ? error.message : "Failed to export dataset",
				datasetFeedback: {
					kind: "error",
					message:
						error instanceof Error
							? error.message
							: "Failed to export dataset.",
				},
			});
			return false;
		}
	},
	clearDatasetFeedback: () => {
		set({ datasetFeedback: null });
	},
	clearDatasetState: () => {
		set(createInitialDatasetState());
	},
	firstStaffOptions: null,
	pendingStaffToggle: null,
	activeTutorialId: "user-readme",
	setActiveTutorialId: (id) => {
		set({ activeTutorialId: id });
		scheduleSaveAppState();
	},
	tutorialAudience: "user",
	setTutorialAudience: (audience) => {
		set({ tutorialAudience: audience });
		scheduleSaveAppState();
	},

	activeSettingsPageId: null,
	setActiveSettingsPageId: (id) => {
		set({ activeSettingsPageId: id });
		scheduleSaveAppState();
	},

	// 使用 getInitialLocale() 确保与 i18n.language 同步
	locale: getInitialLocale(),
	setLocale: (locale) => {
		const currentLocale = get().locale;
		// 如果语言没有变化，直接返回
		if (currentLocale === locale) return;

		// 先更新 store（单一数据源），然后同步到 i18n
		set({ locale });
		// 同步更新 i18n
		i18n.changeLanguage(locale).catch((err) => {
			console.error("Failed to change language:", err);
		});
		void saveGlobalSettings({ locale });
	},

	disabledCommandIds: [],
	setCommandEnabled: (commandId, enabled) => {
		set((state) => {
			const hasCommand = state.disabledCommandIds.includes(commandId);
			if (enabled) {
				if (!hasCommand) return {};
				const next = state.disabledCommandIds.filter((id) => id !== commandId);
				void mergeAndSaveWorkspacePreferences({ disabledCommandIds: next });
				return { disabledCommandIds: next };
			}

			if (hasCommand) return {};
			const next = [...state.disabledCommandIds, commandId];
			void mergeAndSaveWorkspacePreferences({ disabledCommandIds: next });
			return { disabledCommandIds: next };
		});
	},

	pinnedCommandIds: [],
	setCommandPinned: (commandId, pinned) => {
		set((state) => {
			const exists = state.pinnedCommandIds.includes(commandId);
			if (pinned) {
				if (exists) return {};
				const next = [...state.pinnedCommandIds, commandId];
				void mergeAndSaveWorkspacePreferences({ pinnedCommandIds: next });
				return { pinnedCommandIds: next };
			}

			if (!exists) return {};
			const next = state.pinnedCommandIds.filter((id) => id !== commandId);
			void mergeAndSaveWorkspacePreferences({ pinnedCommandIds: next });
			return { pinnedCommandIds: next };
		});
	},

	commandMruIds: [],
	recordCommandUsage: (commandId) => {
		set((state) => {
			const next = [
				commandId,
				...state.commandMruIds.filter((id) => id !== commandId),
			].slice(0, 30);
			void mergeAndSaveWorkspacePreferences({ commandMruIds: next });
			return { commandMruIds: next };
		});
	},

	templateFilePaths: [],
	setFileTemplate: (filePath, enabled) => {
		const normalizedPath = normalizePathForCompare(filePath);
		if (!normalizedPath) return;
		if (enabled && !isTemplateCandidatePath(normalizedPath)) return;

		set((state) => {
			const exists = state.templateFilePaths.includes(normalizedPath);
			const next = sanitizeTemplatePathList(
				enabled
					? exists
						? state.templateFilePaths
						: [...state.templateFilePaths, normalizedPath]
					: exists
						? state.templateFilePaths.filter((path) => path !== normalizedPath)
						: state.templateFilePaths,
			);

			if (isSameStringList(state.templateFilePaths, next)) return {};
			void mergeAndSaveWorkspacePreferences({ templateFilePaths: next });
			return { templateFilePaths: next };
		});
	},
	toggleFileTemplate: (filePath) => {
		const normalizedPath = normalizePathForCompare(filePath);
		if (!normalizedPath) return;

		set((state) => {
			const exists = state.templateFilePaths.includes(normalizedPath);
			const next = sanitizeTemplatePathList(
				exists
					? state.templateFilePaths.filter((path) => path !== normalizedPath)
					: isTemplateCandidatePath(normalizedPath)
						? [...state.templateFilePaths, normalizedPath]
						: state.templateFilePaths,
			);

			if (isSameStringList(state.templateFilePaths, next)) return {};
			void mergeAndSaveWorkspacePreferences({ templateFilePaths: next });
			return { templateFilePaths: next };
		});
	},
	remapTemplatePaths: (oldPrefix, newPrefix) => {
		const normalizedOldPrefix = normalizePathForCompare(oldPrefix);
		const normalizedNewPrefix = normalizePathForCompare(newPrefix);
		if (!normalizedOldPrefix || !normalizedNewPrefix) return;

		set((state) => {
			const next = sanitizeTemplatePathList(
				state.templateFilePaths.map((path) =>
					replacePathPrefix(path, normalizedOldPrefix, normalizedNewPrefix),
				),
			);

			if (isSameStringList(state.templateFilePaths, next)) return {};
			void mergeAndSaveWorkspacePreferences({ templateFilePaths: next });
			return { templateFilePaths: next };
		});
	},
	commandShortcuts: {},
	setCommandShortcuts: (commandId, shortcuts) => {
		const normalized = sanitizeShortcutList(shortcuts);
		set((state) => {
			const current = state.commandShortcuts[commandId] ?? [];
			if (isSameStringList(current, normalized)) return {};

			const next = {
				...state.commandShortcuts,
				[commandId]: normalized,
			};
			void mergeAndSaveWorkspacePreferences({ commandShortcuts: next });
			return { commandShortcuts: next };
		});
	},
	resetCommandShortcuts: (commandId) => {
		set((state) => {
			if (!Object.hasOwn(state.commandShortcuts, commandId)) {
				return {};
			}

			const next = { ...state.commandShortcuts };
			delete next[commandId];
			void mergeAndSaveWorkspacePreferences({ commandShortcuts: next });
			return { commandShortcuts: next };
		});
	},

	addFile: (file) => {
		set((state) => {
			const parsedMeta = extractAtDocFileMeta(file.content ?? "");
			const incomingMetaClass =
				file.metaClass ??
				(parsedMeta.metaClass.length > 0 ? parsedMeta.metaClass : undefined);
			const incomingMetaTags =
				file.metaTags ??
				(parsedMeta.metaTags.length > 0 ? parsedMeta.metaTags : undefined);
			const incomingMetaStatus = file.metaStatus ?? parsedMeta.metaStatus;
			const incomingMetaTabist = file.metaTabist ?? parsedMeta.metaTabist;
			const incomingMetaApp = file.metaApp ?? parsedMeta.metaApp;
			const incomingMetaGithub = file.metaGithub ?? parsedMeta.metaGithub;
			const incomingMetaLicense = file.metaLicense ?? parsedMeta.metaLicense;
			const incomingMetaSource = file.metaSource ?? parsedMeta.metaSource;
			const incomingMetaRelease = file.metaRelease ?? parsedMeta.metaRelease;
			const incomingMetaAlias =
				file.metaAlias ??
				(parsedMeta.metaAlias.length > 0 ? parsedMeta.metaAlias : undefined);
			const incomingMetaTitle = file.metaTitle ?? parsedMeta.metaTitle;
			const existing = state.files.find((f) => f.path === file.path);
			if (existing) {
				const merged = {
					...existing,
					// Prefer latest metadata/content when provided
					name: file.name || existing.name,
					content: file.content ?? existing.content,
					metaClass: incomingMetaClass ?? existing.metaClass,
					metaTags: incomingMetaTags ?? existing.metaTags,
					metaStatus: incomingMetaStatus ?? existing.metaStatus,
					metaTabist: incomingMetaTabist ?? existing.metaTabist,
					metaApp: incomingMetaApp ?? existing.metaApp,
					metaGithub: incomingMetaGithub ?? existing.metaGithub,
					metaLicense: incomingMetaLicense ?? existing.metaLicense,
					metaSource: incomingMetaSource ?? existing.metaSource,
					metaRelease: incomingMetaRelease ?? existing.metaRelease,
					metaAlias: incomingMetaAlias ?? existing.metaAlias,
					metaTitle: incomingMetaTitle ?? existing.metaTitle,
					contentLoaded: file.contentLoaded ?? true,
				};
				return {
					...state,
					files: state.files.map((f) => (f.id === existing.id ? merged : f)),
					activeFileId: existing.id,
				};
			}
			return {
				...state,
				files: [
					...state.files,
					{
						...file,
						metaClass: incomingMetaClass,
						metaTags: incomingMetaTags,
						metaStatus: incomingMetaStatus,
						metaTabist: incomingMetaTabist,
						metaApp: incomingMetaApp,
						metaGithub: incomingMetaGithub,
						metaLicense: incomingMetaLicense,
						metaSource: incomingMetaSource,
						metaRelease: incomingMetaRelease,
						metaAlias: incomingMetaAlias,
						metaTitle: incomingMetaTitle,
						contentLoaded: file.contentLoaded ?? true,
					},
				],
				activeFileId: file.id,
			};
		});
		scheduleSaveAppState();
	},

	removeFile: (id) => {
		set((state) => {
			const removedFile = state.files.find((file) => file.id === id);
			const removedPath = removedFile
				? normalizePathForCompare(removedFile.path)
				: null;
			const newFiles = state.files.filter((f) => f.id !== id);
			const newActiveId =
				state.activeFileId === id
					? newFiles.length > 0
						? newFiles[0].id
						: null
					: state.activeFileId;
			const nextTemplatePaths = sanitizeTemplatePathList(
				removedPath
					? state.templateFilePaths.filter((path) => path !== removedPath)
					: state.templateFilePaths,
			);

			if (nextTemplatePaths.length !== state.templateFilePaths.length) {
				void mergeAndSaveWorkspacePreferences({
					templateFilePaths: nextTemplatePaths,
				});
			}

			return {
				files: newFiles,
				activeFileId: newActiveId,
				templateFilePaths: nextTemplatePaths,
			};
		});
		scheduleSaveAppState();
	},

	renameFile: async (id, newName) => {
		const file = get().files.find((f) => f.id === id);
		if (!file) return false;

		// preserve original extension
		const idx = file.name.lastIndexOf(".");
		const oldExt = idx > 0 ? file.name.slice(idx) : "";
		// strip any extension from newName
		const newBaseIdx = newName.lastIndexOf(".");
		const newBase = newBaseIdx > 0 ? newName.slice(0, newBaseIdx) : newName;
		const finalName = `${newBase}${oldExt}`;

		try {
			const result = await window.desktopAPI?.renameFile?.(
				file.path,
				finalName,
			);
			if (!result?.success) {
				console.error("renameFile failed:", result?.error);
				return false;
			}

			const oldPath = file.path;
			const newPath = result.newPath ?? file.path;
			const updatedName = result.newName ?? finalName;

			set((state) => {
				const target = state.files.find((f) => f.id === id);
				if (!target) return {};

				const shouldUpdateId =
					target.id === oldPath || target.id === target.path;

				const newFiles = state.files.map((f) =>
					f.id === id
						? {
								...f,
								id: shouldUpdateId ? newPath : f.id,
								name: updatedName,
								path: newPath,
							}
						: f,
				);

				const newActiveFileId =
					shouldUpdateId && state.activeFileId === id
						? newPath
						: state.activeFileId;

				const newTree = renameNodeInTree(state.fileTree, oldPath, newPath);
				const nextTemplatePaths = sanitizeTemplatePathList(
					state.templateFilePaths.map((path) =>
						replacePathPrefix(path, oldPath, newPath),
					),
				);
				const templatePathsChanged = !isSameStringList(
					nextTemplatePaths,
					state.templateFilePaths,
				);

				if (templatePathsChanged) {
					void mergeAndSaveWorkspacePreferences({
						templateFilePaths: nextTemplatePaths,
					});
				}

				return {
					files: newFiles,
					activeFileId: newActiveFileId,
					fileTree: newTree,
					templateFilePaths: templatePathsChanged
						? nextTemplatePaths
						: state.templateFilePaths,
				};
			});
			scheduleSaveAppState();
			return true;
		} catch (err) {
			console.error("renameFile error:", err);
			return false;
		}
	},

	setActiveFile: (id) => {
		set({ activeFileId: id });
		scheduleSaveAppState();
	},

	updateFileContent: (id, content) => {
		const parsedMeta = extractAtDocFileMeta(content);
		set((state) => ({
			files: state.files.map((f) =>
				f.id === id
					? {
							...f,
							content,
							metaClass:
								parsedMeta.metaClass.length > 0
									? parsedMeta.metaClass
									: undefined,
							metaTags:
								parsedMeta.metaTags.length > 0
									? parsedMeta.metaTags
									: undefined,
							metaStatus: parsedMeta.metaStatus,
							metaTabist: parsedMeta.metaTabist,
							metaApp: parsedMeta.metaApp,
							metaGithub: parsedMeta.metaGithub,
							metaLicense: parsedMeta.metaLicense,
							metaSource: parsedMeta.metaSource,
							metaRelease: parsedMeta.metaRelease,
							metaAlias:
								parsedMeta.metaAlias.length > 0
									? parsedMeta.metaAlias
									: undefined,
							metaTitle: parsedMeta.metaTitle,
							contentLoaded: true,
						}
					: f,
			),
		}));
	},

	setFileMeta: (
		id,
		metaClass,
		metaTags,
		metaStatus,
		metaTabist,
		metaApp,
		metaGithub,
		metaLicense,
		metaSource,
		metaRelease,
		metaAlias,
		metaTitle,
	) => {
		set((state) => {
			let changed = false;
			const nextFiles = state.files.map((f) => {
				if (f.id !== id) return f;
				const nextClass = metaClass.length > 0 ? [...metaClass] : undefined;
				const nextTags = metaTags.length > 0 ? [...metaTags] : undefined;
				const nextStatus = metaStatus;
				const nextTabist = metaTabist;
				const nextApp = metaApp;
				const nextGithub = metaGithub;
				const nextLicense = metaLicense;
				const nextSource = metaSource;
				const nextRelease = metaRelease;
				const nextAlias =
					metaAlias && metaAlias.length > 0 ? [...metaAlias] : undefined;
				const nextTitle = metaTitle;
				if (
					isSameStringList(f.metaClass, nextClass) &&
					isSameStringList(f.metaTags, nextTags) &&
					f.metaStatus === nextStatus &&
					f.metaTabist === nextTabist &&
					f.metaApp === nextApp &&
					f.metaGithub === nextGithub &&
					f.metaLicense === nextLicense &&
					f.metaSource === nextSource &&
					f.metaRelease === nextRelease &&
					isSameStringList(f.metaAlias, nextAlias) &&
					f.metaTitle === nextTitle
				) {
					return f;
				}
				changed = true;
				return {
					...f,
					metaClass: nextClass,
					metaTags: nextTags,
					metaStatus: nextStatus,
					metaTabist: nextTabist,
					metaApp: nextApp,
					metaGithub: nextGithub,
					metaLicense: nextLicense,
					metaSource: nextSource,
					metaRelease: nextRelease,
					metaAlias: nextAlias,
					metaTitle: nextTitle,
				};
			});
			if (!changed) return state;
			return { ...state, files: nextFiles };
		});
	},

	setFileMetaByPath: (
		path,
		metaClass,
		metaTags,
		metaStatus,
		metaTabist,
		metaApp,
		metaGithub,
		metaLicense,
		metaSource,
		metaRelease,
		metaAlias,
		metaTitle,
	) => {
		set((state) => {
			let changed = false;
			const nextFiles = state.files.map((f) => {
				if (f.path !== path) return f;
				const nextClass = metaClass.length > 0 ? [...metaClass] : undefined;
				const nextTags = metaTags.length > 0 ? [...metaTags] : undefined;
				const nextStatus = metaStatus;
				const nextTabist = metaTabist;
				const nextApp = metaApp;
				const nextGithub = metaGithub;
				const nextLicense = metaLicense;
				const nextSource = metaSource;
				const nextRelease = metaRelease;
				const nextAlias =
					metaAlias && metaAlias.length > 0 ? [...metaAlias] : undefined;
				const nextTitle = metaTitle;
				if (
					isSameStringList(f.metaClass, nextClass) &&
					isSameStringList(f.metaTags, nextTags) &&
					f.metaStatus === nextStatus &&
					f.metaTabist === nextTabist &&
					f.metaApp === nextApp &&
					f.metaGithub === nextGithub &&
					f.metaLicense === nextLicense &&
					f.metaSource === nextSource &&
					f.metaRelease === nextRelease &&
					isSameStringList(f.metaAlias, nextAlias) &&
					f.metaTitle === nextTitle
				) {
					return f;
				}
				changed = true;
				return {
					...f,
					metaClass: nextClass,
					metaTags: nextTags,
					metaStatus: nextStatus,
					metaTabist: nextTabist,
					metaApp: nextApp,
					metaGithub: nextGithub,
					metaLicense: nextLicense,
					metaSource: nextSource,
					metaRelease: nextRelease,
					metaAlias: nextAlias,
					metaTitle: nextTitle,
				};
			});
			if (!changed) return state;
			return { ...state, files: nextFiles };
		});
	},

	getActiveFile: () => {
		const state = get();
		return state.files.find((f) => f.id === state.activeFileId);
	},

	// 🆕 设置乐谱选区
	setScoreSelection: (selection) => {
		set({ scoreSelection: selection });
	},

	// 🆕 清除乐谱选区
	clearScoreSelection: () => {
		set({ scoreSelection: null });
	},

	// 🆕 设置编辑器光标位置
	setEditorCursor: (cursor) => {
		set({ editorCursor: cursor });
	},

	// 🆕 设置播放位置
	setPlaybackBeat: (beat) => {
		set({ playbackBeat: beat });
	},

	// 🆕 清除播放位置
	clearPlaybackBeat: () => {
		set({ playbackBeat: null });
	},

	// 🆕 设置播放器光标位置（暂停时也保留）
	setPlayerCursorPosition: (position) => {
		set({ playerCursorPosition: position });
	},
	setPlaybackProgress: (progress) => {
		set({
			playbackPositionTick: progress.positionTick,
			playbackEndTick: progress.endTick,
			playbackPositionMs: progress.positionMs,
			playbackEndMs: progress.endMs,
		});
	},
	resetPlaybackProgress: () => {
		set({
			playbackPositionTick: 0,
			playbackEndTick: 0,
			playbackPositionMs: 0,
			playbackEndMs: 0,
		});
	},

	// 🆕 清除播放相关高亮（绿色 + 黄色）
	clearPlaybackHighlights: () => {
		set({
			playbackBeat: null,
			playerCursorPosition: null,
			playbackPositionTick: 0,
			playbackPositionMs: 0,
		});
	},

	// 🆕 清除所有高亮（选区 + 播放）
	clearAllHighlights: () => {
		set({
			scoreSelection: null,
			playbackBeat: null,
			playerCursorPosition: null,
			playbackPositionTick: 0,
			playbackPositionMs: 0,
		});
	},

	// 🆕 设置第一个谱表选项
	setFirstStaffOptions: (options) => {
		set({ firstStaffOptions: options });
	},

	// 🆕 切换第一个谱表选项
	toggleFirstStaffOption: (key) => {
		set((state) => ({
			firstStaffOptions: state.firstStaffOptions
				? {
						...state.firstStaffOptions,
						[key]: !state.firstStaffOptions[key],
					}
				: null,
		}));
	},

	// 🆕 请求切换谱表选项（由 Preview 处理）
	requestStaffToggle: (key) => {
		set({ pendingStaffToggle: key });
	},

	initialize: async () => {
		try {
			isRestoringAppState = true;
			setActiveRepoContext(null);
			const [loadedRepos, legacyAppState] = await Promise.all([
				window.desktopAPI?.loadRepos?.(),
				window.desktopAPI?.loadAppState?.(),
			]);

			if (!loadedRepos) return;

			let repos = loadedRepos;
			if (repos.length === 0) {
				const sandboxRepo = await createDefaultSandboxRepo();
				if (sandboxRepo) {
					repos = [sandboxRepo];
					try {
						await window.desktopAPI.saveRepos(repos);
					} catch (error) {
						console.error("Failed to persist default sandbox repo:", error);
					}
				}
			}

			set({ repos });

			const persistedRepoId = legacyAppState?.activeRepoId ?? null;
			const fallbackRepoId =
				repos.length > 0
					? [...repos].sort((a, b) => b.lastOpenedAt - a.lastOpenedAt)[0]?.id
					: null;
			const targetRepoId =
				persistedRepoId && repos.some((repo) => repo.id === persistedRepoId)
					? persistedRepoId
					: fallbackRepoId;

			if (!targetRepoId) return;

			await get().switchRepo(targetRepoId);

			const targetRepo = get().repos.find((repo) => repo.id === targetRepoId);
			const legacyActiveFilePath = legacyAppState?.activeFileId
				? (legacyAppState.files.find(
						(file) => file.id === legacyAppState.activeFileId,
					)?.path ?? null)
				: null;

			if (
				targetRepo &&
				legacyActiveFilePath &&
				legacyAppState?.activeRepoId === targetRepoId
			) {
				const existingWorkspace = await loadWorkspaceMetadata(targetRepo.path);
				if (!existingWorkspace?.activeFilePath) {
					const normalizedPath = normalizePathForCompare(legacyActiveFilePath);
					const targetFile = get().files.find(
						(file) => normalizePathForCompare(file.path) === normalizedPath,
					);

					if (targetFile) {
						if (!targetFile.contentLoaded) {
							try {
								const readResult = await window.desktopAPI.readFile(
									targetFile.path,
								);
								if (!readResult.error) {
									set((current) => ({
										files: current.files.map((file) =>
											file.id === targetFile.id
												? {
														...file,
														content: readResult.content,
														contentLoaded: true,
													}
												: file,
										),
									}));
								}
							} catch (error) {
								console.error("legacy active file migration failed:", error);
							}
						}

						set({ activeFileId: targetFile.id });
						scheduleSaveAppState();
					}
				}
			}
		} catch (err) {
			console.error("初始化应用状态失败:", err);
		} finally {
			isRestoringAppState = false;
			scheduleSaveAppState();
		}
	},
}));

void (async () => {
	try {
		const settings = await loadGlobalSettings();
		const store = useAppStore.getState();
		if (settings.locale && settings.locale !== store.locale) {
			store.setLocale(settings.locale);
		}
		if (
			settings.deleteBehavior &&
			settings.deleteBehavior !== store.deleteBehavior
		) {
			store.setDeleteBehavior(settings.deleteBehavior);
		}
	} catch (error) {
		console.error("Failed to hydrate initial settings:", error);
	}
})();

// 辅助函数：将 FileNode 树扁平化为 FileItem 数组
function flattenFileNodes(nodes: FileNode[]): FileItem[] {
	const result: FileItem[] = [];
	for (const node of nodes) {
		if (node.type === "file") {
			result.push({
				id: node.id,
				name: node.name,
				path: node.path,
				content: node.content || "",
				contentLoaded: typeof node.content === "string",
			});
		} else if (node.children) {
			result.push(...flattenFileNodes(node.children));
		}
	}
	return result;
}

function normalizePathForCompare(p: string): string {
	return p.replace(/\\/g, "/");
}

function reconcileFilesWithTree(
	nodes: FileNode[],
	currentFiles: FileItem[],
): FileItem[] {
	const scanned = flattenFileNodes(nodes);
	const byPath = new Map(
		currentFiles.map((f) => [normalizePathForCompare(f.path), f]),
	);

	return scanned.map((next) => {
		const existing = byPath.get(normalizePathForCompare(next.path));
		if (!existing) return next;

		return {
			...next,
			id: existing.id ?? next.id,
			content: existing.content ?? next.content,
			metaClass: existing.metaClass,
			metaTags: existing.metaTags,
			metaStatus: existing.metaStatus,
			metaTabist: existing.metaTabist,
			metaApp: existing.metaApp,
			metaGithub: existing.metaGithub,
			metaLicense: existing.metaLicense,
			metaSource: existing.metaSource,
			metaRelease: existing.metaRelease,
			metaAlias: existing.metaAlias,
			metaTitle: existing.metaTitle,
			contentLoaded: existing.contentLoaded ?? next.contentLoaded,
		};
	});
}

function resolveActiveFileId(
	nextFiles: FileItem[],
	currentActiveId: string | null,
	previousActivePath?: string,
): string | null {
	if (!currentActiveId) return null;

	if (nextFiles.some((f) => f.id === currentActiveId)) {
		return currentActiveId;
	}

	if (previousActivePath) {
		const byPath = nextFiles.find(
			(f) =>
				normalizePathForCompare(f.path) ===
				normalizePathForCompare(previousActivePath),
		);
		if (byPath) return byPath.id;
	}

	return null;
}

function basenameFromPath(p: string): string {
	const normalized = p.replace(/\\/g, "/");
	const parts = normalized.split("/");
	return parts[parts.length - 1] || normalized;
}

function replacePathPrefix(
	p: string,
	oldPrefix: string,
	newPrefix: string,
): string {
	if (p === oldPrefix) return newPrefix;
	if (!p.startsWith(oldPrefix)) return p;
	const rest = p.slice(oldPrefix.length);
	if (rest === "" || rest.startsWith("/") || rest.startsWith("\\")) {
		return `${newPrefix}${rest}`;
	}
	return p;
}

function renameNodeInTree(
	nodes: FileNode[],
	oldPath: string,
	newPath: string,
): FileNode[] {
	let changed = false;
	const next = nodes.map((node) => {
		const nodeMatches = node.id === oldPath || node.path === oldPath;
		if (nodeMatches) {
			changed = true;
			if (node.type === "folder" && node.children) {
				const updatedChildren = renameDescendants(
					node.children,
					oldPath,
					newPath,
				);
				return {
					...node,
					id: newPath,
					path: newPath,
					name: basenameFromPath(newPath),
					children: updatedChildren,
				};
			}
			return {
				...node,
				id: newPath,
				path: newPath,
				name: basenameFromPath(newPath),
			};
		}

		if (node.type === "folder" && node.children) {
			const updatedChildren = renameNodeInTree(node.children, oldPath, newPath);
			if (updatedChildren !== node.children) {
				changed = true;
				return { ...node, children: updatedChildren };
			}
		}
		return node;
	});
	return changed ? next : nodes;
}

function renameDescendants(
	nodes: FileNode[],
	oldPrefix: string,
	newPrefix: string,
): FileNode[] {
	return nodes.map((node) => {
		const updatedId = replacePathPrefix(node.id, oldPrefix, newPrefix);
		const updatedPath = replacePathPrefix(node.path, oldPrefix, newPrefix);
		const updatedName = basenameFromPath(updatedPath);
		if (node.type === "folder" && node.children) {
			const updatedChildren = renameDescendants(
				node.children,
				oldPrefix,
				newPrefix,
			);
			return {
				...node,
				id: updatedId,
				path: updatedPath,
				name: updatedName,
				children: updatedChildren,
			};
		}
		return {
			...node,
			id: updatedId,
			path: updatedPath,
			name: updatedName,
		};
	});
}
