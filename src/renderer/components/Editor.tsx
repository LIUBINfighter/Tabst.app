import type { Extension } from "@codemirror/state";
import { EditorState } from "@codemirror/state";
import type { ViewUpdate } from "@codemirror/view";
import { basicSetup, EditorView } from "codemirror";
import { ChevronRight, Edit } from "lucide-react";
import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { useTranslation } from "react-i18next";
import { useEditorLSP } from "../hooks/useEditorLSP";
import { useEditorTheme } from "../hooks/useEditorTheme";
import { updateEditorPlaybackHighlight } from "../lib/alphatex-playback-sync";
import { updateEditorSelectionHighlight } from "../lib/alphatex-selection-sync";
import { whitespaceDecoration } from "../lib/whitespace-decoration";
import { useAppStore } from "../store/appStore";
import Preview from "./Preview";
import QuoteCard from "./QuoteCard";
import TopBar from "./TopBar";
import { TracksPanel, type TracksPanelProps } from "./TracksPanel";
import { Button } from "./ui/button";
import IconButton from "./ui/icon-button";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "./ui/tooltip";

interface EditorProps {
	showExpandSidebar?: boolean;
	onExpandSidebar?: () => void;
}

export function Editor({ showExpandSidebar, onExpandSidebar }: EditorProps) {
	const { t } = useTranslation(["sidebar", "common"]);
	const editorRef = useRef<HTMLDivElement | null>(null);
	const viewRef = useRef<EditorView | null>(null);
	const saveTimerRef = useRef<number | null>(null);
	const lastContentRef = useRef<string>("");
	const focusCleanupRef = useRef<(() => void) | null>(null);
	const [previewApi, setPreviewApi] = useState<TracksPanelProps["api"]>(null);

	// Track current file path to detect language changes
	const currentFilePathRef = useRef<string>("");

	// Track if we're currently updating to prevent recursive updates
	const isUpdatingRef = useRef(false);

	const activeFile = useAppStore((s) =>
		s.files.find((f) => f.id === s.activeFileId),
	);
	const setWorkspaceMode = useAppStore((s) => s.setWorkspaceMode);
	const isTracksPanelOpen = useAppStore((s) => s.isTracksPanelOpen);
	const setTracksPanelOpen = useAppStore((s) => s.setTracksPanelOpen);

	const _scoreSelection = useAppStore((s) => s.scoreSelection);
	const _playbackBeat = useAppStore((s) => s.playbackBeat);
	const _playerCursorPosition = useAppStore((s) => s.playerCursorPosition);
	const enableSyncScroll = useAppStore((s) => s.enableSyncScroll);

	const { themeCompartment, themeExtension } = useEditorTheme();
	const {
		languageCompartment,
		getLanguageForFile,
		loadLanguageExtensions,
		cleanupLSP,
	} = useEditorLSP();

	// Create update listener
	const createUpdateListener = useCallback(() => {
		return EditorView.updateListener.of((update: ViewUpdate) => {
			if (update.docChanged && !isUpdatingRef.current) {
				const newContent = update.state.doc.toString();
				lastContentRef.current = newContent;
				const currentActiveId = useAppStore.getState().activeFileId;

				if (currentActiveId) {
					useAppStore.getState().updateFileContent(currentActiveId, newContent);
				}

				if (saveTimerRef.current) {
					clearTimeout(saveTimerRef.current);
				}

				saveTimerRef.current = window.setTimeout(async () => {
					const state = useAppStore.getState();
					const file = state.files.find((f) => f.id === state.activeFileId);
					if (file) {
						try {
							await window.electronAPI.saveFile(file.path, newContent);
						} catch (err) {
							console.error("Failed to save file:", err);
						}
					}
					saveTimerRef.current = null;
				}, 800);
			}
		});
	}, []);

	// Main effect: Create editor or update it when file changes
	useEffect(() => {
		if (!editorRef.current) return;

		// If there's no active file, destroy editor
		if (!activeFile?.id) {
			if (viewRef.current) {
				viewRef.current.destroy();
				viewRef.current = null;
			}
			// Clear any残留的 DOM 元素 - 使用 requestAnimationFrame 确保在下一帧清理
			if (editorRef.current) {
				// 立即清空，确保 DOM 被清理
				const container = editorRef.current;
				// 查找并移除所有 CodeMirror 相关的 DOM 元素
				const cmEditor = container.querySelector(".cm-editor");
				if (cmEditor) {
					cmEditor.remove();
				}
				// 也清空 innerHTML 作为备用
				container.innerHTML = "";
			}
			if (focusCleanupRef.current) {
				focusCleanupRef.current();
				focusCleanupRef.current = null;
				useAppStore.getState().setEditorHasFocus(false);
			}
			cleanupLSP();
			currentFilePathRef.current = "";
			return;
		}

		const filePath = activeFile.path;
		const content = activeFile.content;
		const language = getLanguageForFile(filePath);

		// Handle both initialization and updates in one async block
		(async () => {
			try {
				// Check if editor's parent DOM has changed (layout switch)
				const needsRemount =
					viewRef.current &&
					viewRef.current.dom.parentElement !== editorRef.current;

				// Initialize editor if it doesn't exist or needs remount
				if (!viewRef.current || needsRemount) {
					// Destroy old instance if remounting
					if (viewRef.current && needsRemount) {
						viewRef.current.destroy();
						viewRef.current = null;
					}
					// Clear any残留的 DOM 元素
					if (editorRef.current) {
						editorRef.current.innerHTML = "";
					}

					const languageExtensions = await loadLanguageExtensions(
						language,
						filePath,
					);
					const updateListener = createUpdateListener();

					const extensions: Extension[] = [
						basicSetup,
						updateListener,
						whitespaceDecoration(),
						themeCompartment.of(themeExtension),
						languageCompartment.of(languageExtensions),
					];

					const state = EditorState.create({
						doc: content,
						extensions,
					});

					if (editorRef.current) {
						viewRef.current = new EditorView({
							state,
							parent: editorRef.current,
						});
						if (focusCleanupRef.current) {
							focusCleanupRef.current();
							focusCleanupRef.current = null;
						}
						const dom = viewRef.current.dom;
						const handleFocusIn = () =>
							useAppStore.getState().setEditorHasFocus(true);
						const handleFocusOut = () =>
							useAppStore.getState().setEditorHasFocus(false);
						dom.addEventListener("focusin", handleFocusIn);
						dom.addEventListener("focusout", handleFocusOut);
						focusCleanupRef.current = () => {
							dom.removeEventListener("focusin", handleFocusIn);
							dom.removeEventListener("focusout", handleFocusOut);
						};
						currentFilePathRef.current = filePath;
						lastContentRef.current = content;
					}
					return;
				}

				// Editor exists - update it instead of recreating
				const needsLanguageChange = currentFilePathRef.current !== filePath;

				if (!viewRef.current) return;

				const effects = [];
				let changes: { from: number; to: number; insert: string } | undefined;

				// Update document content if different from what we last saw
				// This prevents feedback loops from store updates
				if (content !== lastContentRef.current) {
					isUpdatingRef.current = true;
					changes = {
						from: 0,
						to: viewRef.current.state.doc.length,
						insert: content,
					};
					lastContentRef.current = content;
				}

				// Update language extensions if file type changed
				if (needsLanguageChange) {
					cleanupLSP();

					const languageExtensions = await loadLanguageExtensions(
						language,
						filePath,
					);
					effects.push(languageCompartment.reconfigure(languageExtensions));
					currentFilePathRef.current = filePath;
				}

				// Apply changes and effects together
				if ((changes !== undefined || effects.length > 0) && viewRef.current) {
					viewRef.current.dispatch({
						changes,
						effects: effects.length > 0 ? effects : undefined,
					});
					isUpdatingRef.current = false;
				}
			} catch (error) {
				console.error("Failed to initialize/update editor:", error);
				isUpdatingRef.current = false;
			}
		})();
	}, [
		activeFile?.id,
		activeFile?.content,
		activeFile?.path,
		getLanguageForFile,
		themeExtension,
		loadLanguageExtensions,
		createUpdateListener,
		activeFile,
		themeCompartment,
		languageCompartment,
		cleanupLSP,
	]);

	// ✅ 统一滚动缓冲：不使用 vh，按容器高度的 60% 计算底部留白（px）
	useEffect(() => {
		const host = editorRef.current;
		if (!host) return;

		const apply = () => {
			// editor 列的可用高度（接近“视口高度”）作为基准
			const h = host.getBoundingClientRect().height;
			const px = Math.max(0, Math.floor(h * 0.6));
			host.style.setProperty("--scroll-buffer", `${px}px`);
		};

		apply();

		const ro = new ResizeObserver(() => apply());
		ro.observe(host);
		return () => ro.disconnect();
	}, []);

	// Update theme when dark mode changes
	useEffect(() => {
		if (!viewRef.current || !themeCompartment) return;

		viewRef.current.dispatch({
			effects: themeCompartment.reconfigure(themeExtension),
		});
	}, [themeExtension, themeCompartment]);

	// 🆕 监听乐谱选区变化，更新编辑器高亮
	useEffect(() => {
		const view = viewRef.current;
		if (!view) return;

		// 只有 AlphaTex 文件才需要选区同步
		const language = activeFile ? getLanguageForFile(activeFile.path) : "";
		if (language !== "alphatex") return;

		const content = activeFile?.content ?? "";
		updateEditorSelectionHighlight(view, content, _scoreSelection);
	}, [_scoreSelection, activeFile, getLanguageForFile]);

	// 🆕 监听播放位置变化，更新编辑器播放高亮
	// 播放中：显示绿色高亮（当前音符）
	// 未播放：显示黄色高亮（播放器光标所在小节）
	useEffect(() => {
		const view = viewRef.current;
		if (!view) return;

		// 只有 AlphaTex 文件才需要播放同步
		const language = activeFile ? getLanguageForFile(activeFile.path) : "";
		if (language !== "alphatex") return;

		const content = activeFile?.content ?? "";
		const isPlaying = _playbackBeat !== null;
		updateEditorPlaybackHighlight(
			view,
			content,
			_playbackBeat,
			_playerCursorPosition,
			isPlaying,
			enableSyncScroll,
		);
	}, [
		_playbackBeat,
		_playerCursorPosition,
		activeFile,
		getLanguageForFile,
		enableSyncScroll,
	]);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			if (viewRef.current) {
				viewRef.current.destroy();
				viewRef.current = null;
			}
			// Clear any残留的 DOM 元素
			if (editorRef.current) {
				editorRef.current.innerHTML = "";
			}
			if (focusCleanupRef.current) {
				focusCleanupRef.current();
				focusCleanupRef.current = null;
				useAppStore.getState().setEditorHasFocus(false);
			}
			cleanupLSP();
			if (saveTimerRef.current) {
				clearTimeout(saveTimerRef.current);
				saveTimerRef.current = null;
			}
		};
	}, [cleanupLSP]);

	// Cleanup editor when no active file - use useLayoutEffect to ensure cleanup before render
	useLayoutEffect(() => {
		if (!activeFile?.id) {
			// 先保存编辑器 DOM 引用，因为 destroy() 会清除它
			const editorDom = viewRef.current?.dom
				? viewRef.current.dom.closest(".cm-editor")
				: null;

			if (viewRef.current) {
				viewRef.current.destroy();
				viewRef.current = null;
			}

			// Clear any残留的 DOM 元素
			if (editorRef.current) {
				// 查找并移除所有 CodeMirror 相关的 DOM 元素
				const cmEditor = editorRef.current.querySelector(".cm-editor");
				if (cmEditor) {
					cmEditor.remove();
				}
				// 也清空 innerHTML 作为备用
				editorRef.current.innerHTML = "";
			}

			// 额外检查：如果编辑器 DOM 被挂载到了其他地方，也清理它
			// 这可能是由于 React 的 ref 更新时机问题导致的
			if (editorDom?.parentElement) {
				editorDom.remove();
			}

			// 最后检查：在整个组件树中查找并清理任何残留的编辑器 DOM
			// 这可以处理编辑器被意外挂载到组件外部的情况
			if (editorRef.current) {
				const container = editorRef.current;
				// 向上查找父元素，确保清理整个编辑器容器
				let parent = container.parentElement;
				while (parent) {
					const cmEditorInParent = parent.querySelector(".cm-editor");
					if (cmEditorInParent) {
						cmEditorInParent.remove();
					}
					// 如果父元素本身就是编辑器容器，也清理它
					if (parent.classList.contains("cm-editor")) {
						parent.remove();
						break;
					}
					parent = parent.parentElement;
				}
			}
		}
	}, [activeFile?.id, activeFile]);

	if (!activeFile) {
		return (
			<div className="flex-1 flex items-center justify-center">
				<div className="flex flex-col items-center gap-6">
					<p className="text-sm text-muted-foreground">
						{t("common:selectOrCreateFile")}
					</p>
					<div className="flex flex-col gap-2 items-center">
						{onExpandSidebar && (
							<Button
								variant="ghost"
								size="sm"
								className="h-7 px-2 text-muted-foreground"
								onClick={onExpandSidebar}
							>
								{t("expandSidebar")}
							</Button>
						)}
						<Button
							variant="ghost"
							size="sm"
							className="h-7 px-2 text-muted-foreground"
							onClick={() => setWorkspaceMode("tutorial")}
						>
							{t("openTutorial")}
						</Button>
						<Button
							variant="ghost"
							size="sm"
							className="h-7 px-2 text-muted-foreground"
							onClick={() => setWorkspaceMode("settings")}
						>
							{t("openSettings")}
						</Button>
					</div>
					{/* Quote card below OpenSettings button */}
					<div className="w-full flex items-center justify-center">
						<QuoteCard />
					</div>
				</div>
			</div>
		);
	}

	// Determine language to optionally enable preview layout for .atex
	const languageForActive = getLanguageForFile(activeFile.path);

	return (
		<div className="flex-1 flex flex-col h-full overflow-hidden">
			{/* If the active file is AlphaTex, render a two-column editor/preview layout */}
			{languageForActive === "alphatex" ? (
				<div className="flex-1 overflow-hidden flex">
					{/* Left: Editor */}
					<div className="w-1/2 border-r border-border flex flex-col min-h-0">
						{/* Column header to align with Preview header */}
						<TopBar
							leading={
								showExpandSidebar ? (
									<Button
										variant="ghost"
										size="icon"
										className="h-8 w-8"
										onClick={onExpandSidebar}
										aria-label={t("expandSidebar")}
									>
										<ChevronRight className="h-4 w-4" />
									</Button>
								) : undefined
							}
							icon={
								<Edit className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
							}
							title={activeFile.name}
						/>

						<div className="flex-1 min-h-0 overflow-hidden relative">
							{/* Host for CodeMirror */}
							<div ref={editorRef} className="h-full" />

							<TracksPanel
								api={previewApi}
								isOpen={isTracksPanelOpen && previewApi !== null}
								onClose={() => setTracksPanelOpen(false)}
							/>
						</div>
					</div>

					{/* Right: Preview */}
					<div className="w-1/2 flex flex-col bg-card min-h-0 overflow-y-auto overflow-x-hidden">
						<Preview
							fileName={`${activeFile.name} ${t("common:preview")}`}
							content={activeFile.content}
							onApiChange={setPreviewApi}
						/>
					</div>
				</div>
			) : (
				<TooltipProvider delayDuration={200}>
					<div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
						<TopBar
							leading={
								showExpandSidebar ? (
									<Tooltip>
										<TooltipTrigger asChild>
											<IconButton onClick={onExpandSidebar}>
												<ChevronRight className="h-4 w-4" />
											</IconButton>
										</TooltipTrigger>
										<TooltipContent side="bottom">
											<p>{t("expandSidebar")}</p>
										</TooltipContent>
									</Tooltip>
								) : undefined
							}
							icon={
								<Edit className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
							}
							title={activeFile.name}
						/>
						{/* Host for CodeMirror */}
						<div ref={editorRef} className="h-full" />
					</div>
				</TooltipProvider>
			)}
		</div>
	);
}

export default Editor;
