import type * as alphaTab from "@coderline/alphatab";

export function findBeatInScore(
	score: alphaTab.model.Score | null | undefined,
	barIndex: number,
	beatIndex: number,
): alphaTab.model.Beat | null {
	if (!score?.tracks?.length) return null;

	const track = score.tracks[0];
	for (const staff of track.staves) {
		for (const bar of staff.bars) {
			if (bar.index === barIndex) {
				for (const voice of bar.voices) {
					for (const beat of voice.beats) {
						if (beat.index === beatIndex) {
							return beat;
						}
					}
				}
				if (bar.voices[0]?.beats?.length > 0) {
					return bar.voices[0].beats[0];
				}
			}
		}
	}
	return null;
}

export function safeSetColor(
	colors: Map<number, alphaTab.model.Color | null>,
	key: number | undefined,
	value: alphaTab.model.Color | undefined,
): boolean {
	if (key === undefined || key === null || typeof key !== "number") {
		console.warn("[BarColor] Invalid key for safeSetColor:", key);
		return false;
	}
	if (!value || value === undefined || value === null) {
		console.warn("[BarColor] Invalid value for safeSetColor, key:", key);
		return false;
	}
	if (typeof value.toString !== "function") {
		console.warn(
			"[BarColor] Value missing toString for safeSetColor, key:",
			key,
		);
		return false;
	}
	try {
		value.toString();
		colors.set(key, value);
		return true;
	} catch (e) {
		console.error("[BarColor] Failed to set color, key:", key, "error:", e);
		return false;
	}
}
