import fs from "node:fs";
import path from "node:path";
import { app, type BrowserWindow } from "electron";

type UpdateEventPayload =
	| { type: "checking" }
	| { type: "available"; version: string; releaseNotes?: string | null }
	| { type: "not-available"; version: string }
	| {
			type: "progress";
			percent: number;
			transferred: number;
			total: number;
	  }
	| { type: "downloaded"; version: string }
	| { type: "error"; message: string };

let updateWindow: BrowserWindow | null = null;
let updaterInitialized = false;
let updaterInstance: typeof import("electron-updater")["autoUpdater"] | null =
	null;

function sendUpdateEvent(payload: UpdateEventPayload) {
	if (updateWindow && !updateWindow.isDestroyed()) {
		updateWindow.webContents.send("update-event", payload);
	}
}

export function registerUpdateWindow(win: BrowserWindow) {
	updateWindow = win;
}

/**
 * Initialize auto-updater for the application
 * Only works in packaged Windows builds
 */
export async function initAutoUpdater(): Promise<void> {
	// Only enable auto-update for Windows in production builds
	const isDev = process.env.NODE_ENV === "development" || !app.isPackaged;
	const updateConfigPath = path.join(process.resourcesPath, "app-update.yml");
	const hasUpdateConfig = fs.existsSync(updateConfigPath);

	if (
		process.platform !== "win32" ||
		isDev ||
		updaterInitialized ||
		!hasUpdateConfig
	) {
		return;
	}
	try {
		const { autoUpdater } = await import("electron-updater");
		const log = require("electron-log");

		updaterInstance = autoUpdater;
		updaterInitialized = true;

		// Configure logger
		log.transports.file.level = "info";
		autoUpdater.logger = log;

		// Auto-updater settings
		autoUpdater.autoDownload = true;
		autoUpdater.allowPrerelease = true; // Allow checking prerelease versions
		if ("disableWebInstaller" in autoUpdater) {
			// Avoid web installer mode for NSIS
			(autoUpdater as { disableWebInstaller: boolean }).disableWebInstaller =
				true;
		}

		autoUpdater.on("checking-for-update", () => {
			log.info("Auto-updater: Checking for updates...");
			sendUpdateEvent({ type: "checking" });
		});

		autoUpdater.on("update-available", (info) => {
			log.info("Auto-updater: Update available:", info.version);
			sendUpdateEvent({
				type: "available",
				version: info.version,
				releaseNotes:
					typeof info.releaseNotes === "string" ? info.releaseNotes : null,
			});
		});

		autoUpdater.on("update-not-available", (info) => {
			log.info(
				"Auto-updater: Update not available. Current version:",
				info.version,
			);
			sendUpdateEvent({ type: "not-available", version: info.version });
		});

		autoUpdater.on("download-progress", (progressObj) => {
			log.info(
				`Auto-updater: Download progress: ${progressObj.percent.toFixed(2)}% (${progressObj.transferred}/${progressObj.total})`,
			);
			sendUpdateEvent({
				type: "progress",
				percent: progressObj.percent,
				transferred: progressObj.transferred,
				total: progressObj.total,
			});
		});

		autoUpdater.on("update-downloaded", (info) => {
			log.info("Auto-updater: Update downloaded successfully:", info.version);
			sendUpdateEvent({ type: "downloaded", version: info.version });
		});

		autoUpdater.on("error", (err) => {
			log.error("Auto-updater error:", err);
			sendUpdateEvent({
				type: "error",
				message: err?.message ?? String(err),
			});
		});

		// Delay check to allow app to finish startup
		setTimeout(() => {
			autoUpdater.checkForUpdatesAndNotify().catch((e) => {
				const message = e instanceof Error ? e.message : String(e);
				log.error("Auto-updater: checkForUpdatesAndNotify failed:", e);
				sendUpdateEvent({
					type: "error",
					message,
				});
			});
		}, 2000);

		log.info("Auto-updater initialized successfully");
	} catch (err) {
		console.warn("Auto-updater not available:", err);
	}
}

export async function checkForUpdates(): Promise<{
	supported: boolean;
	message?: string;
}> {
	const isDev = process.env.NODE_ENV === "development" || !app.isPackaged;
	if (process.platform !== "win32" || isDev) {
		return {
			supported: false,
			message: "仅支持 Windows 打包版本的更新检查",
		};
	}

	if (!updaterInitialized || !updaterInstance) {
		await initAutoUpdater();
	}

	if (!updaterInitialized || !updaterInstance) {
		return {
			supported: false,
			message: "自动更新尚未初始化，请稍后再试",
		};
	}
	try {
		await updaterInstance.checkForUpdates();
		return { supported: true };
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		sendUpdateEvent({
			type: "error",
			message,
		});
		return { supported: false, message };
	}
}

export async function installUpdate(): Promise<{
	ok: boolean;
	message?: string;
}> {
	const isDev = process.env.NODE_ENV === "development" || !app.isPackaged;
	if (process.platform !== "win32" || isDev) {
		return { ok: false, message: "仅支持 Windows 打包版本安装更新" };
	}

	if (!updaterInitialized || !updaterInstance) {
		await initAutoUpdater();
	}
	if (!updaterInitialized || !updaterInstance) {
		return { ok: false, message: "自动更新尚未初始化" };
	}
	try {
		updaterInstance.quitAndInstall(false, true);
		return { ok: true };
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return { ok: false, message };
	}
}
