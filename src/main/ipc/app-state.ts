import fs from "node:fs";
import path from "node:path";
import { app } from "electron";

export function getAppStatePath(): string {
	const dataDir = app.getPath("userData");
	return path.join(dataDir, "app-state.json");
}

export async function handleLoadAppState() {
	const stateFile = getAppStatePath();

	if (!fs.existsSync(stateFile)) {
		return { files: [], activeFileId: null };
	}

	try {
		const raw = fs.readFileSync(stateFile, "utf-8");
		const state = JSON.parse(raw) as {
			files: { id: string; name: string; path: string }[];
			activeFileId: string | null;
		};

		const files = state.files
			.map((f) => {
				try {
					if (fs.existsSync(f.path)) {
						const content = fs.readFileSync(f.path, "utf-8");
						return {
							id: f.id,
							name: f.name,
							path: f.path,
							content,
						};
					}
				} catch (e) {
					console.warn("Failed to read file for restore:", f.path, e);
				}
				return null;
			})
			.filter(Boolean) as {
			id: string;
			name: string;
			path: string;
			content: string;
		}[];

		const activeFileId = files.some((f) => f.id === state.activeFileId)
			? state.activeFileId
			: files.length > 0
				? files[0].id
				: null;

		return { files, activeFileId };
	} catch (err) {
		console.error("Failed to load app state:", err);
		return { files: [], activeFileId: null };
	}
}

export async function handleSaveAppState(
	_event: Electron.IpcMainInvokeEvent,
	state: {
		files: { id: string; name: string; path: string }[];
		activeFileId: string | null;
	},
) {
	const stateFile = getAppStatePath();
	try {
		const json = JSON.stringify(state, null, 2);
		fs.writeFileSync(stateFile, json, "utf-8");
		return { success: true };
	} catch (err) {
		console.error("Failed to save app state:", err);
		return { success: false, error: String(err) };
	}
}
