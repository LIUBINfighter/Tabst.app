import { create } from "zustand";
import i18n, { LOCALE_STORAGE_KEY, type Locale } from "../i18n";
import type { StaffDisplayOptions } from "../lib/staff-config";
import type { DeleteBehavior, FileNode, Repo } from "../types/repo";

/**
 * 获取初始语言设置
 * 优先从 i18n.language 读取（它已经从 localStorage 初始化过了）
 * 这确保 appStore.locale 与 i18n.language 保持同步
 */
function getInitialLocale(): Locale {
	// i18n 在此模块导入时已经初始化完成，直接读取它的语言设置
	const lng = i18n.language;
	if (lng === "en" || lng === "zh-cn") return lng;
	return "zh-cn";
}

/**
 * @deprecated 使用 FileNode 替代
 */
export interface FileItem {
	id: string;
	name: string;
	path: string;
	content: string;
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
	// 🆕 编辑器焦点状态（用于控制 player enable）
	editorHasFocus: boolean;
	setEditorHasFocus: (hasFocus: boolean) => void;
	// 🆕 Player UI / remote controls
	playerControls: {
		play?: () => void;
		pause?: () => void;
		stop?: () => void;
		refresh?: () => void;
		applyZoom?: (percent: number) => void;
		applyPlaybackSpeed?: (speed: number) => void;
		setMetronomeVolume?: (volume: number) => void;
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
	bumpApiInstanceId: () => void;
	bumpScoreVersion: () => void;
	// 工作区模式：editor | tutorial | settings
	workspaceMode: "editor" | "tutorial" | "settings";
	setWorkspaceMode: (mode: "editor" | "tutorial" | "settings") => void;

	// 🆕 第一个谱表显示选项
	firstStaffOptions: StaffDisplayOptions | null;

	// 🆕 待处理的谱表选项切换
	pendingStaffToggle: keyof StaffDisplayOptions | null;

	// 教程选择（用于侧边栏与教程视图间同步）
	activeTutorialId: string | null;
	setActiveTutorialId: (id: string | null) => void;
	// 设置页选择（用于侧边栏与设置视图间同步）
	activeSettingsPageId: string | null;
	setActiveSettingsPageId: (id: string | null) => void;

	// i18n 语言
	locale: "en" | "zh-cn";
	setLocale: (locale: "en" | "zh-cn") => void;
	// Actions
	addFile: (file: FileItem) => void;
	removeFile: (id: string) => void;
	renameFile: (id: string, newName: string) => Promise<boolean>;
	setActiveFile: (id: string | null) => void;
	updateFileContent: (id: string, content: string) => void;
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

export const useAppStore = create<AppState>((set, get) => ({
	// ===== Repo 初始状态 =====
	repos: [],
	activeRepoId: null,
	fileTree: [],
	deleteBehavior: "ask-every-time",
	setDeleteBehavior: (behavior) => set({ deleteBehavior: behavior }),

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
			};
		});
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
					return {
						repos: newRepos,
						activeRepoId: id,
						fileTree: result.nodes,
						files: flattenFileNodes(result.nodes),
						activeFileId: null,
						scoreSelection: null,
						playbackBeat: null,
						playerCursorPosition: null,
					};
				});

				await window.electronAPI?.saveWorkspaceMetadata?.(repo.path, {
					id: repo.id,
					name: repo.name,
					openedAt: Date.now(),
					expandedFolders: result.expandedFolders,
				});
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
	},

	collapseFolder: (path: string) => {
		set((state) => ({
			fileTree: updateNodeExpanded(state.fileTree, path, false),
		}));
	},

	refreshFileTree: async () => {
		const { activeRepoId, repos } = get();
		if (!activeRepoId) return;

		const repo = repos.find((r) => r.id === activeRepoId);
		if (!repo) return;

		try {
			const result = await window.electronAPI?.scanDirectory?.(repo.path);
			if (result) {
				set({
					fileTree: result.nodes,
					files: flattenFileNodes(result.nodes),
				});
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
	editorHasFocus: false,
	setEditorHasFocus: (hasFocus) => set({ editorHasFocus: hasFocus }),
	playerControls: null,
	registerPlayerControls: (controls) => set({ playerControls: controls }),
	unregisterPlayerControls: () => set({ playerControls: null }),
	playerIsPlaying: false,
	setPlayerIsPlaying: (v) => set({ playerIsPlaying: v }),
	zoomPercent: 60,
	setZoomPercent: (v) => set({ zoomPercent: v }),
	playbackSpeed: 1.0,
	setPlaybackSpeed: (v) => set({ playbackSpeed: v }),

	// 默认为 BPM 模式
	playbackBpmMode: true,
	setPlaybackBpmMode: (v) => set({ playbackBpmMode: v }),

	// 初始 BPM（由 Preview 在加载/渲染后填充）
	songInitialBpm: null,
	setSongInitialBpm: (v) => set({ songInitialBpm: v }),

	metronomeVolume: 0,
	setMetronomeVolume: (v) => set({ metronomeVolume: v }),
	// 是否启用编辑器播放同步滚动
	enableSyncScroll: false,
	setEnableSyncScroll: (v) => set({ enableSyncScroll: v }),
	// 是否启用编辑器光标广播到Preview
	enableCursorBroadcast: false,
	setEnableCursorBroadcast: (v) => set({ enableCursorBroadcast: v }),

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
				type: "playbackTransport",
				enabled: true,
				label: "Transport Controls",
				description: "Play, pause, stop, and refresh buttons",
			},
		],
	},
	setCustomPlayerConfig: (config) => set({ customPlayerConfig: config }),
	updatePlayerComponentOrder: (components) =>
		set((state) => ({
			customPlayerConfig: { ...state.customPlayerConfig, components },
		})),
	togglePlayerComponent: (type) =>
		set((state) => ({
			customPlayerConfig: {
				...state.customPlayerConfig,
				components: state.customPlayerConfig.components.map((comp) =>
					comp.type === type ? { ...comp, enabled: !comp.enabled } : comp,
				),
			},
		})),
	apiInstanceId: 0,
	scoreVersion: 0,
	bumpApiInstanceId: () =>
		set((state) => ({ apiInstanceId: state.apiInstanceId + 1 })),
	bumpScoreVersion: () =>
		set((state) => ({ scoreVersion: state.scoreVersion + 1 })),
	workspaceMode: "editor",
	setWorkspaceMode: (mode: "editor" | "tutorial" | "settings") =>
		set({ workspaceMode: mode }),
	firstStaffOptions: null,
	pendingStaffToggle: null,
	activeTutorialId: null,
	setActiveTutorialId: (id) => set({ activeTutorialId: id }),

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
		// 持久化到 localStorage（仅用于下次启动时恢复）
		try {
			localStorage.setItem(LOCALE_STORAGE_KEY, locale);
		} catch {}
	},

	addFile: (file) => {
		set((state) => {
			const existing = state.files.find((f) => f.path === file.path);
			if (existing) {
				const merged = {
					...existing,
					// Prefer latest metadata/content when provided
					name: file.name || existing.name,
					content: file.content ?? existing.content,
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
					{ ...file, contentLoaded: file.contentLoaded ?? true },
				],
				activeFileId: file.id,
			};
		});
	},

	removeFile: (id) => {
		set((state) => {
			const newFiles = state.files.filter((f) => f.id !== id);
			const newActiveId =
				state.activeFileId === id
					? newFiles.length > 0
						? newFiles[0].id
						: null
					: state.activeFileId;
			return { files: newFiles, activeFileId: newActiveId };
		});
	},

	renameFile: async (id, newName) => {
		// find file first
		const state = get();
		const file = state.files.find((f) => f.id === id);
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
			const newFiles = state.files.map((f) =>
				f.id === id
					? {
							...f,
							name: result.newName ?? finalName,
							path: result.newPath ?? f.path,
						}
					: f,
			);
			set({ files: newFiles });
			return true;
		} catch (err) {
			console.error("renameFile error:", err);
			return false;
		}
	},

	setActiveFile: (id) => {
		set({ activeFileId: id });
	},

	updateFileContent: (id, content) => {
		set((state) => ({
			files: state.files.map((f) =>
				f.id === id ? { ...f, content, contentLoaded: true } : f,
			),
		}));
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

	// 🆕 清除播放相关高亮（绿色 + 黄色）
	clearPlaybackHighlights: () => {
		set({ playbackBeat: null, playerCursorPosition: null });
	},

	// 🆕 清除所有高亮（选区 + 播放）
	clearAllHighlights: () => {
		set({
			scoreSelection: null,
			playbackBeat: null,
			playerCursorPosition: null,
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
			const repos = await window.electronAPI?.loadRepos?.();
			if (repos) {
				set({ repos });
			}

			if (repos) {
				const activeRepo = repos.find((r) => r.id === get().activeRepoId);
				if (activeRepo) {
					await get().switchRepo(activeRepo.id);
				}
			}
		} catch (err) {
			console.error("初始化应用状态失败:", err);
		}
	},
}));

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
