import { describe, expect, it } from "vitest";
import {
	disableNumberedNotationAcrossScore,
	isNumberedNotationBeatError,
} from "./numbered-notation-guard";

describe("isNumberedNotationBeatError", () => {
	it("matches NumberedBarRenderer null beat error", () => {
		const message =
			"TypeError: Cannot read properties of null (reading 'beat') at NumberedBarRenderer.calculateBeamingOverflows";
		expect(isNumberedNotationBeatError(message)).toBe(true);
	});

	it("matches beatOfHighestNote null beat error", () => {
		const message =
			"TypeError: Cannot read properties of null (reading 'beat') at get beatOfHighestNote";
		expect(isNumberedNotationBeatError(message)).toBe(true);
	});

	it("ignores unrelated null-property errors", () => {
		const message =
			"TypeError: Cannot read properties of null (reading 'staves')";
		expect(isNumberedNotationBeatError(message)).toBe(false);
	});
});

describe("disableNumberedNotationAcrossScore", () => {
	it("disables numbered notation and keeps each staff visible", () => {
		const score = {
			tracks: [
				{
					staves: [
						{
							showNumbered: true,
							showSlash: false,
							showStandardNotation: false,
							showTablature: false,
						},
					],
				},
			],
		};

		const changed = disableNumberedNotationAcrossScore(score);

		expect(changed).toBe(true);
		expect(score.tracks?.[0]?.staves?.[0]).toEqual({
			showNumbered: false,
			showSlash: false,
			showStandardNotation: true,
			showTablature: false,
		});
	});

	it("returns false when nothing needs changes", () => {
		const score = {
			tracks: [
				{
					staves: [
						{
							showNumbered: false,
							showSlash: true,
							showStandardNotation: false,
							showTablature: false,
						},
					],
				},
			],
		};

		const changed = disableNumberedNotationAcrossScore(score);

		expect(changed).toBe(false);
	});

	it("handles empty or null score values", () => {
		expect(disableNumberedNotationAcrossScore(null)).toBe(false);
		expect(disableNumberedNotationAcrossScore({ tracks: null })).toBe(false);
		expect(disableNumberedNotationAcrossScore({ tracks: [] })).toBe(false);
	});
});
