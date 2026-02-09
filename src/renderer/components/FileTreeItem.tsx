import {
	ChevronDown,
	ChevronRight,
	FileDown,
	FileMusic,
	FileText,
	Folder,
	FolderOpen,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAppStore } from "../store/appStore";
import type { FileNode } from "../types/repo";
import { FileContextMenu } from "./FileContextMenu";

export interface FileTreeItemProps {
	node: FileNode;
	level?: number;
	onFileSelect?: (node: FileNode) => void;
	onFolderToggle?: (node: FileNode) => void;
	onRename?: (node: FileNode) => void;
	onReveal?: (node: FileNode) => void;
	onCopyPath?: (node: FileNode) => void;
	onDelete?: (node: FileNode) => void;
}

export function FileTreeItem({
	node,
	level = 0,
	onFileSelect,
	onFolderToggle,
	onRename,
	onReveal,
	onCopyPath,
	onDelete,
}: FileTreeItemProps) {
	const { t } = useTranslation("sidebar");
	const activeFileId = useAppStore((s) => s.activeFileId);
	const _setActiveFile = useAppStore((s) => s.setActiveFile);
	const _setWorkspaceMode = useAppStore((s) => s.setWorkspaceMode);
	const expandFolder = useAppStore((s) => s.expandFolder);
	const collapseFolder = useAppStore((s) => s.collapseFolder);

	const [isEditing, setIsEditing] = useState(false);
	const [editValue, setEditValue] = useState(node.name);
	const inputRef = useRef<HTMLInputElement | null>(null);

	const isActive = activeFileId === node.id;
	const isFolder = node.type === "folder";
	const isExpanded = node.isExpanded ?? false;

	const fileExt = node.name.split(".").pop()?.toLowerCase() || "";
	const baseName = node.name.replace(/\.[^/.]+$/, "");

	useEffect(() => {
		if (isEditing && inputRef.current) {
			inputRef.current.focus();
			inputRef.current.select();
		}
	}, [isEditing]);

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
		if (editValue.trim() && editValue !== node.name) {
			onRename?.(node);
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

	const indentStyle = { paddingLeft: `${12 + level * 16}px` };

	const content = (
		<div
			role="button"
			tabIndex={0}
			onClick={handleClick}
			onKeyDown={(e) => {
				if (e.key === "Enter" || e.key === " ") {
					handleClick();
				}
			}}
			className={`
				w-full max-w-full group flex items-center gap-2 px-3 py-1.5 cursor-pointer overflow-hidden
				text-xs text-muted-foreground transition-colors text-left
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
				<div className="w-3 shrink-0" />
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

			<span className="flex-1 min-w-0 truncate h-6 leading-6">
				{isEditing ? (
					<input
						ref={inputRef}
						value={editValue}
						onChange={(e) => setEditValue(e.target.value)}
						onBlur={handleRenameSubmit}
						onKeyDown={(e) => {
							if (e.key === "Enter") {
								handleRenameSubmit();
							} else if (e.key === "Escape") {
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
					baseName
				)}
			</span>

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
						setIsEditing(true);
						onRename?.(node);
					})
				}
				onReveal={() => handleContextMenuAction(() => onReveal?.(node))}
				onCopyPath={() => handleContextMenuAction(() => onCopyPath?.(node))}
				onDelete={() => handleContextMenuAction(() => onDelete?.(node))}
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
							onFileSelect={onFileSelect}
							onFolderToggle={onFolderToggle}
							onRename={onRename}
							onReveal={onReveal}
							onCopyPath={onCopyPath}
							onDelete={onDelete}
						/>
					))}
				</div>
			)}
		</div>
	);
}
