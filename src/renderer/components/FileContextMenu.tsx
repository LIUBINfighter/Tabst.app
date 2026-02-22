import {
	Copy,
	ExternalLink,
	FileEdit,
	FilePlus,
	FolderOpen,
	FolderPlus,
	Trash2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuShortcut,
	ContextMenuTrigger,
} from "@/renderer/components/ui/context-menu";
import type { FileNode } from "../types/repo";

export interface FileContextMenuProps {
	children: React.ReactNode;
	node: FileNode;
	onOpen: () => void;
	onRename: () => void;
	onReveal: () => void;
	onCopyPath: () => void;
	onDelete: () => void;
	onCreateFileInFolder?: (ext: ".md" | ".atex") => void;
	onCreateFolderInFolder?: () => void;
	onCloseAutoFocus?: (event: Event) => void;
}

export function FileContextMenu({
	children,
	node,
	onOpen,
	onRename,
	onReveal,
	onCopyPath,
	onDelete,
	onCreateFileInFolder,
	onCreateFolderInFolder,
	onCloseAutoFocus,
}: FileContextMenuProps) {
	const { t } = useTranslation("sidebar");

	return (
		<ContextMenu>
			<ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
			<ContextMenuContent className="w-48" onCloseAutoFocus={onCloseAutoFocus}>
				{node.type === "file" && (
					<ContextMenuItem onClick={onOpen}>
						<ExternalLink className="mr-2 h-4 w-4" />
						{t("open")}
						<ContextMenuShortcut>↵</ContextMenuShortcut>
					</ContextMenuItem>
				)}

				{node.type === "folder" && (
					<>
						<ContextMenuItem onClick={() => onCreateFileInFolder?.(".atex")}>
							<FilePlus className="mr-2 h-4 w-4" />
							{t("newAtex")}
						</ContextMenuItem>
						<ContextMenuItem onClick={() => onCreateFileInFolder?.(".md")}>
							<FilePlus className="mr-2 h-4 w-4" />
							{t("newMd")}
						</ContextMenuItem>
						<ContextMenuItem onClick={() => onCreateFolderInFolder?.()}>
							<FolderPlus className="mr-2 h-4 w-4" />
							{t("newFolder")}
						</ContextMenuItem>
						<ContextMenuSeparator />
					</>
				)}

				<ContextMenuItem onClick={onRename}>
					<FileEdit className="mr-2 h-4 w-4" />
					{t("rename")}
					<ContextMenuShortcut>F2</ContextMenuShortcut>
				</ContextMenuItem>
				<ContextMenuItem onClick={onReveal}>
					<FolderOpen className="mr-2 h-4 w-4" />
					{t("showInExplorer")}
				</ContextMenuItem>
				<ContextMenuItem onClick={onCopyPath}>
					<Copy className="mr-2 h-4 w-4" />
					{t("copyPath")}
					<ContextMenuShortcut>⌘C</ContextMenuShortcut>
				</ContextMenuItem>
				<ContextMenuSeparator />
				<ContextMenuItem
					onClick={onDelete}
					className="text-destructive focus:text-destructive"
				>
					<Trash2 className="mr-2 h-4 w-4" />
					{t("delete")}
					<ContextMenuShortcut>⌫</ContextMenuShortcut>
				</ContextMenuItem>
			</ContextMenuContent>
		</ContextMenu>
	);
}
