import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	getResourceUrls,
	type ResourceUrlOverrides,
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
});
