import { ChevronLeft, Settings } from "lucide-react";
import { useEffect } from "react";
import { useAppStore } from "../store/appStore";
import { AboutPage } from "./settings/AboutPage";
import { AppearancePage } from "./settings/AppearancePage";
import { RoadmapPage } from "./settings/RoadmapPage";
import { UpdatesPage } from "./settings/UpdatesPage";
import { defaultSettingsPages } from "./settings-pages";
import TopBar from "./TopBar";
import IconButton from "./ui/icon-button";

export default function SettingsView() {
	const setWorkspaceMode = useAppStore((s) => s.setWorkspaceMode);
	const activeSettingsPageId = useAppStore((s) => s.activeSettingsPageId);

	// 键盘快捷键：ESC 返回编辑器
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				setWorkspaceMode("editor");
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [setWorkspaceMode]);

	// 根据 activeSettingsPageId 渲染对应的页面
	const renderPage = () => {
		const pageId = activeSettingsPageId || defaultSettingsPages[0].id;

		switch (pageId) {
			case "appearance":
				return <AppearancePage />;
			case "updates":
				return <UpdatesPage />;
			case "roadmap":
				return <RoadmapPage />;
			case "about":
				return <AboutPage />;
			default:
				return <AppearancePage />;
		}
	};

	return (
		<div className="flex-1 flex flex-col min-h-0 overflow-hidden">
			<TopBar
				leading={
					<IconButton
						onClick={() => setWorkspaceMode("editor")}
						title="返回编辑器"
					>
						<ChevronLeft className="h-4 w-4" />
					</IconButton>
				}
				icon={
					<Settings className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
				}
				title="设置"
			/>

			<div className="flex-1 overflow-auto p-4">{renderPage()}</div>
		</div>
	);
}
