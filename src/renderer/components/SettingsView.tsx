import { ChevronLeft, Settings, X } from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAppStore } from "../store/appStore";
import { AboutPage } from "./settings/AboutPage";
import { AppearancePage } from "./settings/AppearancePage";
import { PlaybackPage } from "./settings/PlaybackPage";
import { RoadmapPage } from "./settings/RoadmapPage";
import { UpdatesPage } from "./settings/UpdatesPage";
import { defaultSettingsPages } from "./settings-pages";
import TopBar from "./TopBar";
import IconButton from "./ui/icon-button";

export default function SettingsView() {
	const { t } = useTranslation("settings");
	const setWorkspaceMode = useAppStore((s) => s.setWorkspaceMode);
	const activeSettingsPageId = useAppStore((s) => s.activeSettingsPageId);
	const setActiveSettingsPageId = useAppStore((s) => s.setActiveSettingsPageId);

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
			case "playback":
				return <PlaybackPage />;
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
					<div className="flex items-center gap-1">
						<IconButton
							onClick={() => {
								setWorkspaceMode("editor");
								setActiveSettingsPageId(null);
							}}
							title={t("backToEditor")}
						>
							<ChevronLeft className="h-4 w-4" />
						</IconButton>
						<IconButton
							className="hover:bg-red-500/20 hover:text-red-600"
							onClick={() => {
								setWorkspaceMode("editor");
								setActiveSettingsPageId(null);
							}}
							title={t("common:close")}
							aria-label={t("common:close")}
						>
							<X className="h-4 w-4" />
						</IconButton>
					</div>
				}
				icon={
					<Settings className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
				}
				title={t("title")}
			/>

			<div className="flex-1 overflow-auto p-4">{renderPage()}</div>
		</div>
	);
}
