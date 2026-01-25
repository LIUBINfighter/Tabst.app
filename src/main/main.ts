import fs from "node:fs";
import https from "node:https";
import path from "node:path";
import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import {
	checkForUpdates,
	initAutoUpdater,
	installUpdate,
	registerUpdateWindow,
} from "./autoUpdater";

// 这里的 env 变量由 cross-env 在 package.json 中注入
// 只要 NODE_ENV 是 development，或者应用没有打包(isPackaged 为 false)，都算是开发环境
const isDev = process.env.NODE_ENV === "development" || !app.isPackaged;

// 获取默认保存目录：用户文档目录下的 tabst 文件夹
function getDefaultSaveDir(): string {
	const documentsDir = app.getPath("documents");
	const tabstDir = path.join(documentsDir, "tabst");

	// 确保目录存在
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
		// 开发模式：加载 Vite 服务
		win.loadURL("http://127.0.0.1:7777");
		win.webContents.openDevTools();
	} else {
		// 生产模式：加载打包文件
		// Vite output may put index.html at dist/index.html or dist/src/renderer/index.html
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
			// Fall back to original for safety
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

// IPC 处理器

// 打开文件对话框并读取文件
ipcMain.handle("open-file", async (_event, extensions: string[]) => {
	const filters = [
		{
			name: "支持的文件",
			extensions: extensions.map((ext) => ext.replace(".", "")),
		},
	];

	const result = await dialog.showOpenDialog({
		properties: ["openFile"],
		filters,
	});

	if (result.canceled || result.filePaths.length === 0) {
		return null;
	}

	const filePath = result.filePaths[0];
	const content = fs.readFileSync(filePath, "utf-8");
	const name = path.basename(filePath);

	return { path: filePath, name, content };
});

// 创建新文件
ipcMain.handle("create-file", async (_event, ext?: string) => {
	const saveDir = getDefaultSaveDir();

	// Normalize extension (accepts 'md', '.md', 'atex', '.atex')
	let normalizedExt = ".md";
	try {
		if (ext && typeof ext === "string") {
			normalizedExt = ext.startsWith(".") ? ext : `.${ext}`;
		}
	} catch {}

	// 生成唯一文件名
	const timestamp = Date.now();
	const fileName = `untitled_${timestamp}${normalizedExt}`;
	const filePath = path.join(saveDir, fileName);

	// 创建空文件
	fs.writeFileSync(filePath, "", "utf-8");

	return { path: filePath, name: fileName, content: "" };
});

// 保存文件
ipcMain.handle(
	"save-file",
	async (_event, filePath: string, content: string) => {
		try {
			fs.writeFileSync(filePath, content, "utf-8");
			return { success: true };
		} catch (error) {
			console.error("保存文件失败:", error);
			return { success: false, error: String(error) };
		}
	},
);

// 重命名（复制 + 删除原文件）
ipcMain.handle(
	"rename-file",
	async (_event, oldPath: string, newName: string) => {
		try {
			const dir = path.dirname(oldPath);
			const newPath = path.join(dir, newName);
			// 如果路径一样，什么都不用做
			if (newPath === oldPath)
				return { success: true, newPath, newName: path.basename(newPath) };
			// 如果目标已经存在，则失败
			if (fs.existsSync(newPath)) {
				return { success: false, error: "target-exists" };
			}

			// 复制文件到新路径
			await fs.promises.copyFile(oldPath, newPath);

			// 删除原文件
			await fs.promises.unlink(oldPath);

			return { success: true, newPath, newName: path.basename(newPath) };
		} catch (err) {
			console.error("rename-file failed:", err);
			return { success: false, error: String(err) };
		}
	},
);

// Reveal file in system file manager
ipcMain.handle("reveal-in-folder", async (_event, filePath: string) => {
	try {
		// shell.showItemInFolder will reveal the file and select it
		const ok = shell.showItemInFolder(filePath);
		return { success: ok };
	} catch (err) {
		console.error("reveal-in-folder failed:", err);
		return { success: false, error: String(err) };
	}
});

// Read a local asset reliably in dev and packaged environments
ipcMain.handle("read-asset", async (_event, relPath: string) => {
	// Candidate paths to try in dev and prod
	const candidates: string[] = [];
	try {
		// Vite dev may keep public assets in project root /public
		candidates.push(path.join(app.getAppPath(), "public", relPath));
	} catch {}
	try {
		// Dist assets if built into dist
		candidates.push(path.join(app.getAppPath(), "dist", relPath));
	} catch {}
	try {
		// Dist assets if built into dist
		candidates.push(path.join(app.getAppPath(), "dist", relPath));
	} catch {}
	// Packaged: resourcesPath may include dist or app.asar unpacked resources
	try {
		candidates.push(path.join(process.resourcesPath, relPath));
		candidates.push(path.join(process.resourcesPath, "dist", relPath));
	} catch {}

	for (const candidate of candidates) {
		try {
			if (fs.existsSync(candidate)) {
				const data = await fs.promises.readFile(candidate);
				// Return as Uint8Array to be safe and serializable
				return new Uint8Array(data);
			}
		} catch {
			// ignore and continue
		}
	}

	// If nothing found, throw to inform renderer
	throw new Error(
		`Asset not found: ${relPath} (tried: ${candidates.join(", ")})`,
	);
});

// Auto-update handlers
ipcMain.handle("check-for-updates", async () => {
	return checkForUpdates();
});

ipcMain.handle("install-update", async () => {
	return installUpdate();
});

// Get app version
ipcMain.handle("get-app-version", async () => {
	return app.getVersion();
});

// Fetch GitHub releases RSS feed (bypasses CORS)
// Security: Hardcoded URL, size limit, timeout protection
ipcMain.handle("fetch-releases-feed", async () => {
	return new Promise<{ success: boolean; data?: string; error?: string }>(
		(resolve) => {
			// Security: Hardcoded URL to prevent SSRF
			const url = "https://github.com/LIUBINfighter/Tabst.app/releases.atom";
			const urlObj = new URL(url);

			// Security: Validate hostname (only allow github.com)
			if (urlObj.hostname !== "github.com") {
				resolve({
					success: false,
					error: "Invalid hostname",
				});
				return;
			}

			// Security: Maximum response size (5MB)
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
				// Security: Check Content-Length header
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
					// Security: Enforce size limit during streaming
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

			req.on("error", (_err) => {
				// Security: Don't leak internal error details
				resolve({
					success: false,
					error: "Network error",
				});
			});

			// Security: Request timeout (10 seconds)
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

// App state persistence ---------------------------------------------------
// Keep metadata (id, path, name) of opened/created files and activeFileId
function getAppStatePath(): string {
	const dataDir = app.getPath("userData");
	const stateFile = path.join(dataDir, "app-state.json");
	return stateFile;
}

ipcMain.handle("load-app-state", async () => {
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

		// Read content for each file that still exists
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

		// Ensure activeFileId is valid
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
});

ipcMain.handle(
	"save-app-state",
	async (
		_event,
		state: {
			files: { id: string; name: string; path: string }[];
			activeFileId: string | null;
		},
	) => {
		const stateFile = getAppStatePath();
		try {
			const json = JSON.stringify(state, null, 2);
			fs.writeFileSync(stateFile, json, "utf-8");
			return { success: true };
		} catch (err) {
			console.error("Failed to save app state:", err);
			return { success: false, error: String(err) };
		}
	},
);
