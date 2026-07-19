import { describe, expect, it } from "vitest";
import { shouldMountPreviewTracksPanel } from "./score-workspace-layout";

describe("score workspace layout", () => {
	it("mounts Track Selection beside imported scores outside Enjoy mode", () => {
		expect(
			shouldMountPreviewTracksPanel({
				isImportedScoreFile: true,
				enjoyMode: false,
			}),
		).toBe(true);
	});

	it("mounts the preview-side panel for Enjoy mode only on AlphaTex pages", () => {
		expect(
			shouldMountPreviewTracksPanel({
				isImportedScoreFile: false,
				enjoyMode: true,
			}),
		).toBe(true);
		expect(
			shouldMountPreviewTracksPanel({
				isImportedScoreFile: false,
				enjoyMode: false,
			}),
		).toBe(false);
	});
});
