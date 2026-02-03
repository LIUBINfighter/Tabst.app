/**
 * AlphaTex Cursor Tracking
 *
 * Tracks editor cursor position and maps it to beat positions in the score.
 */

import type { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import type { EditorCursorInfo } from "../store/appStore";
import { findBeatAtPosition } from "./alphatex-selection-sync";

/**
 * Create cursor tracking extension
 * When cursor moves, calculates corresponding Beat position and updates store
 *
 * @param onCursorChange Cursor change callback
 * @returns CodeMirror extension
 */
export function createCursorTrackingExtension(
	onCursorChange: (cursor: EditorCursorInfo | null) => void,
): Extension {
	let rafId: number | null = null;
	let lastEmitted: EditorCursorInfo | null = null;

	return EditorView.updateListener.of((update) => {
		if (!update.selectionSet && !update.docChanged) {
			return;
		}

		const fromDocChange = update.docChanged;
		if (rafId !== null) return;
		rafId = window.requestAnimationFrame(() => {
			rafId = null;
			const { head } = update.state.selection.main;
			const line = update.state.doc.lineAt(head);
			const lineNumber = line.number - 1; // Convert to 0-based
			const column = head - line.from;

			const text = update.state.doc.toString();
			const beatInfo = findBeatAtPosition(text, lineNumber, column);

			if (!beatInfo) {
				if (lastEmitted !== null) {
					lastEmitted = null;
					onCursorChange(null);
				}
				return;
			}

			const next: EditorCursorInfo = {
				...beatInfo,
				fromDocChange,
			};

			if (lastEmitted && lastEmitted.barIndex === next.barIndex) {
				return;
			}

			lastEmitted = next;
			onCursorChange(next);
		});
	});
}
