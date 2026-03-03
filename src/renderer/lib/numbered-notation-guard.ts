export interface NumberedStaffLike {
	showNumbered?: boolean;
	showSlash?: boolean;
	showStandardNotation?: boolean;
	showTablature?: boolean;
}

export interface NumberedTrackLike {
	staves?: Array<NumberedStaffLike | null | undefined> | null;
}

export interface NumberedScoreLike {
	tracks?: Array<NumberedTrackLike | null | undefined> | null;
}

export function isNumberedNotationBeatError(errorText: string): boolean {
	if (!errorText) return false;

	const hasBeatNullAccess =
		errorText.includes("(reading 'beat')") ||
		errorText.includes('reading "beat"') ||
		errorText.includes("Cannot read properties of null (reading 'beat')");

	if (!hasBeatNullAccess) return false;

	return (
		errorText.includes("NumberedBarRenderer") ||
		errorText.includes("beatOfHighestNote")
	);
}

function ensureStaffVisible(staff: NumberedStaffLike): boolean {
	const hasVisibleStaff =
		staff.showTablature === true ||
		staff.showStandardNotation === true ||
		staff.showSlash === true ||
		staff.showNumbered === true;

	if (hasVisibleStaff) {
		return false;
	}

	staff.showStandardNotation = true;
	return true;
}

export function disableNumberedNotationAcrossScore(
	score: NumberedScoreLike | null | undefined,
): boolean {
	if (!score?.tracks?.length) return false;

	let changed = false;

	for (const track of score.tracks) {
		if (!track?.staves?.length) continue;

		for (const staff of track.staves) {
			if (!staff) continue;

			if (staff.showNumbered === true) {
				staff.showNumbered = false;
				changed = true;
			}

			if (ensureStaffVisible(staff)) {
				changed = true;
			}
		}
	}

	return changed;
}
