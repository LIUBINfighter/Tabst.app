import { useTranslation } from "react-i18next";
import { useFileOperations } from "../hooks/useFileOperations";
import { useTheme } from "../lib/theme-system/use-theme";
import { useAppStore } from "../store/appStore";
import type { FileNode } from "../types/repo";
import { FileTree } from "./FileTree";
import { SettingsSidebar } from "./SettingsSidebar";
import { SidebarBottomBar, SidebarCommands } from "./SidebarCommands";
import { TutorialsSidebar } from "./TutorialsSidebar";
import { ScrollArea } from "./ui/scroll-area";
import { TooltipProvider } from "./ui/tooltip";

export interface SidebarProps {
	onCollapse?: () => void;
}

export function Sidebar({ onCollapse }: SidebarProps) {
	const { t } = useTranslation("sidebar");
	const fileTree = useAppStore((s) => s.fileTree);
	const activeRepoId = useAppStore((s) => s.activeRepoId);
	const workspaceMode = useAppStore((s) => s.workspaceMode);
	const setActiveFile = useAppStore((s) => s.setActiveFile);
	const setWorkspaceMode = useAppStore((s) => s.setWorkspaceMode);
	const expandFolder = useAppStore((s) => s.expandFolder);
	const collapseFolder = useAppStore((s) => s.collapseFolder);
	const refreshFileTree = useAppStore((s) => s.refreshFileTree);
	const addFile = useAppStore((s) => s.addFile);
	const renameFile = useAppStore((s) => s.renameFile);
	const { themeMode, setThemeMode } = useTheme();

	const { handleOpenFile, handleNewFile } = useFileOperations();

	const handleToggleTheme = () => {
		const modes = ["light", "dark", "system"] as const;
		const currentIndex = modes.indexOf(themeMode);
		const nextMode = modes[(currentIndex + 1) % modes.length];
		setThemeMode(nextMode);
	};

	const normalizePath = (p: string) => p.replace(/\\/g, "/");

	const handleFileSelect = async (node: FileNode) => {
		if (node.type === "file") {
			const currentFiles = useAppStore.getState().files;
			const normalizedNodePath = normalizePath(node.path);
			const existingFile = currentFiles.find(
				(f) => normalizePath(f.path) === normalizedNodePath,
			);
			const currentActiveId = useAppStore.getState().activeFileId;
			const targetId = existingFile?.id ?? node.id;
			const isCurrentlyActive = currentActiveId === targetId;

			if (isCurrentlyActive) {
				setActiveFile(null);
			} else {
				try {
					// If this file came from a directory scan, it's likely a placeholder with empty content.
					// Hydrate from disk on first open to avoid Editor/Preview rendering blank.
					const shouldHydrate = !existingFile?.contentLoaded;
					let content = existingFile?.content ?? "";
					let contentLoaded = existingFile?.contentLoaded ?? false;

					if (shouldHydrate) {
						const result = await window.electronAPI.readFile(node.path);
						if (result.error) {
							console.error("[Sidebar] readFile error:", result.error);
							return;
						}
						content = result.content;
						contentLoaded = true;
					}

					addFile({
						id: targetId,
						name: node.name,
						path: node.path,
						content,
						contentLoaded,
					});
					setActiveFile(targetId);
					setWorkspaceMode("editor");
				} catch (error) {
					console.error("[Sidebar] Failed to read file:", error);
				}
			}
		}
	};

	const handleFolderToggle = (node: FileNode) => {
		if (node.type === "folder") {
			if (node.isExpanded) {
				collapseFolder(node.path);
			} else {
				expandFolder(node.path);
			}
		}
	};

	const handleReveal = async (node: FileNode) => {
		try {
			await window.electronAPI.revealInFolder(node.path);
		} catch (err) {
			console.error("revealInFolder failed:", err);
		}
	};

	const handleCopyPath = (node: FileNode) => {
		navigator.clipboard.writeText(node.path).catch((err) => {
			console.error("Failed to copy path:", err);
		});
	};

	const handleDelete = async (node: FileNode) => {
		console.log("Delete:", node);
		await refreshFileTree();
	};

	const handleRename = async (node: FileNode, newName: string) => {
		if (!newName.trim()) return;

		try {
			if (node.type === "file") {
				await renameFile(node.id, newName.trim());
				return;
			}

			// Folder rename is not represented in `files`, so do it via IPC then rescan.
			const result = await window.electronAPI?.renameFile?.(
				node.path,
				newName.trim(),
			);
			if (!result?.success) {
				console.error("rename folder failed:", result?.error);
				return;
			}
			await refreshFileTree();
		} catch (err) {
			console.error("rename failed:", err);
		}
	};

	const renderContent = () => {
		if (workspaceMode === "tutorial") {
			return <TutorialsSidebar />;
		}

		if (workspaceMode === "settings") {
			return <SettingsSidebar />;
		}

		if (!activeRepoId) {
			return (
				<div className="p-3 text-xs text-muted-foreground text-center">
					{t("noRepoSelected")}
				</div>
			);
		}

		if (fileTree.length === 0) {
			return (
				<div className="p-3 text-xs text-muted-foreground text-center">
					{t("noFiles")}
				</div>
			);
		}

		return (
			<FileTree
				nodes={fileTree}
				onFileSelect={handleFileSelect}
				onFolderToggle={handleFolderToggle}
				onRename={handleRename}
				onReveal={handleReveal}
				onCopyPath={handleCopyPath}
				onDelete={handleDelete}
			/>
		);
	};

	return (
		<TooltipProvider delayDuration={200}>
			<div className="w-60 max-w-[15rem] h-full border-r border-border flex flex-col bg-card box-border overflow-x-hidden shrink-0">
				<SidebarCommands
					onCollapse={onCollapse}
					onOpenFile={handleOpenFile}
					onNewFile={handleNewFile}
					onToggleTheme={handleToggleTheme}
					themeMode={themeMode}
				/>

				<ScrollArea className="flex-1 w-full overflow-hidden min-h-0">
					<div className="py-1 w-full overflow-hidden">{renderContent()}</div>
				</ScrollArea>

				<SidebarBottomBar />
			</div>
		</TooltipProvider>
	);
}
