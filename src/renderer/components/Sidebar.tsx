import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useFileOperations } from "../hooks/useFileOperations";
import { useTheme } from "../lib/theme-system/use-theme";
import { useAppStore } from "../store/appStore";
import type { DeleteBehavior, FileNode } from "../types/repo";
import { DeleteConfirmDialog } from "./DeleteConfirmDialog";
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
	const removeFile = useAppStore((s) => s.removeFile);
	const deleteBehavior = useAppStore((s) => s.deleteBehavior);

	const { themeMode, setThemeMode } = useTheme();
	const { handleOpenFile, handleNewFile, handleNewFolder } =
		useFileOperations();

	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [pendingDeleteNode, setPendingDeleteNode] = useState<FileNode | null>(
		null,
	);
	const [sidebarToast, setSidebarToast] = useState<string | null>(null);
	const [createTargetDir, setCreateTargetDir] = useState<string | undefined>(
		undefined,
	);
	const [pendingRenamePath, setPendingRenamePath] = useState<string | null>(
		null,
	);
	const toastTimerRef = useRef<number | null>(null);
	const backgroundRefreshTimerRef = useRef<number | null>(null);

	useEffect(() => {
		return () => {
			if (toastTimerRef.current) {
				window.clearTimeout(toastTimerRef.current);
			}
			if (backgroundRefreshTimerRef.current) {
				window.clearTimeout(backgroundRefreshTimerRef.current);
			}
		};
	}, []);

	const handleToggleTheme = () => {
		const modes = ["light", "dark", "system"] as const;
		const currentIndex = modes.indexOf(themeMode);
		const nextMode = modes[(currentIndex + 1) % modes.length];
		setThemeMode(nextMode);
	};

	const showSidebarToast = (message: string) => {
		if (toastTimerRef.current) {
			window.clearTimeout(toastTimerRef.current);
		}
		setSidebarToast(message);
		toastTimerRef.current = window.setTimeout(() => {
			setSidebarToast(null);
			toastTimerRef.current = null;
		}, 2400);
	};

	const getFailureReason = (reason?: string) =>
		reason && reason.trim().length > 0 ? reason : "unknown";

	const replacePathPrefix = (
		value: string,
		oldPrefix: string,
		newPrefix: string,
	): string => {
		if (value === oldPrefix) return newPrefix;
		if (!value.startsWith(oldPrefix)) return value;
		const rest = value.slice(oldPrefix.length);
		if (rest === "" || rest.startsWith("/") || rest.startsWith("\\")) {
			return `${newPrefix}${rest}`;
		}
		return value;
	};

	const syncOpenedFilesAfterMove = (fromPath: string, toPath: string) => {
		useAppStore.setState((state) => {
			const updatedFiles = state.files.map((file) => {
				const nextPath = replacePathPrefix(file.path, fromPath, toPath);
				if (nextPath === file.path) return file;
				const nextName = nextPath.split(/[\\/]/).pop() ?? file.name;
				return {
					...file,
					id: replacePathPrefix(file.id, fromPath, toPath),
					path: nextPath,
					name: nextName,
				};
			});

			const nextActiveFileId = state.activeFileId
				? replacePathPrefix(state.activeFileId, fromPath, toPath)
				: null;

			return {
				files: updatedFiles,
				activeFileId: nextActiveFileId,
			};
		});
	};

	const sortTreeNodes = (nodes: FileNode[]) => {
		nodes.sort((a, b) => {
			if (a.type === "folder" && b.type !== "folder") return -1;
			if (a.type !== "folder" && b.type === "folder") return 1;
			return a.name.localeCompare(b.name);
		});
	};

	const addNodeToTree = (
		nodes: FileNode[],
		targetDirPath: string,
		nodeToAdd: FileNode,
	): FileNode[] => {
		const walk = (items: FileNode[]): FileNode[] => {
			let changed = false;
			const next = items.map((item) => {
				if (item.type === "folder") {
					if (item.path === targetDirPath) {
						const children = [...(item.children ?? [])];
						if (!children.some((c) => c.path === nodeToAdd.path)) {
							children.push(nodeToAdd);
							sortTreeNodes(children);
						}
						changed = true;
						return { ...item, children, isExpanded: true };
					}
					if (item.children) {
						const updatedChildren = walk(item.children);
						if (updatedChildren !== item.children) {
							changed = true;
							return { ...item, children: updatedChildren };
						}
					}
				}
				return item;
			});

			return changed ? next : items;
		};

		return walk(nodes);
	};

	const removeNodeFromTree = (
		nodes: FileNode[],
		targetPath: string,
	): { tree: FileNode[]; removed: FileNode | null } => {
		let removed: FileNode | null = null;
		const walk = (items: FileNode[]): FileNode[] => {
			let changed = false;
			const filtered: FileNode[] = [];
			for (const item of items) {
				if (item.path === targetPath) {
					removed = item;
					changed = true;
					continue;
				}
				if (item.type === "folder" && item.children) {
					const nextChildren = walk(item.children);
					if (nextChildren !== item.children) {
						changed = true;
						filtered.push({ ...item, children: nextChildren });
						continue;
					}
				}
				filtered.push(item);
			}
			return changed ? filtered : items;
		};

		return { tree: walk(nodes), removed };
	};

	const remapNodePath = (
		node: FileNode,
		oldPrefix: string,
		newPrefix: string,
	): FileNode => {
		const mappedPath = replacePathPrefix(node.path, oldPrefix, newPrefix);
		const mappedId = replacePathPrefix(node.id, oldPrefix, newPrefix);
		const mappedName = mappedPath.split(/[\\/]/).pop() ?? node.name;
		if (node.type === "folder" && node.children) {
			return {
				...node,
				id: mappedId,
				path: mappedPath,
				name: mappedName,
				children: node.children.map((child) =>
					remapNodePath(child, oldPrefix, newPrefix),
				),
			};
		}
		return {
			...node,
			id: mappedId,
			path: mappedPath,
			name: mappedName,
		};
	};

	const scheduleBackgroundRefresh = () => {
		if (backgroundRefreshTimerRef.current) {
			window.clearTimeout(backgroundRefreshTimerRef.current);
		}
		backgroundRefreshTimerRef.current = window.setTimeout(() => {
			void refreshFileTree();
			backgroundRefreshTimerRef.current = null;
		}, 180);
	};

	const normalizePath = (p: string) => p.replace(/\\/g, "/");
	const getParentDirectory = (p: string): string | undefined => {
		const normalized = normalizePath(p);
		const idx = normalized.lastIndexOf("/");
		if (idx <= 0) return undefined;
		return normalized.slice(0, idx);
	};

	const closeOpenedFilesForDeletedNode = (node: FileNode) => {
		const state = useAppStore.getState();
		const nodePath = normalizePath(node.path).replace(/\/+$/, "");

		const shouldRemove = (filePath: string) => {
			const p = normalizePath(filePath);
			if (node.type === "file") return p === nodePath;
			return p === nodePath || p.startsWith(`${nodePath}/`);
		};

		const opened = state.files.filter((f) => shouldRemove(f.path));
		for (const file of opened) {
			removeFile(file.id);
		}

		if (state.activeFileId) {
			const active = state.files.find((f) => f.id === state.activeFileId);
			if (active && shouldRemove(active.path)) {
				setActiveFile(null);
			}
		}
	};

	const executeDelete = async (node: FileNode, behavior: DeleteBehavior) => {
		if (behavior === "ask-every-time") {
			return;
		}

		const state = useAppStore.getState();
		const activeRepo = state.repos.find((r) => r.id === state.activeRepoId);
		const repoPath = behavior === "repo-trash" ? activeRepo?.path : undefined;

		try {
			const result = await window.electronAPI.deleteFile(
				node.path,
				behavior,
				repoPath,
			);
			if (!result?.success) {
				const reason = getFailureReason(result?.error);
				console.error("Delete failed:", reason);
				showSidebarToast(t("deleteFailed", { name: node.name, reason }));
				return;
			}

			closeOpenedFilesForDeletedNode(node);
			await refreshFileTree();
		} catch (err) {
			const reason =
				err instanceof Error ? err.message : getFailureReason(String(err));
			console.error("Delete error:", err);
			showSidebarToast(t("deleteFailed", { name: node.name, reason }));
		}
	};

	const handleFileSelect = async (node: FileNode) => {
		if (node.type === "file") {
			setCreateTargetDir(getParentDirectory(node.path));
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
			setCreateTargetDir(node.path);
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
		if (deleteBehavior === "ask-every-time") {
			setPendingDeleteNode(node);
			setDeleteDialogOpen(true);
			return;
		}
		await executeDelete(node, deleteBehavior);
	};

	const handleDeleteConfirm = async (behavior: DeleteBehavior) => {
		const target = pendingDeleteNode;
		setDeleteDialogOpen(false);
		setPendingDeleteNode(null);

		if (!target || behavior === "ask-every-time") {
			return;
		}

		await executeDelete(target, behavior);
	};

	const handleRename = async (node: FileNode, newName: string) => {
		if (!newName.trim()) return;

		try {
			if (node.type === "file") {
				const ok = await renameFile(node.id, newName.trim());
				if (!ok) {
					showSidebarToast(
						t("renameFailed", {
							name: node.name,
							reason: "unknown",
						}),
					);
				}
				return;
			}

			// Folder rename is not represented in `files`, so do it via IPC then rescan.
			const result = await window.electronAPI?.renameFile?.(
				node.path,
				newName.trim(),
			);
			if (!result?.success) {
				const reason = getFailureReason(result?.error);
				console.error("rename folder failed:", reason);
				showSidebarToast(t("renameFailed", { name: node.name, reason }));
				return;
			}
			await refreshFileTree();
		} catch (err) {
			const reason =
				err instanceof Error ? err.message : getFailureReason(String(err));
			console.error("rename failed:", err);
			showSidebarToast(t("renameFailed", { name: node.name, reason }));
		}
	};

	const handleMove = async (sourceNode: FileNode, targetFolder: FileNode) => {
		if (targetFolder.type !== "folder") return;

		try {
			const result = await window.electronAPI.movePath(
				sourceNode.path,
				targetFolder.path,
			);
			if (!result?.success || !result.newPath) {
				const reason = getFailureReason(result?.error);
				showSidebarToast(t("moveFailed", { name: sourceNode.name, reason }));
				return;
			}
			const newPath = result.newPath;

			syncOpenedFilesAfterMove(sourceNode.path, newPath);
			useAppStore.setState((state) => {
				const { tree, removed } = removeNodeFromTree(
					state.fileTree,
					sourceNode.path,
				);
				if (!removed) return {};
				const remapped = remapNodePath(removed, sourceNode.path, newPath);
				const nextTree = addNodeToTree(tree, targetFolder.path, remapped);
				return { fileTree: nextTree };
			});
			scheduleBackgroundRefresh();
		} catch (err) {
			const reason =
				err instanceof Error ? err.message : getFailureReason(String(err));
			showSidebarToast(t("moveFailed", { name: sourceNode.name, reason }));
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
				pendingRenamePath={pendingRenamePath}
				onPendingRenameConsumed={() => setPendingRenamePath(null)}
				onFileSelect={handleFileSelect}
				onFolderToggle={handleFolderToggle}
				onRename={handleRename}
				onMove={handleMove}
				onReveal={handleReveal}
				onCopyPath={handleCopyPath}
				onDelete={handleDelete}
				onCreateFileInFolder={(folder, ext) => {
					setCreateTargetDir(folder.path);
					void (async () => {
						const createdPath = await handleNewFile(ext ?? ".md", folder.path);
						if (!createdPath) return;
						const name = createdPath.split(/[\\/]/).pop() ?? createdPath;
						const newNode: FileNode = {
							id: createdPath,
							name,
							path: createdPath,
							type: "file",
						};
						useAppStore.setState((state) => ({
							fileTree: addNodeToTree(state.fileTree, folder.path, newNode),
						}));
						setPendingRenamePath(createdPath);
						scheduleBackgroundRefresh();
					})();
				}}
				onCreateFolderInFolder={(folder) => {
					setCreateTargetDir(folder.path);
					void (async () => {
						const createdPath = await handleNewFolder(folder.path);
						if (!createdPath) return;
						const name = createdPath.split(/[\\/]/).pop() ?? createdPath;
						const newNode: FileNode = {
							id: createdPath,
							name,
							path: createdPath,
							type: "folder",
							children: [],
							isExpanded: true,
						};
						useAppStore.setState((state) => ({
							fileTree: addNodeToTree(state.fileTree, folder.path, newNode),
						}));
						setPendingRenamePath(createdPath);
						scheduleBackgroundRefresh();
					})();
				}}
			/>
		);
	};

	return (
		<TooltipProvider delayDuration={200}>
			<div className="w-60 max-w-[15rem] h-full border-r border-border flex flex-col bg-card box-border overflow-x-hidden shrink-0">
				<SidebarCommands
					onCollapse={onCollapse}
					onOpenFile={handleOpenFile}
					onNewFile={(ext) =>
						void (async () => {
							const createdPath = await handleNewFile(ext, createTargetDir);
							if (!createdPath) return;
							const state = useAppStore.getState();
							const activeRepo = state.repos.find(
								(r) => r.id === state.activeRepoId,
							);
							const targetDir =
								createTargetDir && createTargetDir.trim().length > 0
									? createTargetDir
									: activeRepo?.path;
							if (!targetDir) return;
							const name = createdPath.split(/[\\/]/).pop() ?? createdPath;
							const newNode: FileNode = {
								id: createdPath,
								name,
								path: createdPath,
								type: "file",
							};
							useAppStore.setState((storeState) => ({
								fileTree: addNodeToTree(
									storeState.fileTree,
									targetDir,
									newNode,
								),
							}));
							setPendingRenamePath(createdPath);
							scheduleBackgroundRefresh();
						})()
					}
					onNewFolder={() =>
						void (async () => {
							const createdPath = await handleNewFolder(createTargetDir);
							if (!createdPath) return;
							const state = useAppStore.getState();
							const activeRepo = state.repos.find(
								(r) => r.id === state.activeRepoId,
							);
							const targetDir =
								createTargetDir && createTargetDir.trim().length > 0
									? createTargetDir
									: activeRepo?.path;
							if (!targetDir) return;
							const name = createdPath.split(/[\\/]/).pop() ?? createdPath;
							const newNode: FileNode = {
								id: createdPath,
								name,
								path: createdPath,
								type: "folder",
								children: [],
								isExpanded: true,
							};
							useAppStore.setState((storeState) => ({
								fileTree: addNodeToTree(
									storeState.fileTree,
									targetDir,
									newNode,
								),
							}));
							setPendingRenamePath(createdPath);
							scheduleBackgroundRefresh();
						})()
					}
					onToggleTheme={handleToggleTheme}
					themeMode={themeMode}
				/>

				<ScrollArea className="flex-1 w-full overflow-hidden min-h-0">
					<div className="py-1 w-full overflow-hidden">{renderContent()}</div>
				</ScrollArea>

				<SidebarBottomBar />
			</div>

			{sidebarToast && (
				<div className="fixed left-1/2 -translate-x-1/2 bottom-4 z-[70] px-3 py-2 rounded-md border border-border bg-popover text-popover-foreground text-xs shadow-lg">
					{sidebarToast}
				</div>
			)}

			<DeleteConfirmDialog
				isOpen={deleteDialogOpen}
				onClose={() => {
					setDeleteDialogOpen(false);
					setPendingDeleteNode(null);
				}}
				onConfirm={handleDeleteConfirm}
				fileName={pendingDeleteNode?.name ?? ""}
			/>
		</TooltipProvider>
	);
}
