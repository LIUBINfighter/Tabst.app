import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadSoundFontFromUrl } from "./assets";

function buildSoundFontBytes(size = 4096): Uint8Array {
	const bytes = new Uint8Array(size);
	bytes.set([0x52, 0x49, 0x46, 0x46], 0); // RIFF
	bytes.set([0x73, 0x66, 0x62, 0x6b], 8); // sfbk
	return bytes;
}

function buildHtmlBytes(): Uint8Array {
	return new TextEncoder().encode(
		"<!doctype html><html><head><title>404 Not Found</title></head><body>not found</body></html>",
	);
}

interface MockFetchOptions {
	contentType: string;
	payload: Uint8Array;
}

function mockFetchOnce(options: MockFetchOptions): void {
	vi.stubGlobal(
		"fetch",
		vi.fn().mockResolvedValue({
			ok: true,
			headers: {
				get: (name: string) =>
					name.toLowerCase() === "content-type" ? options.contentType : null,
			},
			arrayBuffer: async () => options.payload.buffer,
		}),
	);
}

function createMockApi(): { loadSoundFont: ReturnType<typeof vi.fn> } {
	return { loadSoundFont: vi.fn() };
}

describe("loadSoundFontFromUrl", () => {
	beforeEach(() => {
		vi.unstubAllGlobals();
	});

	it("accepts a valid soundfont when the server reports text/html (Tauri embedded assets)", async () => {
		mockFetchOnce({ contentType: "text/html", payload: buildSoundFontBytes() });
		const api = createMockApi();

		const ok = await loadSoundFontFromUrl(
			api as never,
			"tauri://localhost/assets/sound.sf2",
		);

		expect(ok).toBe(true);
		expect(api.loadSoundFont).toHaveBeenCalledOnce();
	});

	it("rejects text/html content that is not a soundfont payload", async () => {
		mockFetchOnce({ contentType: "text/html", payload: buildHtmlBytes() });
		const api = createMockApi();

		const ok = await loadSoundFontFromUrl(
			api as never,
			"tauri://localhost/assets/missing.sf2",
		);

		expect(ok).toBe(false);
		expect(api.loadSoundFont).not.toHaveBeenCalled();
	});

	it("accepts a valid soundfont with a proper binary content type", async () => {
		mockFetchOnce({
			contentType: "application/octet-stream",
			payload: buildSoundFontBytes(),
		});
		const api = createMockApi();

		const ok = await loadSoundFontFromUrl(
			api as never,
			"https://example.com/assets/sonivox.sf3",
		);

		expect(ok).toBe(true);
		expect(api.loadSoundFont).toHaveBeenCalledOnce();
	});

	it("rejects payloads that are neither soundfont nor HTML", async () => {
		mockFetchOnce({
			contentType: "application/octet-stream",
			payload: new Uint8Array(64),
		});
		const api = createMockApi();

		const ok = await loadSoundFontFromUrl(
			api as never,
			"https://example.com/assets/data.bin",
		);

		expect(ok).toBe(false);
		expect(api.loadSoundFont).not.toHaveBeenCalled();
	});

	it("returns false when the fetch response is not ok", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({ ok: false, status: 404 }),
		);
		const api = createMockApi();

		const ok = await loadSoundFontFromUrl(
			api as never,
			"https://example.com/missing.sf2",
		);

		expect(ok).toBe(false);
		expect(api.loadSoundFont).not.toHaveBeenCalled();
	});
});
