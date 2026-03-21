export const PREVIEW_THEME_REBUILD_COOLDOWN_MS = 250;

type ThemeRebuildDecisionParams = {
	hasApi: boolean;
	hasContent: boolean;
	lastRebuildAt: number;
	now: number;
};

type ThemeRebuildDecision = {
	allowed: boolean;
	nextLastRebuildAt: number;
};

type TrackConfigSnapshot = {
	showNumbered?: boolean;
	showSlash?: boolean;
	showTablature?: boolean;
	showStandardNotation?: boolean;
};

type PreviewApiLike = {
	score?: {
		tracks?: Array<{
			staves?: Array<{
				showNumbered?: boolean;
				showSlash?: boolean;
				showTablature?: boolean;
				showStandardNotation?: boolean;
			}>;
		}>;
	} | null;
} | null;

export function shouldStartThemeRebuild({
	hasApi,
	hasContent,
	lastRebuildAt,
	now,
}: ThemeRebuildDecisionParams): ThemeRebuildDecision {
	if (!hasApi || !hasContent) {
		return {
			allowed: false,
			nextLastRebuildAt: lastRebuildAt,
		};
	}

	if (now - lastRebuildAt < PREVIEW_THEME_REBUILD_COOLDOWN_MS) {
		return {
			allowed: false,
			nextLastRebuildAt: lastRebuildAt,
		};
	}

	return {
		allowed: true,
		nextLastRebuildAt: now,
	};
}

export function captureTrackConfigForRebuild(
	api: PreviewApiLike,
): TrackConfigSnapshot | null {
	const firstStaff = api?.score?.tracks?.[0]?.staves?.[0];
	if (!firstStaff) return null;

	return {
		showTablature: firstStaff.showTablature,
		showStandardNotation: firstStaff.showStandardNotation,
		showSlash: firstStaff.showSlash,
		showNumbered: firstStaff.showNumbered,
	};
}
