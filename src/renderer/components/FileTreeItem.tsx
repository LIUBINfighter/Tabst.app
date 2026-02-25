import {
	ChevronDown,
	ChevronRight,
	FileDown,
	FileMusic,
	FilePlus2,
	FileText,
	Folder,
	FolderOpen,
	FolderPlus,
	Hash,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAppStore } from "../store/appStore";
import type { FileNode } from "../types/repo";
import { FileContextMenu } from "./FileContextMenu";

const EMPTY_TAGS: string[] = [];

function normalizePath(path: string): string {
	return path.replace(/\\/g, "/");
}

function getRepoRelativeDir(filePath: string, repoPath: string | null): string {
	if (!repoPath) return "";
	const normalizedFile = normalizePath(filePath);
	const normalizedRepo = normalizePath(repoPath).replace(/\/+$/, "");
	if (!normalizedFile.startsWith(normalizedRepo)) return "";
	const relative = normalizedFile
		.slice(normalizedRepo.length)
		.replace(/^\/+/, "");
	if (!relative) return "";
	const segments = relative.split("/");
	segments.pop();
	return segments.join("/");
}

function formatRelativeTime(timestampMs: number | undefined): string {
	if (!timestampMs || Number.isNaN(timestampMs)) return "";
	const diff = Date.now() - timestampMs;
	if (diff < 60_000) return "just now";
	if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
	if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
	if (diff < 2_592_000_000) return `${Math.floor(diff / 86_400_000)}d ago`;
	const date = new Date(timestampMs);
	return date.toLocaleDateString();
}

export interface FileTreeItemProps {
	node: FileNode;
	level?: number;
	pendingRenamePath?: string | null;
	onPendingRenameConsumed?: () => void;
	onFileSelect?: (node: FileNode) => void;
	onFolderToggle?: (node: FileNode) => void;
	onRename?: (node: FileNode, newName: string) => void;
	onMove?: (sourceNode: FileNode, targetFolder: FileNode) => void;
	onReveal?: (node: FileNode) => void;
	onCopyPath?: (node: FileNode) => void;
	onDelete?: (node: FileNode) => void;
	onCreateFileInFolder?: (node: FileNode, ext: ".md" | ".atex") => void;
	onCreateFolderInFolder?: (node: FileNode) => void;
	onTagClick?: (tag: string) => void;
	activeTagFilters?: string[];
}

export function FileTreeItem({
	node,
	level = 0,
	pendingRenamePath,
	onPendingRenameConsumed,
	onFileSelect,
	onFolderToggle,
	onRename,
	onMove,
	onReveal,
	onCopyPath,
	onDelete,
	onCreateFileInFolder,
	onCreateFolderInFolder,
	onTagClick,
	activeTagFilters,
}: FileTreeItemProps) {
	const { t } = useTranslation("sidebar");
	const activeFileId = useAppStore((s) => s.activeFileId);
	const expandFolder = useAppStore((s) => s.expandFolder);
	const collapseFolder = useAppStore((s) => s.collapseFolder);

	const [isEditing, setIsEditing] = useState(false);
	const [editValue, setEditValue] = useState("");
	const [isDragging, setIsDragging] = useState(false);
	const [isDragOver, setIsDragOver] = useState(false);
	const inputRef = useRef<HTMLInputElement | null>(null);
	const preventCloseAutoFocusRef = useRef(false);

	const focusRenameInput = useCallback(() => {
		const el = inputRef.current;
		if (!el) return false;
		el.focus();
		try {
			el.setSelectionRange(0, el.value.length);
		} catch {
			// ignore (e.g. unsupported input type)
		}
		return true;
	}, []);

	const isActive = activeFileId === node.id;
	const isFolder = node.type === "folder";
	const isExpanded = node.isExpanded ?? false;
	const fileMetaTags = useAppStore(
		useCallback(
			(s) => {
				if (isFolder) return EMPTY_TAGS;
				const current = s.files.find(
					(f) => f.id === node.id || f.path === node.path,
				);
				return current?.metaTags ?? EMPTY_TAGS;
			},
			[isFolder, node.id, node.path],
		),
	);
	const fileMetaTitle = useAppStore(
		useCallback(
			(s) => {
				if (isFolder) return undefined;
				const current = s.files.find(
					(f) => f.id === node.id || f.path === node.path,
				);
				return current?.metaTitle;
			},
			[isFolder, node.id, node.path],
		),
	);
	const fileMetaStatus = useAppStore(
		useCallback(
			(s) => {
				if (isFolder) return undefined;
				const current = s.files.find(
					(f) => f.id === node.id || f.path === node.path,
				);
				return current?.metaStatus;
			},
			[isFolder, node.id, node.path],
		),
	);
	const statusBadgeClass =
		fileMetaStatus === "done"
			? "shrink-0 rounded border border-emerald-500/40 bg-emerald-500/15 px-1 py-0 uppercase text-[9px] text-emerald-600"
			: fileMetaStatus === "released"
				? "shrink-0 rounded border border-amber-700/40 bg-amber-700/15 px-1 py-0 uppercase text-[9px] text-amber-700"
				: fileMetaStatus === "active"
					? "shrink-0 rounded border border-primary/40 bg-primary/15 px-1 py-0 uppercase text-[9px] text-primary"
					: "shrink-0 rounded border border-border bg-background/70 px-1 py-0 uppercase text-[9px]";
	const shownTags: string[] = fileMetaTags.slice(0, 3);
	const hiddenTagsCount = Math.max(fileMetaTags.length - shownTags.length, 0);
	const activeRepoPath = useAppStore((s) => {
		const repo = s.repos.find((r) => r.id === s.activeRepoId);
		return repo?.path ?? null;
	});
	const relativeDir = isFolder
		? ""
		: getRepoRelativeDir(node.path, activeRepoPath) || "/";
	const relativeEditTime = isFolder ? "" : formatRelativeTime(node.mtimeMs);

	const isTagActive = (tag: string) =>
		(activeTagFilters ?? []).some(
			(value) => value.toLowerCase() === tag.toLowerCase(),
		);

	const moveFocusToSibling = useCallback((dir: "next" | "prev") => {
		const allItems = Array.from(
			document.querySelectorAll<HTMLElement>("[data-tree-item='true']"),
		);
		const current = document.activeElement as HTMLElement | null;
		if (!current) return;

		const idx = allItems.indexOf(current);
		if (idx < 0) return;

		const target = dir === "next" ? allItems[idx + 1] : allItems[idx - 1];
		target?.focus();
	}, []);

	const fileExt = node.name.split(".").pop()?.toLowerCase() || "";
	const baseName = node.name.replace(/\.[^/.]+$/, "");
	const displayName = fileMetaTitle?.trim() || baseName;

	useEffect(() => {
		if (!isEditing) {
			setEditValue(isFolder ? node.name : baseName);
		}
	}, [isEditing, isFolder, node.name, baseName]);

	useEffect(() => {
		if (!pendingRenamePath || pendingRenamePath !== node.path) return;
		setIsEditing(true);
		onPendingRenameConsumed?.();
	}, [pendingRenamePath, node.path, onPendingRenameConsumed]);

	useEffect(() => {
		if (!isEditing) return;
		// Focus after paint to ensure the input is mounted.
		const id = requestAnimationFrame(() => {
			focusRenameInput();
		});
		return () => cancelAnimationFrame(id);
	}, [isEditing, focusRenameInput]);

	const handleContextMenuCloseAutoFocus = useCallback(
		(event: Event) => {
			if (preventCloseAutoFocusRef.current) {
				event.preventDefault();
				preventCloseAutoFocusRef.current = false;
				// After the menu closes, force focus back into the rename input.
				requestAnimationFrame(() => focusRenameInput());
				requestAnimationFrame(() => focusRenameInput());
			}
		},
		[focusRenameInput],
	);

	const handleClick = () => {
		if (isFolder) {
			if (isExpanded) {
				collapseFolder(node.path);
			} else {
				expandFolder(node.path);
			}
			onFolderToggle?.(node);
		} else {
			onFileSelect?.(node);
		}
	};

	const handleRenameSubmit = () => {
		const trimmed = editValue.trim();
		if (!trimmed) {
			setEditValue(isFolder ? node.name : baseName);
			setIsEditing(false);
			return;
		}

		if (isFolder) {
			if (trimmed !== node.name) {
				onRename?.(node, trimmed);
			}
			setIsEditing(false);
			return;
		}

		const finalName = fileExt ? `${trimmed}.${fileExt}` : trimmed;
		if (finalName !== node.name) {
			onRename?.(node, finalName);
		}
		setIsEditing(false);
	};

	const handleRenameCancel = () => {
		setEditValue(node.name);
		setIsEditing(false);
	};

	const handleContextMenuAction = (action: () => void) => {
		if (!isEditing) {
			action();
		}
	};

	const iconClass = `shrink-0 h-3.5 w-3.5 transition-colors ${
		isActive
			? "text-[var(--highlight-text)]"
			: "text-muted-foreground group-hover:text-[var(--hover-text)]"
	}`;

	const indentStyle = { paddingLeft: `${4 + level * 14}px` };

	const content = (
		<div
			role="button"
			tabIndex={0}
			draggable={!isEditing}
			onClick={handleClick}
			data-tree-item="true"
			onDragStart={(e) => {
				if (isEditing) {
					e.preventDefault();
					return;
				}
				setIsDragging(true);
				e.dataTransfer.effectAllowed = "move";
				e.dataTransfer.setData("application/json", JSON.stringify(node));
			}}
			onDragEnd={() => {
				setIsDragging(false);
				setIsDragOver(false);
			}}
			onDragOver={(e) => {
				if (!isFolder || isEditing) return;
				const sourceRaw = e.dataTransfer.getData("application/json");
				if (!sourceRaw) return;
				try {
					const source = JSON.parse(sourceRaw) as FileNode;
					if (source.path === node.path) return;
					e.preventDefault();
					e.dataTransfer.dropEffect = "move";
					if (!isDragOver) setIsDragOver(true);
				} catch {}
			}}
			onDragLeave={() => {
				if (isDragOver) setIsDragOver(false);
			}}
			onDrop={(e) => {
				if (!isFolder || isEditing) return;
				e.preventDefault();
				setIsDragOver(false);
				const sourceRaw = e.dataTransfer.getData("application/json");
				if (!sourceRaw) return;
				try {
					const source = JSON.parse(sourceRaw) as FileNode;
					if (source.path === node.path) return;
					onMove?.(source, node);
				} catch {}
			}}
			onKeyDown={(e) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					handleClick();
					return;
				}

				if (e.key === "ArrowRight" && isFolder) {
					e.preventDefault();
					if (!isExpanded) {
						expandFolder(node.path);
						onFolderToggle?.(node);
					}
					return;
				}

				if (e.key === "ArrowLeft" && isFolder) {
					e.preventDefault();
					if (isExpanded) {
						collapseFolder(node.path);
						onFolderToggle?.(node);
					}
					return;
				}

				if (e.key === "ArrowDown") {
					e.preventDefault();
					moveFocusToSibling("next");
					return;
				}

				if (e.key === "ArrowUp") {
					e.preventDefault();
					moveFocusToSibling("prev");
					return;
				}

				if (
					isFolder &&
					(e.metaKey || e.ctrlKey) &&
					e.key.toLowerCase() === "n"
				) {
					e.preventDefault();
					onCreateFileInFolder?.(node, ".md");
					return;
				}

				if (
					isFolder &&
					(e.metaKey || e.ctrlKey) &&
					e.shiftKey &&
					e.key.toLowerCase() === "n"
				) {
					e.preventDefault();
					onCreateFolderInFolder?.(node);
				}
			}}
			className={`
				w-full max-w-full group flex items-start gap-2 px-0.5 py-2 cursor-pointer overflow-hidden
				text-xs text-muted-foreground transition-colors text-left min-h-[56px]
				${isDragging ? "opacity-50" : ""}
				${isDragOver ? "ring-1 ring-primary/60 bg-primary/10" : ""}
				${isActive ? "bg-[var(--highlight-bg)] text-[var(--highlight-text)]" : "hover:bg-[var(--hover-bg)] hover:text-[var(--hover-text)]"}
			`}
			style={indentStyle}
		>
			{isFolder ? (
				isExpanded ? (
					<ChevronDown className="shrink-0 h-3 w-3 text-muted-foreground" />
				) : (
					<ChevronRight className="shrink-0 h-3 w-3 text-muted-foreground" />
				)
			) : (
				<div className="w-1 shrink-0" />
			)}

			{isFolder ? (
				isExpanded ? (
					<FolderOpen className={iconClass} />
				) : (
					<Folder className={iconClass} />
				)
			) : fileExt === "atex" ? (
				<FileMusic className={iconClass} />
			) : fileExt === "md" ? (
				<FileDown className={iconClass} />
			) : (
				<FileText className={iconClass} />
			)}

			<div className="flex-1 min-w-0">
				{isEditing ? (
					<input
						ref={inputRef}
						value={editValue}
						onChange={(e) => setEditValue(e.target.value)}
						onBlur={handleRenameSubmit}
						onKeyDown={(e) => {
							if (e.key === "Enter") {
								e.preventDefault();
								e.stopPropagation();
								handleRenameSubmit();
							} else if (e.key === "Escape") {
								e.preventDefault();
								e.stopPropagation();
								handleRenameCancel();
							}
						}}
						className="w-full bg-transparent text-xs h-6 leading-6 px-1 border border-border rounded-sm outline-none"
						spellCheck={false}
						autoComplete="off"
						aria-label={t("renameFile")}
						onClick={(e) => e.stopPropagation()}
					/>
				) : (
					<div className="min-w-0">
						<div className="truncate h-6 leading-6 font-medium">
							{displayName}
						</div>
						{!isFolder ? (
							<div className="flex items-center gap-1 text-[10px] text-muted-foreground min-w-0">
								<span className="truncate">{relativeDir}</span>
								{fileMetaStatus ? (
									<span className={statusBadgeClass}>{fileMetaStatus}</span>
								) : null}
								{relativeEditTime ? (
									<span className="shrink-0">· {relativeEditTime}</span>
								) : null}
							</div>
						) : null}
						{!isFolder && shownTags.length > 0 ? (
							<div className="mt-0.5 flex flex-wrap items-center gap-1">
								{shownTags.map((tag) => (
									<button
										type="button"
										key={`${node.id}-${tag}`}
										onClick={(event) => {
											event.stopPropagation();
											onTagClick?.(tag);
										}}
										onKeyDown={(event) => {
											event.stopPropagation();
										}}
										className={`inline-flex items-center gap-0.5 rounded border px-1.5 py-0.5 text-[10px] leading-none transition-colors ${
											isTagActive(tag)
												? "border-primary/50 bg-primary/15 text-primary"
												: isActive
													? "border-[var(--highlight-text)]/30 bg-[var(--highlight-text)]/12 text-[var(--highlight-text)]"
													: "border-border bg-muted/70 text-muted-foreground"
										}`}
									>
										<Hash className="h-2.5 w-2.5" />
										{tag}
									</button>
								))}
								{hiddenTagsCount > 0 ? (
									<span
										className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] leading-none ${
											isActive
												? "border-[var(--highlight-text)]/30 bg-[var(--highlight-text)]/12 text-[var(--highlight-text)]"
												: "border-border bg-muted/70 text-muted-foreground"
										}`}
									>
										+{hiddenTagsCount}
									</span>
								) : null}
							</div>
						) : null}
					</div>
				)}
			</div>

			{isFolder && (
				<div className="shrink-0 hidden group-hover:flex items-center gap-0.5">
					<button
						type="button"
						className="h-5 w-5 inline-flex items-center justify-center rounded hover:bg-muted"
						title={t("newMd")}
						onClick={(e) => {
							e.stopPropagation();
							onCreateFileInFolder?.(node, ".md");
						}}
					>
						<FilePlus2 className="h-3 w-3" />
					</button>
					<button
						type="button"
						className="h-5 w-5 inline-flex items-center justify-center rounded hover:bg-muted"
						title="New folder"
						onClick={(e) => {
							e.stopPropagation();
							onCreateFolderInFolder?.(node);
						}}
					>
						<FolderPlus className="h-3 w-3" />
					</button>
				</div>
			)}

			{!isFolder && fileExt === "md" && (
				<code
					className={`shrink-0 font-mono bg-muted/50 px-1 rounded text-xs h-6 leading-6 select-none ${
						isActive ? "text-[var(--highlight-text)]" : "text-muted-foreground"
					}`}
				>
					{fileExt}
				</code>
			)}
		</div>
	);

	return (
		<div className="w-full">
			<FileContextMenu
				node={node}
				onOpen={() => handleContextMenuAction(() => onFileSelect?.(node))}
				onRename={() =>
					handleContextMenuAction(() => {
						preventCloseAutoFocusRef.current = true;
						setIsEditing(true);
					})
				}
				onReveal={() => handleContextMenuAction(() => onReveal?.(node))}
				onCopyPath={() => handleContextMenuAction(() => onCopyPath?.(node))}
				onDelete={() => handleContextMenuAction(() => onDelete?.(node))}
				onCreateFileInFolder={(ext) =>
					handleContextMenuAction(() =>
						onCreateFileInFolder?.(node, ext === ".atex" ? ".atex" : ".md"),
					)
				}
				onCreateFolderInFolder={() =>
					handleContextMenuAction(() => onCreateFolderInFolder?.(node))
				}
				onCloseAutoFocus={handleContextMenuCloseAutoFocus}
			>
				{content}
			</FileContextMenu>

			{isFolder && isExpanded && node.children && (
				<div className="w-full">
					{node.children.map((child) => (
						<FileTreeItem
							key={child.id}
							node={child}
							level={level + 1}
							pendingRenamePath={pendingRenamePath}
							onPendingRenameConsumed={onPendingRenameConsumed}
							onFileSelect={onFileSelect}
							onFolderToggle={onFolderToggle}
							onRename={onRename}
							onMove={onMove}
							onReveal={onReveal}
							onCopyPath={onCopyPath}
							onDelete={onDelete}
							onCreateFileInFolder={onCreateFileInFolder}
							onCreateFolderInFolder={onCreateFolderInFolder}
							onTagClick={onTagClick}
							activeTagFilters={activeTagFilters}
						/>
					))}
				</div>
			)}
		</div>
	);
}
