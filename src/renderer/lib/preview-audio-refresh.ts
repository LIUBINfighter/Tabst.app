/**
 * Playback audio refresh coordinator
 *
 * Single owner for "window came back / audio needs recovery" refreshes.
 * Window focus and visibilitychange both funnel into one single-flight
 * refresh so a single macOS window return cannot trigger concurrent
 * recoveries or soundfont reloads.
 *
 * Recovery is cascading:
 * 1. resume the AudioContext in place (window-unfocus scenarios),
 * 2. reload the soundfont (cheap in-place attempt),
 * 3. if playback is still stalled (tick not advancing while playing), report
 *    `audioStalled` so the caller can surface a user-facing restart hint —
 *    the WKWebView audio subsystem is process-level broken after macOS
 *    display/system sleep and cannot be fixed from inside the page.
 *
 * Stall detection is measured against a baseline captured *before* any
 * recovery work. This matters because `loadSoundFont()` internally pauses the
 * player: checking "is the player still playing?" after a reload always
 * answered "no", which silently suppressed the `audioStalled` report (and with
 * it the restart toast) for exactly the failure it was meant to detect.
 */

import type { AudioRecoveryResult } from "./player-audio-recovery";

/**
 * Snapshot of the playback position taken before recovery starts.
 *
 * `wasPlaying` decides whether a stall can be reported at all: when the user
 * was not playing, a frozen tick is expected and must not raise a notice.
 */
export interface PlaybackStallBaseline {
	wasPlaying: boolean;
	tick: number;
}

export interface PlaybackAudioRefreshDependencies<TApi> {
	getApi: () => TApi | null;
	getRecoverPlaybackAudio: () => () => Promise<AudioRecoveryResult | null>;
	reloadSoundFont: (api: TApi) => Promise<boolean>;
	getReapplyPlaybackAudioState: () => (api: TApi) => void;
	/** Snapshot the playback state before recovery touches the player. */
	capturePlaybackBaseline: () => PlaybackStallBaseline | null;
	/**
	 * Observe playback for a short window and report whether the tick failed to
	 * advance past `baseline.tick`. Implementations must NOT require the player
	 * to still be in the playing state: recovery itself may have paused it.
	 */
	isPlaybackStalledSince: (baseline: PlaybackStallBaseline) => Promise<boolean>;
}

export interface PlaybackAudioRefreshResult {
	/** True when the soundfont was reloaded but playback is still stalled. */
	audioStalled: boolean;
}

export interface PlaybackAudioRefreshCoordinator {
	refresh: (reason: string) => Promise<PlaybackAudioRefreshResult>;
}

/**
 * Create a coordinator that serializes audio pipeline refreshes.
 *
 * Concurrent refresh() calls share the in-flight run. The soundfont is only
 * reloaded when the AudioContext state cannot be recovered in place
 * (closed), an activation attempt did not end in the running state, or
 * playback is stalled while playing. Idle time alone never triggers a reload.
 */
export function createPlaybackAudioRefreshCoordinator<TApi>(
	deps: PlaybackAudioRefreshDependencies<TApi>,
): PlaybackAudioRefreshCoordinator {
	let inFlight: Promise<PlaybackAudioRefreshResult> | null = null;

	const refresh = (reason: string): Promise<PlaybackAudioRefreshResult> => {
		if (inFlight) {
			return inFlight;
		}

		inFlight = run(reason).finally(() => {
			inFlight = null;
		});
		return inFlight;
	};

	async function run(reason: string): Promise<PlaybackAudioRefreshResult> {
		const api = deps.getApi();
		if (!api) {
			return { audioStalled: false };
		}

		// Capture before recovery: reloading the soundfont pauses the player, so
		// the playing state must not be re-read afterwards.
		const baseline = deps.capturePlaybackBaseline();
		const canReportStall = baseline?.wasPlaying === true;

		const recovery = await deps.getRecoverPlaybackAudio()();
		if (deps.getApi() !== api) {
			return { audioStalled: false };
		}

		const finalState = recovery?.finalState ?? null;
		const attemptedButNotRunning =
			recovery?.didAttemptActivation === true && finalState !== "running";
		let needsSoundFontReload =
			finalState === "closed" || attemptedButNotRunning;

		if (!needsSoundFontReload && canReportStall && baseline) {
			needsSoundFontReload = await deps.isPlaybackStalledSince(baseline);
			if (deps.getApi() !== api) {
				return { audioStalled: false };
			}
		}

		if (!needsSoundFontReload) {
			deps.getReapplyPlaybackAudioState()(api);
			return { audioStalled: false };
		}

		const reloaded = await deps.reloadSoundFont(api);
		if (deps.getApi() !== api) {
			return { audioStalled: false };
		}
		if (reloaded) {
			console.info(`[audio-refresh] reloaded soundfont (${reason})`);
			await deps.getRecoverPlaybackAudio()();
			if (deps.getApi() !== api) {
				return { audioStalled: false };
			}
		}

		deps.getReapplyPlaybackAudioState()(api);

		const stillStalled =
			canReportStall && baseline
				? await deps.isPlaybackStalledSince(baseline)
				: false;
		if (deps.getApi() !== api) {
			return { audioStalled: false };
		}

		return { audioStalled: stillStalled };
	}

	return { refresh };
}
