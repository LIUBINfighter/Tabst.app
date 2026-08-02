import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toAssetProtocolUrl } from "./assets";
import {
	getResourceUrls,
	type ResourceUrlOverrides,
	resolveResourceOverrides,
} from "./resourceLoaderService";

function withWindowLocation(href: string) {
	const location = new URL(href);
	vi.stubGlobal("window", { location });
}

describe("getResourceUrls", () => {
	beforeEach(() => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => ({
				ok: true,
			})),
		);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("keeps existing defaults when no overrides are set", async () => {
		withWindowLocation("https://example.com/app/index.html");

		const urls = await getResourceUrls();

		expect(urls.bravuraFontUrl).toBe(
			"https://example.com/assets/Bravura.woff2",
		);
		expect(urls.soundFontUrl).toBe("https://example.com/assets/sonivox.sf3");
		expect(urls.workerUrl).toBe("https://example.com/assets/alphaTab.min.js");
		expect(urls.bravuraFontDirectory).toBe("https://example.com/assets/");
	});

	it("supports overriding font and soundfont urls", async () => {
		withWindowLocation("https://example.com/app/index.html");

		const urls = await getResourceUrls({
			bravuraFontUrl: "assets/fonts/Petaluma.woff2",
			soundFontUrl: "assets/soundfonts/GeneralUser.sf3",
		} satisfies ResourceUrlOverrides);

		expect(urls.bravuraFontUrl).toBe(
			"https://example.com/assets/fonts/Petaluma.woff2",
		);
		expect(urls.soundFontUrl).toBe(
			"https://example.com/assets/soundfonts/GeneralUser.sf3",
		);
		expect(urls.bravuraFontDirectory).toBe("https://example.com/assets/");
	});

	it("builds a chunked asset protocol url for external soundfonts", () => {
		const url = toAssetProtocolUrl("/Users/jay/External SoundFont.sf2");
		expect(url.startsWith("asset://localhost/")).toBe(true);
		expect(decodeURIComponent(url.replace("asset://localhost/", ""))).toBe(
			"/Users/jay/External SoundFont.sf2",
		);
	});
});

describe("resolveResourceOverrides", () => {
	const builtIn: ResourceUrlOverrides = {
		soundFontUrl: "assets/sonivox.sf3",
	};

	it("keeps built-in overrides when no external soundfont is configured", () => {
		expect(resolveResourceOverrides(builtIn, null)).toEqual(builtIn);
	});

	it("keeps built-in overrides when the external soundfont is invalid", () => {
		expect(
			resolveResourceOverrides(builtIn, {
				success: true,
				configured: true,
				valid: false,
				error: "soundfont-not-found",
			}),
		).toEqual(builtIn);
	});

	it("prefers a valid external soundfont over the built-in override", () => {
		const resolved = resolveResourceOverrides(builtIn, {
			success: true,
			configured: true,
			valid: true,
			path: "/Users/jay/External SoundFont.sf2",
			name: "External SoundFont.sf2",
			size: 1024,
			format: "sf2",
		});

		expect(resolved.soundFontUrl).toMatch(/^asset:\/\/localhost\//);
		expect(
			decodeURIComponent(
				(resolved.soundFontUrl ?? "").replace("asset://localhost/", ""),
			),
		).toBe("/Users/jay/External SoundFont.sf2");
		expect(resolved.bravuraFontUrl).toBeUndefined();
	});
});
