import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Editor } from "./components/Editor";
import GlobalBottomBar from "./components/GlobalBottomBar";
import type { GlobalCommandId } from "./lib/command-registry";

const SettingsView = lazy(() => import("./components/SettingsView"));
const GitWorkspace = lazy(() => import("./components/GitWorkspace"));

import { Sidebar } from "./components/Sidebar";
import {
	TemplatePickerDialog,
	type TemplatePickerItem,
} from "./components/TemplatePickerDialog";

const TutorialView = lazy(() => import("./components/TutorialView"));

import UpdateToast from "./components/UpdateToast";
import { useFileOperations } from "./hooks/useFileOperations";
import { getAlphaTexHighlight } from "./lib/alphatex-highlight";
import { createAlphaTexLSPClient } from "./lib/alphatex-lsp";
import { bindGlobalShortcutListener } from "./lib/shortcut-manager";
import { isTemplateCandidateName } from "./lib/template-utils";
import { runUiCommand } from "./lib/ui-command-registry";
import {
	UI_SHELL_COMMAND_EVENT,
	type UiShellCommandId,
} from "./lib/ui-shell-events";
import { type FileItem, useAppStore } from "./store/appStore";

const QuickFileSwitcher = lazy(() => import("./components/QuickFileSwitcher"));
const GlobalCommandPalette = lazy(
	() => import("./components/GlobalCommandPalette"),
);

function normalizePath(path: string): string {
	return path.replace(/\\/g, "/");
}

function getParentDirectory(path: string): string | undefined {
	const normalized = normalizePath(path);
	const index = normalized.lastIndexOf("/");
	if (index <= 0) return undefined;
	return normalized.slice(0, index);
}

function App() {
	const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
	const [quickSwitcherOpen, setQuickSwitcherOpen] = useState(false);
	const [globalPaletteOpen, setGlobalPaletteOpen] = useState(false);
	const [templateInsertOpen, setTemplateInsertOpen] = useState(false);
	const [templateCreateOpen, setTemplateCreateOpen] = useState(false);
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
	const files = useAppStore((s) => s.files);
	const activeFileId = useAppStore((s) => s.activeFileId);
	const templateFilePaths = useAppStore((s) => s.templateFilePaths);
	const updateFileContent = useAppStore((s) => s.updateFileContent);
	const setWorkspaceMode = useAppStore((s) => s.setWorkspaceMode);
	const refreshFileTree = useAppStore((s) => s.refreshFileTree);
	const { handleImportGpBytes, handleNewFile } = useFileOperations();
	const fsRefreshTimerRef = useRef<number | null>(null);
	const fsRecentEventRef = useRef<Map<string, number>>(new Map());

	const SUPPORTED_EXTENSIONS = useRef(
		new Set([".md", ".atex", ".gp", ".gp3", ".gp4", ".gp5", ".gpx"]),
	);

	const templatePathSet = useMemo(
		() => new Set(templateFilePaths.map((path) => normalizePath(path))),
		[templateFilePaths],
	);

	const templateItems = useMemo<TemplatePickerItem[]>(() => {
		return files
			.filter(
				(file) =>
					templatePathSet.has(normalizePath(file.path)) &&
					isTemplateCandidateName(file.name),
			)
			.map((file) => ({
				path: file.path,
				name: file.name,
				title: file.metaTitle,
			}))
			.sort((left, right) => left.name.localeCompare(right.name));
	}, [files, templatePathSet]);

	const filesByNormalizedPath = useMemo(
		() => new Map(files.map((file) => [normalizePath(file.path), file])),
		[files],
	);

	const resolveFileContent = async (file: FileItem): Promise<string | null> => {
		if (file.contentLoaded) return file.content;
		try {
			const result = await window.electronAPI.readFile(file.path);
			if (result.error) {
				console.error("Failed to read template file:", result.error);
				return null;
			}
			updateFileContent(file.id, result.content);
			return result.content;
		} catch (error) {
			console.error("Failed to resolve file content:", error);
			return null;
		}
	};

	const handleInsertTemplate = async (templatePath: string) => {
		const activeFile = files.find((file) => file.id === activeFileId);
		if (!activeFile) return;

		const templateFile = filesByNormalizedPath.get(normalizePath(templatePath));
		if (!templateFile) return;
		if (!isTemplateCandidateName(templateFile.name)) return;

		const [activeContent, templateContent] = await Promise.all([
			resolveFileContent(activeFile),
			resolveFileContent(templateFile),
		]);
		if (activeContent == null || templateContent == null) return;

		const joiner =
			activeContent.length === 0
				? ""
				: activeContent.endsWith("\n\n")
					? ""
					: activeContent.endsWith("\n")
						? "\n"
						: "\n\n";
		const nextContent = `${activeContent}${joiner}${templateContent}`;

		updateFileContent(activeFile.id, nextContent);
		try {
			await window.electronAPI.saveFile(activeFile.path, nextContent);
		} catch (error) {
			console.error("Failed to save file after template insertion:", error);
		}
		setWorkspaceMode("editor");
	};

	const resolveCreateTargetDirectory = () => {
		const activeFile = files.find((file) => file.id === activeFileId);
		if (activeFile) {
			return getParentDirectory(activeFile.path);
		}

		const activeRepo = repos.find((repo) => repo.id === activeRepoId);
		return activeRepo?.path;
	};

	const handleCreateFromTemplate = async (templatePath: string) => {
		const templateFile = filesByNormalizedPath.get(normalizePath(templatePath));
		if (!templateFile) return;
		if (!isTemplateCandidateName(templateFile.name)) return;

		const templateContent = await resolveFileContent(templateFile);
		if (templateContent == null) return;

		const templateExt: ".md" | ".atex" = templateFile.name
			.toLowerCase()
			.endsWith(".atex")
			? ".atex"
			: ".md";

		const createdPath = await handleNewFile(
			templateExt,
			resolveCreateTargetDirectory(),
		);
		if (!createdPath) return;

		const normalizedCreatedPath = normalizePath(createdPath);
		const createdFile = useAppStore
			.getState()
			.files.find(
				(file) =>
					normalizePath(file.path) === normalizedCreatedPath ||
					file.id === createdPath,
			);
		if (!createdFile) return;

		updateFileContent(createdFile.id, templateContent);
		try {
			await window.electronAPI.saveFile(createdFile.path, templateContent);
		} catch (error) {
			console.error("Failed to save file created from template:", error);
		}
		setWorkspaceMode("editor");
	};

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
				return;
			}

			if (commandId === "template.insert-picker.open") {
				setTemplateInsertOpen(true);
				return;
			}

			if (commandId === "template.create-picker.open") {
				setTemplateCreateOpen(true);
			}
		};

		window.addEventListener(UI_SHELL_COMMAND_EVENT, handler);
		return () => window.removeEventListener(UI_SHELL_COMMAND_EVENT, handler);
	}, []);

	useEffect(() => {
		return bindGlobalShortcutListener();
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
			case "template.insert.open-picker":
			case "template.new-from.open-picker":
			case "template.toggle-active-file":
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
			<TemplatePickerDialog
				open={templateInsertOpen}
				mode="insert"
				templates={templateItems}
				onOpenChange={setTemplateInsertOpen}
				onSelect={(path) => {
					void handleInsertTemplate(path);
				}}
			/>
			<TemplatePickerDialog
				open={templateCreateOpen}
				mode="create"
				templates={templateItems}
				onOpenChange={setTemplateCreateOpen}
				onSelect={(path) => {
					void handleCreateFromTemplate(path);
				}}
			/>
		</div>
	);
}

export default App;
