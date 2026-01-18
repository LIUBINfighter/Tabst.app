import { useEffect, useState } from "react";
import { Editor } from "./components/Editor";
import GlobalBottomBar from "./components/GlobalBottomBar";
import { Sidebar } from "./components/Sidebar";
import { getAlphaTexHighlight } from "./lib/alphatex-highlight";
import { createAlphaTexLSPClient } from "./lib/alphatex-lsp";
import { useAppStore } from "./store/appStore";

function App() {
	const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

	// 初始化 store：从主进程恢复上次打开的文件和选中项
	const initialize = useAppStore((s) => s.initialize);

	useEffect(() => {
		initialize();
	}, [initialize]);

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
				<Editor
					showExpandSidebar={sidebarCollapsed}
					onExpandSidebar={() => setSidebarCollapsed(false)}
				/>

				{/* 全局底部栏（放在主内容流中，保持与 Editor 排列，不再遮挡内容） */}
				<GlobalBottomBar />
			</div>
		</div>
	);
}

export default App;
