import * as alphaTab from "@coderline/alphatab";
import type { AtDocConfig } from "./atdoc";

function toColor(input: string | undefined): alphaTab.model.Color | null {
	if (!input) return null;
	try {
		return alphaTab.model.Color.fromJson(input);
	} catch {
		return null;
	}
}

function mustColor(hex: string): alphaTab.model.Color {
	const c = toColor(hex);
	if (c) return c;
	throw new Error(`Invalid fallback color: ${hex}`);
}

function getFretPaletteColor(fret: number): alphaTab.model.Color {
	if (fret <= 0) return mustColor("#22c55e");
	if (fret <= 4) return mustColor("#3b82f6");
	if (fret <= 8) return mustColor("#eab308");
	if (fret <= 12) return mustColor("#ef4444");
	return mustColor("#a855f7");
}

export function applyAtDocColoring(
	api: alphaTab.AlphaTabApi,
	config: AtDocConfig,
	warn: (message: string) => void,
): boolean {
	const score = api.score;
	const coloring = config.coloring;
	if (!score || !coloring?.enabled) return false;

	const barNumberColor = toColor(coloring.barNumberColor);
	const staffLineColor = toColor(coloring.staffLineColor);
	const barSeparatorColor = toColor(coloring.barSeparatorColor);
	const noteHeadColor = toColor(coloring.noteHeadColor);
	const fretNumberColor = toColor(coloring.fretNumberColor);

	if (coloring.barNumberColor && !barNumberColor) {
		warn(`Invalid at.coloring.barNumberColor: ${coloring.barNumberColor}`);
	}
	if (coloring.staffLineColor && !staffLineColor) {
		warn(`Invalid at.coloring.staffLineColor: ${coloring.staffLineColor}`);
	}
	if (coloring.barSeparatorColor && !barSeparatorColor) {
		warn(
			`Invalid at.coloring.barSeparatorColor: ${coloring.barSeparatorColor}`,
		);
	}
	if (coloring.noteHeadColor && !noteHeadColor) {
		warn(`Invalid at.coloring.noteHeadColor: ${coloring.noteHeadColor}`);
	}
	if (coloring.fretNumberColor && !fretNumberColor) {
		warn(`Invalid at.coloring.fretNumberColor: ${coloring.fretNumberColor}`);
	}

	let changed = false;

	for (const track of score.tracks ?? []) {
		for (const staff of track.staves ?? []) {
			for (const bar of staff.bars ?? []) {
				if (barNumberColor || staffLineColor || barSeparatorColor) {
					if (!bar.style) bar.style = new alphaTab.model.BarStyle();
					if (barNumberColor) {
						bar.style.colors.set(
							alphaTab.model.BarSubElement.StandardNotationBarNumber,
							barNumberColor,
						);
						bar.style.colors.set(
							alphaTab.model.BarSubElement.GuitarTabsBarNumber,
							barNumberColor,
						);
						bar.style.colors.set(
							alphaTab.model.BarSubElement.SlashBarNumber,
							barNumberColor,
						);
						bar.style.colors.set(
							alphaTab.model.BarSubElement.NumberedBarNumber,
							barNumberColor,
						);
						changed = true;
					}
					if (staffLineColor) {
						bar.style.colors.set(
							alphaTab.model.BarSubElement.StandardNotationStaffLine,
							staffLineColor,
						);
						bar.style.colors.set(
							alphaTab.model.BarSubElement.GuitarTabsStaffLine,
							staffLineColor,
						);
						changed = true;
					}
					if (barSeparatorColor) {
						bar.style.colors.set(
							alphaTab.model.BarSubElement.StandardNotationBarLines,
							barSeparatorColor,
						);
						bar.style.colors.set(
							alphaTab.model.BarSubElement.GuitarTabsBarLines,
							barSeparatorColor,
						);
						changed = true;
					}
				}

				for (const voice of bar.voices ?? []) {
					for (const beat of voice.beats ?? []) {
						for (const note of beat.notes ?? []) {
							const paletteColor =
								coloring.colorizeByFret === true
									? getFretPaletteColor(note.fret)
									: null;
							const noteColor = paletteColor ?? noteHeadColor;
							const fretColor = paletteColor ?? fretNumberColor;
							if (!noteColor && !fretColor) continue;

							if (!note.style) note.style = new alphaTab.model.NoteStyle();
							if (noteColor) {
								note.style.colors.set(
									alphaTab.model.NoteSubElement.StandardNotationNoteHead,
									noteColor,
								);
								changed = true;
							}
							if (fretColor) {
								note.style.colors.set(
									alphaTab.model.NoteSubElement.GuitarTabFretNumber,
									fretColor,
								);
								changed = true;
							}
						}
					}
				}
			}
		}
	}

	if (changed) {
		try {
			api.render?.();
		} catch (err) {
			warn(`[ATDOC] Coloring render failed: ${String(err)}`);
		}
	}

	return changed;
}
