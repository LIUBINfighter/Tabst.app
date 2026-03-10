import { describe, expect, it } from "vitest";
import { shouldUseTauriDesktopApi } from "./desktop-api";

describe("tauri runtime detection", () => {
	it("does not treat TAURI_ENV_PLATFORM alone as a runtime signal", () => {
		expect(
			shouldUseTauriDesktopApi({
				hasTauriInternals: false,
				hasTauriGlobal: false,
				hasTauriIpc: false,
				protocol: "http:",
				hostname: "127.0.0.1",
				userAgent: "Mozilla/5.0",
			}),
		).toBe(false);
	});

	it("detects tauri when bridge globals exist", () => {
		expect(
			shouldUseTauriDesktopApi({
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
			shouldUseTauriDesktopApi({
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
			shouldUseTauriDesktopApi({
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
