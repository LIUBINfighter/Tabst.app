import { create } from "zustand";
import type { StaffDisplayOptions } from "../lib/staff-config";

export interface FileItem {
	id: string;
	name: string;
	path: string;
	content: string;
}

/**
 * 乐谱选区信息 - 用于 Preview 和 Editor 之间同步选区
 * 使用 alphaTab 1.8.0 Selection API
 */
export interface ScoreSelectionInfo {
	/** 起始 Beat 的小节索引 (0-based) */
	startBarIndex: number;
	/** 起始 Beat 在小节内的索引 (0-based) */
	startBeatIndex: number;
	/** 结束 Beat 的小节索引 (0-based) */
	endBarIndex: number;
	/** 结束 Beat 在小节内的索引 (0-based) */
	endBeatIndex: number;
}

/**
 * 编辑器光标位置信息 - 用于反向同步到乐谱
 */
export interface EditorCursorInfo {
	/** 光标所在行 (0-based) */
	line: number;
	/** 光标所在列 (0-based) */
	column: number;
	/** 对应的小节索引 (0-based)，-1 表示未知 */
	barIndex: number;
	/** 对应的 Beat 索引 (0-based)，-1 表示未知 */
	beatIndex: number;
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

interface AppState {
	// 文件列表
	files: FileItem[];
	// 当前选中的文件
	activeFileId: string | null;

	// 🆕 乐谱选区状态 - 用于 Preview ↔ Editor 双向同步
	scoreSelection: ScoreSelectionInfo | null;

	// 🆕 编辑器光标位置 - 用于 Editor → Preview 反向同步
	editorCursor: EditorCursorInfo | null;

	// 🆕 播放位置 - 用于播放时编辑器跟随高亮
	playbackBeat: PlaybackBeatInfo | null;

	// 🆕 播放器光标位置 - 暂停时也保留，用于显示黄色小节高亮
	playerCursorPosition: PlaybackBeatInfo | null;

	// 🆕 Player UI / remote controls
	playerControls: {
		play?: () => void;
		pause?: () => void;
		stop?: () => void;
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
	metronomeVolume: number;
	setMetronomeVolume: (v: number) => void;

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
	 * 🆕 清除“播放相关”高亮状态，回到无高亮状态
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

export const useAppStore = create<AppState>((set, get) => ({
	files: [],
	activeFileId: null,
	scoreSelection: null,
	editorCursor: null,
	playbackBeat: null,
	playerCursorPosition: null,
	playerControls: null,
	registerPlayerControls: (controls) => set({ playerControls: controls }),
	unregisterPlayerControls: () => set({ playerControls: null }),
	playerIsPlaying: false,
	setPlayerIsPlaying: (v) => set({ playerIsPlaying: v }),
	zoomPercent: 60,
	setZoomPercent: (v) => set({ zoomPercent: v }),
	playbackSpeed: 1.0,
	setPlaybackSpeed: (v) => set({ playbackSpeed: v }),
	metronomeVolume: 0,
	setMetronomeVolume: (v) => set({ metronomeVolume: v }),
	workspaceMode: "editor",
	setWorkspaceMode: (mode: "editor" | "tutorial" | "settings") =>
		set({ workspaceMode: mode }),
	firstStaffOptions: null,
	pendingStaffToggle: null,
	activeTutorialId: null,
	setActiveTutorialId: (id) => set({ activeTutorialId: id }),

	addFile: (file) => {
		set((state) => {
			// 检查文件是否已存在
			const exists = state.files.some((f) => f.path === file.path);
			if (exists) {
				return {
					activeFileId: state.files.find((f) => f.path === file.path)?.id,
				};
			}
			const newState = {
				files: [...state.files, file],
				activeFileId: file.id,
			};
			// 持久化到主进程
			try {
				window.electronAPI?.saveAppState?.({
					files: newState.files.map((f) => ({
						id: f.id,
						name: f.name,
						path: f.path,
					})),
					activeFileId: newState.activeFileId,
				});
			} catch {}
			return newState;
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
			const newState = { files: newFiles, activeFileId: newActiveId };
			try {
				window.electronAPI?.saveAppState?.({
					files: newFiles.map((f) => ({
						id: f.id,
						name: f.name,
						path: f.path,
					})),
					activeFileId: newActiveId,
				});
			} catch {}
			return newState;
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
			try {
				window.electronAPI?.saveAppState?.({
					files: newFiles.map((f) => ({
						id: f.id,
						name: f.name,
						path: f.path,
					})),
					activeFileId: state.activeFileId,
				});
			} catch {}
			return true;
		} catch (err) {
			console.error("renameFile error:", err);
			return false;
		}
	},

	setActiveFile: (id) => {
		set((state) => {
			const newState = { ...state, activeFileId: id };
			try {
				window.electronAPI?.saveAppState?.({
					files: newState.files.map((f) => ({
						id: f.id,
						name: f.name,
						path: f.path,
					})),
					activeFileId: newState.activeFileId,
				});
			} catch {}
			return { activeFileId: id };
		});
	},

	updateFileContent: (id, content) => {
		set((state) => ({
			files: state.files.map((f) => (f.id === id ? { ...f, content } : f)),
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
			const result = await window.electronAPI.loadAppState();
			if (result?.files) {
				const restored = result.files.map((f) => ({
					id: f.id ?? crypto.randomUUID(),
					name: f.name,
					path: f.path,
					content: f.content ?? "",
				}));
				set({ files: restored, activeFileId: result.activeFileId });
			}
		} catch (err) {
			console.error("初始化应用状态失败:", err);
		}
	},
}));
