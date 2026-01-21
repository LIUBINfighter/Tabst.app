import { BrowserWindow, dialog } from "electron";

/**
 * Initialize auto-updater for the application
 * Only works in packaged Windows builds
 */
export async function initAutoUpdater(): Promise<void> {
	// Only enable auto-update for Windows in production builds
	const isDev =
		process.env.NODE_ENV === "development" ||
		!require("electron").app.isPackaged;

	if (process.platform !== "win32" || isDev) {
		return;
	}

	try {
		const { autoUpdater } = await import("electron-updater");
		const log = require("electron-log");

		// Configure logger
		log.transports.file.level = "info";
		autoUpdater.logger = log;

		// Auto-updater settings
		autoUpdater.autoDownload = true;
		autoUpdater.allowPrerelease = true; // Allow checking prerelease versions

		// Event: Checking for updates
		autoUpdater.on("checking-for-update", () => {
			log.info("Auto-updater: Checking for updates...");
		});

		// Event: Update available
		autoUpdater.on("update-available", (info) => {
			log.info("Auto-updater: Update available:", info.version);
		});

		// Event: Update not available
		autoUpdater.on("update-not-available", (info) => {
			log.info(
				"Auto-updater: Update not available. Current version:",
				info.version,
			);
		});

		// Event: Download progress
		autoUpdater.on("download-progress", (progressObj) => {
			log.info(
				`Auto-updater: Download progress: ${progressObj.percent.toFixed(2)}% (${progressObj.transferred}/${progressObj.total})`,
			);
		});

		// Event: Update downloaded
		autoUpdater.on("update-downloaded", (info) => {
			log.info("Auto-updater: Update downloaded successfully:", info.version);

			const win = BrowserWindow.getAllWindows()[0];
			if (win) {
				dialog
					.showMessageBox(win, {
						type: "info",
						buttons: ["Install and Restart", "Later"],
						defaultId: 0,
						message:
							"A new update has been downloaded. Install and restart now?",
					})
					.then((result) => {
						if (result.response === 0) {
							log.info("Auto-updater: User chose to install and restart");
							autoUpdater.quitAndInstall(false, true);
						} else {
							log.info("Auto-updater: User chose to install later");
						}
					})
					.catch((err) => {
						log.error("Auto-updater: Error showing dialog:", err);
					});
			} else {
				log.warn("Auto-updater: No window available to show update dialog");
			}
		});

		// Event: Error
		autoUpdater.on("error", (err) => {
			log.error("Auto-updater error:", err);
		});

		// Delay check to allow app to finish startup
		setTimeout(() => {
			autoUpdater.checkForUpdatesAndNotify().catch((e) => {
				log.error("Auto-updater: checkForUpdatesAndNotify failed:", e);
			});
		}, 2000);

		log.info("Auto-updater initialized successfully");
	} catch (err) {
		console.warn("Auto-updater not available:", err);
	}
}
