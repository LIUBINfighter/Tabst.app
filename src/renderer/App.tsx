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

			{/* 编辑器主体 */}
			<Editor
				showExpandSidebar={sidebarCollapsed}
				onExpandSidebar={() => setSidebarCollapsed(false)}
			/>

			{/* 全局底部栏（单独设计，不复用 PrintPreview 的实现） */}
			{/* 使用 fixed 定位以覆盖全局，Editor 已有底部内边距以避免遮挡 */}
			{/* 注意：如果你想让底部栏包含更多交互（可折叠、通知等），可以再扩展这个组件 */}
			<GlobalBottomBar />
		</div>
	);
}

export default App;
