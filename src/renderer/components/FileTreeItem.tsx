import { Edit, FileDown, FileMusic, FileText, FolderOpen } from "lucide-react";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { FileItem } from "../store/appStore";
import { useAppStore } from "../store/appStore";

export interface FileTreeItemProps {
	file: FileItem;
	isEditing: boolean;
	renameValue: string;
	renameExt: string;
	onRenameValueChange: (value: string) => void;
	onRenameClick: (e: React.MouseEvent, file: FileItem) => void;
	onRenameSubmit: (id: string) => void;
	onRenameCancel: (e?: React.KeyboardEvent | React.FocusEvent) => void;
	splitName: (name: string) => { base: string; ext: string };
}

export function FileTreeItem({
	file,
	isEditing,
	renameValue,
	renameExt,
	onRenameValueChange,
	onRenameClick,
	onRenameSubmit,
	onRenameCancel,
	splitName,
}: FileTreeItemProps) {
	const { t } = useTranslation("sidebar");
	const activeFileId = useAppStore((s) => s.activeFileId);
	const setActiveFile = useAppStore((s) => s.setActiveFile);
	const setWorkspaceMode = useAppStore((s) => s.setWorkspaceMode);
	const inputRef = useRef<HTMLInputElement | null>(null);

	const isActive = activeFileId === file.id;
	const fileExt = isEditing ? renameExt : splitName(file.name).ext;
	const iconClass = `shrink-0 h-3.5 w-3.5 transition-colors ${
		isActive
			? "text-[var(--highlight-text)]"
			: "text-muted-foreground group-hover:text-[var(--hover-text)]"
	}`;

	useEffect(() => {
		if (isEditing && inputRef.current) {
			inputRef.current.focus();
			inputRef.current.select();
		}
	}, [isEditing]);

	return (
		<div
			onClick={(e) => {
				if ((e.target as HTMLElement).closest("button")) {
					return;
				}
				if (isActive) {
					setActiveFile(null);
				} else {
					setActiveFile(file.id);
					setWorkspaceMode("editor");
				}
			}}
			onKeyDown={(e) => {
				if ((e.target as HTMLElement).closest("button")) {
					return;
				}
				if (e.key === "Enter" || e.key === " ") {
					if (isActive) {
						setActiveFile(null);
					} else {
						setActiveFile(file.id);
						setWorkspaceMode("editor");
					}
				}
			}}
			role="button"
			tabIndex={0}
			className={`
				w-full max-w-full group flex items-center gap-2 px-3 py-1.5 cursor-pointer overflow-hidden
				text-xs text-muted-foreground transition-colors text-left
				${isActive ? "bg-[var(--highlight-bg)] text-[var(--highlight-text)]" : "hover:bg-[var(--hover-bg)] hover:text-[var(--hover-text)]"}
			`}
		>
			{fileExt === "atex" ? (
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
						value={renameValue}
						onChange={(e) => onRenameValueChange(e.target.value)}
						onBlur={() => onRenameSubmit(file.id)}
						onKeyDown={(e) => {
							if (e.key === "Enter") {
								onRenameSubmit(file.id);
							} else if (e.key === "Escape") {
								onRenameCancel(e);
							}
						}}
						className="w-full bg-transparent text-xs h-6 leading-6 px-1 border border-border rounded-sm outline-none"
						spellCheck={false}
						autoComplete="off"
						aria-label={t("renameFile")}
					/>
				) : (
					splitName(file.name).base
				)}
			</span>

			<div className="shrink-0 flex items-center gap-0.5">
				<button
					type="button"
					onClick={(e) => onRenameClick(e, file)}
					className={`opacity-0 group-hover:opacity-100 focus-visible:opacity-100 p-1 rounded transition-opacity w-6 h-6 flex items-center justify-center hover:bg-[var(--hover-bg)] focus-visible:bg-[var(--highlight-bg)] ${
						isActive
							? "text-[var(--highlight-text)]"
							: "text-muted-foreground hover:text-[var(--hover-text)] focus-visible:text-[var(--highlight-text)]"
					}`}
					aria-label={t("rename")}
				>
					<span className="sr-only">{t("renameFile")}</span>
					<Edit className="h-3 w-3" />
				</button>
				<button
					type="button"
					onClick={async (e) => {
						e.stopPropagation();
						try {
							await window.electronAPI.revealInFolder(file.path);
						} catch (err) {
							console.error("revealInFolder failed:", err);
						}
					}}
					className={`opacity-0 group-hover:opacity-100 focus-visible:opacity-100 p-1 rounded transition-opacity w-6 h-6 flex items-center justify-center hover:bg-[var(--hover-bg)] focus-visible:bg-[var(--highlight-bg)] ${
						isActive
							? "text-[var(--highlight-text)]"
							: "text-muted-foreground hover:text-[var(--hover-text)] focus-visible:text-[var(--highlight-text)]"
					}`}
					aria-label={t("showInExplorer")}
				>
					<span className="sr-only">{t("showInExplorer")}</span>
					<FolderOpen className="h-3.5 w-3.5" />
				</button>
			</div>

			{fileExt === "md" && (
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
}
