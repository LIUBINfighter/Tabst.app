import { create } from "zustand";

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
