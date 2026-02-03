/**
 * File Operations Hook
 *
 * Encapsulates file operations: open, create, rename.
 */

import { useCallback, useState } from "react";
import type { FileItem } from "../store/appStore";
import { useAppStore } from "../store/appStore";

const ALLOWED_EXTENSIONS = [".md", ".atex"];

export function useFileOperations() {
	const addFile = useAppStore((s) => s.addFile);
	const renameFile = useAppStore((s) => s.renameFile);

	const [editingId, setEditingId] = useState<string | null>(null);
	const [renameValue, setRenameValue] = useState<string>("");
	const [renameExt, setRenameExt] = useState<string>("");

	const splitName = useCallback((name: string) => {
		const idx = name.lastIndexOf(".");
		if (idx > 0) return { base: name.slice(0, idx), ext: name.slice(idx + 1) };
		return { base: name, ext: "" };
	}, []);

	const handleOpenFile = useCallback(async () => {
		try {
			const result = await window.electronAPI.openFile(ALLOWED_EXTENSIONS);
			if (result) {
				const file: FileItem = {
					id: crypto.randomUUID(),
					name: result.name,
					path: result.path,
					content: result.content,
				};
				addFile(file);
			}
		} catch (error) {
			console.error("打开文件失败:", error);
		}
	}, [addFile]);

	const handleNewFile = useCallback(
		async (ext: string) => {
			try {
				const result = await window.electronAPI.createFile(ext);
				if (result) {
					const file: FileItem = {
						id: crypto.randomUUID(),
						name: result.name,
						path: result.path,
						content: result.content,
					};
					addFile(file);
				}
			} catch (error) {
				console.error("创建文件失败:", error);
			}
		},
		[addFile],
	);

	const handleRenameClick = useCallback(
		(e: React.MouseEvent, file: FileItem) => {
			e.stopPropagation();
			setEditingId(file.id);
			const { base, ext } = splitName(file.name);
			setRenameValue(base);
			setRenameExt(ext);
		},
		[splitName],
	);

	const handleRenameCancel = useCallback(
		(e?: React.KeyboardEvent | React.FocusEvent) => {
			if (e && "key" in e && e.key === "Escape") {
				e.stopPropagation();
			}
			setEditingId(null);
			setRenameValue("");
			setRenameExt("");
		},
		[],
	);

	const handleRenameSubmit = useCallback(
		async (id: string) => {
			if (!renameValue?.trim()) {
				handleRenameCancel();
				return;
			}
			const finalName = renameExt
				? `${renameValue.trim()}.${renameExt}`
				: `${renameValue.trim()}`;
			if (!finalName) return;
			const ok = await renameFile(id, finalName);
			if (!ok) {
				console.error("failed to rename file");
				return;
			}
			setEditingId(null);
			setRenameExt("");
		},
		[renameValue, renameExt, renameFile, handleRenameCancel],
	);

	return {
		handleOpenFile,
		handleNewFile,
		editingId,
		renameValue,
		renameExt,
		setRenameValue,
		handleRenameClick,
		handleRenameCancel,
		handleRenameSubmit,
		splitName,
	};
}
