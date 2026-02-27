import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Editor } from "./components/Editor";
import GlobalBottomBar from "./components/GlobalBottomBar";
import type { GlobalCommandId } from "./lib/command-registry";

const SettingsView = lazy(() => import("./components/SettingsView"));
const GitWorkspace = lazy(() => import("./components/GitWorkspace"));

import { Sidebar } from "./components/Sidebar";

const TutorialView = lazy(() => import("./components/TutorialView"));

import UpdateToast from "./components/UpdateToast";
import { useFileOperations } from "./hooks/useFileOperations";
import { getAlphaTexHighlight } from "./lib/alphatex-highlight";
import { createAlphaTexLSPClient } from "./lib/alphatex-lsp";
import { runUiCommand } from "./lib/ui-command-registry";
import {
	UI_SHELL_COMMAND_EVENT,
	type UiShellCommandId,
} from "./lib/ui-shell-events";
import { useAppStore } from "./store/appStore";

const QuickFileSwitcher = lazy(() => import("./components/QuickFileSwitcher"));
const GlobalCommandPalette = lazy(
	() => import("./components/GlobalCommandPalette"),
);

function App() {
	const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
	const [quickSwitcherOpen, setQuickSwitcherOpen] = useState(false);
	const [globalPaletteOpen, setGlobalPaletteOpen] = useState(false);
	const workspaceMode = useAppStore((s) => s.workspaceMode);
	const editorRefreshVersion = useAppStore((s) => s.editorRefreshVersion);
	const bottomBarRefreshVersion = useAppStore((s) => s.bottomBarRefreshVersion);
	const prevWorkspaceModeRef = useRef<
		"editor" | "enjoy" | "tutorial" | "settings" | "git"
	>("editor");

	// 初始化 store：从主进程恢复上次打开的文件和选中项
	const initialize = useAppStore((s) => s.initialize);
	const activeRepoId = useAppStore((s) => s.activeRepoId);
	const repos = useAppStore((s) => s.repos);
	const refreshFileTree = useAppStore((s) => s.refreshFileTree);
	const { handleImportGpBytes } = useFileOperations();
	const fsRefreshTimerRef = useRef<number | null>(null);
	const fsRecentEventRef = useRef<Map<string, number>>(new Map());

	const SUPPORTED_EXTENSIONS = useRef(
		new Set([".md", ".atex", ".gp", ".gp3", ".gp4", ".gp5", ".gpx"]),
	);

	useEffect(() => {
		initialize();
	}, [initialize]);

	useEffect(() => {
		const handler = (event: Event) => {
			const custom = event as CustomEvent<UiShellCommandId>;
			const commandId = custom.detail;
			if (!commandId) return;

			if (commandId === "layout.sidebar.open") {
				setSidebarCollapsed(false);
				return;
			}
			if (commandId === "layout.sidebar.close") {
				setSidebarCollapsed(true);
				return;
			}
			if (commandId === "layout.sidebar.toggle") {
				setSidebarCollapsed((prev) => !prev);
				return;
			}
			if (commandId === "workspace.quick-switcher.open") {
				setQuickSwitcherOpen(true);
				return;
			}
			if (commandId === "workspace.global-command-palette.open") {
				setGlobalPaletteOpen(true);
			}
		};

		window.addEventListener(UI_SHELL_COMMAND_EVENT, handler);
		return () => window.removeEventListener(UI_SHELL_COMMAND_EVENT, handler);
	}, []);

	useEffect(() => {
		const handleQuickSwitcherShortcut = (event: KeyboardEvent) => {
			if (event.key.toLowerCase() === "o") {
				if (!(event.metaKey || event.ctrlKey)) return;
				if (event.shiftKey || event.altKey) return;
				event.preventDefault();
				runUiCommand("workspace.quick-switcher.open");
				return;
			}

			if (event.key.toLowerCase() === "p") {
				if (!(event.metaKey || event.ctrlKey)) return;
				if (event.shiftKey) {
					event.preventDefault();
					runUiCommand("workspace.global-command-palette.open");
					return;
				}
				if (!event.altKey) {
					event.preventDefault();
					runUiCommand("workspace.editor-inline-command.open");
				}
			}
		};

		window.addEventListener("keydown", handleQuickSwitcherShortcut);
		return () =>
			window.removeEventListener("keydown", handleQuickSwitcherShortcut);
	}, []);

	const runGlobalCommand = (commandId: GlobalCommandId) => {
		switch (commandId) {
			case "open-quick-file":
				runUiCommand("workspace.quick-switcher.open");
				return;
			case "open-editor-command-palette":
				runUiCommand("workspace.editor-inline-command.open");
				return;
			case "layout.sidebar.open":
			case "layout.sidebar.close":
			case "layout.sidebar.toggle":
			case "workspace.quick-switcher.open":
			case "workspace.global-command-palette.open":
			case "workspace.mode.editor":
			case "workspace.mode.enjoy.toggle":
			case "workspace.mode.tutorial":
			case "workspace.mode.settings":
			case "workspace.mode.git":
			case "workspace.editor-inline-command.open":
			case "settings.playback.progress-bar.toggle":
			case "settings.playback.progress-seek.toggle":
			case "settings.playback.sync-scroll.toggle":
			case "settings.playback.cursor-broadcast.toggle":
			case "settings.playback.component.staff-controls.toggle":
			case "settings.playback.component.tracks-controls.toggle":
			case "settings.playback.component.zoom-controls.toggle":
			case "settings.playback.component.speed-controls.toggle":
			case "settings.playback.component.progress-controls.toggle":
			case "settings.playback.component.transport-controls.toggle":
			case "preview.export.midi":
			case "preview.export.wav":
			case "preview.export.gp7":
			case "preview.print-preview.open":
			case "playback.play":
			case "playback.pause":
			case "playback.stop":
			case "playback.refresh":
			case "playback.play-pause":
			case "playback.tracks-panel.toggle":
				runUiCommand(commandId);
				return;
			case "insert-atdoc-block":
				runUiCommand("insert-atdoc-block");
				return;
			case "insert-atdoc-directive":
				runUiCommand("insert-atdoc-directive");
				return;
			case "insert-atdoc-meta-preset":
				runUiCommand("insert-atdoc-meta-preset");
				return;
		}
	};

	useEffect(() => {
		const preventWindowDropDefault = (event: DragEvent) => {
			if (!event.dataTransfer?.files?.length) return;
			event.preventDefault();
		};

		const isGpFileName = (fileName: string) => {
			const lower = fileName.toLowerCase();
			return (
				lower.endsWith(".gp") ||
				lower.endsWith(".gp3") ||
				lower.endsWith(".gp4") ||
				lower.endsWith(".gp5") ||
				lower.endsWith(".gpx")
			);
		};

		const importGpFiles = (files: File[]) => {
			const state = useAppStore.getState();
			const activeRepo = state.repos.find((r) => r.id === state.activeRepoId);
			const targetDir = activeRepo?.path;

			for (const file of files) {
				if (!isGpFileName(file.name)) continue;

				void (async () => {
					try {
						const bytes = new Uint8Array(await file.arrayBuffer());
						await handleImportGpBytes(bytes, targetDir, file.name);
					} catch (error) {
						console.error("导入 GP 文件转换失败:", error);
					}
				})();
			}
		};

		const handleWindowDrop = (event: DragEvent) => {
			if (!event.dataTransfer?.files?.length) return;
			event.preventDefault();
			importGpFiles(Array.from(event.dataTransfer.files));
		};

		const shouldIgnorePaste = (target: EventTarget | null) => {
			if (!(target instanceof HTMLElement)) return false;
			if (target.isContentEditable) return true;
			const tag = target.tagName;
			return tag === "INPUT" || tag === "TEXTAREA";
		};

		const handleWindowPaste = (event: ClipboardEvent) => {
			if (shouldIgnorePaste(event.target)) return;

			const clipboardData = event.clipboardData;
			if (!clipboardData?.files?.length) return;

			const files = Array.from(clipboardData.files);
			const gpFiles = files.filter((file) => isGpFileName(file.name));
			if (gpFiles.length === 0) return;

			event.preventDefault();
			importGpFiles(gpFiles);
		};

		window.addEventListener("dragover", preventWindowDropDefault);
		window.addEventListener("drop", handleWindowDrop);
		window.addEventListener("paste", handleWindowPaste);

		return () => {
			window.removeEventListener("dragover", preventWindowDropDefault);
			window.removeEventListener("drop", handleWindowDrop);
			window.removeEventListener("paste", handleWindowPaste);
		};
	}, [handleImportGpBytes]);

	useEffect(() => {
		const activeRepo = repos.find((r) => r.id === activeRepoId);
		if (!activeRepo) return;

		const shouldProcessChange = (changedPath?: string) => {
			if (!changedPath) return true;
			const normalized = changedPath.replace(/\\/g, "/");
			if (normalized.includes("/.tabst/")) return false;
			const base = normalized.split("/").pop() ?? "";
			if (!base) return true;
			if (base.startsWith(".")) return false;
			const dot = base.lastIndexOf(".");
			if (dot <= 0) return true;
			const ext = base.slice(dot).toLowerCase();
			return SUPPORTED_EXTENSIONS.current.has(ext);
		};

		const pruneRecentFsEvents = (now: number) => {
			for (const [k, ts] of fsRecentEventRef.current) {
				if (now - ts > 2_000) {
					fsRecentEventRef.current.delete(k);
				}
			}

			if (fsRecentEventRef.current.size > 500) {
				const extra = fsRecentEventRef.current.size - 500;
				let removed = 0;
				for (const k of fsRecentEventRef.current.keys()) {
					fsRecentEventRef.current.delete(k);
					removed += 1;
					if (removed >= extra) break;
				}
			}
		};

		const scheduleRefresh = (eventType: string, changedPath?: string) => {
			if (!shouldProcessChange(changedPath)) return;

			const now = Date.now();
			pruneRecentFsEvents(now);
			const eventKey = `${eventType}:${changedPath ?? ""}`;
			const lastTs = fsRecentEventRef.current.get(eventKey) ?? 0;
			if (now - lastTs < 120) return;
			fsRecentEventRef.current.set(eventKey, now);

			if (fsRefreshTimerRef.current) {
				window.clearTimeout(fsRefreshTimerRef.current);
			}

			fsRefreshTimerRef.current = window.setTimeout(() => {
				void refreshFileTree();
				fsRefreshTimerRef.current = null;
			}, 180);
		};

		void window.electronAPI.startRepoWatch(activeRepo.path);

		const unsubscribe = window.electronAPI.onRepoFsChanged((event) => {
			if (event.repoPath !== activeRepo.path) return;
			scheduleRefresh(event.eventType, event.changedPath);
		});

		return () => {
			if (fsRefreshTimerRef.current) {
				window.clearTimeout(fsRefreshTimerRef.current);
				fsRefreshTimerRef.current = null;
			}
			fsRecentEventRef.current.clear();
			unsubscribe();
			void window.electronAPI.stopRepoWatch();
		};
	}, [activeRepoId, repos, refreshFileTree]);

	// 当从教程/设置界面返回编辑器时，如果侧边栏是收起的，则展开它
	useEffect(() => {
		const prevMode = prevWorkspaceModeRef.current;
		prevWorkspaceModeRef.current = workspaceMode;

		// 如果从 tutorial 或 settings 切换到 editor，且侧边栏是收起的，则展开侧边栏
		if (
			(prevMode === "tutorial" || prevMode === "settings") &&
			workspaceMode === "editor" &&
			sidebarCollapsed
		) {
			setSidebarCollapsed(false);
		}
	}, [workspaceMode, sidebarCollapsed]);

	useEffect(() => {
		// Preload highlight and worker in the background to reduce initial latency
		const preload = async () => {
			try {
				await getAlphaTexHighlight();
			} catch (_e) {
				// swallow
			}
			try {
				const client = createAlphaTexLSPClient("file:///preload.atex");
				client.request("initialize", { rootUri: "file:///" }).catch(() => {});
				// close after being warmed up
				setTimeout(() => client.close(), 2000);
			} catch (_e) {
				// swallow
			}
		};
		// Safely check for requestIdleCallback without using `any`
		const rIC = (
			window as unknown as { requestIdleCallback?: (cb: () => void) => number }
		).requestIdleCallback;
		if (typeof rIC === "function") {
			rIC(() => preload());
		} else {
			setTimeout(() => void preload(), 500);
		}
	}, []);

	return (
		<div className="flex h-screen w-screen overflow-hidden bg-background">
			{!sidebarCollapsed && (
				<Sidebar onCollapse={() => setSidebarCollapsed(true)} />
			)}

			{/* 编辑器主体 + 全局底部栏（将底部栏放在主内容流中，避免遮挡滚动内容） */}
			<div className="flex-1 flex flex-col min-h-0">
				{(workspaceMode === "editor" || workspaceMode === "enjoy") && (
					<Editor
						key={`editor-${editorRefreshVersion}`}
						enjoyMode={workspaceMode === "enjoy"}
						showExpandSidebar={sidebarCollapsed}
						onExpandSidebar={() => setSidebarCollapsed(false)}
					/>
				)}
				{workspaceMode === "tutorial" && (
					<Suspense
						fallback={<div className="flex-1 bg-background" aria-busy="true" />}
					>
						<TutorialView
							showExpandSidebar={sidebarCollapsed}
							onExpandSidebar={() => setSidebarCollapsed(false)}
							onCollapseSidebar={() => setSidebarCollapsed(true)}
						/>
					</Suspense>
				)}
				{workspaceMode === "settings" && (
					<Suspense
						fallback={<div className="flex-1 bg-background" aria-busy="true" />}
					>
						<SettingsView
							showExpandSidebar={sidebarCollapsed}
							onExpandSidebar={() => setSidebarCollapsed(false)}
							onCollapseSidebar={() => setSidebarCollapsed(true)}
						/>
					</Suspense>
				)}
				{workspaceMode === "git" && (
					<Suspense
						fallback={<div className="flex-1 bg-background" aria-busy="true" />}
					>
						<GitWorkspace
							showExpandSidebar={sidebarCollapsed}
							onExpandSidebar={() => setSidebarCollapsed(false)}
							onCollapseSidebar={() => setSidebarCollapsed(true)}
						/>
					</Suspense>
				)}

				{/* 全局底部栏（放在主内容流中，保持与 Editor 排列，不再遮挡内容） */}
				<GlobalBottomBar key={`bottom-bar-${bottomBarRefreshVersion}`} />
			</div>

			<UpdateToast />
			{quickSwitcherOpen && (
				<Suspense fallback={null}>
					<QuickFileSwitcher
						open={quickSwitcherOpen}
						onOpenChange={setQuickSwitcherOpen}
					/>
				</Suspense>
			)}
			{globalPaletteOpen && (
				<Suspense fallback={null}>
					<GlobalCommandPalette
						open={globalPaletteOpen}
						onOpenChange={setGlobalPaletteOpen}
						onRunCommand={runGlobalCommand}
					/>
				</Suspense>
			)}
		</div>
	);
}

export default App;
