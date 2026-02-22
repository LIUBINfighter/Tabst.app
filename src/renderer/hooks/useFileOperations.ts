/**
 * File Operations Hook
 *
 * Simplified to stable callbacks only (no local hook state),
 * and includes folder creation helper.
 */

import { useCallback } from "react";
import type { FileItem } from "../store/appStore";
import { useAppStore } from "../store/appStore";

const ALLOWED_EXTENSIONS = [".md", ".atex"];

export function useFileOperations() {
	const addFile = useAppStore((s) => s.addFile);
	const renameFile = useAppStore((s) => s.renameFile);
	const refreshFileTree = useAppStore((s) => s.refreshFileTree);

	const splitName = useCallback((name: string) => {
		const idx = name.lastIndexOf(".");
		if (idx > 0) return { base: name.slice(0, idx), ext: name.slice(idx + 1) };
		return { base: name, ext: "" };
	}, []);

	const handleOpenFile = useCallback(async () => {
		try {
			const result = await window.electronAPI.openFile(ALLOWED_EXTENSIONS);
			if (!result) return;

			addFile({
				id: result.path,
				name: result.name,
				path: result.path,
				content: result.content,
				contentLoaded: true,
			});
		} catch (error) {
			console.error("打开文件失败:", error);
		}
	}, [addFile]);

	const resolveTargetDir = useCallback((targetDirectory?: string) => {
		if (targetDirectory && targetDirectory.trim().length > 0) {
			return targetDirectory;
		}
		const state = useAppStore.getState();
		const activeRepo = state.repos.find((r) => r.id === state.activeRepoId);
		return activeRepo?.path;
	}, []);

	const handleNewFile = useCallback(
		async (ext: string, targetDirectory?: string) => {
			try {
				const targetDir = resolveTargetDir(targetDirectory);
				const result = await window.electronAPI.createFile(ext, targetDir);
				if (!result) return;

				addFile({
					id: result.path,
					name: result.name,
					path: result.path,
					content: result.content,
					contentLoaded: true,
				});
				await refreshFileTree();
			} catch (error) {
				console.error("创建文件失败:", error);
			}
		},
		[addFile, refreshFileTree, resolveTargetDir],
	);

	const handleNewFolder = useCallback(
		async (targetDirectory?: string, folderName?: string) => {
			try {
				const targetDir = resolveTargetDir(targetDirectory);
				await window.electronAPI.createFolder(folderName, targetDir);
				await refreshFileTree();
			} catch (error) {
				console.error("创建文件夹失败:", error);
			}
		},
		[refreshFileTree, resolveTargetDir],
	);

	const handleRenameSubmit = useCallback(
		async (id: string, nextName?: string) => {
			if (!nextName || !nextName.trim()) return;
			const ok = await renameFile(id, nextName.trim());
			if (!ok) {
				console.error("failed to rename file");
			}
		},
		[renameFile],
	);

	// Kept for backward compatibility with older call sites.
	const handleRenameClick = useCallback(
		(_e: React.MouseEvent, _file: FileItem) => {},
		[],
	);

	// Kept for backward compatibility with older call sites.
	const handleRenameCancel = useCallback(
		(_e?: React.KeyboardEvent | React.FocusEvent) => {},
		[],
	);

	return {
		handleOpenFile,
		handleNewFile,
		handleNewFolder,

		// backward-compatible fields (now stateless)
		editingId: null as string | null,
		renameValue: "",
		renameExt: "",
		setRenameValue: (_v: string) => {},
		handleRenameClick,
		handleRenameCancel,
		handleRenameSubmit,
		splitName,
	};
}
