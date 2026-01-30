import { ChevronLeft, ChevronRight, Settings, X } from "lucide-react";
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
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "./ui/tooltip";

export interface SettingsViewProps {
	showExpandSidebar?: boolean;
	onExpandSidebar?: () => void;
	onCollapseSidebar?: () => void;
}

export default function SettingsView({
	showExpandSidebar,
	onExpandSidebar,
	onCollapseSidebar,
}: SettingsViewProps) {
	const { t } = useTranslation(["settings", "sidebar", "common"]);
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
		<TooltipProvider delayDuration={200}>
			<div className="flex-1 flex flex-col min-h-0 overflow-hidden">
				<TopBar
					leading={
						showExpandSidebar
							? onExpandSidebar && (
									<div className="flex items-center gap-1">
										<Tooltip>
											<TooltipTrigger asChild>
												<IconButton onClick={onExpandSidebar}>
													<ChevronRight className="h-4 w-4" />
												</IconButton>
											</TooltipTrigger>
											<TooltipContent side="bottom">
												<p>{t("sidebar:expandSidebar")}</p>
											</TooltipContent>
										</Tooltip>
									</div>
								)
							: onCollapseSidebar && (
									<div className="flex items-center gap-1">
										<Tooltip>
											<TooltipTrigger asChild>
												<IconButton onClick={onCollapseSidebar}>
													<ChevronLeft className="h-4 w-4" />
												</IconButton>
											</TooltipTrigger>
											<TooltipContent side="bottom">
												<p>{t("sidebar:collapseSidebar")}</p>
											</TooltipContent>
										</Tooltip>
									</div>
								)
					}
					trailing={
						<div className="flex items-center gap-1">
							<Tooltip>
								<TooltipTrigger asChild>
									<IconButton
										destructive
										onClick={() => {
											setWorkspaceMode("editor");
											setActiveSettingsPageId(null);
										}}
									>
										<X className="h-4 w-4" />
									</IconButton>
								</TooltipTrigger>
								<TooltipContent side="bottom">
									<p>{t("common:close")}</p>
								</TooltipContent>
							</Tooltip>
						</div>
					}
					icon={
						<Settings className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
					}
					title={t("settings:title")}
				/>

				<div className="flex-1 overflow-auto p-4">{renderPage()}</div>
			</div>
		</TooltipProvider>
	);
}
