import { describe, expect, it } from "vitest";
import {
	captureTrackConfigForRebuild,
	PREVIEW_THEME_REBUILD_COOLDOWN_MS,
	shouldStartThemeRebuild,
} from "./preview-session-controller";

describe("shouldStartThemeRebuild", () => {
	it("blocks rebuilds when there is no live preview api", () => {
		expect(
			shouldStartThemeRebuild({
				hasApi: false,
				hasContent: true,
				lastRebuildAt: 0,
				now: 1_000,
			}),
		).toEqual({
			allowed: false,
			nextLastRebuildAt: 0,
		});
	});

	it("blocks rebuilds when there is no current content", () => {
		expect(
			shouldStartThemeRebuild({
				hasApi: true,
				hasContent: false,
				lastRebuildAt: 0,
				now: 1_000,
			}),
		).toEqual({
			allowed: false,
			nextLastRebuildAt: 0,
		});
	});

	it("throttles rebuilds within the cooldown window", () => {
		expect(
			shouldStartThemeRebuild({
				hasApi: true,
				hasContent: true,
				lastRebuildAt: 1_000,
				now: 1_000 + PREVIEW_THEME_REBUILD_COOLDOWN_MS - 1,
			}),
		).toEqual({
			allowed: false,
			nextLastRebuildAt: 1_000,
		});
	});

	it("allows rebuilds outside the cooldown window", () => {
		expect(
			shouldStartThemeRebuild({
				hasApi: true,
				hasContent: true,
				lastRebuildAt: 1_000,
				now: 1_000 + PREVIEW_THEME_REBUILD_COOLDOWN_MS,
			}),
		).toEqual({
			allowed: true,
			nextLastRebuildAt: 1_000 + PREVIEW_THEME_REBUILD_COOLDOWN_MS,
		});
	});
});

describe("captureTrackConfigForRebuild", () => {
	it("returns null when the preview score has no first staff", () => {
		expect(captureTrackConfigForRebuild(null)).toBeNull();
		expect(captureTrackConfigForRebuild({ score: null })).toBeNull();
		expect(captureTrackConfigForRebuild({ score: { tracks: [] } })).toBeNull();
	});

	it("captures the first track staff display flags for rebuild restore", () => {
		expect(
			captureTrackConfigForRebuild({
				score: {
					tracks: [
						{
							staves: [
								{
									showNumbered: true,
									showSlash: false,
									showStandardNotation: true,
									showTablature: false,
								},
							],
						},
					],
				},
			}),
		).toEqual({
			showNumbered: true,
			showSlash: false,
			showStandardNotation: true,
			showTablature: false,
		});
	});
});
