import {
	ChevronLeft,
	FileDown,
	FileMusic,
	FileQuestion,
	FolderOpen,
	Moon,
	Settings,
	Sun,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAppStore } from "../store/appStore";
import { Button } from "./ui/button";
import IconButton from "./ui/icon-button";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

export interface SidebarCommandsProps {
	onCollapse?: () => void;
	onOpenFile: () => void;
	onNewFile: (ext: string) => void;
	onToggleTheme: () => void;
}

export function SidebarCommands({
	onCollapse,
	onOpenFile,
	onNewFile,
	onToggleTheme,
}: SidebarCommandsProps) {
	const { t } = useTranslation("sidebar");
	const workspaceMode = useAppStore((s) => s.workspaceMode);
	const setWorkspaceMode = useAppStore((s) => s.setWorkspaceMode);
	const _setActiveTutorialId = useAppStore((s) => s.setActiveTutorialId);

	const _handleOpenSettings = () => {
		try {
			const newMode = workspaceMode === "settings" ? "editor" : "settings";
			setWorkspaceMode(newMode);
			const api = (
				window as unknown as { electronAPI?: { openSettings?: () => void } }
			).electronAPI;
			if (newMode === "settings" && api?.openSettings) {
				api.openSettings();
			}
		} catch (err) {
			console.error("Failed to open settings:", err);
		}
	};

	return (
		<>
			{/* Top commands - above file list */}
			<div className="h-9 px-3 flex items-center gap-1 border-b border-border bg-muted/40 shrink-0">
				{onCollapse && (
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant="ghost"
								size="icon"
								className="h-8 w-8 hover:bg-[var(--hover-bg)] hover:text-[var(--hover-text)]"
								onClick={onCollapse}
							>
								<span className="sr-only">{t("collapseSidebar")}</span>
								<ChevronLeft className="h-4 w-4" />
							</Button>
						</TooltipTrigger>
						<TooltipContent side="bottom">
							<p>{t("collapseSidebar")}</p>
						</TooltipContent>
					</Tooltip>
				)}

				{workspaceMode === "editor" && (
					<>
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									variant="ghost"
									size="icon"
									className="h-8 w-8 hover:bg-[var(--hover-bg)] hover:text-[var(--hover-text)]"
									onClick={onOpenFile}
								>
									<span className="sr-only">{t("openFile")}</span>
									<FolderOpen className="h-4 w-4" />
								</Button>
							</TooltipTrigger>
							<TooltipContent side="bottom">
								<p>{t("openFile")}</p>
							</TooltipContent>
						</Tooltip>

						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									variant="ghost"
									size="icon"
									className="h-8 w-8 hover:bg-[var(--hover-bg)] hover:text-[var(--hover-text)]"
									onClick={() => onNewFile(".atex")}
								>
									<span className="sr-only">{t("newAtex")}</span>
									<FileMusic className="h-4 w-4" />
								</Button>
							</TooltipTrigger>
							<TooltipContent side="bottom">
								<p>{t("newAtex")}</p>
							</TooltipContent>
						</Tooltip>

						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									variant="ghost"
									size="icon"
									className="h-8 w-8 hover:bg-[var(--hover-bg)] hover:text-[var(--hover-text)]"
									onClick={() => onNewFile(".md")}
								>
									<span className="sr-only">{t("newMd")}</span>
									<FileDown className="h-4 w-4" />
								</Button>
							</TooltipTrigger>
							<TooltipContent side="bottom">
								<p>{t("newMd")}</p>
							</TooltipContent>
						</Tooltip>
					</>
				)}

				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant="ghost"
							size="icon"
							className="h-8 w-8 hover:bg-[var(--hover-bg)] hover:text-[var(--hover-text)]"
							onClick={onToggleTheme}
						>
							<span className="sr-only">{t("toggleTheme")}</span>
							<Sun className="h-4 w-4 block dark:hidden" />
							<Moon className="h-4 w-4 hidden dark:block" />
						</Button>
					</TooltipTrigger>
					<TooltipContent side="bottom">
						<p>{t("toggleTheme")}</p>
					</TooltipContent>
				</Tooltip>
			</div>
		</>
	);
}

/** Sidebar bottom bar: tutorial + settings, rendered at bottom of sidebar below file list */
export function SidebarBottomBar() {
	const { t } = useTranslation("sidebar");
	const workspaceMode = useAppStore((s) => s.workspaceMode);
	const setWorkspaceMode = useAppStore((s) => s.setWorkspaceMode);
	const setActiveTutorialId = useAppStore((s) => s.setActiveTutorialId);

	const handleOpenSettings = () => {
		try {
			const newMode = workspaceMode === "settings" ? "editor" : "settings";
			setWorkspaceMode(newMode);
			const api = (
				window as unknown as { electronAPI?: { openSettings?: () => void } }
			).electronAPI;
			if (newMode === "settings" && api?.openSettings) {
				api.openSettings();
			}
		} catch (err) {
			console.error("Failed to open settings:", err);
		}
	};

	return (
		<div className="h-9 px-3 flex items-center gap-1 border-t border-border bg-muted/40 shrink-0">
			<Tooltip>
				<TooltipTrigger asChild>
					<IconButton
						active={workspaceMode === "tutorial"}
						onClick={() => {
							const newMode =
								workspaceMode === "tutorial" ? "editor" : "tutorial";
							setWorkspaceMode(newMode);
							if (newMode === "tutorial") {
								setActiveTutorialId(null);
							}
						}}
						aria-label={t("tutorial")}
					>
						<FileQuestion className="h-4 w-4" />
					</IconButton>
				</TooltipTrigger>
				<TooltipContent side="top">
					<p>
						{workspaceMode === "tutorial"
							? t("exitTutorial")
							: t("enterTutorial")}
					</p>
				</TooltipContent>
			</Tooltip>
			<Tooltip>
				<TooltipTrigger asChild>
					<IconButton
						active={workspaceMode === "settings"}
						onClick={handleOpenSettings}
						aria-label={t("settings")}
					>
						<Settings className="h-4 w-4" />
					</IconButton>
				</TooltipTrigger>
				<TooltipContent side="top">
					<p>{t("settings")}</p>
				</TooltipContent>
			</Tooltip>
		</div>
	);
}
