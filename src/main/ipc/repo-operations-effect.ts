import { Effect, Exit } from "effect";
import type {
	DeleteBehavior,
	Repo,
	RepoMetadata,
	ScanDirectoryResult,
} from "../../renderer/types/repo";
import type { GlobalSettings } from "../effects/file-system";
import {
	moveToRepoTrash,
	moveToSystemTrash,
	readGlobalSettings,
	readRepos,
	readWorkspaceMetadata,
	scanDirectory,
	writeGlobalSettings,
	writeRepos,
	writeWorkspaceMetadata,
} from "../effects/file-system";

export async function handleScanDirectoryEffect(
	_event: Electron.IpcMainInvokeEvent,
	dirPath: string,
): Promise<ScanDirectoryResult | null> {
	const program = scanDirectory(dirPath);
	const result = await Effect.runPromiseExit(program);

	return Exit.match(result, {
		onFailure: (error) => {
			console.error("Scan directory failed:", error);
			return null;
		},
		onSuccess: (value) => value,
	});
}

export async function handleLoadReposEffect(): Promise<Repo[]> {
	const program = readRepos();
	const result = await Effect.runPromiseExit(program);

	return Exit.match(result, {
		onFailure: (error) => {
			console.error("Load repos failed:", error);
			return [];
		},
		onSuccess: (value) => value,
	});
}

export async function handleSaveReposEffect(
	_event: Electron.IpcMainInvokeEvent,
	repos: Repo[],
): Promise<void> {
	const program = writeRepos(repos);
	const result = await Effect.runPromiseExit(program);

	return Exit.match(result, {
		onFailure: (error) => {
			console.error("Save repos failed:", error);
		},
		onSuccess: () => {},
	});
}

export async function handleLoadWorkspaceMetadataEffect(
	_event: Electron.IpcMainInvokeEvent,
	repoPath: string,
): Promise<RepoMetadata | null> {
	const program = readWorkspaceMetadata(repoPath);
	const result = await Effect.runPromiseExit(program);

	return Exit.match(result, {
		onFailure: (error) => {
			console.error("Load workspace metadata failed:", error);
			return null;
		},
		onSuccess: (value) => value,
	});
}

export async function handleSaveWorkspaceMetadataEffect(
	_event: Electron.IpcMainInvokeEvent,
	repoPath: string,
	metadata: RepoMetadata,
): Promise<void> {
	const program = writeWorkspaceMetadata(repoPath, metadata);
	const result = await Effect.runPromiseExit(program);

	return Exit.match(result, {
		onFailure: (error) => {
			console.error("Save workspace metadata failed:", error);
		},
		onSuccess: () => {},
	});
}

export async function handleDeleteFileEffect(
	_event: Electron.IpcMainInvokeEvent,
	filePath: string,
	behavior: DeleteBehavior,
	repoPath?: string,
): Promise<{ success: boolean; error?: string }> {
	if (behavior === "system-trash") {
		const program = moveToSystemTrash(filePath);
		const result = await Effect.runPromiseExit(program);

		return Exit.match(result, {
			onFailure: (error) => {
				console.error("Move to system trash failed:", error);
				return {
					success: false,
					error: error._tag === "Fail" ? error.error.message : "Unknown error",
				};
			},
			onSuccess: () => ({ success: true }),
		});
	}

	if (behavior === "repo-trash" && repoPath) {
		const program = moveToRepoTrash(filePath, repoPath);
		const result = await Effect.runPromiseExit(program);

		return Exit.match(result, {
			onFailure: (error) => {
				console.error("Move to repo trash failed:", error);
				return {
					success: false,
					error: error._tag === "Fail" ? error.error.message : "Unknown error",
				};
			},
			onSuccess: () => ({ success: true }),
		});
	}

	return {
		success: false,
		error: "Invalid delete behavior or missing repo path",
	};
}

export async function handleLoadGlobalSettingsEffect(): Promise<{
	success: boolean;
	data?: unknown;
	error?: string;
}> {
	const program = readGlobalSettings();
	const result = await Effect.runPromiseExit(program);
	return Exit.match(result, {
		onFailure: (error) => {
			console.error("Load global settings failed:", error);
			return { success: false, error: "Failed to load settings" };
		},
		onSuccess: (value) => ({ success: true, data: value ?? {} }),
	});
}

export async function handleSaveGlobalSettingsEffect(
	_event: Electron.IpcMainInvokeEvent,
	settings: unknown,
): Promise<{ success: boolean; error?: string }> {
	const program = writeGlobalSettings(settings as GlobalSettings);
	const result = await Effect.runPromiseExit(program);
	return Exit.match(result, {
		onFailure: (error) => {
			console.error("Save global settings failed:", error);
			return { success: false, error: "Failed to save settings" };
		},
		onSuccess: () => ({ success: true }),
	});
}
