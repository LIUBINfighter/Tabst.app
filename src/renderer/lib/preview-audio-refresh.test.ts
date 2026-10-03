import { describe, expect, it, vi } from "vitest";
import type { AudioRecoveryResult } from "./player-audio-recovery";
import {
	createPlaybackAudioRefreshCoordinator,
	type PlaybackStallBaseline,
} from "./preview-audio-refresh";

function createCoordinator({
	recovery,
	reloadOk = true,
	baseline = { wasPlaying: true, tick: 100 },
	stalled = false,
	stillStalled,
}: {
	recovery: AudioRecoveryResult;
	reloadOk?: boolean;
	baseline?: PlaybackStallBaseline | null;
	stalled?: boolean;
	stillStalled?: boolean;
}) {
	const api = { player: { output: { context: { state: "running" } } } };
	const recover = vi.fn(async () => recovery);
	const reloadSoundFont = vi.fn(async () => reloadOk);
	const reapplyPlaybackAudioState = vi.fn();
	let stallCalls = 0;
	const isPlaybackStalledSince = vi.fn(async () => {
		stallCalls += 1;
		if (stallCalls === 1) return stalled;
		return stillStalled === undefined ? stalled : stillStalled;
	});
	const depsRef = { recover, reapplyPlaybackAudioState };

	const coordinator = createPlaybackAudioRefreshCoordinator({
		getApi: () => api,
		getRecoverPlaybackAudio: () => depsRef.recover,
		reloadSoundFont,
		getReapplyPlaybackAudioState: () => depsRef.reapplyPlaybackAudioState,
		capturePlaybackBaseline: () => baseline,
		isPlaybackStalledSince,
	});

	return {
		coordinator,
		recover,
		reloadSoundFont,
		reapplyPlaybackAudioState,
		isPlaybackStalledSince,
	};
}

describe("createPlaybackAudioRefreshCoordinator", () => {
	it("runs a single recovery when focus and visibilitychange fire together", async () => {
		const { coordinator, recover, reapplyPlaybackAudioState } =
			createCoordinator({
				recovery: {
					didAttemptActivation: false,
					initialState: "running",
					finalState: "running",
				},
			});

		await Promise.all([
			coordinator.refresh("window-focus"),
			coordinator.refresh("visibility-return"),
		]);

		expect(recover).toHaveBeenCalledTimes(1);
		expect(reapplyPlaybackAudioState).toHaveBeenCalledTimes(1);
	});

	it("does not reload the soundfont when the context is running and playback advances", async () => {
		const { coordinator, recover, reloadSoundFont } = createCoordinator({
			recovery: {
				didAttemptActivation: false,
				initialState: "running",
				finalState: "running",
			},
		});

		const result = await coordinator.refresh("window-focus");

		expect(reloadSoundFont).not.toHaveBeenCalled();
		expect(recover).toHaveBeenCalledTimes(1);
		expect(result.audioStalled).toBe(false);
	});

	it("reloads the soundfont when the context is closed", async () => {
		const { coordinator, reloadSoundFont, recover } = createCoordinator({
			recovery: {
				didAttemptActivation: false,
				initialState: "closed",
				finalState: "closed",
			},
		});

		await coordinator.refresh("window-focus");

		expect(reloadSoundFont).toHaveBeenCalledTimes(1);
		expect(recover).toHaveBeenCalledTimes(2);
	});

	it("reloads the soundfont when activation did not end in running state", async () => {
		const { coordinator, reloadSoundFont } = createCoordinator({
			recovery: {
				didAttemptActivation: true,
				initialState: "suspended",
				finalState: "suspended",
			},
		});

		await coordinator.refresh("window-focus");

		expect(reloadSoundFont).toHaveBeenCalledTimes(1);
	});

	it("does not reload the soundfont after a successful resume", async () => {
		const { coordinator, reloadSoundFont } = createCoordinator({
			recovery: {
				didAttemptActivation: true,
				initialState: "suspended",
				finalState: "running",
			},
		});

		await coordinator.refresh("window-focus");

		expect(reloadSoundFont).not.toHaveBeenCalled();
	});

	it("reloads the soundfont when playback is stalled while running", async () => {
		const { coordinator, reloadSoundFont, isPlaybackStalledSince } =
			createCoordinator({
				recovery: {
					didAttemptActivation: false,
					initialState: "running",
					finalState: "running",
				},
				stalled: true,
				stillStalled: false,
			});

		const result = await coordinator.refresh("window-focus");

		expect(reloadSoundFont).toHaveBeenCalledTimes(1);
		expect(isPlaybackStalledSince).toHaveBeenCalled();
		expect(result.audioStalled).toBe(false);
	});

	it("reports audioStalled when playback is still stalled after the reload", async () => {
		const { coordinator, reloadSoundFont } = createCoordinator({
			recovery: {
				didAttemptActivation: false,
				initialState: "running",
				finalState: "running",
			},
			stalled: true,
			stillStalled: true,
		});

		const result = await coordinator.refresh("window-focus");

		expect(reloadSoundFont).toHaveBeenCalledTimes(1);
		expect(result.audioStalled).toBe(true);
	});

	it("reports audioStalled when the soundfont reload itself paused the player", async () => {
		// Regression: alphaTab's loadSoundFont() pauses the player, so the old
		// "is the player still playing?" guard answered false after the reload and
		// silently suppressed the restart notice. Stall detection is now measured
		// against the pre-recovery baseline tick instead of the playing state.
		const baseline = { wasPlaying: true, tick: 100 };
		const api = {};
		const recover = vi.fn(async () => ({
			didAttemptActivation: false,
			initialState: "running",
			finalState: "running",
		}));
		const reloadSoundFont = vi.fn(async () => true);
		const isPlaybackStalledSince = vi.fn(async () => true);

		const coordinator = createPlaybackAudioRefreshCoordinator({
			getApi: () => api,
			getRecoverPlaybackAudio: () => recover,
			reloadSoundFont,
			getReapplyPlaybackAudioState: () => () => {},
			capturePlaybackBaseline: () => baseline,
			isPlaybackStalledSince,
		});

		const result = await coordinator.refresh("play-stall");

		expect(reloadSoundFont).toHaveBeenCalledTimes(1);
		expect(result.audioStalled).toBe(true);
	});

	it("does not reload when playback is not stalled", async () => {
		const { coordinator, reloadSoundFont } = createCoordinator({
			recovery: {
				didAttemptActivation: false,
				initialState: "running",
				finalState: "running",
			},
		});

		await coordinator.refresh("window-focus");

		expect(reloadSoundFont).not.toHaveBeenCalled();
	});

	it("never probes for a stall when the user was not playing", async () => {
		const { coordinator, reloadSoundFont, isPlaybackStalledSince } =
			createCoordinator({
				recovery: {
					didAttemptActivation: false,
					initialState: "running",
					finalState: "running",
				},
				baseline: { wasPlaying: false, tick: 0 },
				stalled: true,
				stillStalled: true,
			});

		const result = await coordinator.refresh("window-focus");

		expect(isPlaybackStalledSince).not.toHaveBeenCalled();
		expect(reloadSoundFont).not.toHaveBeenCalled();
		expect(result.audioStalled).toBe(false);
	});

	it("reapplies playback state after a recovery", async () => {
		const { coordinator, reapplyPlaybackAudioState } = createCoordinator({
			recovery: {
				didAttemptActivation: false,
				initialState: "running",
				finalState: "running",
			},
		});

		await coordinator.refresh("window-focus");

		expect(reapplyPlaybackAudioState).toHaveBeenCalledTimes(1);
	});
});
