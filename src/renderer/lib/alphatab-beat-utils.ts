/**
 * AlphaTab score/beat 查找工具
 * 供 Preview、选区同步、播放同步等使用
 */

import type * as alphaTab from "@coderline/alphatab";

/**
 * Find the Beat object in the score by barIndex and beatIndex
 */
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
