import fs from "node:fs";
import path from "node:path";
import { Effect, Exit } from "effect";
import {
	fileExists,
	getDefaultSaveDir,
	mkdir,
	readFile,
	readJsonFile,
	renamePath,
	showOpenDialog,
	writeFile,
	writeJsonFile,
} from "../effects/file-system";

interface FileResult {
	path: string;
	name: string;
	content: string;
}

interface OperationResult {
	success: boolean;
	newPath?: string;
	newName?: string;
	error?: string;
}

interface FolderResult {
	path: string;
	name: string;
}

export async function handleOpenFileEffect(
	_event: Electron.IpcMainInvokeEvent,
	extensions: string[],
): Promise<FileResult | null> {
	const program = showOpenDialog(extensions);

	const result = await Effect.runPromiseExit(program);

	return Exit.match(result, {
		onFailure: (error) => {
			console.error("Open file failed:", error);
			return null;
		},
		onSuccess: (value) => value,
	});
}

export async function handleCreateFileEffect(
	_event: Electron.IpcMainInvokeEvent,
	ext?: string,
	preferredDir?: string,
): Promise<FileResult> {
	const program = Effect.gen(function* () {
		const saveDir =
			typeof preferredDir === "string" && preferredDir.trim().length > 0
				? preferredDir
				: yield* getDefaultSaveDir();

		let normalizedExt = ".md";
		if (ext && typeof ext === "string") {
			normalizedExt = ext.startsWith(".") ? ext : `.${ext}`;
		}

		const timestamp = Date.now();
		const fileName = `untitled_${timestamp}${normalizedExt}`;
		const filePath = path.join(saveDir, fileName);

		yield* writeFile(filePath, "");

		return { path: filePath, name: fileName, content: "" };
	});

	const result = await Effect.runPromiseExit(program);

	return Exit.match(result, {
		onFailure: (error) => {
			console.error("Create file failed:", error);
			throw error;
		},
		onSuccess: (value) => value,
	});
}

export async function handleCreateFolderEffect(
	_event: Electron.IpcMainInvokeEvent,
	folderName?: string,
	preferredDir?: string,
): Promise<FolderResult> {
	const program = Effect.gen(function* () {
		const targetDir =
			typeof preferredDir === "string" && preferredDir.trim().length > 0
				? preferredDir
				: yield* getDefaultSaveDir();

		const rawName =
			typeof folderName === "string" && folderName.trim().length > 0
				? folderName.trim()
				: `untitled_folder_${Date.now()}`;

		const safeBaseName = rawName.replace(/[\\/:*?"<>|]/g, "_");
		let finalName = safeBaseName;
		let folderPath = path.join(targetDir, finalName);
		let suffix = 1;

		while (yield* fileExists(folderPath)) {
			finalName = `${safeBaseName}_${suffix}`;
			folderPath = path.join(targetDir, finalName);
			suffix += 1;
		}

		yield* mkdir(folderPath);

		return { path: folderPath, name: finalName };
	});

	const result = await Effect.runPromiseExit(program);

	return Exit.match(result, {
		onFailure: (error) => {
			console.error("Create folder failed:", error);
			throw error;
		},
		onSuccess: (value) => value,
	});
}

export async function handleSaveFileEffect(
	_event: Electron.IpcMainInvokeEvent,
	filePath: string,
	content: string,
): Promise<{ success: boolean; error?: string }> {
	const program = writeFile(filePath, content);

	const result = await Effect.runPromiseExit(program);

	return Exit.match(result, {
		onFailure: (error) => {
			if (error._tag === "Fail") {
				return {
					success: false,
					error: error.error.message,
				};
			}
			return { success: false, error: "Unknown error" };
		},
		onSuccess: () => ({ success: true }),
	});
}

export async function handleRenameFileEffect(
	_event: Electron.IpcMainInvokeEvent,
	oldPath: string,
	newName: string,
): Promise<OperationResult> {
	const program = Effect.gen(function* () {
		const dir = path.dirname(oldPath);
		const newPath = path.join(dir, newName);

		if (newPath === oldPath) {
			return {
				success: true,
				newPath,
				newName: path.basename(newPath),
			};
		}

		const exists = yield* fileExists(newPath);
		if (exists) {
			return { success: false, error: "target-exists" };
		}

		yield* renamePath(oldPath, newPath);

		return {
			success: true,
			newPath,
			newName: path.basename(newPath),
		};
	});

	const result = await Effect.runPromiseExit(program);

	return Exit.match(result, {
		onFailure: (error) => {
			if (error._tag === "Fail") {
				return {
					success: false,
					error: error.error.message,
				};
			}
			return { success: false, error: "Unknown error" };
		},
		onSuccess: (value) => value,
	});
}

export async function handleMovePathEffect(
	_event: Electron.IpcMainInvokeEvent,
	sourcePath: string,
	targetFolderPath: string,
): Promise<OperationResult> {
	const program = Effect.gen(function* () {
		const normalizedSource = sourcePath.trim();
		const normalizedTarget = targetFolderPath.trim();

		if (!normalizedSource || !normalizedTarget) {
			return { success: false, error: "invalid-path" };
		}

		const sourceExists = yield* fileExists(normalizedSource);
		if (!sourceExists) {
			return { success: false, error: "source-not-found" };
		}

		const targetStat = yield* Effect.tryPromise({
			try: () => fs.promises.stat(normalizedTarget),
			catch: () => new Error("target-not-found"),
		});

		if (!targetStat.isDirectory()) {
			return { success: false, error: "target-not-folder" };
		}

		const sourceStat = yield* Effect.tryPromise({
			try: () => fs.promises.stat(normalizedSource),
			catch: () => new Error("source-not-found"),
		});

		const destPath = path.join(
			normalizedTarget,
			path.basename(normalizedSource),
		);

		if (destPath === normalizedSource) {
			return {
				success: true,
				newPath: destPath,
				newName: path.basename(destPath),
			};
		}

		if (sourceStat.isDirectory()) {
			const sourceWithSep = `${normalizedSource}${path.sep}`;
			if (normalizedTarget.startsWith(sourceWithSep)) {
				return { success: false, error: "invalid-target" };
			}
		}

		const targetExists = yield* fileExists(destPath);
		if (targetExists) {
			return { success: false, error: "target-exists" };
		}

		yield* renamePath(normalizedSource, destPath);

		return {
			success: true,
			newPath: destPath,
			newName: path.basename(destPath),
		};
	});

	const result = await Effect.runPromiseExit(program);

	return Exit.match(result, {
		onFailure: (error) => {
			if (error._tag === "Fail") {
				return {
					success: false,
					error: error.error.message,
				};
			}
			return { success: false, error: "Unknown error" };
		},
		onSuccess: (value) => value,
	});
}

interface AppState {
	files: { id: string; name: string; path: string }[];
	activeRepoId?: string | null;
	activeFileId: string | null;
}

interface AppStateWithContent {
	files: { id: string; name: string; path: string; content: string }[];
	activeRepoId: string | null;
	activeFileId: string | null;
}

export async function handleLoadAppStateEffect(): Promise<AppStateWithContent> {
	const stateFile = Effect.sync(() => {
		const { app } = require("electron");
		const path = require("node:path");
		const dataDir = app.getPath("userData");
		return path.join(dataDir, "app-state.json");
	});

	const program = Effect.gen(function* () {
		const filePath = yield* stateFile;
		const state = yield* readJsonFile<AppState>(filePath);

		if (!state) {
			return { files: [], activeRepoId: null, activeFileId: null };
		}

		const files = (yield* Effect.all(
			state.files.map((f) =>
				Effect.gen(function* () {
					const exists = yield* fileExists(f.path);
					if (!exists) {
						return null;
					}
					const content = yield* readFile(f.path);
					return {
						id: f.id,
						name: f.name,
						path: f.path,
						content,
					};
				}),
			),
			{ concurrency: 5 },
		)).filter((f): f is NonNullable<typeof f> => f !== null);

		const activeFileId = files.some((f) => f.id === state.activeFileId)
			? state.activeFileId
			: files.length > 0
				? files[0].id
				: null;

		return {
			files,
			activeRepoId: state.activeRepoId ?? null,
			activeFileId,
		};
	});

	const result = await Effect.runPromiseExit(program);

	return Exit.match(result, {
		onFailure: (error) => {
			console.error("Load app state failed:", error);
			return { files: [], activeRepoId: null, activeFileId: null };
		},
		onSuccess: (value) => ({
			...value,
			activeRepoId: value.activeRepoId ?? null,
		}),
	});
}

export async function handleSaveAppStateEffect(
	_event: Electron.IpcMainInvokeEvent,
	state: AppState,
): Promise<{ success: boolean; error?: string }> {
	const program = Effect.gen(function* () {
		const { app } = require("electron");
		const path = require("node:path");
		const dataDir = app.getPath("userData");
		const stateFile = path.join(dataDir, "app-state.json");
		yield* writeJsonFile(stateFile, state);
	});

	const result = await Effect.runPromiseExit(program);

	return Exit.match(result, {
		onFailure: (error) => {
			if (error._tag === "Fail") {
				return {
					success: false,
					error: error.error.message,
				};
			}
			return { success: false, error: "Unknown error" };
		},
		onSuccess: () => ({ success: true }),
	});
}

export async function handleReadFileEffect(
	_event: Electron.IpcMainInvokeEvent,
	filePath: string,
): Promise<{ content: string; error?: string }> {
	const program = readFile(filePath);
	const result = await Effect.runPromiseExit(program);

	return Exit.match(result, {
		onFailure: (error) => {
			console.error("Read file failed:", error);
			if (error._tag === "Fail") {
				return { content: "", error: error.error.message };
			}
			return { content: "", error: "Unknown error" };
		},
		onSuccess: (content) => ({ content }),
	});
}
