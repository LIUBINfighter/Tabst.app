import fs from "node:fs";
import path from "node:path";
import { app, BrowserWindow, ipcMain } from "electron";
import {
	checkForUpdates,
	initAutoUpdater,
	installUpdate,
	registerUpdateWindow,
} from "./autoUpdater";
import {
	handleCreateFileEffect,
	handleLoadAppStateEffect,
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
	handleLoadReposEffect,
	handleLoadWorkspaceMetadataEffect,
	handleLoadGlobalSettingsEffect,
	handleSaveReposEffect,
	handleSaveWorkspaceMetadataEffect,
	handleSaveGlobalSettingsEffect,
	handleScanDirectoryEffect,
} from "./ipc/repo-operations-effect";

const isDev = process.env.NODE_ENV === "development" || !app.isPackaged;

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

app.on("window-all-closed", () => {
	if (process.platform !== "darwin") app.quit();
});

// IPC Handlers (Effect-based)
ipcMain.handle("open-file", handleOpenFileEffect);
ipcMain.handle("create-file", handleCreateFileEffect);
ipcMain.handle("save-file", handleSaveFileEffect);
ipcMain.handle("rename-file", handleRenameFileEffect);

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
