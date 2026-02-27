import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useFileOperations } from "../hooks/useFileOperations";
import { extractAtDocFileMeta } from "../lib/atdoc";
import { useTheme } from "../lib/theme-system/use-theme";
import { useAppStore } from "../store/appStore";
import type { DeleteBehavior, FileNode } from "../types/repo";
import { DeleteConfirmDialog } from "./DeleteConfirmDialog";
import { FileTree } from "./FileTree";
import { GitSidebar } from "./GitSidebar";
import { SettingsSidebar } from "./SettingsSidebar";
import { SidebarBottomBar, SidebarCommands } from "./SidebarCommands";
import { TutorialsSidebar } from "./TutorialsSidebar";
import { ScrollArea } from "./ui/scroll-area";
import { TooltipProvider } from "./ui/tooltip";

export interface SidebarProps {
	onCollapse?: () => void;
}

function normalizePath(p: string): string {
	return p.replace(/\\/g, "/");
}

function flattenNodes(nodes: FileNode[]): FileNode[] {
	const out: FileNode[] = [];
	for (const node of nodes) {
		if (node.type === "file") {
			out.push(node);
			continue;
		}
		if (node.children?.length) {
			out.push(...flattenNodes(node.children));
		}
	}
	return out;
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
	const files = useAppStore((s) => s.files);
	const addFile = useAppStore((s) => s.addFile);
	const setFileMetaByPath = useAppStore((s) => s.setFileMetaByPath);
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
	const [selectedTagFilters, setSelectedTagFilters] = useState<string[]>([]);
	const [selectedStatusFilters, setSelectedStatusFilters] = useState<
		Array<"draft" | "active" | "done" | "released">
	>([]);

	useEffect(() => {
		if (selectedTagFilters.length === 0 && selectedStatusFilters.length === 0) {
			return;
		}

		const clearFiltersOnEscape = (event: KeyboardEvent) => {
			if (event.key !== "Escape") return;
			setSelectedTagFilters([]);
			setSelectedStatusFilters([]);
		};

		window.addEventListener("keydown", clearFiltersOnEscape);
		return () => window.removeEventListener("keydown", clearFiltersOnEscape);
	}, [selectedStatusFilters.length, selectedTagFilters.length]);
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
			const timeA = a.mtimeMs ?? 0;
			const timeB = b.mtimeMs ?? 0;
			if (timeA !== timeB) return timeB - timeA;
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

	const tagsByPath = useMemo(() => {
		const map = new Map<string, string[]>();
		for (const file of files) {
			map.set(normalizePath(file.path), file.metaTags ?? []);
		}
		return map;
	}, [files]);

	const availableTags = useMemo(() => {
		const set = new Set<string>();
		for (const file of files) {
			for (const tag of file.metaTags ?? []) {
				const cleaned = tag.trim();
				if (cleaned) set.add(cleaned);
			}
		}
		return Array.from(set).sort((a, b) => a.localeCompare(b));
	}, [files]);

	const availableStatuses = useMemo(() => {
		const set = new Set<"draft" | "active" | "done" | "released">();
		for (const file of files) {
			if (file.metaStatus) {
				set.add(file.metaStatus);
			}
		}
		const order: Array<"draft" | "active" | "done" | "released"> = [
			"draft",
			"active",
			"done",
			"released",
		];
		return order.filter((status) => set.has(status));
	}, [files]);

	const toggleTagFilter = (tag: string) => {
		const lower = tag.toLowerCase();
		setSelectedTagFilters((current) => {
			const exists = current.some((item) => item.toLowerCase() === lower);
			if (exists) {
				return current.filter((item) => item.toLowerCase() !== lower);
			}
			return [...current, tag];
		});
	};

	const toggleStatusFilter = (
		status: "draft" | "active" | "done" | "released",
	) => {
		setSelectedStatusFilters((current) => {
			if (current.includes(status)) {
				return current.filter((item) => item !== status);
			}
			return [...current, status];
		});
	};

	const filteredFileTree = useMemo(() => {
		if (selectedTagFilters.length === 0 && selectedStatusFilters.length === 0) {
			return fileTree;
		}

		const required = selectedTagFilters.map((tag) => tag.toLowerCase());
		const requiredStatuses = selectedStatusFilters;
		const statusByPath = new Map<
			string,
			"draft" | "active" | "done" | "released" | undefined
		>(files.map((file) => [normalizePath(file.path), file.metaStatus]));

		const filterNodes = (nodes: FileNode[]): FileNode[] => {
			const out: FileNode[] = [];
			for (const node of nodes) {
				if (node.type === "file") {
					const tags =
						tagsByPath
							.get(normalizePath(node.path))
							?.map((tag) => tag.toLowerCase()) ?? [];
					const status = statusByPath.get(normalizePath(node.path));
					const statusMatched =
						requiredStatuses.length === 0 ||
						requiredStatuses.includes(status ?? "draft");
					if (required.every((tag) => tags.includes(tag)) && statusMatched) {
						out.push(node);
					}
					continue;
				}

				const children = node.children ? filterNodes(node.children) : [];
				if (children.length > 0) {
					out.push({ ...node, children, isExpanded: true });
				}
			}
			return out;
		};

		return filterNodes(fileTree);
	}, [fileTree, files, selectedStatusFilters, selectedTagFilters, tagsByPath]);

	useEffect(() => {
		if (workspaceMode !== "editor" || !activeRepoId) return;

		const openedByPath = new Map(
			files.map((file) => [normalizePath(file.path), file]),
		);
		const atexNodes = flattenNodes(fileTree).filter((node) =>
			node.name.toLowerCase().endsWith(".atex"),
		);
		const pendingPaths = atexNodes
			.map((node) => normalizePath(node.path))
			.filter((path) => {
				const file = openedByPath.get(path);
				return (
					!file ||
					(!file.metaClass &&
						!file.metaTags &&
						!file.metaStatus &&
						!file.metaTabist &&
						!file.metaApp &&
						!file.metaGithub &&
						!file.metaLicense &&
						!file.metaSource &&
						!file.metaRelease &&
						!file.metaAlias &&
						!file.metaTitle)
				);
			});

		if (pendingPaths.length === 0) return;

		let cancelled = false;
		void (async () => {
			for (const path of pendingPaths) {
				if (cancelled) return;
				try {
					const readResult = await window.electronAPI.readFile(path);
					if (readResult.error) continue;
					const parsedMeta = extractAtDocFileMeta(readResult.content);
					setFileMetaByPath(
						path,
						parsedMeta.metaClass,
						parsedMeta.metaTags,
						parsedMeta.metaStatus,
						parsedMeta.metaTabist,
						parsedMeta.metaApp,
						parsedMeta.metaGithub,
						parsedMeta.metaLicense,
						parsedMeta.metaSource,
						parsedMeta.metaRelease,
						parsedMeta.metaAlias,
						parsedMeta.metaTitle,
					);
				} catch {}
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [activeRepoId, fileTree, files, setFileMetaByPath, workspaceMode]);

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
		if (workspaceMode === "git") {
			return <GitSidebar />;
		}

		if (workspaceMode === "tutorial") {
			return (
				<ScrollArea className="flex-1 w-full overflow-hidden min-h-0">
					<div className="py-1 w-full overflow-hidden">
						<TutorialsSidebar />
					</div>
				</ScrollArea>
			);
		}

		if (workspaceMode === "settings") {
			return (
				<ScrollArea className="flex-1 w-full overflow-hidden min-h-0">
					<div className="py-1 w-full overflow-hidden">
						<SettingsSidebar />
					</div>
				</ScrollArea>
			);
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
			<div className="flex h-full min-h-0 w-full flex-col">
				{availableStatuses.length > 0 || availableTags.length > 0 ? (
					<div className="px-2 pt-2 pb-1 border-b border-border/60 shrink-0">
						{availableStatuses.length > 0 ? (
							<>
								<div className="mb-1 flex items-center justify-between gap-2 text-[10px] uppercase tracking-wide text-muted-foreground">
									<span>Status</span>
									{selectedStatusFilters.length > 0 ? (
										<button
											type="button"
											onClick={() => setSelectedStatusFilters([])}
											className="normal-case text-[10px] text-muted-foreground underline underline-offset-2"
										>
											Clear (ESC)
										</button>
									) : null}
								</div>
								<div className="mb-2 flex flex-wrap items-center gap-1">
									{availableStatuses.map((status) => {
										const active = selectedStatusFilters.includes(status);
										const style =
											status === "done"
												? active
													? "border-emerald-500/60 bg-emerald-500/15 text-emerald-600"
													: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600"
												: status === "released"
													? active
														? "border-amber-700/60 bg-amber-700/20 text-amber-700"
														: "border-amber-700/40 bg-amber-700/10 text-amber-700"
													: status === "active"
														? active
															? "border-primary/60 bg-primary/15 text-primary"
															: "border-primary/30 bg-primary/10 text-primary"
														: active
															? "border-border bg-muted text-foreground"
															: "border-border bg-muted/70 text-muted-foreground";
										return (
											<button
												type="button"
												key={`status-filter-${status}`}
												onClick={() => toggleStatusFilter(status)}
												className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] uppercase transition-colors ${style}`}
											>
												{status}
											</button>
										);
									})}
								</div>
							</>
						) : null}
						{availableTags.length > 0 ? (
							<div className="mb-1 flex items-center justify-between gap-2 text-[10px] uppercase tracking-wide text-muted-foreground">
								<span>Tags</span>
								{selectedTagFilters.length > 0 ? (
									<button
										type="button"
										onClick={() => setSelectedTagFilters([])}
										className="normal-case text-[10px] text-muted-foreground underline underline-offset-2"
									>
										Clear (ESC)
									</button>
								) : null}
							</div>
						) : null}
						<div className="flex flex-wrap items-center gap-1">
							{availableTags.map((tag) => {
								const active = selectedTagFilters.some(
									(item) => item.toLowerCase() === tag.toLowerCase(),
								);
								return (
									<button
										type="button"
										key={`tag-filter-${tag}`}
										onClick={() => toggleTagFilter(tag)}
										className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] transition-colors ${
											active
												? "border-primary/50 bg-primary/10 text-primary"
												: "border-border bg-muted/70 text-muted-foreground hover:bg-muted"
										}`}
									>
										#{tag}
									</button>
								);
							})}
						</div>
					</div>
				) : null}

				<ScrollArea className="flex-1 w-full overflow-hidden min-h-0">
					<div className="py-1 w-full overflow-hidden">
						<FileTree
							nodes={filteredFileTree}
							pendingRenamePath={pendingRenamePath}
							onPendingRenameConsumed={() => setPendingRenamePath(null)}
							onFileSelect={handleFileSelect}
							onFolderToggle={handleFolderToggle}
							onRename={handleRename}
							onMove={handleMove}
							onReveal={handleReveal}
							onCopyPath={handleCopyPath}
							onDelete={handleDelete}
							onTagClick={toggleTagFilter}
							activeTagFilters={selectedTagFilters}
							onCreateFileInFolder={(folder, ext) => {
								setCreateTargetDir(folder.path);
								void (async () => {
									const createdPath = await handleNewFile(
										ext ?? ".md",
										folder.path,
									);
									if (!createdPath) return;
									const name = createdPath.split(/[\\/]/).pop() ?? createdPath;
									const newNode: FileNode = {
										id: createdPath,
										name,
										path: createdPath,
										type: "file",
										mtimeMs: Date.now(),
									};
									useAppStore.setState((state) => ({
										fileTree: addNodeToTree(
											state.fileTree,
											folder.path,
											newNode,
										),
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
										mtimeMs: Date.now(),
										children: [],
										isExpanded: true,
									};
									useAppStore.setState((state) => ({
										fileTree: addNodeToTree(
											state.fileTree,
											folder.path,
											newNode,
										),
									}));
									setPendingRenamePath(createdPath);
									scheduleBackgroundRefresh();
								})();
							}}
						/>
						{(selectedTagFilters.length > 0 ||
							selectedStatusFilters.length > 0) &&
						filteredFileTree.length === 0 ? (
							<div className="p-3 text-xs text-muted-foreground text-center">
								No files matched selected filters.
							</div>
						) : null}
					</div>
				</ScrollArea>
			</div>
		);
	};

	return (
		<TooltipProvider delayDuration={200}>
			<div className="w-60 max-w-[15rem] h-full border-r border-border flex flex-col bg-card box-border overflow-x-hidden shrink-0">
				<SidebarCommands
					onCollapse={onCollapse}
					onOpenFile={() => {
						void handleOpenFile(createTargetDir);
					}}
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
								mtimeMs: Date.now(),
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
								mtimeMs: Date.now(),
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

				<div className="flex-1 w-full overflow-hidden min-h-0">
					{renderContent()}
				</div>

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
