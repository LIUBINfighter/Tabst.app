import {
	ChevronDown,
	ChevronLeft,
	FileDown,
	FileMusic,
	FileQuestion,
	FolderOpen,
	FolderPlus,
	Monitor,
	Moon,
	Plus,
	Settings,
	Sun,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { ThemeMode } from "../lib/theme-system/types";
import { useAppStore } from "../store/appStore";
import { Button } from "./ui/button";
import IconButton from "./ui/icon-button";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

export interface SidebarCommandsProps {
	onCollapse?: () => void;
	onOpenFile: () => void;
	onNewFile: (ext: string) => void;
	onNewFolder: () => void;
	onToggleTheme: () => void;
	themeMode: ThemeMode;
}

export function SidebarCommands({
	onCollapse,
	onOpenFile,
	onNewFile,
	onNewFolder,
	onToggleTheme,
	themeMode,
}: SidebarCommandsProps) {
	const { t } = useTranslation("sidebar");
	const workspaceMode = useAppStore((s) => s.workspaceMode);

	const themeIcon = {
		light: <Sun className="h-4 w-4" />,
		dark: <Moon className="h-4 w-4" />,
		system: <Monitor className="h-4 w-4" />,
	};

	const themeTooltip = {
		light: t("themeLight"),
		dark: t("themeDark"),
		system: t("themeSystem"),
	};

	return (
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
								onClick={onNewFolder}
							>
								<span className="sr-only">{t("newFolder")}</span>
								<FolderPlus className="h-4 w-4" />
							</Button>
						</TooltipTrigger>
						<TooltipContent side="bottom">
							<p>{t("newFolder")}</p>
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
						<span className="sr-only">{themeTooltip[themeMode]}</span>
						{themeIcon[themeMode]}
					</Button>
				</TooltipTrigger>
				<TooltipContent side="bottom">
					<p>{themeTooltip[themeMode]}</p>
				</TooltipContent>
			</Tooltip>
		</div>
	);
}

export function SidebarBottomBar() {
	const { t } = useTranslation("sidebar");
	const workspaceMode = useAppStore((s) => s.workspaceMode);
	const setWorkspaceMode = useAppStore((s) => s.setWorkspaceMode);
	const setActiveTutorialId = useAppStore((s) => s.setActiveTutorialId);
	const repos = useAppStore((s) => s.repos);
	const activeRepoId = useAppStore((s) => s.activeRepoId);
	const switchRepo = useAppStore((s) => s.switchRepo);
	const addRepo = useAppStore((s) => s.addRepo);

	const [showRepoDropdown, setShowRepoDropdown] = useState(false);

	const activeRepo = repos.find((r) => r.id === activeRepoId);

	const handleAddRepo = async () => {
		try {
			const folderPath = await window.electronAPI.selectFolder();
			if (folderPath) {
				await addRepo(folderPath);
			}
		} catch (err) {
			console.error("Failed to add repo:", err);
		}
		setShowRepoDropdown(false);
	};

	const handleSwitchRepo = async (repoId: string) => {
		await switchRepo(repoId);
		setShowRepoDropdown(false);
	};

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
		<div className="h-9 px-3 flex items-center gap-1 border-t border-border bg-muted/40 shrink-0 relative">
			<div className="relative">
				<button
					type="button"
					onClick={() => setShowRepoDropdown(!showRepoDropdown)}
					className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground truncate max-w-[80px]"
				>
					<span className="truncate">
						{activeRepo?.name || t("selectRepo")}
					</span>
					<ChevronDown className="h-3 w-3 shrink-0" />
				</button>

				{showRepoDropdown && (
					<div className="absolute bottom-full left-0 mb-1 bg-popover border border-border shadow-md z-50 max-h-48 overflow-auto min-w-[140px] rounded-md">
						{repos.length === 0 && (
							<div className="px-3 py-2 text-xs text-muted-foreground">
								{t("noRepos")}
							</div>
						)}
						{repos.map((repo) => (
							<button
								key={repo.id}
								type="button"
								onClick={() => handleSwitchRepo(repo.id)}
								className={`w-full px-3 py-2 text-xs text-left hover:bg-accent truncate ${
									repo.id === activeRepoId ? "bg-accent" : ""
								}`}
							>
								{repo.name}
							</button>
						))}
						<div className="border-t border-border mt-1 pt-1">
							<button
								type="button"
								onClick={handleAddRepo}
								className="w-full px-3 py-2 text-xs text-left hover:bg-accent flex items-center gap-1"
							>
								<Plus className="h-3 w-3" />
								{t("addRepo")}
							</button>
						</div>
					</div>
				)}
			</div>

			<div className="flex-1" />

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
