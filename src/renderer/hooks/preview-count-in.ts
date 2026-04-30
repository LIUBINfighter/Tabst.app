type GetCountInVolumeParams = {
	countInEnabled: boolean;
	metronomeVolume: number;
};

type ResolvePreviewPlayerStateParams = {
	countInPending: boolean;
	state: number;
	stopped: boolean;
};

type ResolvePreviewPlayerStateResult = {
	clearPlaybackHighlights: boolean;
	nextCountInPending: boolean;
	playerIsPlaying: boolean;
	resetPlaybackProgress: boolean;
};

export function getCountInVolume({
	countInEnabled,
	metronomeVolume,
}: GetCountInVolumeParams): number {
	if (!countInEnabled) return 0;
	const effectiveVolume =
		metronomeVolume === 0 ? 0.5 : metronomeVolume;
	return Math.max(0, Math.min(1, effectiveVolume));
}

export function resolvePreviewPlayerState({
	countInPending,
	state,
	stopped,
}: ResolvePreviewPlayerStateParams): ResolvePreviewPlayerStateResult {
	if (stopped) {
		return {
			clearPlaybackHighlights: true,
			nextCountInPending: false,
			playerIsPlaying: false,
			resetPlaybackProgress: true,
		};
	}

	if (state === 1) {
		return {
			clearPlaybackHighlights: false,
			nextCountInPending: false,
			playerIsPlaying: true,
			resetPlaybackProgress: false,
		};
	}

	if (countInPending) {
		return {
			clearPlaybackHighlights: false,
			nextCountInPending: true,
			playerIsPlaying: true,
			resetPlaybackProgress: false,
		};
	}

	return {
		clearPlaybackHighlights: false,
		nextCountInPending: false,
		playerIsPlaying: false,
		resetPlaybackProgress: false,
	};
}
