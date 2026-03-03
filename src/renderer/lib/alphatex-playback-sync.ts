/**
 * AlphaTex Playback Sync
 *
 * Synchronizes playback position with editor highlighting (green beat highlight + yellow bar highlight).
 */

import {
	type Extension,
	RangeSetBuilder,
	StateEffect,
	StateField,
} from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView } from "@codemirror/view";
import type { PlaybackBeatInfo } from "../store/appStore";
import {
	type CodeRange,
	getBarRanges,
	parseBeatPositions,
} from "./alphatex-parse-positions";
import { createPlaybackRangeCache } from "./playback-range-cache";

const playbackRangeCache = createPlaybackRangeCache({
	parseBeats: (text) => parseBeatPositions(text).beats,
	resolveBarRanges: (text, barIndex) => getBarRanges(text, barIndex),
});

/**
 * Effect to update playback highlight in the editor
 */
export const setPlaybackHighlightEffect =
	StateEffect.define<CodeRange | null>();

/**
 * Playback highlight decoration style - uses green/cyan tone, different from selection
 */
const playbackHighlightMark = Decoration.mark({
	class: "cm-playback-highlight",
});

/**
 * State field to manage playback highlight decorations
 */
export const playbackHighlightField = StateField.define<DecorationSet>({
	create() {
		return Decoration.none;
	},
	update(highlights, tr) {
		for (const e of tr.effects) {
			if (e.is(setPlaybackHighlightEffect)) {
				if (!e.value) {
					return Decoration.none;
				}

				try {
					const range = e.value;
					const docLength = tr.state.doc.length;

					const from = Math.max(0, Math.min(range.from, docLength));
					const to = Math.max(0, Math.min(range.to, docLength));

					if (from >= to || from < 0) {
						return Decoration.none;
					}

					const builder = new RangeSetBuilder<Decoration>();
					builder.add(from, to, playbackHighlightMark);
					return builder.finish();
				} catch (err) {
					console.error(
						"[PlaybackSync] Error building playback highlight:",
						err,
					);
					return Decoration.none;
				}
			}
		}

		if (tr.docChanged) {
			try {
				return highlights.map(tr.changes);
			} catch {
				return Decoration.none;
			}
		}

		return highlights;
	},
	provide: (f) => EditorView.decorations.from(f),
});

/**
 * Playback highlight theme style - uses green tone, different from selection highlight
 */
export const playbackHighlightTheme = EditorView.baseTheme({
	".cm-playback-highlight": {
		backgroundColor: "hsl(142 76% 36% / 0.3)",
		borderRadius: "2px",
		boxShadow: "0 0 0 1px hsl(142 76% 36% / 0.5)",
		transition: "background-color 0.1s ease-out",
	},
});

/**
 * Effect to update playback bar highlight in the editor
 */
export const setPlaybackBarHighlightEffect = StateEffect.define<{
	ranges: CodeRange[];
} | null>();

/**
 * Playback bar highlight decoration style - uses yellow tone
 */
const playbackBarHighlightMark = Decoration.mark({
	class: "cm-playback-bar-highlight",
});

/**
 * State field to manage playback bar highlight decorations
 */
export const playbackBarHighlightField = StateField.define<DecorationSet>({
	create() {
		return Decoration.none;
	},
	update(highlights, tr) {
		for (const e of tr.effects) {
			if (e.is(setPlaybackBarHighlightEffect)) {
				if (!e.value || e.value.ranges.length === 0) {
					return Decoration.none;
				}

				try {
					const docLength = tr.state.doc.length;
					const builder = new RangeSetBuilder<Decoration>();

					const sortedRanges = [...e.value.ranges].sort(
						(a, b) => a.from - b.from,
					);

					for (const range of sortedRanges) {
						const from = Math.max(0, Math.min(range.from, docLength));
						const to = Math.max(0, Math.min(range.to, docLength));

						if (from < to) {
							builder.add(from, to, playbackBarHighlightMark);
						}
					}

					return builder.finish();
				} catch (err) {
					console.error(
						"[PlaybackSync] Error building playback bar highlight:",
						err,
					);
					return Decoration.none;
				}
			}
		}

		if (tr.docChanged) {
			try {
				return highlights.map(tr.changes);
			} catch {
				return Decoration.none;
			}
		}

		return highlights;
	},
	provide: (f) => EditorView.decorations.from(f),
});

/**
 * Playback bar highlight theme style - yellow background
 */
export const playbackBarHighlightTheme = EditorView.baseTheme({
	".cm-playback-bar-highlight": {
		backgroundColor: "hsl(45 100% 60% / 0.25)",
		borderRadius: "2px",
	},
});

/**
 * Create playback sync extension
 * Includes: current beat highlight (green) + current bar highlight (yellow)
 *
 * @returns CodeMirror extension array
 */
export function createPlaybackSyncExtension(): Extension[] {
	return [
		playbackHighlightField,
		playbackHighlightTheme,
		playbackBarHighlightField,
		playbackBarHighlightTheme,
	];
}

/**
 * Calculate code range from playback position info
 *
 * @param text AlphaTex source code
 * @param playback Playback position info
 * @returns Code range, or null if cannot map
 */
export function mapPlaybackToCodeRange(
	text: string,
	playback: PlaybackBeatInfo,
): CodeRange | null {
	const beats = playbackRangeCache.getBeats(text);

	if (beats.length === 0) {
		return null;
	}

	let targetBeat = beats.find(
		(b) =>
			b.barIndex === playback.barIndex && b.beatIndex === playback.beatIndex,
	);

	if (!targetBeat) {
		targetBeat = beats.find((b) => b.barIndex === playback.barIndex);
	}

	if (!targetBeat) {
		return null;
	}

	return {
		from: targetBeat.startOffset,
		to: targetBeat.endOffset,
		startLine: targetBeat.startLine,
		startColumn: targetBeat.startColumn,
		endLine: targetBeat.endLine,
		endColumn: targetBeat.endColumn,
	};
}

const pendingFrameTasks = new WeakMap<EditorView, Map<string, number>>();
const lastScrollAtByView = new WeakMap<
	EditorView,
	{ playback: number; bar: number }
>();

function requestFrame(callback: () => void): number {
	if (
		typeof window !== "undefined" &&
		typeof window.requestAnimationFrame === "function"
	) {
		return window.requestAnimationFrame(callback);
	}
	return globalThis.setTimeout(callback, 0) as unknown as number;
}

function cancelFrame(id: number): void {
	if (
		typeof window !== "undefined" &&
		typeof window.cancelAnimationFrame === "function"
	) {
		window.cancelAnimationFrame(id);
		return;
	}
	globalThis.clearTimeout(id);
}

function nowMs(): number {
	if (
		typeof performance !== "undefined" &&
		typeof performance.now === "function"
	) {
		return performance.now();
	}
	return Date.now();
}

function scheduleViewTask(
	view: EditorView,
	key: string,
	task: () => void,
): void {
	let entry = pendingFrameTasks.get(view);
	if (!entry) {
		entry = new Map();
		pendingFrameTasks.set(view, entry);
	}

	const previous = entry.get(key);
	if (typeof previous === "number") {
		cancelFrame(previous);
	}

	const id = requestFrame(() => {
		const current = pendingFrameTasks.get(view);
		current?.delete(key);
		task();
	});
	entry.set(key, id);
}

function shouldRunScrollTask(
	view: EditorView,
	scope: "playback" | "bar",
	minIntervalMs: number,
): boolean {
	const now = nowMs();
	const prev = lastScrollAtByView.get(view) ?? { playback: 0, bar: 0 };
	const last = scope === "playback" ? prev.playback : prev.bar;
	if (now - last < minIntervalMs) {
		return false;
	}

	if (scope === "playback") {
		prev.playback = now;
	} else {
		prev.bar = now;
	}
	lastScrollAtByView.set(view, prev);
	return true;
}

/**
 * Safely dispatch effect, avoiding conflicts during view updates
 */
function safeDispatch(
	view: EditorView,
	effect: StateEffect<CodeRange | null>,
): void {
	if (!view || !view.dom || !document.contains(view.dom)) {
		return;
	}

	scheduleViewTask(view, "dispatch-playback-highlight", () => {
		if (!view || !view.dom || !document.contains(view.dom)) {
			return;
		}
		try {
			view.dispatch({ effects: effect });
		} catch (err) {
			console.error("[PlaybackSync] Failed to dispatch:", err);
		}
	});
}

/**
 * Safely dispatch bar highlight effect
 */
function safeDispatchBarHighlight(
	view: EditorView,
	value: { ranges: CodeRange[] } | null,
): void {
	if (!view || !view.dom || !document.contains(view.dom)) {
		return;
	}

	scheduleViewTask(view, "dispatch-playback-bar", () => {
		if (!view || !view.dom || !document.contains(view.dom)) {
			return;
		}
		try {
			view.dispatch({ effects: setPlaybackBarHighlightEffect.of(value) });
		} catch (err) {
			void err;
		}
	});
}

/**
 * Scroll editor to make playback highlight visible
 * Strategy: always scroll, keep highlight near top of viewport
 * Called frequently during playback, maintains follow effect
 *
 * @param view CodeMirror EditorView
 * @param codeRange Highlighted code range
 */
function scrollToPlaybackHighlight(
	view: EditorView,
	codeRange: CodeRange,
): void {
	if (!view || !view.dom || !document.contains(view.dom)) {
		return;
	}
	if (!shouldRunScrollTask(view, "playback", 48)) {
		return;
	}

	scheduleViewTask(view, "scroll-playback-highlight", () => {
		if (!view || !view.dom || !document.contains(view.dom)) {
			return;
		}

		try {
			const targetPos = codeRange.from;
			const coords = view.coordsAtPos(targetPos);
			const scrollDOM = view.scrollDOM;
			if (!coords) {
				view.dispatch({
					effects: EditorView.scrollIntoView(targetPos, {
						y: "center",
					}),
				});
				return;
			}

			const editorRect = scrollDOM.getBoundingClientRect();
			const viewportHeight = editorRect.height;
			const localTop = coords.top - editorRect.top;

			const topClamp = viewportHeight * 0.08;
			const bottomTurnTrigger = viewportHeight * 0.9;
			const pageStep = Math.floor(viewportHeight * 0.72);

			if (localTop < topClamp) {
				const targetTop = Math.max(
					0,
					scrollDOM.scrollTop - (topClamp - localTop) - 12,
				);
				scrollDOM.scrollTo({ top: targetTop, behavior: "auto" });
				return;
			}

			if (localTop > bottomTurnTrigger) {
				const maxTop = Math.max(0, scrollDOM.scrollHeight - viewportHeight);
				const targetTop = Math.min(maxTop, scrollDOM.scrollTop + pageStep);
				scrollDOM.scrollTo({ top: targetTop, behavior: "auto" });
			}
		} catch (err) {
			console.error(
				"[PlaybackSync] Failed to scroll to playback highlight:",
				err,
			);
		}
	});
}

/**
 * Scroll editor to make bar highlight visible (scroll to 33% viewport position)
 * Strategy: scroll when highlight is not in comfortable area
 *
 * @param view CodeMirror EditorView
 * @param codeRange Highlighted code range
 */
function scrollToBarHighlight(view: EditorView, codeRange: CodeRange): void {
	if (!view || !view.dom || !document.contains(view.dom)) {
		return;
	}
	if (!shouldRunScrollTask(view, "bar", 64)) {
		return;
	}

	scheduleViewTask(view, "scroll-bar-highlight", () => {
		if (!view || !view.dom || !document.contains(view.dom)) {
			return;
		}

		try {
			const targetPos = codeRange.from;
			const coords = view.coordsAtPos(targetPos);
			const scrollDOM = view.scrollDOM;
			if (!coords) {
				view.dispatch({
					effects: EditorView.scrollIntoView(targetPos, {
						y: "center",
					}),
				});
				return;
			}

			const editorRect = scrollDOM.getBoundingClientRect();
			const viewportHeight = editorRect.height;
			const localTop = coords.top - editorRect.top;

			const topThreshold = viewportHeight * 0.12;
			const bottomTurnTrigger = viewportHeight * 0.88;
			const pageStep = Math.floor(viewportHeight * 0.7);

			if (localTop < topThreshold) {
				const targetTop = Math.max(
					0,
					scrollDOM.scrollTop - (topThreshold - localTop) - 12,
				);
				scrollDOM.scrollTo({ top: targetTop, behavior: "auto" });
				return;
			}

			if (localTop > bottomTurnTrigger) {
				const maxTop = Math.max(0, scrollDOM.scrollHeight - viewportHeight);
				const targetTop = Math.min(maxTop, scrollDOM.scrollTop + pageStep);
				scrollDOM.scrollTo({ top: targetTop, behavior: "auto" });
			}
		} catch (err) {
			console.error("[PlaybackSync] Failed to scroll to bar highlight:", err);
		}
	});
}

/**
 * Update playback highlight in editor
 *
 * Playing: show green highlight (current note)
 * Not playing: show yellow highlight (player cursor bar)
 *
 * @param view CodeMirror EditorView
 * @param text AlphaTex source code
 * @param playback Currently playing position info (has value when playing)
 * @param cursorPosition Player cursor position (retained when paused)
 * @param isPlaying Whether currently playing
 * @param autoScroll Whether to auto-scroll to highlight position (default true)
 */
export function updateEditorPlaybackHighlight(
	view: EditorView,
	text: string,
	playback: PlaybackBeatInfo | null,
	cursorPosition: PlaybackBeatInfo | null,
	isPlaying: boolean,
	autoScroll = true,
): void {
	if (isPlaying && playback) {
		const codeRange = mapPlaybackToCodeRange(text, playback);
		safeDispatch(view, setPlaybackHighlightEffect.of(codeRange));
		safeDispatchBarHighlight(view, null);

		if (autoScroll && codeRange) {
			scrollToPlaybackHighlight(view, codeRange);
		}
	} else if (!isPlaying && cursorPosition) {
		safeDispatch(view, setPlaybackHighlightEffect.of(null));
		const barRanges = playbackRangeCache.getBarRanges(
			text,
			cursorPosition.barIndex,
		);
		safeDispatchBarHighlight(
			view,
			barRanges.length > 0 ? { ranges: barRanges } : null,
		);

		if (autoScroll && barRanges.length > 0) {
			scrollToBarHighlight(view, barRanges[0]);
		}
	} else {
		safeDispatch(view, setPlaybackHighlightEffect.of(null));
		safeDispatchBarHighlight(view, null);
	}
}
