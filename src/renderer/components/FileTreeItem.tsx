import {
	ChevronDown,
	ChevronRight,
	FileDown,
	FileMusic,
	FileText,
	Folder,
	FolderOpen,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAppStore } from "../store/appStore";
import type { FileNode } from "../types/repo";
import { FileContextMenu } from "./FileContextMenu";

export interface FileTreeItemProps {
	node: FileNode;
	level?: number;
	onFileSelect?: (node: FileNode) => void;
	onFolderToggle?: (node: FileNode) => void;
	onRename?: (node: FileNode, newName: string) => void;
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
	const expandFolder = useAppStore((s) => s.expandFolder);
	const collapseFolder = useAppStore((s) => s.collapseFolder);

	const [isEditing, setIsEditing] = useState(false);
	const [editValue, setEditValue] = useState("");
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

	const fileExt = node.name.split(".").pop()?.toLowerCase() || "";
	const baseName = node.name.replace(/\.[^/.]+$/, "");

	useEffect(() => {
		if (!isEditing) {
			setEditValue(isFolder ? node.name : baseName);
		}
	}, [isEditing, isFolder, node.name, baseName]);

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
						preventCloseAutoFocusRef.current = true;
						setIsEditing(true);
					})
				}
				onReveal={() => handleContextMenuAction(() => onReveal?.(node))}
				onCopyPath={() => handleContextMenuAction(() => onCopyPath?.(node))}
				onDelete={() => handleContextMenuAction(() => onDelete?.(node))}
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
