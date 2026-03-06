import { describe, expect, it } from "vitest";
import { shouldUseTauriElectronApi } from "./web-electron-api";

describe("tauri runtime detection", () => {
	it("detects tauri when TAURI_ENV_PLATFORM is present", () => {
		expect(
			shouldUseTauriElectronApi({
				tauriEnvPlatform: "darwin",
				hasTauriInternals: false,
				hasTauriGlobal: false,
				hasTauriIpc: false,
				protocol: "http:",
				hostname: "127.0.0.1",
				userAgent: "Mozilla/5.0",
			}),
		).toBe(true);
	});

	it("detects tauri when bridge globals exist", () => {
		expect(
			shouldUseTauriElectronApi({
				tauriEnvPlatform: undefined,
				hasTauriInternals: true,
				hasTauriGlobal: false,
				hasTauriIpc: false,
				protocol: "http:",
				hostname: "localhost",
				userAgent: "Mozilla/5.0",
			}),
		).toBe(true);
	});

	it("detects tauri by user agent fallback", () => {
		expect(
			shouldUseTauriElectronApi({
				tauriEnvPlatform: undefined,
				hasTauriInternals: false,
				hasTauriGlobal: false,
				hasTauriIpc: false,
				protocol: "http:",
				hostname: "127.0.0.1",
				userAgent: "Mozilla/5.0 Tauri/2.0",
			}),
		).toBe(true);
	});

	it("keeps web fallback for plain browser runtime", () => {
		expect(
			shouldUseTauriElectronApi({
				tauriEnvPlatform: undefined,
				hasTauriInternals: false,
				hasTauriGlobal: false,
				hasTauriIpc: false,
				protocol: "https:",
				hostname: "tabst.app",
				userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X)",
			}),
		).toBe(false);
	});
});
