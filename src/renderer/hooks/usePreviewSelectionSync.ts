/**
 * Syncs editor cursor to score: selection highlight, playback range, player cursor, scroll.
 */

import type * as alphaTab from "@coderline/alphatab";
import { useEffect } from "react";
import { findBeatInScore } from "../lib/alphatab-beat-utils";
import type { EditorCursorInfo } from "../store/appStore";
import { useAppStore } from "../store/appStore";

type ApplyEditorBarNumberColor = (
	api: alphaTab.AlphaTabApi,
	barIndex: number,
) => boolean;

export interface UsePreviewSelectionSyncArgs {
	apiRef: React.RefObject<alphaTab.AlphaTabApi | null>;
	containerRef: React.RefObject<HTMLDivElement | null>;
	scrollHostRef: React.RefObject<HTMLDivElement | null>;
	editorCursor: EditorCursorInfo | null;
	applyEditorBarNumberColor: ApplyEditorBarNumberColor;
	pendingBarColorRef: React.MutableRefObject<number | null>;
	isEditorCursorFromScoreRef: React.MutableRefObject<boolean>;
	isHighlightFromEditorCursorRef: React.MutableRefObject<boolean>;
	lastEditorCursorSelectionRef: React.MutableRefObject<{
		startBarIndex: number;
		endBarIndex: number;
	} | null>;
}

export function usePreviewSelectionSync({
	apiRef,
	containerRef,
	scrollHostRef,
	editorCursor,
	applyEditorBarNumberColor,
	pendingBarColorRef,
	isEditorCursorFromScoreRef,
	isHighlightFromEditorCursorRef,
	lastEditorCursorSelectionRef,
}: UsePreviewSelectionSyncArgs): void {
	useEffect(() => {
		const api = apiRef.current;
		if (!api || !editorCursor) return;

		// 检查是否启用了光标广播功能
		if (!useAppStore.getState().enableCursorBroadcast) return;

		if (editorCursor.barIndex < 0) return;
		if (isEditorCursorFromScoreRef.current) {
			isEditorCursorFromScoreRef.current = false;
			return;
		}

		const score = api.score;
		const beat = findBeatInScore(
			score,
			editorCursor.barIndex,
			editorCursor.beatIndex,
		);

		if (beat) {
			useAppStore.getState().clearScoreSelection();

			try {
				if (!applyEditorBarNumberColor(api, editorCursor.barIndex)) {
					pendingBarColorRef.current = editorCursor.barIndex;
				}

				let startTick: number | null = null;
				try {
					if (
						api.tickCache &&
						typeof api.tickCache.getBeatStart === "function"
					) {
						const tick = api.tickCache.getBeatStart(beat);
						if (tick !== undefined && tick !== null && tick >= 0) {
							startTick = tick;
						}
					}
					if (startTick === null && beat.playbackStart != null) {
						startTick = beat.playbackStart;
					}
					if (startTick !== null) {
						const isPlaying = useAppStore.getState().playerIsPlaying;
						if (!isPlaying) {
							api.tickPosition = startTick;
							useAppStore.getState().setPlayerCursorPosition({
								barIndex: editorCursor.barIndex,
								beatIndex: editorCursor.beatIndex,
							});
						}
					}
				} catch {
					// Failed to sync player cursor position
				}

				const bar = beat.voice?.bar;
				if (bar && bar.voices?.[0]?.beats?.length > 0) {
					const firstBeatInBar = bar.voices[0].beats[0];
					const lastBeatInBar =
						bar.voices[0].beats[bar.voices[0].beats.length - 1];

					if (typeof api.highlightPlaybackRange === "function") {
						isHighlightFromEditorCursorRef.current = true;
						lastEditorCursorSelectionRef.current = {
							startBarIndex: bar.index,
							endBarIndex: bar.index,
						};
						api.highlightPlaybackRange(firstBeatInBar, lastBeatInBar);
						setTimeout(() => {
							isHighlightFromEditorCursorRef.current = false;
							setTimeout(() => {
								lastEditorCursorSelectionRef.current = null;
							}, 100);
						}, 200);
					}

					try {
						let barStartTick: number | null = null;
						let barEndTick: number | null = null;

						if (
							api.tickCache &&
							typeof api.tickCache.getBeatStart === "function"
						) {
							barStartTick = api.tickCache.getBeatStart(firstBeatInBar);
							const lastBeatStartTick =
								api.tickCache.getBeatStart(lastBeatInBar);
							if (lastBeatInBar.nextBeat) {
								barEndTick = api.tickCache.getBeatStart(lastBeatInBar.nextBeat);
							} else if (
								lastBeatInBar.playbackDuration !== undefined &&
								lastBeatInBar.playbackDuration !== null
							) {
								barEndTick = lastBeatStartTick + lastBeatInBar.playbackDuration;
							} else {
								barEndTick = lastBeatStartTick;
							}
						}
						if (barStartTick === null || barEndTick === null) {
							if (firstBeatInBar.playbackStart !== undefined) {
								barStartTick = firstBeatInBar.playbackStart;
							}
							if (lastBeatInBar.playbackStart !== undefined) {
								const lastBeatStart = lastBeatInBar.playbackStart;
								if (
									lastBeatInBar.playbackDuration !== undefined &&
									lastBeatInBar.playbackDuration !== null
								) {
									barEndTick = lastBeatStart + lastBeatInBar.playbackDuration;
								} else if (
									lastBeatInBar.nextBeat?.playbackStart !== undefined
								) {
									barEndTick = (
										lastBeatInBar.nextBeat as { playbackStart: number }
									).playbackStart;
								} else {
									barEndTick = lastBeatStart;
								}
							}
						}
						if (
							barStartTick !== null &&
							barEndTick !== null &&
							barEndTick > barStartTick
						) {
							(
								api as unknown as {
									playbackRange?: { startTick: number; endTick: number } | null;
								}
							).playbackRange = {
								startTick: barStartTick,
								endTick: barEndTick,
							};
						}
					} catch {
						// Failed to set playback range
					}
				}

				if (!editorCursor.fromDocChange) {
					const bb = api.boundsLookup?.findBeat?.(beat);
					const scrollHost = scrollHostRef.current;
					const container = scrollHost ?? containerRef.current;

					if (bb && container) {
						const visual = bb.visualBounds;
						const containerRect = container.getBoundingClientRect();
						const beatTop = visual.y;
						const beatBottom = visual.y + visual.h;
						const scrollTop = (container as HTMLElement).scrollTop ?? 0;
						const viewportBottom = scrollTop + containerRect.height;

						if (beatTop < scrollTop || beatBottom > viewportBottom) {
							container.scrollTo({
								top: Math.max(0, beatTop - containerRect.height / 3),
								behavior: "smooth",
							});
						}
					}
				}
			} catch {
				// Failed to sync editor cursor to score
			}
		} else {
			useAppStore.getState().clearScoreSelection();
			try {
				const a = apiRef.current;
				if (a) {
					(a as unknown as { playbackRange?: null }).playbackRange = null;
				}
			} catch {
				// Failed to clear playback range
			}
		}
	}, [
		apiRef,
		containerRef,
		scrollHostRef,
		editorCursor,
		applyEditorBarNumberColor,
		pendingBarColorRef,
		isEditorCursorFromScoreRef,
		isHighlightFromEditorCursorRef,
		lastEditorCursorSelectionRef,
	]);
}
