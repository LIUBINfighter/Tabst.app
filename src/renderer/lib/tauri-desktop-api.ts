import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type {
	DesktopAPI,
	FileResult,
	SaveResult,
	ScanDirectoryResult,
} from "../types/desktop";
import type {
	GitChangeGroup,
	GitDiffResult,
	GitStatusSummary,
} from "../types/git";
import type { Repo, RepoMetadata } from "../types/repo";
import { normalizeTauriInvokeArgs } from "./tauri-invoke-args";

type RepoWatchEvent = {
	repoPath: string;
	eventType: string;
	changedPath?: string;
};

type UpdateEvent = {
	type:
		| "checking"
		| "available"
		| "not-available"
		| "progress"
		| "downloaded"
		| "error";
	version?: string;
	releaseNotes?: string | null;
	percent?: number;
	transferred?: number;
	total?: number;
	message?: string;
};

function toErrorMessage(error: unknown): string {
	if (error instanceof Error) return error.message;
	if (typeof error === "string") return error;
	try {
		return JSON.stringify(error);
	} catch {
		return String(error);
	}
}

function toUint8Array(data: number[] | Uint8Array): Uint8Array {
	if (data instanceof Uint8Array) return data;
	return new Uint8Array(data);
}

async function invokeCommand<T>(
	command: string,
	args?: Record<string, unknown>,
): Promise<T> {
	return invoke<T>(command, normalizeTauriInvokeArgs(args));
}

export function createTauriDesktopAPI(): DesktopAPI {
	const api: DesktopAPI = {
		openFile: async (extensions: string[]): Promise<FileResult | null> => {
			try {
				return await invokeCommand<FileResult | null>("open_file", {
					extensions,
				});
			} catch {
				return null;
			}
		},

		selectFolder: async (): Promise<string | null> => {
			try {
				return await invokeCommand<string | null>("select_folder");
			} catch {
				return null;
			}
		},

		createFile: async (
			ext?: string,
			preferredDir?: string,
		): Promise<FileResult | null> => {
			try {
				return await invokeCommand<FileResult | null>("create_file", {
					ext,
					preferred_dir: preferredDir,
				});
			} catch {
				return null;
			}
		},

		createFolder: async (
			folderName?: string,
			preferredDir?: string,
		): Promise<{ path: string; name: string } | null> => {
			try {
				return await invokeCommand<{ path: string; name: string } | null>(
					"create_folder",
					{
						folder_name: folderName,
						preferred_dir: preferredDir,
					},
				);
			} catch {
				return null;
			}
		},

		saveFile: async (
			filePath: string,
			content: string,
		): Promise<SaveResult> => {
			try {
				return await invokeCommand<SaveResult>("save_file", {
					file_path: filePath,
					content,
				});
			} catch (error) {
				return { success: false, error: toErrorMessage(error) };
			}
		},

		loadAppState: async () => {
			try {
				return await invokeCommand<{
					files: FileResult[];
					activeRepoId?: string | null;
					activeFileId: string | null;
				} | null>("load_app_state");
			} catch {
				return null;
			}
		},

		saveAppState: async (state) => {
			try {
				return await invokeCommand<{ success: boolean; error?: string } | null>(
					"save_app_state",
					{ state },
				);
			} catch (error) {
				return { success: false, error: toErrorMessage(error) };
			}
		},

		renameFile: async (oldPath: string, newName: string) => {
			try {
				return await invokeCommand<{
					success: boolean;
					newPath?: string;
					newName?: string;
					error?: string;
				} | null>("rename_file", {
					old_path: oldPath,
					new_name: newName,
				});
			} catch (error) {
				return { success: false, error: toErrorMessage(error) };
			}
		},

		movePath: async (sourcePath: string, targetFolderPath: string) => {
			try {
				return await invokeCommand<{
					success: boolean;
					newPath?: string;
					newName?: string;
					error?: string;
				} | null>("move_path", {
					source_path: sourcePath,
					target_folder_path: targetFolderPath,
				});
			} catch (error) {
				return { success: false, error: toErrorMessage(error) };
			}
		},

		revealInFolder: async (filePath: string) => {
			try {
				return await invokeCommand<{ success: boolean; error?: string } | null>(
					"reveal_in_folder",
					{ file_path: filePath },
				);
			} catch (error) {
				return { success: false, error: toErrorMessage(error) };
			}
		},

		readAsset: async (relPath: string): Promise<Uint8Array> => {
			const data = await invokeCommand<number[] | Uint8Array>("read_asset", {
				rel_path: relPath,
			});
			return toUint8Array(data);
		},

		readFile: async (
			filePath: string,
		): Promise<{ content: string; error?: string }> => {
			try {
				return await invokeCommand<{ content: string; error?: string }>(
					"read_file",
					{ file_path: filePath },
				);
			} catch (error) {
				return { content: "", error: toErrorMessage(error) };
			}
		},

		readFileBytes: async (
			filePath: string,
		): Promise<{ data?: Uint8Array; error?: string }> => {
			try {
				const result = await invokeCommand<{ data?: number[]; error?: string }>(
					"read_file_bytes",
					{ file_path: filePath },
				);
				if (!result.data) return { error: result.error };
				return { data: new Uint8Array(result.data) };
			} catch (error) {
				return { error: toErrorMessage(error) };
			}
		},

		scanDirectory: async (
			dirPath: string,
		): Promise<ScanDirectoryResult | null> => {
			try {
				return await invokeCommand<ScanDirectoryResult | null>(
					"scan_directory",
					{
						dir_path: dirPath,
					},
				);
			} catch {
				return null;
			}
		},

		loadRepos: async (): Promise<Repo[]> => {
			try {
				return await invokeCommand<Repo[]>("load_repos");
			} catch {
				return [];
			}
		},

		saveRepos: async (repos: Repo[]): Promise<void> => {
			try {
				await invokeCommand<void>("save_repos", { repos });
			} catch (error) {
				console.error("[tauri-desktop-api] saveRepos failed", error);
			}
		},

		loadWorkspaceMetadata: async (
			repoPath: string,
		): Promise<RepoMetadata | null> => {
			try {
				return await invokeCommand<RepoMetadata | null>(
					"load_workspace_metadata",
					{ repo_path: repoPath },
				);
			} catch {
				return null;
			}
		},

		saveWorkspaceMetadata: async (
			repoPath: string,
			metadata: RepoMetadata,
		): Promise<void> => {
			try {
				await invokeCommand<void>("save_workspace_metadata", {
					repo_path: repoPath,
					metadata,
				});
			} catch (error) {
				console.error(
					"[tauri-desktop-api] saveWorkspaceMetadata failed",
					error,
				);
			}
		},

		deleteFile: async (
			filePath: string,
			behavior: "system-trash" | "repo-trash" | "ask-every-time",
			repoPath?: string,
		): Promise<{ success: boolean; error?: string }> => {
			try {
				return await invokeCommand<{ success: boolean; error?: string }>(
					"delete_file",
					{
						file_path: filePath,
						behavior,
						repo_path: repoPath,
					},
				);
			} catch (error) {
				return { success: false, error: toErrorMessage(error) };
			}
		},

		startRepoWatch: async (
			repoPath: string,
		): Promise<{ success: boolean; error?: string }> => {
			try {
				return await invokeCommand<{ success: boolean; error?: string }>(
					"start_repo_watch",
					{ repo_path: repoPath },
				);
			} catch (error) {
				return { success: false, error: toErrorMessage(error) };
			}
		},

		stopRepoWatch: async (): Promise<{ success: boolean }> => {
			try {
				return await invokeCommand<{ success: boolean }>("stop_repo_watch");
			} catch {
				return { success: false };
			}
		},

		onRepoFsChanged: (
			callback: (event: RepoWatchEvent) => void,
		): (() => void) => {
			const subscription = listen<RepoWatchEvent>(
				"repo-fs-changed",
				(event) => {
					callback(event.payload);
				},
			);

			return () => {
				void subscription
					.then((unlisten) => {
						unlisten();
					})
					.catch((error) => {
						console.error(
							"[tauri-desktop-api] repo watch unlisten failed",
							error,
						);
					});
			};
		},

		getGitStatus: async (
			repoPath: string,
		): Promise<{
			success: boolean;
			data?: GitStatusSummary;
			error?: string;
		}> => {
			try {
				return await invokeCommand<{
					success: boolean;
					data?: GitStatusSummary;
					error?: string;
				}>("get_git_status", {
					repo_path: repoPath,
				});
			} catch (error) {
				return { success: false, error: toErrorMessage(error) };
			}
		},

		getGitDiff: async (
			repoPath: string,
			filePath: string,
			group: GitChangeGroup,
		): Promise<{ success: boolean; data?: GitDiffResult; error?: string }> => {
			try {
				return await invokeCommand<{
					success: boolean;
					data?: GitDiffResult;
					error?: string;
				}>("get_git_diff", {
					repo_path: repoPath,
					file_path: filePath,
					group,
				});
			} catch (error) {
				return { success: false, error: toErrorMessage(error) };
			}
		},

		stageGitFile: async (
			repoPath: string,
			filePath: string,
		): Promise<{ success: boolean; error?: string }> => {
			try {
				return await invokeCommand<{ success: boolean; error?: string }>(
					"stage_git_file",
					{ repo_path: repoPath, file_path: filePath },
				);
			} catch (error) {
				return { success: false, error: toErrorMessage(error) };
			}
		},

		stageAllGitChanges: async (
			repoPath: string,
		): Promise<{ success: boolean; error?: string }> => {
			try {
				return await invokeCommand<{ success: boolean; error?: string }>(
					"stage_all_git_changes",
					{ repo_path: repoPath },
				);
			} catch (error) {
				return { success: false, error: toErrorMessage(error) };
			}
		},

		unstageGitFile: async (
			repoPath: string,
			filePath: string,
		): Promise<{ success: boolean; error?: string }> => {
			try {
				return await invokeCommand<{ success: boolean; error?: string }>(
					"unstage_git_file",
					{ repo_path: repoPath, file_path: filePath },
				);
			} catch (error) {
				return { success: false, error: toErrorMessage(error) };
			}
		},

		syncGitPull: async (
			repoPath: string,
			remoteName?: string,
		): Promise<{ success: boolean; error?: string }> => {
			try {
				return await invokeCommand<{ success: boolean; error?: string }>(
					"sync_git_pull",
					{ repo_path: repoPath, remote_name: remoteName },
				);
			} catch (error) {
				return { success: false, error: toErrorMessage(error) };
			}
		},

		commitGitChanges: async (
			repoPath: string,
			message: string,
		): Promise<{ success: boolean; error?: string }> => {
			try {
				return await invokeCommand<{ success: boolean; error?: string }>(
					"commit_git_changes",
					{ repo_path: repoPath, message },
				);
			} catch (error) {
				return { success: false, error: toErrorMessage(error) };
			}
		},

		checkForUpdates: async (): Promise<{
			supported: boolean;
			message?: string;
		}> => {
			try {
				return await invokeCommand<{ supported: boolean; message?: string }>(
					"check_for_updates",
				);
			} catch (error) {
				return { supported: false, message: toErrorMessage(error) };
			}
		},

		installUpdate: async (): Promise<{ ok: boolean; message?: string }> => {
			try {
				return await invokeCommand<{ ok: boolean; message?: string }>(
					"install_update",
				);
			} catch (error) {
				return { ok: false, message: toErrorMessage(error) };
			}
		},

		getAppVersion: async (): Promise<string> => {
			try {
				return await invokeCommand<string>("get_app_version");
			} catch {
				return "tauri";
			}
		},

		fetchReleasesFeed: async (): Promise<{
			success: boolean;
			data?: string;
			error?: string;
		}> => {
			try {
				return await invokeCommand<{
					success: boolean;
					data?: string;
					error?: string;
				}>("fetch_releases_feed");
			} catch (error) {
				return { success: false, error: toErrorMessage(error) };
			}
		},

		onUpdateEvent: (callback: (event: UpdateEvent) => void): (() => void) => {
			const subscription = listen<UpdateEvent>("update-event", (event) => {
				callback(event.payload);
			});

			return () => {
				void subscription
					.then((unlisten) => {
						unlisten();
					})
					.catch((error) => {
						console.error("[tauri-desktop-api] update unlisten failed", error);
					});
			};
		},

		loadGlobalSettings: async (): Promise<{
			success: boolean;
			data?: unknown;
			error?: string;
		}> => {
			try {
				return await invokeCommand<{
					success: boolean;
					data?: unknown;
					error?: string;
				}>("load_global_settings");
			} catch (error) {
				return { success: false, error: toErrorMessage(error) };
			}
		},

		saveGlobalSettings: async (
			settings: unknown,
		): Promise<{ success: boolean; error?: string }> => {
			try {
				return await invokeCommand<{ success: boolean; error?: string }>(
					"save_global_settings",
					{ settings },
				);
			} catch (error) {
				return { success: false, error: toErrorMessage(error) };
			}
		},
	};

	return api;
}
