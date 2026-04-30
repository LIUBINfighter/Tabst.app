import { describe, expect, it } from "vitest";
import {
	getCountInVolume,
	resolvePreviewPlayerState,
} from "./preview-count-in";

describe("getCountInVolume", () => {
	it("disables count-in volume when count-in is turned off", () => {
		expect(
			getCountInVolume({ countInEnabled: false, metronomeVolume: 0.6 }),
		).toBe(0);
	});

	it("reuses the metronome volume when count-in is enabled", () => {
		expect(
			getCountInVolume({ countInEnabled: true, metronomeVolume: 0.35 }),
		).toBe(0.35);
	});

	it("falls back to default volume when metronome is muted", () => {
		expect(
			getCountInVolume({ countInEnabled: true, metronomeVolume: 0 }),
		).toBe(0.5);
	});

	it("clamps the derived count-in volume into alphaTab's expected range", () => {
		expect(
			getCountInVolume({ countInEnabled: true, metronomeVolume: -1 }),
		).toBe(0);
		expect(getCountInVolume({ countInEnabled: true, metronomeVolume: 3 })).toBe(
			1,
		);
	});
});

describe("resolvePreviewPlayerState", () => {
	it("treats a pending count-in paused event as active playback", () => {
		expect(
			resolvePreviewPlayerState({
				countInPending: true,
				state: 0,
				stopped: false,
			}),
		).toEqual({
			clearPlaybackHighlights: false,
			nextCountInPending: true,
			playerIsPlaying: true,
			resetPlaybackProgress: false,
		});
	});

	it("clears the pending count-in flag once the main player starts", () => {
		expect(
			resolvePreviewPlayerState({
				countInPending: true,
				state: 1,
				stopped: false,
			}),
		).toEqual({
			clearPlaybackHighlights: false,
			nextCountInPending: false,
			playerIsPlaying: true,
			resetPlaybackProgress: false,
		});
	});

	it("treats a stopped event as a full playback stop", () => {
		expect(
			resolvePreviewPlayerState({
				countInPending: true,
				state: 0,
				stopped: true,
			}),
		).toEqual({
			clearPlaybackHighlights: true,
			nextCountInPending: false,
			playerIsPlaying: false,
			resetPlaybackProgress: true,
		});
	});

	it("treats an ordinary paused event without count-in as not playing", () => {
		expect(
			resolvePreviewPlayerState({
				countInPending: false,
				state: 0,
				stopped: false,
			}),
		).toEqual({
			clearPlaybackHighlights: false,
			nextCountInPending: false,
			playerIsPlaying: false,
			resetPlaybackProgress: false,
		});
	});
});
