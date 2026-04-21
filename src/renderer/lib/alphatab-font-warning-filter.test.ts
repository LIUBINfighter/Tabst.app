import { describe, expect, it, vi } from "vitest";
import {
	installAlphaTabFontWarningFilter,
	parseAlphaTabFontWarningFamily,
	shouldSuppressAlphaTabFontWarning,
} from "./alphatab-font-warning-filter";

describe("parseAlphaTabFontWarningFamily", () => {
	it("extracts the font family from alphaTab rendering warnings", () => {
		expect(
			parseAlphaTabFontWarningFamily(
				"Could not load font 'alphaTab1' within 10 seconds",
			),
		).toBe("alphaTab1");
	});

	it("returns null for unrelated messages", () => {
		expect(parseAlphaTabFontWarningFamily("other warning")).toBeNull();
	});
});

describe("shouldSuppressAlphaTabFontWarning", () => {
	it("suppresses font warnings when the family is already available", () => {
		expect(
			shouldSuppressAlphaTabFontWarning("Rendering", {
				checkFontAvailable: (family) => family === "alphaTab2",
				message: "Could not load font 'alphaTab2' within 15 seconds",
			}),
		).toBe(true);
	});

	it("does not suppress warnings for unavailable fonts", () => {
		expect(
			shouldSuppressAlphaTabFontWarning("Rendering", {
				checkFontAvailable: () => false,
				message: "Could not load font 'alphaTab2' within 15 seconds",
			}),
		).toBe(false);
	});

	it("does not suppress non-rendering warnings", () => {
		expect(
			shouldSuppressAlphaTabFontWarning("Font", {
				checkFontAvailable: () => true,
				message: "Could not load font 'alphaTab2' within 15 seconds",
			}),
		).toBe(false);
	});
});

describe("installAlphaTabFontWarningFilter", () => {
	it("wraps the logger and skips stale font warnings only", () => {
		const originalWarning = vi.fn();
		const logger = { warning: originalWarning };

		installAlphaTabFontWarningFilter(logger, {
			checkFontAvailable: (family) => family === "alphaTab1",
		});

		logger.warning(
			"Rendering",
			"Could not load font 'alphaTab1' within 20 seconds",
			null,
		);
		logger.warning(
			"Rendering",
			"Could not load font 'alphaTab9' within 20 seconds",
			null,
		);
		logger.warning("Rendering", "Different warning", null);

		expect(originalWarning).toHaveBeenCalledTimes(2);
		expect(originalWarning).toHaveBeenNthCalledWith(
			1,
			"Rendering",
			"Could not load font 'alphaTab9' within 20 seconds",
			null,
		);
		expect(originalWarning).toHaveBeenNthCalledWith(
			2,
			"Rendering",
			"Different warning",
			null,
		);
	});
});
