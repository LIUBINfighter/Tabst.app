import type { RepoMetadata } from "../types/repo";

type WorkspaceUpdater = (
	existing: RepoMetadata | null,
) => RepoMetadata | Promise<RepoMetadata>;

const writeQueueByRepoPath = new Map<string, Promise<void>>();

function enqueueWorkspaceWrite(
	repoPath: string,
	work: () => Promise<void>,
): Promise<void> {
	const previous = writeQueueByRepoPath.get(repoPath) ?? Promise.resolve();
	const current = previous.catch(() => undefined).then(work);
	writeQueueByRepoPath.set(repoPath, current);

	void current.finally(() => {
		if (writeQueueByRepoPath.get(repoPath) === current) {
			writeQueueByRepoPath.delete(repoPath);
		}
	});

	return current;
}

export async function loadWorkspaceMetadata(
	repoPath: string,
): Promise<RepoMetadata | null> {
	if (!window.desktopAPI?.loadWorkspaceMetadata) {
		return null;
	}

	return window.desktopAPI.loadWorkspaceMetadata(repoPath);
}

export async function updateWorkspaceMetadata(
	repo: { id: string; name: string; path: string },
	updater: WorkspaceUpdater,
): Promise<void> {
	if (
		!window.desktopAPI?.loadWorkspaceMetadata ||
		!window.desktopAPI?.saveWorkspaceMetadata
	) {
		throw new Error("workspace-metadata-api-unavailable");
	}

	await enqueueWorkspaceWrite(repo.path, async () => {
		const existing =
			(await window.desktopAPI.loadWorkspaceMetadata(repo.path)) ?? null;
		const next = await updater(existing);
		await window.desktopAPI.saveWorkspaceMetadata(repo.path, next);
	});
}
