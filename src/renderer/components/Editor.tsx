import { markdown } from "@codemirror/lang-markdown";
import type { Extension } from "@codemirror/state";
import { Compartment, EditorState } from "@codemirror/state";
import type { ViewUpdate } from "@codemirror/view";
import { basicSetup, EditorView } from "codemirror";
import { ChevronRight, Edit } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { alphatexAbbreviations } from "../lib/alphatex-abbreviations";
import { createAlphaTexBarlinesExtension } from "../lib/alphatex-barlines";
import { createAlphaTexAutocomplete } from "../lib/alphatex-completion";
import { getAlphaTexHighlight } from "../lib/alphatex-highlight";
import type { AlphaTexLSPClient } from "../lib/alphatex-lsp";
import { createAlphaTexLSPClient } from "../lib/alphatex-lsp";
import {
	createCursorTrackingExtension,
	createPlaybackSyncExtension,
	createSelectionSyncExtension,
	updateEditorPlaybackHighlight,
	updateEditorSelectionHighlight,
} from "../lib/alphatex-selection-sync";
import { whitespaceDecoration } from "../lib/whitespace-decoration";
import type { EditorCursorInfo } from "../store/appStore";
import { useAppStore } from "../store/appStore";
import Preview from "./Preview";
import { Button } from "./ui/button";

interface EditorProps {
	showExpandSidebar?: boolean;
	onExpandSidebar?: () => void;
}

export function Editor({ showExpandSidebar, onExpandSidebar }: EditorProps) {
	const editorRef = useRef<HTMLDivElement | null>(null);
	const viewRef = useRef<EditorView | null>(null);
	const saveTimerRef = useRef<number | null>(null);
	const lspClientRef = useRef<AlphaTexLSPClient | null>(null);
	const lastContentRef = useRef<string>("");

	// Track current file path to detect language changes
	const currentFilePathRef = useRef<string>("");

	// Track if we're currently updating to prevent recursive updates
	const isUpdatingRef = useRef(false);

	const activeFileId = useAppStore((s) => s.activeFileId);
	const files = useAppStore((s) => s.files);
	const activeFile = files.find((f) => f.id === activeFileId);

	// 🆕 订阅乐谱选区状态
	const scoreSelection = useAppStore((s) => s.scoreSelection);

	// 🆕 订阅播放位置状态
	const playbackBeat = useAppStore((s) => s.playbackBeat);

	// 🆕 订阅播放器光标位置（暂停时也保留）
	const playerCursorPosition = useAppStore((s) => s.playerCursorPosition);

	// Observe <html> to detect dark mode toggles (class 'dark')
	const [isDark, setIsDark] = useState<boolean>(() => {
		if (typeof document === "undefined") return false;
		return document.documentElement.classList.contains("dark");
	});

	// Helper function to determine file language
	const getLanguageForFile = useCallback((filePath: string) => {
		if (filePath.endsWith(".atex")) return "alphatex";
		if (filePath.endsWith(".md")) return "markdown";
		return "plaintext";
	}, []);

	// Observe dark mode changes
	useEffect(() => {
		if (typeof document === "undefined") return;
		const root = document.documentElement;
		const observer = new MutationObserver(() => {
			setIsDark(root.classList.contains("dark"));
		});
		observer.observe(root, { attributes: true, attributeFilter: ["class"] });
		return () => observer.disconnect();
	}, []);

	// Initialize Compartments (only once)
	const themeCompartmentRef = useRef<Compartment>(new Compartment());
	const languageCompartmentRef = useRef<Compartment>(new Compartment());

	// Helper to create theme extension
	const createThemeExtension = useCallback((dark: boolean) => {
		const themeStyles = {
			"&": {
				height: "100%",
				display: "flex",
				flexDirection: "column",
				fontSize: "14px",
				backgroundColor: "hsl(var(--card))",
				color: "hsl(var(--foreground))",
			},
			".cm-scroller": {
				overflowX: "hidden",
				overflowY: "auto",
				height: "100%",
				minHeight: 0,
				fontFamily:
					'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
				scrollbarWidth: "thin",
				scrollbarColor: "hsl(var(--border) / 0.7) transparent",
			},
			".cm-content": {
				padding: "8px 0 150px 0",
			},
			".cm-gutters": {
				backgroundColor: "transparent",
				border: "none",
				color: "hsl(var(--muted-foreground))",
			},
			".cm-activeLineGutter": { backgroundColor: "transparent" },
			".cm-activeLine": { backgroundColor: "hsl(var(--muted) / 0.06)" },
			".cm-selectionBackground, .cm-selection": {
				backgroundColor: "var(--selection-overlay)",
				color: "inherit",
				opacity: "1",
				mixBlendMode: "normal",
			},
			".cm-selectionMatch": {
				backgroundColor: "hsl(var(--primary) / 0.18)",
				color: "inherit",
			},
			".cm-searchMatch": {
				backgroundColor: "hsl(var(--muted) / 0.12)",
				color: "inherit",
			},
			".cm-searchMatch.cm-searchMatch-selected": {
				backgroundColor: "hsl(var(--primary) / 0.22)",
				color: "inherit",
			},
			".cm-matchingBracket": {
				backgroundColor: "hsl(var(--primary) / 0.14)",
			},
			".cm-nonmatchingBracket": {
				backgroundColor: "hsl(var(--destructive) / 0.14)",
			},
			".cm-cursor": { borderLeftColor: "hsl(var(--primary))" },
			".cm-tooltip": {
				backgroundColor: "hsl(var(--popover))",
				color: "hsl(var(--popover-foreground))",
				border: "1px solid hsl(var(--border))",
			},
			".cm-gutterElement": { color: "hsl(var(--muted-foreground))" },
			"&.cm-focused": { outline: "none" },
		} as const;

		return EditorView.theme(themeStyles, { dark });
	}, []);

	// Helper to load language extensions
	const loadLanguageExtensions = useCallback(
		async (language: string, filePath: string): Promise<Extension[]> => {
			const extensions: Extension[] = [];

			if (language === "alphatex") {
				try {
					// Load AlphaTex highlight
					const alphaTexHighlight = await getAlphaTexHighlight();
					if (alphaTexHighlight && alphaTexHighlight.length > 0) {
						extensions.push(alphaTexHighlight);
					}

					// Initialize LSP client for AlphaTex
					const lspClient = createAlphaTexLSPClient(filePath);
					lspClientRef.current = lspClient;

					// Initialize the language server in background
					lspClient
						.request("initialize", {
							rootUri: "file:///",
							capabilities: {},
						})
						.catch((e: unknown) => console.error("LSP init failed:", e));

					// Add code completion extension
					const completionExt = createAlphaTexAutocomplete(lspClient);
					extensions.push(completionExt);

					// Add barline decorations extension
					const barlinesExt = createAlphaTexBarlinesExtension(lspClient);
					extensions.push(barlinesExt);

					// Add immediate abbreviation expansion
					extensions.push(alphatexAbbreviations);

					// 🆕 Add selection sync extension (乐谱选区 → 代码高亮)
					const selectionSyncExt = createSelectionSyncExtension();
					extensions.push(...selectionSyncExt);

					// 🆕 Add playback sync extension (播放进度 → 代码高亮)
					const playbackSyncExt = createPlaybackSyncExtension();
					extensions.push(...playbackSyncExt);

					// 🆕 Add cursor tracking extension (代码光标 → 乐谱定位)
					const cursorTrackingExt = createCursorTrackingExtension(
						(cursor: EditorCursorInfo | null) => {
							useAppStore.getState().setEditorCursor(cursor);
						},
					);
					extensions.push(cursorTrackingExt);

					// Enable soft-wrapping
					extensions.push(EditorView.lineWrapping);
				} catch (e) {
					console.error("Failed to load AlphaTex support:", e);
				}
			} else if (language === "markdown") {
				extensions.push(markdown());
				extensions.push(EditorView.lineWrapping);
			}

			return extensions;
		},
		[],
	);

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
		if (!activeFileId || !activeFile) {
			if (viewRef.current) {
				viewRef.current.destroy();
				viewRef.current = null;
			}
			if (lspClientRef.current) {
				lspClientRef.current.close?.();
				lspClientRef.current = null;
			}
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

					const themeExtension = createThemeExtension(isDark);
					const languageExtensions = await loadLanguageExtensions(
						language,
						filePath,
					);
					const updateListener = createUpdateListener();

					const extensions: Extension[] = [
						basicSetup,
						updateListener,
						whitespaceDecoration(),
						themeCompartmentRef.current.of(themeExtension),
						languageCompartmentRef.current.of(languageExtensions),
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
					// Clean up old LSP client if exists
					if (lspClientRef.current) {
						lspClientRef.current.close?.();
						lspClientRef.current = null;
					}

					const languageExtensions = await loadLanguageExtensions(
						language,
						filePath,
					);
					effects.push(
						languageCompartmentRef.current.reconfigure(languageExtensions),
					);
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
		activeFileId,
		activeFile?.content,
		activeFile?.path,
		isDark,
		getLanguageForFile,
		createThemeExtension,
		loadLanguageExtensions,
		createUpdateListener,
		activeFile,
	]);

	// Update theme when dark mode changes
	useEffect(() => {
		if (!viewRef.current || !themeCompartmentRef.current) return;

		const themeExtension = createThemeExtension(isDark);
		viewRef.current.dispatch({
			effects: themeCompartmentRef.current.reconfigure(themeExtension),
		});
	}, [isDark, createThemeExtension]);

	// 🆕 监听乐谱选区变化，更新编辑器高亮
	useEffect(() => {
		const view = viewRef.current;
		if (!view) return;

		// 只有 AlphaTex 文件才需要选区同步
		const language = activeFile ? getLanguageForFile(activeFile.path) : "";
		if (language !== "alphatex") return;

		const content = activeFile?.content ?? "";
		updateEditorSelectionHighlight(view, content, scoreSelection);
	}, [scoreSelection, activeFile, getLanguageForFile]);

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
		const isPlaying = playbackBeat !== null;
		updateEditorPlaybackHighlight(
			view,
			content,
			playbackBeat,
			playerCursorPosition,
			isPlaying,
		);
	}, [playbackBeat, playerCursorPosition, activeFile, getLanguageForFile]);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			if (viewRef.current) {
				viewRef.current.destroy();
				viewRef.current = null;
			}
			if (lspClientRef.current) {
				lspClientRef.current.close?.();
				lspClientRef.current = null;
			}
			if (saveTimerRef.current) {
				clearTimeout(saveTimerRef.current);
				saveTimerRef.current = null;
			}
		};
	}, []);

	if (!activeFile) {
		return (
			<div className="flex-1 flex items-center justify-center text-muted-foreground">
				<span>选择或创建一个文件开始编辑</span>
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
						<div className="h-9 border-b border-border flex items-center px-3 text-xs text-muted-foreground shrink-0 gap-2 bg-card">
							{showExpandSidebar && (
								<Button
									variant="ghost"
									size="icon"
									className="h-8 w-8"
									onClick={onExpandSidebar}
									aria-label="展开侧边栏"
								>
									<ChevronRight className="h-4 w-4" />
								</Button>
							)}
							<Edit className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
							<div className="truncate">{activeFile.name}</div>
						</div>
						<div className="flex-1 min-h-0 overflow-hidden relative">
							{/* Host for CodeMirror */}
							<div ref={editorRef} className="h-full" />
						</div>
					</div>

					{/* Right: Preview */}
					<div className="w-1/2 flex flex-col bg-card min-h-0 overflow-y-auto overflow-x-hidden">
						<Preview
							fileName={`${activeFile.name} 预览`}
							content={activeFile.content}
						/>
					</div>
				</div>
			) : (
				<div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
					<div className="h-9 border-b border-border flex items-center px-3 text-xs text-muted-foreground shrink-0 gap-2 bg-card">
						{showExpandSidebar && (
							<Button
								variant="ghost"
								size="icon"
								className="h-8 w-8"
								onClick={onExpandSidebar}
								aria-label="展开侧边栏"
							>
								<ChevronRight className="h-4 w-4" />
							</Button>
						)}
						<Edit className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
						<div className="truncate">{activeFile.name}</div>
					</div>
					{/* Host for CodeMirror */}
					<div ref={editorRef} className="h-full" />
				</div>
			)}
		</div>
	);
}

export default Editor;
