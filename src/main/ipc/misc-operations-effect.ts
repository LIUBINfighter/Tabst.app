import path from "node:path";
import { Effect, Exit } from "effect";
import { app, dialog, shell } from "electron";
import { fileExists, readFileAsUint8Array } from "../effects/file-system";
import { fetchReleasesFeed } from "../effects/http";

export async function handleRevealInFolderEffect(
	_event: Electron.IpcMainInvokeEvent,
	filePath: string,
): Promise<{ success: boolean; error?: string }> {
	const program = Effect.try({
		try: () => {
			const ok = shell.showItemInFolder(filePath) as boolean | undefined;
			return { success: ok !== false };
		},
		catch: (error) => error,
	});

	const result = await Effect.runPromiseExit(program);
	return Exit.match(result, {
		onFailure: (err) => {
			console.error("reveal-in-folder failed:", err);
			return { success: false, error: String(err) };
		},
		onSuccess: (v) => v,
	});
}

export async function handleReadAssetEffect(
	_event: Electron.IpcMainInvokeEvent,
	relPath: string,
): Promise<Uint8Array> {
	const program = Effect.gen(function* () {
		const candidates: string[] = [];
		try {
			candidates.push(path.join(app.getAppPath(), "public", relPath));
		} catch {}
		try {
			candidates.push(path.join(app.getAppPath(), "dist", relPath));
		} catch {}
		try {
			candidates.push(path.join(process.resourcesPath, relPath));
			candidates.push(path.join(process.resourcesPath, "dist", relPath));
		} catch {}

		for (const candidate of candidates) {
			const exists = yield* fileExists(candidate);
			if (exists) {
				return yield* readFileAsUint8Array(candidate);
			}
		}

		return yield* Effect.fail(
			new Error(
				`Asset not found: ${relPath} (tried: ${candidates.join(", ")})`,
			),
		);
	});

	const result = await Effect.runPromiseExit(program);
	return Exit.match(result, {
		onFailure: (err) => {
			throw err instanceof Error ? err : new Error(String(err));
		},
		onSuccess: (v) => v,
	});
}

const RELEASES_FEED_URL =
	"https://github.com/LIUBINfighter/Tabst.app/releases.atom";

export async function handleFetchReleasesFeedEffect(): Promise<{
	success: boolean;
	data?: string;
	error?: string;
}> {
	const program = fetchReleasesFeed(RELEASES_FEED_URL);

	const result = await Effect.runPromiseExit(program);
	return Exit.match(result, {
		onFailure: (err) => {
			console.error("fetch-releases-feed failed:", err);
			return {
				success: false,
				error: err._tag === "Fail" ? err.error.message : String(err),
			};
		},
		onSuccess: (v) => v,
	});
}

export async function handleSelectFolderEffect(): Promise<string | null> {
	const program = Effect.tryPromise({
		try: async () => {
			const result = await dialog.showOpenDialog({
				properties: ["openDirectory"],
			});
			if (result.canceled || result.filePaths.length === 0) {
				return null;
			}
			return result.filePaths[0];
		},
		catch: (error) => error,
	});

	const result = await Effect.runPromiseExit(program);
	return Exit.match(result, {
		onFailure: (err) => {
			console.error("select-folder failed:", err);
			return null;
		},
		onSuccess: (v) => v,
	});
}
