import { create } from "zustand";
import i18n, { type Locale } from "../i18n";
import { extractAtDocFileMeta } from "../lib/atdoc";
import { loadGlobalSettings, saveGlobalSettings } from "../lib/global-settings";
import { sanitizeShortcutList } from "../lib/shortcut-utils";
import type { StaffDisplayOptions } from "../lib/staff-config";
import {
	isTemplateCandidatePath,
	sanitizeTemplatePathList,
} from "../lib/template-utils";
import type { TutorialAudience } from "../lib/tutorial-loader";
import type {
	GitDiffResult,
	GitSelectedChange,
	GitStatusSummary,
} from "../types/git";
import type {
	DeleteBehavior,
	FileNode,
	Repo,
	RepoMetadata,
	RepoPreferences,
} from "../types/repo";

/**
 * 获取初始语言设置
 * 优先从 i18n.language 读取（它已经从 localStorage 初始化过了）
 * 这确保 appStore.locale 与 i18n.language 保持同步
 */
function getInitialLocale(): Locale {
	// Prefer i18n language; fallback to global settings; default zh-cn
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
	| "staffControls" // TAB/Staff切换控件
	| "tracksControls" // 轨道选择控件
	| "zoomControls" // 缩放控件 (zoom out/input/zoom in)
	| "playbackSpeedControls" // 播放速度和节拍器控件
	| "playbackProgress"
	| "playbackTransport"; // 播放控制 (play/pause/stop/refresh)

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
	playerControls: {
		play?: () => void;
		pause?: () => void;
		stop?: () => void;
		refresh?: () => void;
		seekPlaybackPosition?: (tick: number) => void;
		applyZoom?: (percent: number) => void;
		applyPlaybackSpeed?: (speed: number) => void;
		setMetronomeVolume?: (volume: number) => void;
		setCountInEnabled?: (enabled: boolean) => void;
	} | null;
	registerPlayerControls: (controls: NonNullable<object>) => void;
	unregisterPlayerControls: () => void;
	playerIsPlaying: boolean;
	setPlayerIsPlaying: (v: boolean) => void;
	zoomPercent: number;
	setZoomPercent: (v: number) => void;
	playbackSpeed: number;
	setPlaybackSpeed: (v: number) => void;
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
	workspaceMode: "editor" | "enjoy" | "tutorial" | "settings" | "git";
	setWorkspaceMode: (
		mode: "editor" | "enjoy" | "tutorial" | "settings" | "git",
	) => void;
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

async function mergeAndSaveWorkspacePreferences(partial: RepoPreferences) {
	const state = useAppStore.getState();
	const repo = state.repos.find((r) => r.id === state.activeRepoId);
	if (!repo) return;
	try {
		const existing = await window.electronAPI.loadWorkspaceMetadata(repo.path);
		const next: RepoMetadata = {
			id: repo.id,
			name: repo.name,
			openedAt: Date.now(),
			expandedFolders:
				existing?.expandedFolders ?? collectExpandedFolders(state.fileTree),
			preferences: { ...(existing?.preferences ?? {}), ...partial },
		};
		await window.electronAPI.saveWorkspaceMetadata(repo.path, next);
	} catch (e) {
		console.error("saveWorkspacePreferences failed", e);
	}
}

const EXPANDED_FOLDERS_SAVE_DEBOUNCE_MS = 250;
const expandedFoldersSaveTimers = new Map<string, number>();
const APP_STATE_SAVE_DEBOUNCE_MS = 180;
let appStateSaveTimer: number | null = null;
let isRestoringAppState = false;

function scheduleSaveAppState() {
	if (isRestoringAppState) return;
	if (appStateSaveTimer) {
		window.clearTimeout(appStateSaveTimer);
	}

	appStateSaveTimer = window.setTimeout(() => {
		appStateSaveTimer = null;
		const state = useAppStore.getState();
		void window.electronAPI
			.saveAppState({
				files: state.files.map((f) => ({
					id: f.id,
					name: f.name,
					path: f.path,
				})),
				activeRepoId: state.activeRepoId,
				activeFileId: state.activeFileId,
			})
			.catch((err) => {
				console.error("saveAppState failed:", err);
			});
	}, APP_STATE_SAVE_DEBOUNCE_MS);
}

async function saveExpandedFoldersForActiveRepo() {
	const s = useAppStore.getState();
	const repo = s.repos.find((r) => r.id === s.activeRepoId);
	if (!repo) return;
	try {
		const expanded = collectExpandedFolders(s.fileTree);
		const existing = await window.electronAPI.loadWorkspaceMetadata(repo.path);
		const next: RepoMetadata = {
			id: repo.id,
			name: repo.name,
			openedAt: Date.now(),
			expandedFolders: expanded,
			preferences: existing?.preferences,
		};
		await window.electronAPI.saveWorkspaceMetadata(repo.path, next);
	} catch (e) {
		console.error("saveExpandedFolders failed", e);
	}
}

function scheduleSaveExpandedFolders() {
	const s = useAppStore.getState();
	const repo = s.repos.find((r) => r.id === s.activeRepoId);
	if (!repo) return;

	const key = repo.path;
	const prevTimer = expandedFoldersSaveTimers.get(key);
	if (typeof prevTimer === "number") {
		window.clearTimeout(prevTimer);
	}

	const timer = window.setTimeout(() => {
		expandedFoldersSaveTimers.delete(key);
		void saveExpandedFoldersForActiveRepo();
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
				window.electronAPI?.saveRepos?.(newRepos);
			} catch {}
			return { repos: newRepos, activeRepoId: newRepo.id };
		});

		await get().switchRepo(newRepo.id);
	},

	removeRepo: (id: string) => {
		set((state) => {
			const newRepos = state.repos.filter((r) => r.id !== id);
			const newActiveId =
				state.activeRepoId === id
					? newRepos.length > 0
						? newRepos[0].id
						: null
					: state.activeRepoId;
			try {
				window.electronAPI?.saveRepos?.(newRepos);
			} catch {}
			return {
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
			};
		});
		scheduleSaveAppState();
	},

	switchRepo: async (id: string) => {
		const repo = get().repos.find((r) => r.id === id);
		if (!repo) return;

		try {
			const result = await window.electronAPI?.scanDirectory?.(repo.path);
			if (result) {
				set((state) => {
					const newRepos = state.repos.map((r) =>
						r.id === id ? { ...r, lastOpenedAt: Date.now() } : r,
					);
					try {
						window.electronAPI?.saveRepos?.(newRepos);
					} catch {}
					const baseState = {
						repos: newRepos,
						activeRepoId: id,
						fileTree: result.nodes,
						files: flattenFileNodes(result.nodes),
						templateFilePaths: [],
						commandShortcuts: {},
						activeFileId: null,
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
					};
					return baseState;
				});
				scheduleSaveAppState();

				// hydrate workspace preferences and expanded folders
				try {
					const meta = await window.electronAPI.loadWorkspaceMetadata(
						repo.path,
					);
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
						if (
							prefs.customPlayerConfig?.components &&
							Array.isArray(prefs.customPlayerConfig.components)
						) {
							set({
								customPlayerConfig: prefs.customPlayerConfig,
							});
						}
					} else {
						// initialize workspace metadata
						await window.electronAPI.saveWorkspaceMetadata(repo.path, {
							id: repo.id,
							name: repo.name,
							openedAt: Date.now(),
							expandedFolders: [],
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
		set((state) => {
			const newRepos = state.repos.map((r) =>
				r.id === id ? { ...r, name } : r,
			);
			try {
				window.electronAPI?.saveRepos?.(newRepos);
			} catch {}
			return { repos: newRepos };
		});
	},

	loadRepos: async () => {
		try {
			const repos = await window.electronAPI?.loadRepos?.();
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
			const result = await window.electronAPI?.scanDirectory?.(repo.path);
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

	// 🆕 自定义播放器配置 - 默认按照当前底部栏顺序
	customPlayerConfig: {
		components: [
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
				type: "playbackSpeedControls",
				enabled: true,
				label: "Playback Speed",
				description: "Speed selector and metronome toggle",
			},
			{
				type: "playbackProgress",
				enabled: true,
				label: "Playback Progress",
				description: "Draggable playback timeline",
			},
			{
				type: "playbackTransport",
				enabled: true,
				label: "Transport Controls",
				description: "Play, pause, stop, and refresh buttons",
			},
		],
	},
	setCustomPlayerConfig: (config) => {
		set({ customPlayerConfig: config });
		void mergeAndSaveWorkspacePreferences({ customPlayerConfig: config });
	},
	updatePlayerComponentOrder: (components) => {
		set((state) => ({
			customPlayerConfig: { ...state.customPlayerConfig, components },
		}));
		const next = { ...get().customPlayerConfig, components };
		void mergeAndSaveWorkspacePreferences({ customPlayerConfig: next });
	},
	togglePlayerComponent: (type) => {
		set((state) => ({
			customPlayerConfig: {
				...state.customPlayerConfig,
				components: state.customPlayerConfig.components.map((comp) =>
					comp.type === type ? { ...comp, enabled: !comp.enabled } : comp,
				),
			},
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
	setWorkspaceMode: (
		mode: "editor" | "enjoy" | "tutorial" | "settings" | "git",
	) => set({ workspaceMode: mode }),
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
			const result = await window.electronAPI.getGitStatus(activeRepo.path);
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
			const diffResult = await window.electronAPI.getGitDiff(
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
				? await window.electronAPI.stageGitFile(activeRepo.path, change.path)
				: await window.electronAPI.unstageGitFile(activeRepo.path, change.path);

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
			const result = await window.electronAPI.stageAllGitChanges(
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
			const result = await window.electronAPI.syncGitPull(activeRepo.path);
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
			const result = await window.electronAPI.commitGitChanges(
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
	firstStaffOptions: null,
	pendingStaffToggle: null,
	activeTutorialId: "user-readme",
	setActiveTutorialId: (id) => set({ activeTutorialId: id }),
	tutorialAudience: "user",
	setTutorialAudience: (audience) => set({ tutorialAudience: audience }),

	activeSettingsPageId: null,
	setActiveSettingsPageId: (id) => set({ activeSettingsPageId: id }),

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
		// Persist to ~/.tabst/settings.json
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
			const result = await window.electronAPI?.renameFile?.(
				file.path,
				finalName,
			);
			if (!result || !result.success) {
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
			const [repos, appState] = await Promise.all([
				window.electronAPI?.loadRepos?.(),
				window.electronAPI?.loadAppState?.(),
			]);

			if (!repos) return;
			set({ repos });

			const persistedRepoId = appState?.activeRepoId ?? null;
			const fallbackRepoId =
				repos.length > 0
					? [...repos].sort((a, b) => b.lastOpenedAt - a.lastOpenedAt)[0]?.id
					: null;
			const targetRepoId =
				persistedRepoId && repos.some((r) => r.id === persistedRepoId)
					? persistedRepoId
					: fallbackRepoId;

			if (!targetRepoId) return;

			await get().switchRepo(targetRepoId);

			const restoredActiveFileId = appState?.activeFileId;
			if (restoredActiveFileId) {
				const state = get();
				const targetFile = state.files.find(
					(f) => f.id === restoredActiveFileId,
				);
				if (targetFile) {
					if (!targetFile.contentLoaded) {
						try {
							const readResult = await window.electronAPI.readFile(
								targetFile.path,
							);
							if (!readResult.error) {
								set((current) => ({
									files: current.files.map((f) =>
										f.id === targetFile.id
											? {
													...f,
													content: readResult.content,
													contentLoaded: true,
												}
											: f,
									),
								}));
							}
						} catch (e) {
							console.error("restore active file content failed", e);
						}
					}
					set({ activeFileId: restoredActiveFileId, workspaceMode: "editor" });
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

// Hydrate locale and delete behavior from global settings at startup
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
	} catch {}
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
