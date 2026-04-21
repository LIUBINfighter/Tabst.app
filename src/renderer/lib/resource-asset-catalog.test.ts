import { describe, expect, it } from "vitest";
import {
	getBuiltInFontByUrl,
	getBuiltInSoundFontByUrl,
	normalizeAssetOverrideUrl,
} from "./resource-asset-catalog";

describe("resource asset catalog", () => {
	it("normalizes relative and absolute overrides consistently", () => {
		expect(normalizeAssetOverrideUrl("assets/Bravura.woff2")).toBe(
			"assets/Bravura.woff2",
		);
		expect(normalizeAssetOverrideUrl("/assets/Bravura.woff2")).toBe(
			"assets/Bravura.woff2",
		);
		expect(
			normalizeAssetOverrideUrl("https://cdn.example.com/Bravura.woff2"),
		).toBe("https://cdn.example.com/Bravura.woff2");
	});

	it("resolves built-in font by url", () => {
		const font = getBuiltInFontByUrl("assets/Bravura.woff2");
		expect(font).not.toBeNull();
		expect(font?.id).toBe("bravura");

		const leland = getBuiltInFontByUrl("assets/fonts/leland/Leland.otf");
		expect(leland?.id).toBe("leland");
	});

	it("resolves built-in soundfont by url", () => {
		const soundFont = getBuiltInSoundFontByUrl("assets/sonivox.sf3");
		expect(soundFont).not.toBeNull();
		expect(soundFont?.id).toBe("sonivox");

		const generalUser = getBuiltInSoundFontByUrl(
			"assets/soundfonts/generaluser-gs/GeneralUser-GS.sf2",
		);
		expect(generalUser?.id).toBe("generaluser-gs");
	});
});
