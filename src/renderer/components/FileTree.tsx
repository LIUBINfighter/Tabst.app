import { useTranslation } from "react-i18next";
import type { FileNode } from "../types/repo";
import { FileTreeItem } from "./FileTreeItem";

export interface FileTreeProps {
	nodes: FileNode[];
	level?: number;
	onFileSelect: (node: FileNode) => void;
	onFolderToggle: (node: FileNode) => void;
	onRename?: (node: FileNode) => void;
	onReveal: (node: FileNode) => void;
	onCopyPath: (node: FileNode) => void;
	onDelete: (node: FileNode) => void;
}

export function FileTree({
	nodes,
	level = 0,
	onFileSelect,
	onFolderToggle,
	onRename,
	onReveal,
	onCopyPath,
	onDelete,
}: FileTreeProps) {
	const { t } = useTranslation("sidebar");

	if (nodes.length === 0) {
		return (
			<div className="p-3 text-xs text-muted-foreground text-center">
				{t("noFiles")}
			</div>
		);
	}

	return (
		<div className="w-full">
			{nodes.map((node) => (
				<FileTreeItem
					key={node.id}
					node={node}
					level={level}
					onFileSelect={onFileSelect}
					onFolderToggle={onFolderToggle}
					onRename={onRename}
					onReveal={onReveal}
					onCopyPath={onCopyPath}
					onDelete={onDelete}
				/>
			))}
		</div>
	);
}
