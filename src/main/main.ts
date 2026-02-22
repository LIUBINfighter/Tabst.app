import fs from "node:fs";
import path from "node:path";
import { app, BrowserWindow, ipcMain, type WebContents } from "electron";
import {
	checkForUpdates,
	initAutoUpdater,
	installUpdate,
	registerUpdateWindow,
} from "./autoUpdater";
import {
	handleCreateFileEffect,
	handleCreateFolderEffect,
	handleLoadAppStateEffect,
	handleMovePathEffect,
	handleOpenFileEffect,
	handleReadFileEffect,
	handleRenameFileEffect,
	handleSaveAppStateEffect,
	handleSaveFileEffect,
} from "./ipc/file-operations-effect";
import {
	handleFetchReleasesFeedEffect,
	handleReadAssetEffect,
	handleRevealInFolderEffect,
	handleSelectFolderEffect,
} from "./ipc/misc-operations-effect";
import {
	handleDeleteFileEffect,
	handleLoadGlobalSettingsEffect,
	handleLoadReposEffect,
	handleLoadWorkspaceMetadataEffect,
	handleSaveGlobalSettingsEffect,
	handleSaveReposEffect,
	handleSaveWorkspaceMetadataEffect,
	handleScanDirectoryEffect,
} from "./ipc/repo-operations-effect";

const isDev = process.env.NODE_ENV === "development" || !app.isPackaged;

interface RepoWatchState {
	repoPath: string;
	watcher: fs.FSWatcher;
}

const repoWatchersByWebContents = new Map<number, RepoWatchState>();

function stopRepoWatchForSender(webContentsId: number) {
	const existing = repoWatchersByWebContents.get(webContentsId);
	if (!existing) return;

	try {
		existing.watcher.close();
	} catch (err) {
		console.error("[repo-watch] close failed:", err);
	}
	repoWatchersByWebContents.delete(webContentsId);
}

function stopAllRepoWatches() {
	for (const webContentsId of repoWatchersByWebContents.keys()) {
		stopRepoWatchForSender(webContentsId);
	}
}

function sendRepoFsChanged(
	sender: WebContents,
	repoPath: string,
	eventType: string,
	changedPath?: string,
) {
	try {
		sender.send("repo-fs-changed", {
			repoPath,
			eventType,
			changedPath,
		});
	} catch (err) {
		console.error("[repo-watch] send event failed:", err);
	}
}

async function handleStartRepoWatch(
	event: Electron.IpcMainInvokeEvent,
	repoPath: string,
): Promise<{ success: boolean; error?: string }> {
	const sender = event.sender;
	const webContentsId = sender.id;

	const normalizedRepoPath = repoPath?.trim();
	if (!normalizedRepoPath) {
		return { success: false, error: "invalid-repo-path" };
	}

	try {
		const existing = repoWatchersByWebContents.get(webContentsId);
		if (existing?.repoPath === normalizedRepoPath) {
			return { success: true };
		}

		if (existing) {
			stopRepoWatchForSender(webContentsId);
		}

		const watcher = fs.watch(
			normalizedRepoPath,
			{ recursive: true },
			(eventType, filename) => {
				const changedPath =
					typeof filename === "string"
						? path.join(normalizedRepoPath, filename)
						: undefined;
				sendRepoFsChanged(sender, normalizedRepoPath, eventType, changedPath);
			},
		);

		watcher.on("error", (err) => {
			console.error("[repo-watch] watcher error:", err);
			sendRepoFsChanged(sender, normalizedRepoPath, "error");
		});

		repoWatchersByWebContents.set(webContentsId, {
			repoPath: normalizedRepoPath,
			watcher,
		});

		const cleanup = () => {
			stopRepoWatchForSender(webContentsId);
			sender.removeListener("destroyed", cleanup);
		};
		sender.once("destroyed", cleanup);

		return { success: true };
	} catch (err) {
		console.error("[repo-watch] start failed:", err);
		return {
			success: false,
			error: err instanceof Error ? err.message : "unknown-error",
		};
	}
}

async function handleStopRepoWatch(
	event: Electron.IpcMainInvokeEvent,
): Promise<{ success: boolean }> {
	stopRepoWatchForSender(event.sender.id);
	return { success: true };
}

function _getDefaultSaveDir(): string {
	const documentsDir = app.getPath("documents");
	const tabstDir = path.join(documentsDir, "tabst");

	if (!fs.existsSync(tabstDir)) {
		fs.mkdirSync(tabstDir, { recursive: true });
	}

	return tabstDir;
}

function createWindow() {
	const win = new BrowserWindow({
		webPreferences: {
			preload: path.join(__dirname, "preload.cjs"),
			nodeIntegration: false,
			contextIsolation: true,
		},
	});

	if (isDev) {
		win.loadURL("http://127.0.0.1:7777");
		win.webContents.openDevTools();
	} else {
		const indexPaths = [
			path.join(__dirname, "../dist/index.html"),
			path.join(__dirname, "../dist/src/renderer/index.html"),
		];

		const exists = indexPaths.find((p) => {
			try {
				return fs.existsSync(p);
			} catch {
				return false;
			}
		});

		if (exists) {
			win.loadFile(exists);
		} else {
			win.loadFile(path.join(__dirname, "../dist/index.html"));
		}
	}

	return win;
}

app.whenReady().then(() => {
	const win = createWindow();
	registerUpdateWindow(win);
	initAutoUpdater();
});

app.on("before-quit", () => {
	stopAllRepoWatches();
});

app.on("window-all-closed", () => {
	stopAllRepoWatches();
	if (process.platform !== "darwin") app.quit();
});

// IPC Handlers (Effect-based)
ipcMain.handle("open-file", handleOpenFileEffect);
ipcMain.handle("create-file", handleCreateFileEffect);
ipcMain.handle("create-folder", handleCreateFolderEffect);
ipcMain.handle("save-file", handleSaveFileEffect);
ipcMain.handle("rename-file", handleRenameFileEffect);
ipcMain.handle("move-path", handleMovePathEffect);

ipcMain.handle("reveal-in-folder", handleRevealInFolderEffect);
ipcMain.handle("read-asset", handleReadAssetEffect);
ipcMain.handle("fetch-releases-feed", handleFetchReleasesFeedEffect);

ipcMain.handle("check-for-updates", async () => checkForUpdates());
ipcMain.handle("install-update", async () => installUpdate());
ipcMain.handle("get-app-version", async () => app.getVersion());

ipcMain.handle("load-app-state", handleLoadAppStateEffect);
ipcMain.handle("save-app-state", handleSaveAppStateEffect);
ipcMain.handle("read-file", handleReadFileEffect);

ipcMain.handle("scan-directory", handleScanDirectoryEffect);
ipcMain.handle("load-repos", handleLoadReposEffect);
ipcMain.handle("save-repos", handleSaveReposEffect);
ipcMain.handle("load-workspace-metadata", handleLoadWorkspaceMetadataEffect);
ipcMain.handle("save-workspace-metadata", handleSaveWorkspaceMetadataEffect);
ipcMain.handle("delete-file", handleDeleteFileEffect);
ipcMain.handle("select-folder", handleSelectFolderEffect);
ipcMain.handle("load-global-settings", handleLoadGlobalSettingsEffect);
ipcMain.handle("save-global-settings", handleSaveGlobalSettingsEffect);

ipcMain.handle("start-repo-watch", handleStartRepoWatch);
ipcMain.handle("stop-repo-watch", handleStopRepoWatch);
