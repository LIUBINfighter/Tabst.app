import { describe, expect, it } from "vitest";
import {
	buildPrintFontFaceCss,
	buildPrintFontFamilyCssValue,
	getPrintFontFamilies,
} from "./print-fonts";

describe("print font helpers", () => {
	it("prioritizes the dedicated print font but preserves alphaTab aliases", () => {
		expect(getPrintFontFamilies("Bravura-Print")).toEqual([
			"Bravura-Print",
			"alphaTab",
			"Bravura",
		]);
	});

	it("builds a css font-family fallback chain", () => {
		expect(buildPrintFontFamilyCssValue("Bravura-Print")).toBe(
			"'Bravura-Print', 'alphaTab', 'Bravura', sans-serif",
		);
	});

	it("emits @font-face rules for every alias name", () => {
		const css = buildPrintFontFaceCss(
			"Bravura-Print",
			"https://example.com/Bravura.woff2",
		);
		expect(css).toContain("font-family: 'Bravura-Print'");
		expect(css).toContain("font-family: 'alphaTab'");
		expect(css).toContain("font-family: 'Bravura'");
	});
});
