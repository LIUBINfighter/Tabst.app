import { beforeEach, describe, expect, it, vi } from "vitest";
import { createWebDesktopAPI, shouldUseTauriDesktopApi } from "./desktop-api";

class MemoryStorage {
	private values = new Map<string, string>();

	getItem(key: string) {
		return this.values.has(key) ? (this.values.get(key) ?? null) : null;
	}

	setItem(key: string, value: string) {
		this.values.set(key, value);
	}

	removeItem(key: string) {
		this.values.delete(key);
	}

	clear() {
		this.values.clear();
	}
}

type MockInputElement = {
	type: string;
	accept?: string;
	multiple?: boolean;
	files: File[] | null;
	onchange: null | (() => void);
	click: () => void;
	webkitdirectory?: boolean;
};

let nextPickedFiles: File[] = [];

beforeEach(() => {
	const localStorage = new MemoryStorage();

	Object.defineProperty(globalThis, "window", {
		value: {
			open: vi.fn(),
			localStorage,
		},
		configurable: true,
	});

	Object.defineProperty(globalThis, "document", {
		value: {
			createElement: vi.fn((): MockInputElement => {
				const input: MockInputElement = {
					type: "file",
					files: null,
					onchange: null,
					click: () => {
						input.files = nextPickedFiles;
						input.onchange?.();
					},
				};
				return input;
			}),
		},
		configurable: true,
	});

	nextPickedFiles = [];
});

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

	it("opens external links through the web runtime bridge", async () => {
		const api = createWebDesktopAPI();
		const result = await api.openExternal("https://example.com/docs");

		expect(result).toEqual({ success: true });
		expect(window.open).toHaveBeenCalledWith(
			"https://example.com/docs",
			"_blank",
			"noopener,noreferrer",
		);
	});

	it("preserves binary gp bytes when importing through openFile", async () => {
		const api = createWebDesktopAPI();
		const originalBytes = Uint8Array.from([0, 255, 254, 65, 0, 66, 67]);
		nextPickedFiles = [
			new File([originalBytes], "song.gp5", {
				type: "application/octet-stream",
			}),
		];

		const result = await api.openFile([".gp5"]);
		expect(result).not.toBeNull();

		const readResult = await api.readFileBytes(result?.path ?? "");
		expect(Array.from(readResult.data ?? [])).toEqual(
			Array.from(originalBytes),
		);
	});

	it("preserves binary gp bytes when importing a directory in web runtime", async () => {
		const api = createWebDesktopAPI();
		const originalBytes = Uint8Array.from([71, 80, 53, 0, 255, 10, 13]);
		const file = new File([originalBytes], "riff.gp5", {
			type: "application/octet-stream",
		});
		Object.defineProperty(file, "webkitRelativePath", {
			value: "session/riff.gp5",
			configurable: true,
		});
		nextPickedFiles = [file];

		const repoPath = await api.selectFolder();
		expect(repoPath).toBeTruthy();

		const tree = await api.scanDirectory(repoPath ?? "");
		const importedPath = tree?.nodes[0]?.path ?? "";
		const readResult = await api.readFileBytes(importedPath);
		expect(Array.from(readResult.data ?? [])).toEqual(
			Array.from(originalBytes),
		);
	});
});
