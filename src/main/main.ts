import fs from "node:fs";
import https from "node:https";
import path from "node:path";
import { app, BrowserWindow, ipcMain, shell } from "electron";
import {
	checkForUpdates,
	initAutoUpdater,
	installUpdate,
	registerUpdateWindow,
} from "./autoUpdater";
import { handleLoadAppState, handleSaveAppState } from "./ipc/app-state";
import {
	handleCreateFile,
	handleOpenFile,
	handleRenameFile,
	handleSaveFile,
} from "./ipc/file-operations";

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

// IPC Handlers
ipcMain.handle("open-file", handleOpenFile);
ipcMain.handle("create-file", handleCreateFile);
ipcMain.handle("save-file", handleSaveFile);
ipcMain.handle("rename-file", handleRenameFile);

ipcMain.handle("reveal-in-folder", async (_event, filePath: string) => {
	try {
		const ok = shell.showItemInFolder(filePath);
		return { success: ok };
	} catch (err) {
		console.error("reveal-in-folder failed:", err);
		return { success: false, error: String(err) };
	}
});

ipcMain.handle("read-asset", async (_event, relPath: string) => {
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
		try {
			if (fs.existsSync(candidate)) {
				const data = await fs.promises.readFile(candidate);
				return new Uint8Array(data);
			}
		} catch {}
	}

	throw new Error(
		`Asset not found: ${relPath} (tried: ${candidates.join(", ")})`,
	);
});

ipcMain.handle("check-for-updates", async () => {
	return checkForUpdates();
});

ipcMain.handle("install-update", async () => {
	return installUpdate();
});

ipcMain.handle("get-app-version", async () => {
	return app.getVersion();
});

ipcMain.handle("fetch-releases-feed", async () => {
	return new Promise<{ success: boolean; data?: string; error?: string }>(
		(resolve) => {
			const url = "https://github.com/LIUBINfighter/Tabst.app/releases.atom";
			const urlObj = new URL(url);

			if (urlObj.hostname !== "github.com") {
				resolve({
					success: false,
					error: "Invalid hostname",
				});
				return;
			}

			const MAX_RESPONSE_SIZE = 5 * 1024 * 1024;
			let data = "";
			let totalSize = 0;

			const options = {
				hostname: urlObj.hostname,
				path: urlObj.pathname + urlObj.search,
				method: "GET",
				headers: {
					"User-Agent": "Tabst/1.0",
				},
			};

			const req = https.request(options, (res) => {
				const contentLength = res.headers["content-length"];
				if (
					contentLength &&
					Number.parseInt(contentLength, 10) > MAX_RESPONSE_SIZE
				) {
					res.destroy();
					resolve({
						success: false,
						error: "Response too large",
					});
					return;
				}

				res.on("data", (chunk) => {
					totalSize += chunk.length;
					if (totalSize > MAX_RESPONSE_SIZE) {
						res.destroy();
						resolve({
							success: false,
							error: "Response too large",
						});
						return;
					}
					data += chunk.toString("utf-8");
				});

				res.on("end", () => {
					if (res.statusCode === 200) {
						resolve({ success: true, data });
					} else {
						resolve({
							success: false,
							error: `HTTP ${res.statusCode}`,
						});
					}
				});
			});

			req.on("error", () => {
				resolve({
					success: false,
					error: "Network error",
				});
			});

			req.setTimeout(10000, () => {
				req.destroy();
				resolve({
					success: false,
					error: "Request timeout",
				});
			});

			req.end();
		},
	);
});

ipcMain.handle("load-app-state", handleLoadAppState);
ipcMain.handle("save-app-state", handleSaveAppState);
