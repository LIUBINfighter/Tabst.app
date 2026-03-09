/**
 * File Operations Hook
 *
 * Simplified to stable callbacks only (no local hook state),
 * and includes folder creation helper.
 */

import { useCallback } from "react";
import { convertGpBytesToAlphaTex, isGpFilePath } from "../lib/gp-import";
import type { FileItem } from "../store/appStore";
import { useAppStore } from "../store/appStore";

const ALLOWED_EXTENSIONS = [
	".md",
	".atex",
	".gp",
	".gp3",
	".gp4",
	".gp5",
	".gpx",
];

export function useFileOperations() {
	const addFile = useAppStore((s) => s.addFile);
	const renameFile = useAppStore((s) => s.renameFile);
	const setWorkspaceMode = useAppStore((s) => s.setWorkspaceMode);
	const setActiveFile = useAppStore((s) => s.setActiveFile);
	const refreshFileTree = useAppStore((s) => s.refreshFileTree);

	const splitName = useCallback((name: string) => {
		const idx = name.lastIndexOf(".");
		if (idx > 0) return { base: name.slice(0, idx), ext: name.slice(idx + 1) };
		return { base: name, ext: "" };
	}, []);

	const getFileNameFromPath = useCallback((input: string) => {
		const normalized = input.replace(/\\/g, "/");
		return normalized.split("/").pop() ?? input;
	}, []);

	const getBaseNameWithoutExt = useCallback(
		(input: string) => {
			const fileName = getFileNameFromPath(input);
			const idx = fileName.lastIndexOf(".");
			if (idx > 0) return fileName.slice(0, idx);
			return fileName;
		},
		[getFileNameFromPath],
	);

	const tryRenameImportedAtex = useCallback(
		async (createdPath: string, sourceName?: string) => {
			if (!sourceName || sourceName.trim().length === 0) {
				return { path: createdPath, name: getFileNameFromPath(createdPath) };
			}

			const baseName = getBaseNameWithoutExt(sourceName).trim();
			if (!baseName) {
				return { path: createdPath, name: getFileNameFromPath(createdPath) };
			}

			for (let i = 0; i < 200; i += 1) {
				const suffix = i === 0 ? "" : `_${i}`;
				const nextName = `${baseName}${suffix}.atex`;
				const result = await window.desktopAPI.renameFile(
					createdPath,
					nextName,
				);
				if (result?.success) {
					return {
						path: result.newPath ?? createdPath,
						name: result.newName ?? nextName,
					};
				}
				if (result?.error !== "target-exists") {
					console.error("重命名导入的 atex 文件失败:", result?.error);
					break;
				}
			}

			return { path: createdPath, name: getFileNameFromPath(createdPath) };
		},
		[getBaseNameWithoutExt, getFileNameFromPath],
	);

	const resolveTargetDir = useCallback((targetDirectory?: string) => {
		if (targetDirectory && targetDirectory.trim().length > 0) {
			return targetDirectory;
		}
		const state = useAppStore.getState();
		const activeRepo = state.repos.find((r) => r.id === state.activeRepoId);
		return activeRepo?.path;
	}, []);

	const importGpToNewAtex = useCallback(
		async (
			gpBytes: Uint8Array,
			targetDirectory?: string,
			sourceName?: string,
		) => {
			const alphaTex = convertGpBytesToAlphaTex(gpBytes);
			const targetDir = resolveTargetDir(targetDirectory);
			const created = await window.desktopAPI.createFile(".atex", targetDir);
			if (!created) return null;
			const renamed = await tryRenameImportedAtex(created.path, sourceName);

			const saveResult = await window.desktopAPI.saveFile(
				renamed.path,
				alphaTex,
			);
			if (!saveResult.success) {
				console.error("写入转换后的 atex 文件失败:", saveResult.error);
				return null;
			}

			addFile({
				id: renamed.path,
				name: renamed.name,
				path: renamed.path,
				content: alphaTex,
				contentLoaded: true,
			});

			setWorkspaceMode("editor");
			setActiveFile(renamed.path);
			void refreshFileTree();
			return renamed.path;
		},
		[
			addFile,
			refreshFileTree,
			resolveTargetDir,
			setActiveFile,
			setWorkspaceMode,
			tryRenameImportedAtex,
		],
	);

	const handleImportGpFile = useCallback(
		async (gpFilePath: string, targetDirectory?: string) => {
			if (!isGpFilePath(gpFilePath)) return null;
			const readResult = await window.desktopAPI.readFileBytes(gpFilePath);
			if (!readResult.data) {
				console.error("读取 GP 文件二进制失败:", readResult.error);
				return null;
			}
			return importGpToNewAtex(
				readResult.data,
				targetDirectory,
				getFileNameFromPath(gpFilePath),
			);
		},
		[getFileNameFromPath, importGpToNewAtex],
	);

	const handleImportGpBytes = useCallback(
		async (
			gpBytes: Uint8Array,
			targetDirectory?: string,
			sourceName?: string,
		) => {
			return importGpToNewAtex(gpBytes, targetDirectory, sourceName);
		},
		[importGpToNewAtex],
	);

	const handleOpenFile = useCallback(
		async (targetDirectory?: string) => {
			try {
				const result = await window.desktopAPI.openFile(ALLOWED_EXTENSIONS);
				if (!result) return;
				if (isGpFilePath(result.path)) {
					await handleImportGpFile(result.path, targetDirectory);
					return;
				}

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
		},
		[addFile, handleImportGpFile],
	);

	const handleNewFile = useCallback(
		async (ext: string, targetDirectory?: string) => {
			try {
				const targetDir = resolveTargetDir(targetDirectory);
				const result = await window.desktopAPI.createFile(ext, targetDir);
				if (!result) return null;

				addFile({
					id: result.path,
					name: result.name,
					path: result.path,
					content: result.content,
					contentLoaded: true,
				});
				return result.path;
			} catch (error) {
				console.error("创建文件失败:", error);
				return null;
			}
		},
		[addFile, resolveTargetDir],
	);

	const handleNewFolder = useCallback(
		async (targetDirectory?: string, folderName?: string) => {
			try {
				const targetDir = resolveTargetDir(targetDirectory);
				const result = await window.desktopAPI.createFolder(
					folderName,
					targetDir,
				);
				if (!result) return null;
				return result.path;
			} catch (error) {
				console.error("创建文件夹失败:", error);
				return null;
			}
		},
		[resolveTargetDir],
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
		handleImportGpFile,
		handleImportGpBytes,
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
