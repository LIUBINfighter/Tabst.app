import { useEffect, useRef, useState } from "react";
import { Editor } from "./components/Editor";
import GlobalBottomBar from "./components/GlobalBottomBar";
import SettingsView from "./components/SettingsView";
import { Sidebar } from "./components/Sidebar";
import TutorialView from "./components/TutorialView";
import UpdateToast from "./components/UpdateToast";
import { getAlphaTexHighlight } from "./lib/alphatex-highlight";
import { createAlphaTexLSPClient } from "./lib/alphatex-lsp";
import { useAppStore } from "./store/appStore";

function App() {
	const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
	const workspaceMode = useAppStore((s) => s.workspaceMode);
	const prevWorkspaceModeRef = useRef<"editor" | "tutorial" | "settings">(
		"editor",
	);

	// 初始化 store：从主进程恢复上次打开的文件和选中项
	const initialize = useAppStore((s) => s.initialize);
	const activeRepoId = useAppStore((s) => s.activeRepoId);
	const repos = useAppStore((s) => s.repos);
	const refreshFileTree = useAppStore((s) => s.refreshFileTree);
	const fsRefreshTimerRef = useRef<number | null>(null);
	const fsRecentEventRef = useRef<Map<string, number>>(new Map());

	const SUPPORTED_EXTENSIONS = useRef(
		new Set([".md", ".atex", ".gp", ".gp3", ".gp4", ".gp5", ".gpx"]),
	);

	useEffect(() => {
		initialize();
	}, [initialize]);

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

		const scheduleRefresh = (eventType: string, changedPath?: string) => {
			if (!shouldProcessChange(changedPath)) return;

			const now = Date.now();
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
				{workspaceMode === "editor" && (
					<Editor
						showExpandSidebar={sidebarCollapsed}
						onExpandSidebar={() => setSidebarCollapsed(false)}
					/>
				)}
				{workspaceMode === "tutorial" && (
					<TutorialView
						showExpandSidebar={sidebarCollapsed}
						onExpandSidebar={() => setSidebarCollapsed(false)}
						onCollapseSidebar={() => setSidebarCollapsed(true)}
					/>
				)}
				{workspaceMode === "settings" && (
					<SettingsView
						showExpandSidebar={sidebarCollapsed}
						onExpandSidebar={() => setSidebarCollapsed(false)}
						onCollapseSidebar={() => setSidebarCollapsed(true)}
					/>
				)}

				{/* 全局底部栏（放在主内容流中，保持与 Editor 排列，不再遮挡内容） */}
				<GlobalBottomBar />
			</div>

			<UpdateToast />
		</div>
	);
}

export default App;
