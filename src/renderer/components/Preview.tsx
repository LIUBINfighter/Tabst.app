// @ts-nocheck
import * as alphaTab from "@coderline/alphatab";
import { FileDown, FileMusic, FileText, Music, Printer } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { createPreviewSettings } from "../lib/alphatab-config";
import { formatFullError } from "../lib/alphatab-error";
import {
	exportToGp7,
	exportToMidi,
	exportToWav,
	getDefaultExportFilename,
} from "../lib/alphatab-export";
import { loadBravuraFont, loadSoundFontFromUrl } from "../lib/assets";
import type { ResourceUrls } from "../lib/resourceLoaderService";
import { getResourceUrls } from "../lib/resourceLoaderService";
import {
	applyStaffConfig,
	type StaffDisplayOptions,
	toggleFirstStaffOption,
} from "../lib/staff-config";
import {
	getAlphaTabColorsForTheme,
	setupThemeObserver,
} from "../lib/themeManager";
import { useAppStore } from "../store/appStore";
import PrintPreview from "./PrintPreview";
import TopBar from "./TopBar";
import IconButton from "./ui/icon-button";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "./ui/tooltip";

/**
 * Find the Beat object in the score by barIndex and beatIndex
 */
function findBeatInScore(
	score: alphaTab.model.Score | null | undefined,
	barIndex: number,
	beatIndex: number,
): alphaTab.model.Beat | null {
	if (!score?.tracks?.length) return null;

	// Iterate through all staves of the first track
	const track = score.tracks[0];
	for (const staff of track.staves) {
		for (const bar of staff.bars) {
			if (bar.index === barIndex) {
				// Found matching bar, search for beat
				for (const voice of bar.voices) {
					for (const beat of voice.beats) {
						if (beat.index === beatIndex) {
							return beat;
						}
					}
				}
				// If exact beatIndex not found, return the first beat of the bar
				if (bar.voices[0]?.beats?.length > 0) {
					return bar.voices[0].beats[0];
				}
			}
		}
	}
	return null;
}

export interface PreviewProps {
	fileName?: string;
	content?: string;
	className?: string;
}

export default function Preview({
	fileName,
	content,
	className,
}: PreviewProps) {
	const { t } = useTranslation(["common", "errors", "print", "toolbar"]);
	const containerRef = useRef<HTMLDivElement>(null);
	const scrollHostRef = useRef<HTMLDivElement>(null);
	const apiRef = useRef<alphaTab.AlphaTabApi | null>(null);
	const cursorRef = useRef<HTMLDivElement | null>(null);
	// Zoom state (percentage)

	const zoomRef = useRef<number>(60);
	// Store tracks configuration for restoration during theme switching
	const trackConfigRef = useRef<{
		showNumbered?: boolean;
		showSlash?: boolean;
		showTablature?: boolean;
		showStandardNotation?: boolean;
	} | null>(null);
	// Store last successfully parsed score and content for error recovery
	const lastValidScoreRef = useRef<{
		score: alphaTab.model.Score;
		content: string;
	} | null>(null);
	// Track whether the last load was from user content (not restore/rebuild)
	const lastLoadWasUserContentRef = useRef<boolean>(false);
	// Error state for displaying parse error messages
	const [parseError, setParseError] = useState<string | null>(null);
	// Pending tex call tracking to detect parse failure on updates
	const pendingTexRef = useRef<{ id: number; content: string } | null>(null);
	const pendingTexTimerRef = useRef<number | null>(null);
	const texSeqRef = useRef(0);
	// Timeout duration (ms) for detecting parse delays (adjustable)
	const TEX_TIMEOUT_MS = 3000;
	// Track whether automatic recovery occurred (for UI display)
	const restorePerformedRef = useRef(false);
	const [restorePerformed, setRestorePerformed] = useState(false);
	// Store latest content for async callbacks and theme rebuild
	const latestContentRef = useRef<string>(content ?? "");
	// Print preview state and reinitialization trigger
	const [showPrintPreview, setShowPrintPreview] = useState(false);
	const [reinitTrigger, setReinitTrigger] = useState(0);

	// Subscribe to editor cursor position for reverse sync (editor → score)
	const editorCursor = useAppStore((s) => s.editorCursor);
	const setFirstStaffOptions = useAppStore((s) => s.setFirstStaffOptions);
	const pendingStaffToggle = useAppStore((s) => s.pendingStaffToggle);
	const toggleFirstStaffOptionStore = useAppStore(
		(s) => s.toggleFirstStaffOption,
	);
	const playbackSpeed = useAppStore((s) => s.playbackSpeed);
	const metronomeVolume = useAppStore((s) => s.metronomeVolume);
	const editorHasFocus = useAppStore((s) => s.editorHasFocus);
	const _scoreVersion = useAppStore((s) => s.scoreVersion);
	const bumpApiInstanceId = useAppStore((s) => s.bumpApiInstanceId);
	const bumpScoreVersion = useAppStore((s) => s.bumpScoreVersion);
	// Store latest playback speed/metronome volume in ref to avoid triggering API rebuild useEffect
	const playbackSpeedRef = useRef(playbackSpeed);
	const metronomeVolumeRef = useRef(metronomeVolume);
	const editorHasFocusRef = useRef(editorHasFocus);
	const _savedPlayerScrollRef = useRef<{
		scrollElement?: HTMLElement | null;
		scrollMode?: alphaTab.ScrollMode | undefined;
	} | null>(null);
	const lastColoredBarsRef = useRef<{
		barIndex: number;
		bars: alphaTab.model.Bar[];
		score: alphaTab.model.Score | null;
	} | null>(null);
	const pendingBarColorRef = useRef<number | null>(null);
	// Prevent loop from cursor updates triggered by score selection
	const isEditorCursorFromScoreRef = useRef(false);
	// Track whether current highlight is triggered by editor cursor (to distinguish from manual selection)
	const isHighlightFromEditorCursorRef = useRef(false);
	// Store last selection info triggered by editor cursor for event handling identification
	const lastEditorCursorSelectionRef = useRef<{
		startBarIndex: number;
		endBarIndex: number;
	} | null>(null);

	// Editor and player cursors can now work simultaneously and sync
	useEffect(() => {
		editorHasFocusRef.current = editorHasFocus;
	}, [editorHasFocus]);

	useEffect(() => {
		latestContentRef.current = content ?? "";
	}, [content]);

	// Sync global state to initialized alphaTab (without rebuilding score)
	useEffect(() => {
		playbackSpeedRef.current = playbackSpeed;
		const api = apiRef.current;
		if (!api) return;
		try {
			api.playbackSpeed = playbackSpeed;
		} catch {
			// Failed to apply playback speed
		}
	}, [playbackSpeed]);

	useEffect(() => {
		metronomeVolumeRef.current = metronomeVolume;
		const api = apiRef.current;
		if (!api) return;
		try {
			api.metronomeVolume = metronomeVolume;
		} catch {
			// Failed to apply metronome volume
		}
	}, [metronomeVolume]);

	// Unified scroll buffer: calculate bottom padding as 60% of preview scroll container height (px)
	useEffect(() => {
		const host = scrollHostRef.current;
		if (!host) return;
		const apply = () => {
			const h = host.getBoundingClientRect().height;
			const px = Math.max(0, Math.floor(h * 0.6));
			host.style.setProperty("--scroll-buffer", `${px}px`);
		};

		apply();

		const ro = new ResizeObserver(() => apply());
		ro.observe(host);
		return () => ro.disconnect();
	}, []);

	// Apply zoom to alphaTab API
	const applyZoom = useCallback((newPercent: number) => {
		const pct = Math.max(10, Math.min(400, Math.round(newPercent)));
		// Keep store in sync
		useAppStore.getState().setZoomPercent(pct);
		zoomRef.current = pct;
		const api = apiRef.current;
		if (!api || !api.settings) return;
		try {
			const disp = api.settings.display as unknown as { scale?: number };
			disp.scale = pct / 100;
			api.updateSettings?.();
			// Prefer partial re-render if available
			if (api.render) api.render();
		} catch (e) {
			console.error("[Preview] Failed to apply zoom:", e);
		}
	}, []);

	const _clearBarNumberColor = useCallback((_api: alphaTab.AlphaTabApi) => {
		const previous = lastColoredBarsRef.current;
		if (!previous?.bars?.length) return;

		// Get all default colors for current theme
		const themeColors = getAlphaTabColorsForTheme();
		const barNumberColor = alphaTab.model.Color.fromJson(
			themeColors.barNumberColor,
		);
		const _mainGlyphColor = alphaTab.model.Color.fromJson(
			themeColors.mainGlyphColor,
		);
		const staffLineColor = alphaTab.model.Color.fromJson(
			themeColors.staffLineColor,
		);
		const barSeparatorColor = alphaTab.model.Color.fromJson(
			themeColors.barSeparatorColor,
		);

		for (const bar of previous.bars) {
			const style = bar.style;
			if (!style?.colors) continue;

			// Backup original colors for error recovery
			const backup = Array.from(style.colors.entries());
			try {
				// Restore bar number colors
				style.colors.set(
					alphaTab.model.BarSubElement.StandardNotationBarNumber,
					barNumberColor,
				);
				style.colors.set(
					alphaTab.model.BarSubElement.GuitarTabsBarNumber,
					barNumberColor,
				);
				style.colors.set(
					alphaTab.model.BarSubElement.SlashBarNumber,
					barNumberColor,
				);
				style.colors.set(
					alphaTab.model.BarSubElement.NumberedBarNumber,
					barNumberColor,
				);

				// Restore staff line colors
				style.colors.set(
					alphaTab.model.BarSubElement.StandardNotationStaffLine,
					staffLineColor,
				);
				style.colors.set(
					alphaTab.model.BarSubElement.GuitarTabsStaffLine,
					staffLineColor,
				);

				// Restore bar separator colors (using bar lines)
				style.colors.set(
					alphaTab.model.BarSubElement.StandardNotationBarLines,
					barSeparatorColor,
				);
				style.colors.set(
					alphaTab.model.BarSubElement.GuitarTabsBarLines,
					barSeparatorColor,
				);

				// Check for undefined values to prevent serialization errors
				for (const [k, v] of style.colors.entries()) {
					if (v === undefined || v === null) {
						console.warn("[BarColor] Found undefined color value for key", k);
						throw new Error("Invalid color value");
					}
					if (typeof v?.toString !== "function") {
						console.warn(
							"[BarColor] Color value missing toString for key",
							k,
							v,
						);
						throw new Error("Invalid color object");
					}
				}
			} catch (err) {
				console.error(
					"[BarColor] Failed to restore bar colors, reverting:",
					err,
				);
				// Restore backup
				style.colors.clear?.();
				for (const [k, v] of backup) {
					style.colors.set(k, v);
				}
			}
		}
		lastColoredBarsRef.current = null;
	}, []);

	// Helper function: safely set color, ensuring both key and value are valid
	const safeSetColor = useCallback(
		(
			colors: Map<number, alphaTab.model.Color | null>,
			key: number | undefined,
			value: alphaTab.model.Color | undefined,
		): boolean => {
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
				// Test if toString can be called normally
				value.toString();
				colors.set(key, value);
				return true;
			} catch (e) {
				console.error("[BarColor] Failed to set color, key:", key, "error:", e);
				return false;
			}
		},
		[],
	);

	const sanitizeAllBarStyles = useCallback((api: alphaTab.AlphaTabApi) => {
		if (!api.score) return false;
		let fixes = 0;
		const themeColors = getAlphaTabColorsForTheme();

		// Validate and create all Color objects
		let barNumberColor: alphaTab.model.Color | null = null;
		let mainGlyphColor: alphaTab.model.Color | null = null;
		let staffLineColor: alphaTab.model.Color | null = null;
		let barSeparatorColor: alphaTab.model.Color | null = null;

		try {
			barNumberColor = alphaTab.model.Color.fromJson(
				themeColors.barNumberColor,
			);
			mainGlyphColor = alphaTab.model.Color.fromJson(
				themeColors.mainGlyphColor,
			);
			staffLineColor = alphaTab.model.Color.fromJson(
				themeColors.staffLineColor,
			);
			barSeparatorColor = alphaTab.model.Color.fromJson(
				themeColors.barSeparatorColor,
			);

			// Validate all Color objects are valid
			if (!barNumberColor || typeof barNumberColor.toString !== "function") {
				throw new Error("Invalid barNumberColor");
			}
			if (!mainGlyphColor || typeof mainGlyphColor.toString !== "function") {
				throw new Error("Invalid mainGlyphColor");
			}
			if (!staffLineColor || typeof staffLineColor.toString !== "function") {
				throw new Error("Invalid staffLineColor");
			}
			if (
				!barSeparatorColor ||
				typeof barSeparatorColor.toString !== "function"
			) {
				throw new Error("Invalid barSeparatorColor");
			}
		} catch (err) {
			console.error(
				"[BarColor] Failed to create Color objects in sanitizeAllBarStyles:",
				err,
			);
			return false;
		}

		for (const track of api.score.tracks ?? []) {
			for (const staff of track.staves ?? []) {
				for (const bar of staff.bars ?? []) {
					const style = bar.style;
					if (!style?.colors) continue;

					// Create new Map, keeping only valid key-value pairs
					const validEntries: Array<[number, alphaTab.model.Color]> = [];

					for (const [k, v] of Array.from(style.colors.entries())) {
						try {
							// Check if key is valid
							if (k === undefined || k === null || typeof k !== "number") {
								console.warn("[BarColor] Invalid key in colors map:", k);
								fixes++;
								continue;
							}

							// Check if value is valid
							if (v === undefined || v === null) {
								console.warn(
									"[BarColor] Found undefined/null color value for key",
									k,
								);
								fixes++;
								continue;
							}

							// If string, try to parse
							if (typeof v === "string") {
								try {
									const parsed = alphaTab.model.Color.fromJson(v);
									if (parsed && typeof parsed.toString === "function") {
										validEntries.push([k, parsed]);
										fixes++;
									} else {
										console.warn("[BarColor] Failed to parse color string:", v);
										fixes++;
									}
									continue;
								} catch (_e) {
									console.warn(
										"[BarColor] Color.fromJson failed for string:",
										v,
									);
									fixes++;
									continue;
								}
							}

							// Check if toString method exists
							if (typeof v?.toString !== "function") {
								console.warn(
									"[BarColor] Color value missing toString for key",
									k,
									"value:",
									v,
								);
								// Try using fallback
								let fallback = mainGlyphColor;
								const keyName = Object.keys(alphaTab.model.BarSubElement).find(
									(n) => alphaTab.model.BarSubElement[n] === k,
								);
								if (keyName) {
									if (keyName.includes("BarNumber")) fallback = barNumberColor;
									else if (keyName.includes("StaffLines"))
										fallback = staffLineColor;
									else if (keyName.includes("BarSeparator"))
										fallback = barSeparatorColor;
								}
								validEntries.push([k, fallback]);
								fixes++;
								continue;
							}

							// Verify toString method can be called normally
							try {
								v.toString();
								validEntries.push([k, v as alphaTab.model.Color]);
							} catch (e) {
								console.warn("[BarColor] toString() failed for key", k, ":", e);
								// Use fallback
								let fallback = mainGlyphColor;
								const keyName = Object.keys(alphaTab.model.BarSubElement).find(
									(n) => alphaTab.model.BarSubElement[n] === k,
								);
								if (keyName) {
									if (keyName.includes("BarNumber")) fallback = barNumberColor;
									else if (keyName.includes("StaffLines"))
										fallback = staffLineColor;
									else if (keyName.includes("BarSeparator"))
										fallback = barSeparatorColor;
								}
								validEntries.push([k, fallback]);
								fixes++;
							}
						} catch (err) {
							console.error(
								"[BarColor] Error validating color for key",
								k,
								err,
							);
							fixes++;
						}
					}

					// Clear and reset valid key-value pairs
					style.colors.clear?.();
					for (const [k, v] of validEntries) {
						style.colors.set(k, v);
					}
				}
			}
		}
		// Applied fixes to bar styles
		// Note: do not call render in sanitize, let caller decide when to render
		return fixes > 0;
	}, []);

	// Simplified approach: only remove bar number colors, let other elements use global theme colors
	// If colors Map is empty, try to delete entire bar.style (let alphaTab use global styles)
	const applyThemeColorsToPreviousBars = useCallback(
		(_api: alphaTab.AlphaTabApi) => {
			const previous = lastColoredBarsRef.current;
			if (!previous?.bars?.length) return;

			const barNumberKeys = [
				alphaTab.model.BarSubElement.StandardNotationBarNumber,
				alphaTab.model.BarSubElement.GuitarTabsBarNumber,
				alphaTab.model.BarSubElement.SlashBarNumber,
				alphaTab.model.BarSubElement.NumberedBarNumber,
			];

			for (const bar of previous.bars) {
				if (!bar?.style?.colors) continue;

				const style = bar.style;

				// Only remove bar number related colors
				for (const key of barNumberKeys) {
					style.colors.delete(key);
				}

				// If colors Map is empty, try to delete entire style (let alphaTab use global theme colors)
				if (style.colors.size === 0) {
					// Note: need to confirm if alphaTab supports bar.style = null/undefined
					// If not supported, keep empty BarStyle (should not affect rendering since Map is empty)
					try {
						// @ts-expect-error - Try to delete style, let alphaTab use global styles
						bar.style = null;
					} catch (_e) {
						// If alphaTab doesn't support deleting style, keep empty BarStyle
					}
				}
			}

			lastColoredBarsRef.current = null;
		},
		[],
	);

	const applyEditorBarNumberColor = useCallback(
		(api: alphaTab.AlphaTabApi, barIndex: number): boolean => {
			if (!api.score?.tracks?.length) {
				return false;
			}
			const currentScore = api.score ?? null;
			if (
				lastColoredBarsRef.current?.barIndex === barIndex &&
				lastColoredBarsRef.current?.score === currentScore
			) {
				return true;
			}

			// Sanitize global bar styles before modification to prevent serialization crashes
			sanitizeAllBarStyles(api);

			// First apply theme colors to previous bars (avoid residual special styles)
			applyThemeColorsToPreviousBars(api);

			const bars: alphaTab.model.Bar[] = [];

			// Only create highlight color (red)
			let highlightColor: alphaTab.model.Color | null = null;
			try {
				highlightColor = alphaTab.model.Color.fromJson("#ef4444");
				if (!highlightColor || typeof highlightColor.toString !== "function") {
					throw new Error("Invalid highlightColor");
				}
			} catch (err) {
				console.error("[BarColor] Failed to create highlightColor:", err);
				return false;
			}

			for (const track of api.score.tracks ?? []) {
				for (const staff of track.staves ?? []) {
					for (const bar of staff.bars ?? []) {
						if (bar.index !== barIndex) continue;
						bars.push(bar);

						// Only create style if it doesn't exist (minimize intervention)
						if (!bar.style) {
							bar.style = new alphaTab.model.BarStyle();
						}

						// Only set bar number color to red, other elements use global theme colors
						safeSetColor(
							bar.style.colors,
							alphaTab.model.BarSubElement.StandardNotationBarNumber,
							highlightColor,
						);
						safeSetColor(
							bar.style.colors,
							alphaTab.model.BarSubElement.GuitarTabsBarNumber,
							highlightColor,
						);
						safeSetColor(
							bar.style.colors,
							alphaTab.model.BarSubElement.SlashBarNumber,
							highlightColor,
						);
						safeSetColor(
							bar.style.colors,
							alphaTab.model.BarSubElement.NumberedBarNumber,
							highlightColor,
						);
					}
				}
			}

			lastColoredBarsRef.current = { barIndex, bars, score: currentScore };

			// Sanitize again before render() to ensure all color values are valid (prevent serialization errors)
			try {
				sanitizeAllBarStyles(api);
			} catch (err) {
				console.error(
					"[BarColor] sanitizeAllBarStyles failed before render:",
					err,
				);
				// Even if sanitize fails, try to render as only some bars may have issues
			}

			api.render?.();
			return true;
		},
		[applyThemeColorsToPreviousBars, sanitizeAllBarStyles, safeSetColor],
	);

	useEffect(() => {
		// When score changes, clear old coloring cache and reapply
		const api = apiRef.current;
		if (api) {
			applyThemeColorsToPreviousBars(api);
		}
		pendingBarColorRef.current = null;
		if (!api || !editorCursor || editorCursor.barIndex < 0) return;
		if (!applyEditorBarNumberColor(api, editorCursor.barIndex)) {
			pendingBarColorRef.current = editorCursor.barIndex;
		}
	}, [applyEditorBarNumberColor, applyThemeColorsToPreviousBars, editorCursor]);

	/**
	 * Apply tracks display configuration to the first track
	 * Read saved configuration from trackConfigRef, use defaults if not available
	 */
	const applyTracksConfig = useCallback(
		(api: alphaTab.AlphaTabApi) => {
			// Get saved configuration from ref, use defaults if not available
			const config: StaffDisplayOptions = trackConfigRef.current || {
				showTablature: true,
				showStandardNotation: false,
				showSlash: false,
				showNumbered: false,
			};

			// Apply configuration
			const appliedConfig = applyStaffConfig(api, config);
			if (appliedConfig) {
				// Update UI state
				setFirstStaffOptions(appliedConfig);
			}
		},
		[setFirstStaffOptions],
	);

	/**
	 * Listen to editor cursor changes and sync to score selection
	 * Implements clicking editor code to locate corresponding position in score
	 */
	useEffect(() => {
		const api = apiRef.current;
		if (!api || !editorCursor) return;

		// Check if position is invalid (in metadata area)
		if (editorCursor.barIndex < 0) {
			return;
		}

		// Prevent loop: if current cursor was triggered by score selection, skip
		if (isEditorCursorFromScoreRef.current) {
			isEditorCursorFromScoreRef.current = false;
			return;
		}

		// Find corresponding Beat in current score (first get the bar where new cursor is located)
		const score = api.score;
		const beat = findBeatInScore(
			score,
			editorCursor.barIndex,
			editorCursor.beatIndex,
		);

		if (beat) {
			// Clear old selection highlight immediately after getting new cursor bar
			// This clears old state before applying new styles and setting new selection
			useAppStore.getState().clearScoreSelection();

			try {
				// 1. Apply new bar score style (bar number highlight)
				if (!applyEditorBarNumberColor(api, editorCursor.barIndex)) {
					pendingBarColorRef.current = editorCursor.barIndex;
				}

				// 2. Sync player cursor position to editor cursor position
				// Player cursor will follow editor cursor movement
				let startTick: number | null = null;
				try {
					// Method 1: Use tickCache.getBeatStart() to get beat start tick position
					if (
						api.tickCache &&
						typeof api.tickCache.getBeatStart === "function"
					) {
						const tick = api.tickCache.getBeatStart(beat);
						if (tick !== undefined && tick !== null && tick >= 0) {
							startTick = tick;
						}
					}
					// Method 2: If tickCache unavailable, fallback to using beat properties
					if (startTick === null) {
						if (
							beat.playbackStart !== undefined &&
							beat.playbackStart !== null
						) {
							startTick = beat.playbackStart;
						}
					}
					if (startTick !== null) {
						const isPlaying = useAppStore.getState().playerIsPlaying;
						if (!isPlaying) {
							api.tickPosition = startTick;
							// Update player cursor position in store
							useAppStore.getState().setPlayerCursorPosition({
								barIndex: editorCursor.barIndex,
								beatIndex: editorCursor.beatIndex,
							});
						}
					}
				} catch {
					// Failed to sync player cursor position
				}

				// 3. Select entire bar (from first beat to last beat)
				// Playback will automatically stop after this bar
				const bar = beat.voice?.bar;
				if (bar && bar.voices?.[0]?.beats?.length > 0) {
					const firstBeatInBar = bar.voices[0].beats[0];
					const lastBeatInBar =
						bar.voices[0].beats[bar.voices[0].beats.length - 1];

					// Use highlightPlaybackRange to highlight entire bar
					// Mark as triggered by editor cursor to avoid setting scoreSelection when playbackRangeHighlightChanged fires
					if (typeof api.highlightPlaybackRange === "function") {
						// Mark as triggered by editor cursor (set before API call to ensure event handler can identify)
						isHighlightFromEditorCursorRef.current = true;

						// Record selection info triggered by this editor cursor for subsequent event identification
						lastEditorCursorSelectionRef.current = {
							startBarIndex: bar.index,
							endBarIndex: bar.index,
						};

						// Set new highlight range (this triggers playbackRangeHighlightChanged event)
						api.highlightPlaybackRange(firstBeatInBar, lastBeatInBar);

						// Delay reset flag to ensure playbackRangeHighlightChanged event can correctly identify
						// Use longer delay as alphaTab may trigger event after rendering completes
						setTimeout(() => {
							isHighlightFromEditorCursorRef.current = false;
							// Delay clearing selection record to give all event handlers enough time
							setTimeout(() => {
								lastEditorCursorSelectionRef.current = null;
							}, 100);
						}, 200);
					}

					// Set playback range so playback automatically stops after this bar
					try {
						let barStartTick: number | null = null;
						let barEndTick: number | null = null;

						// Get bar start and end ticks
						if (
							api.tickCache &&
							typeof api.tickCache.getBeatStart === "function"
						) {
							barStartTick = api.tickCache.getBeatStart(firstBeatInBar);
							const lastBeatStartTick =
								api.tickCache.getBeatStart(lastBeatInBar);

							// Get last beat end tick
							// Method 1: If there's a next beat, use next beat's start tick
							if (lastBeatInBar.nextBeat) {
								barEndTick = api.tickCache.getBeatStart(lastBeatInBar.nextBeat);
							}
							// Method 2: If no next beat, use last beat's start tick + duration
							else {
								if (
									lastBeatInBar.playbackDuration !== undefined &&
									lastBeatInBar.playbackDuration !== null
								) {
									barEndTick =
										lastBeatStartTick + lastBeatInBar.playbackDuration;
								} else {
									// If duration unavailable, use last beat's start tick
									barEndTick = lastBeatStartTick;
								}
							}
						}

						// If unable to get via tickCache, try using beat properties
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
								} else if (lastBeatInBar.nextBeat) {
									if (lastBeatInBar.nextBeat.playbackStart !== undefined) {
										// @ts-expect-error
										barEndTick = lastBeatInBar.nextBeat.playbackStart;
									}
								} else {
									barEndTick = lastBeatStart;
								}
							}
						}

						// Set playback range (always set to ensure update to new position)
						if (
							barStartTick !== null &&
							barEndTick !== null &&
							barEndTick > barStartTick
						) {
							// @ts-expect-error - playbackRange may need specific type
							api.playbackRange = {
								startTick: barStartTick,
								endTick: barEndTick,
							};
						}
					} catch {
						// Failed to set playback range
					}
				}

				// Scroll to beat position (optional)
				// Don't auto-scroll for docChanged from input, keep current view
				if (!editorCursor.fromDocChange) {
					const bb = api.boundsLookup?.findBeat?.(beat);
					// Actual scroll container: prefer scrollHost (has overflow-auto), fallback to inner container
					const scrollHost = scrollHostRef.current;
					const container = scrollHost ?? containerRef.current;

					if (bb && container) {
						const visual = bb.visualBounds;
						const containerRect = container.getBoundingClientRect();

						// Check if beat is in visible area
						const beatTop = visual.y;
						const beatBottom = visual.y + visual.h;
						const scrollTop = (container as HTMLElement).scrollTop ?? 0;
						const viewportTop = scrollTop;
						const viewportBottom = scrollTop + containerRect.height;

						// If beat not in visible area, scroll to it
						if (beatTop < viewportTop || beatBottom > viewportBottom) {
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
			// When editor cursor is at invalid position, clear selection highlight and playback range
			useAppStore.getState().clearScoreSelection();

			// Clear playback range, restore full playback
			try {
				const api = apiRef.current;
				if (api) {
					// @ts-expect-error
					api.playbackRange = null;
					// Clear highlight range
					if (typeof api.highlightPlaybackRange === "function") {
						// Pass null or undefined to clear highlight
						// Note: alphaTab may not support passing null, need to check API
						// If not, can try passing same beat to "reset"
					}
				}
			} catch {
				// Failed to clear playback range
			}
		}
	}, [editorCursor, applyEditorBarNumberColor]);

	// Handle staff toggle requests from GlobalBottomBar
	useEffect(() => {
		if (pendingStaffToggle) {
			const api = apiRef.current;
			if (!api) return;

			const newValue = toggleFirstStaffOption(api, pendingStaffToggle);
			if (newValue !== null) {
				// Update state in store
				toggleFirstStaffOptionStore(pendingStaffToggle);
			}

			// Clear pending toggle
			setTimeout(() => useAppStore.setState({ pendingStaffToggle: null }), 0);
		}
	}, [pendingStaffToggle, toggleFirstStaffOptionStore]);

	useEffect(() => {
		if (!containerRef.current) return;

		// 使用 reinitTrigger 触发重新初始化（例如从打印预览返回时）
		if (reinitTrigger > 0) {
			// Reinitializing alphaTab API
		}

		/**
		 * 🆕 统一附加所有 alphaTab 事件监听器
		 * 确保在初始化和主题重建时都能正确绑定所有功能
		 */
		const attachApiListeners = (api: alphaTab.AlphaTabApi) => {
			// 1. 音频加载
			try {
				api.soundFontLoaded?.on(() => {
					console.info("[Preview] alphaTab soundfont loaded");
					try {
						if (api) api.masterVolume = 1.0;
					} catch (_) {
						// ignore if property not available
					}
				});
			} catch {
				// Soundfont event binding failed
			}

			// 2. 渲染完成（处理光标，注意：不要修改播放状态）
			api.renderFinished.on((r) => {
				console.info("[Preview] alphaTab render complete:", r);
				const cursor = cursorRef.current;
				if (cursor) cursor.classList.add("hidden");
				// 渲染完成时回到无高亮状态（避免保留旧的黄色小节高亮导致滚动锁定）
				useAppStore.getState().clearPlaybackHighlights();

				// 🆕 尝试提取乐谱的初始 BPM（以便 BPM 模式使用）
				try {
					const score = api?.score;
					let initialBpm: number | null = null;
					if (score) {
						if (score.masterBars?.length) {
							const mb0 = score.masterBars[0] as unknown as {
								tempoChanges?: Array<{ value?: number }>;
							};
							if (mb0?.tempoChanges?.length) {
								const mc = mb0.tempoChanges[0];
								if (mc && typeof mc.value === "number") initialBpm = mc.value;
							} else if (
								typeof (score as unknown as { tempo?: number }).tempo ===
								"number"
							) {
								initialBpm =
									(score as unknown as { tempo?: number }).tempo ?? null;
							}
						}
					}
					useAppStore.getState().setSongInitialBpm(initialBpm);
				} catch {
					// setSongInitialBpm failed
				}
			});

			// 3. 播放进度（更新光标位置）
			api.playedBeatChanged?.on((beat: alphaTab.model.Beat | null) => {
				if (!beat) {
					// 播放停止/结束时回到无高亮状态（同时清除黄色小节高亮的来源）
					useAppStore.getState().clearPlaybackHighlights();
					useAppStore.getState().setPlayerIsPlaying(false);
					return;
				}
				const barIndex = beat.voice?.bar?.index ?? 0;
				const beatIndex = beat.index ?? 0;
				useAppStore.getState().setPlaybackBeat({ barIndex, beatIndex });
				// 🆕 同时更新播放器光标位置（暂停后保留）
				useAppStore.getState().setPlayerCursorPosition({ barIndex, beatIndex });

				const cursor = cursorRef.current;
				if (!cursor) return;
				const bb = api.boundsLookup?.findBeat?.(beat);
				if (!bb) {
					cursor.classList.add("hidden");
					return;
				}
				cursor.classList.remove("hidden");
				const visual = bb.visualBounds;
				cursor.style.left = `${visual.x}px`;
				cursor.style.top = `${visual.y}px`;
				cursor.style.width = `${visual.w}px`;
				cursor.style.height = `${visual.h}px`;
			});

			// 4. 播放器完成/状态变化事件：确保 UI 与播放器同步
			api.playerFinished?.on(() => {
				console.info("[Preview] alphaTab player finished");
				// 播放结束后播放器光标可能回到默认位置，但 store 仍可能停留在末尾
				// 这里强制回到无高亮状态，避免编辑器高亮/滚动锁死在末尾
				useAppStore.getState().clearPlaybackHighlights();
				useAppStore.getState().setPlayerIsPlaying(false);
			});

			api.playerStateChanged?.on((e: { state: number; stopped?: boolean }) => {
				console.info("[Preview] alphaTab player state changed:", e);
				if (e?.stopped) {
					// stopped 明确表示停止（而不是暂停），停止时清除播放相关高亮
					useAppStore.getState().clearPlaybackHighlights();
					useAppStore.getState().setPlayerIsPlaying(false);
				} else if (e?.state === 1 /* Playing */) {
					useAppStore.getState().setPlayerIsPlaying(true);
				} else {
					useAppStore.getState().setPlayerIsPlaying(false);
				}
			});

			// 🆕 Register playback controls to store so controls can live outside of Preview
			try {
				useAppStore.getState().registerPlayerControls({
					play: () => {
						// 🆕 播放开始时，清除用户手动选择的选区高亮（但保留编辑器光标触发的播放范围）
						// 这样可以避免播放时编辑器中的蓝色选区高亮干扰视觉
						useAppStore.getState().clearScoreSelection();

						// 如果有高亮的小节，从该小节的第一个 beat 开始播放
						const highlightedBar = lastColoredBarsRef.current;
						if (
							highlightedBar &&
							highlightedBar.bars?.length > 0 &&
							api.score
						) {
							const bar = highlightedBar.bars[0];
							// 获取该小节的第一个 beat
							if (bar.voices?.[0]?.beats?.length > 0) {
								const firstBeat = bar.voices[0].beats[0];
								const barIndex = bar.index;
								const beatIndex = firstBeat.index;

								console.info(
									"[Preview] Starting playback from highlighted bar",
									barIndex,
									"beat",
									beatIndex,
								);

								// 先停止当前播放（如果有）
								api.stop?.();

								// 先设置播放器光标位置
								useAppStore.getState().setPlayerCursorPosition({
									barIndex,
									beatIndex,
								});

								// 尝试设置播放位置
								let positionSet = false;
								try {
									// 方法 1: 使用 tickCache.getBeatStart() 获取 beat 的开始 tick 位置
									// 这是 alphaTab 官方推荐的方法
									if (
										api.tickCache &&
										typeof api.tickCache.getBeatStart === "function"
									) {
										const startTick = api.tickCache.getBeatStart(firstBeat);
										if (
											startTick !== undefined &&
											startTick !== null &&
											startTick >= 0
										) {
											api.tickPosition = startTick;
											positionSet = true;
										}
									}

									// 方法 2: 如果 tickCache 不可用，尝试使用 beat 的属性
									if (!positionSet) {
										// @ts-expect-error - beat 可能有 playbackStart 属性
										if (
											firstBeat.playbackStart !== undefined &&
											firstBeat.playbackStart !== null
										) {
											// @ts-expect-error
											api.tickPosition = firstBeat.playbackStart;
											positionSet = true;
										}
										// @ts-expect-error
										else if (
											firstBeat.displayStart !== undefined &&
											firstBeat.displayStart !== null
										) {
											// @ts-expect-error
											api.tickPosition = firstBeat.displayStart;
											positionSet = true;
										}
									}
								} catch (err) {
									console.warn(
										"[Preview] Failed to set playback position:",
										err,
									);
								}

								// 如果成功设置了位置，等待一小段时间让位置设置生效，然后播放
								if (positionSet) {
									// 使用 setTimeout 确保位置设置生效后再播放
									setTimeout(() => {
										api.play?.();
									}, 50); // 50ms 延迟，确保位置设置生效
								} else {
									// 如果无法设置位置，尝试使用 highlightPlaybackRange
									// 然后正常播放（可能不会从该位置开始，但至少会高亮）
									if (typeof api.highlightPlaybackRange === "function") {
										api.highlightPlaybackRange(firstBeat, firstBeat);
									}
									api.play?.();
								}
								return;
							}
						}
						// 如果没有高亮小节，正常从头播放
						api.play?.();
					},
					pause: () => api.pause?.(),
					stop: () => {
						// 1. 停止播放器
						api.stop?.();

						// 2. 清除选区高亮
						useAppStore.getState().clearScoreSelection();

						// 3. 清除播放相关高亮（绿色当前 beat 高亮 + 黄色小节高亮）
						useAppStore.getState().clearPlaybackHighlights();

						// 4. 重置播放器状态
						useAppStore.getState().setPlayerIsPlaying(false);

						// 5. 清除编辑器光标相关的 refs（避免残留状态）
						isHighlightFromEditorCursorRef.current = false;
						lastEditorCursorSelectionRef.current = null;

						// 6. 🆕 清除小节号红色高亮（Editor -> Preview 的高亮）
						// 恢复之前高亮的小节到默认主题颜色
						try {
							if (lastColoredBarsRef.current?.bars?.length > 0) {
								applyThemeColorsToPreviousBars(api);
								// 清除 refs
								lastColoredBarsRef.current = null;
								pendingBarColorRef.current = null;
								// 重新渲染以应用颜色更改
								if (api.render) {
									api.render();
								}
							}
						} catch {
							// Failed to clear bar number highlight
						}

						// 7. 清除播放范围和高亮范围
						try {
							api.playbackRange = null;

							// 清除高亮范围（如果 API 支持）
							if (typeof api.highlightPlaybackRange === "function") {
								// 注意：alphaTab 可能不支持传递 null 来清除，但我们可以尝试
								// 如果不行，这个调用会被忽略
								try {
									// 尝试清除：传递 undefined 或 null（如果 API 支持）
									api.highlightPlaybackRange(null, null);
								} catch {
									// 如果 API 不支持，忽略错误
								}
							}
						} catch {
							// Failed to clear playback range
						}
					},
					refresh: () => {
						// 1. 先停止播放并清除所有状态
						api.stop?.();
						useAppStore.getState().clearScoreSelection();
						useAppStore.getState().clearPlaybackHighlights();
						useAppStore.getState().setPlayerIsPlaying(false);

						// 2. 清除编辑器光标相关的 refs
						isHighlightFromEditorCursorRef.current = false;
						lastEditorCursorSelectionRef.current = null;

						// 3. 销毁当前 API
						if (apiRef.current) {
							// 清理主题观察者
							const unsubscribeTheme = (
								apiRef.current as unknown as Record<string, unknown>
							).__unsubscribeTheme;
							if (typeof unsubscribeTheme === "function") {
								unsubscribeTheme();
							}

							// 取消注册播放器控制
							try {
								useAppStore.getState().unregisterPlayerControls();
							} catch {
								// Failed to unregister player controls
							}

							// 销毁 API
							apiRef.current.destroy();
							apiRef.current = null;

							// 清除选区高亮
							useAppStore.getState().clearScoreSelection();
						}

						// 4. 清除 pending tex 相关计时器
						if (pendingTexTimerRef.current) {
							clearTimeout(pendingTexTimerRef.current);
							pendingTexTimerRef.current = null;
						}
						pendingTexRef.current = null;

						// 5. 触发重新初始化（通过增加 reinitTrigger）
						setReinitTrigger((prev) => prev + 1);
					},
					applyPlaybackSpeed: (speed: number) => {
						try {
							api.playbackSpeed = speed;
						} catch (err) {
							console.error("Failed to set playback speed:", err);
						}
					},
					setMetronomeVolume: (volume: number) => {
						try {
							api.metronomeVolume = volume;
						} catch (err) {
							console.error("Failed to set metronome volume:", err);
						}
					},
					applyZoom: (pct: number) => applyZoom(pct),
				});
			} catch {
				// Failed to register player controls
			}

			// 3.6. 点击曲谱时更新播放器光标位置（不播放也能设置）
			api.beatMouseDown?.on((beat: alphaTab.model.Beat) => {
				if (!beat) return;
				const barIndex = beat.voice?.bar?.index ?? 0;
				const beatIndex = beat.index ?? 0;
				console.info("[Preview] Beat clicked:", `Bar ${barIndex}:${beatIndex}`);
				// 🆕 清除播放高亮（绿色），让黄色小节高亮能够显示
				useAppStore.getState().clearPlaybackBeat();
				// 🆕 清除用户手动选择的选区高亮（点击乐谱时，应该清除之前的选区）
				useAppStore.getState().clearScoreSelection();
				// 更新播放器光标位置，触发编辑器黄色高亮
				useAppStore.getState().setPlayerCursorPosition({ barIndex, beatIndex });
			});

			// 🆕 3.5. Selection API (alphaTab 1.8.0+): 监听选区变化，同步到编辑器
			try {
				api.playbackRangeHighlightChanged?.on((e) => {
					const { setScoreSelection, clearScoreSelection } =
						useAppStore.getState();

					// 如果没有选区，清除编辑器高亮
					if (!e.startBeat || !e.endBeat) {
						clearScoreSelection();
						return;
					}

					// 🆕 检查 beat 是否属于当前有效的 score（避免旧曲谱的 beat 触发事件）
					const currentScore = api.score;
					const startBeatScore = e.startBeat.voice?.bar?.staff?.track?.score;
					const endBeatScore = e.endBeat.voice?.bar?.staff?.track?.score;

					if (
						!currentScore ||
						startBeatScore !== currentScore ||
						endBeatScore !== currentScore
					) {
						clearScoreSelection();
						return;
					}

					// 获取选区的小节索引
					const startBarIndex = e.startBeat.voice?.bar?.index ?? 0;
					const endBarIndex = e.endBeat.voice?.bar?.index ?? startBarIndex;

					// 🆕 如果这是由编辑器光标触发的，不设置 scoreSelection，并确保清除选区
					// 避免编辑器中的蓝色选区高亮持续存在
					// 检查方式：1. 标志位 2. 选区是否匹配最后一次编辑器光标选区
					const isFromEditorCursor =
						isHighlightFromEditorCursorRef.current ||
						(lastEditorCursorSelectionRef.current &&
							startBarIndex ===
								lastEditorCursorSelectionRef.current.startBarIndex &&
							endBarIndex === lastEditorCursorSelectionRef.current.endBarIndex);

					if (isFromEditorCursor) {
						// 确保清除选区，防止残留
						clearScoreSelection();
						return;
					}

					// 标记：这次编辑器光标更新是由乐谱选择触发的，防止循环
					isEditorCursorFromScoreRef.current = true;

					// 从 Beat 对象中提取小节和 Beat 索引
					const startBeat = e.startBeat;
					const endBeat = e.endBeat;

					// 获取 Beat 在小节内的索引
					const startBeatIndex = startBeat.index ?? 0;
					const endBeatIndex = endBeat.index ?? 0;

					console.info(
						"[Preview] Selection changed (user selection):",
						`Bar ${startBarIndex}:${startBeatIndex} -> Bar ${endBarIndex}:${endBeatIndex}`,
					);

					// 更新 store，触发 Editor 高亮（只有用户手动选择时才设置）
					setScoreSelection({
						startBarIndex,
						startBeatIndex,
						endBarIndex,
						endBeatIndex,
					});
				});
			} catch {
				// playbackRangeHighlightChanged not available (requires alphaTab 1.8.0+)
			}

			// 4. 改进的错误处理：保留上一次成功的渲染
			api.error.on((err: unknown) => {
				console.error("[Preview] alphaTab error:", err);
				console.error("[Preview] Error type:", typeof err, err);
				console.error("[Preview] Error keys:", err ? Object.keys(err) : "null");

				// 使用工具函数格式化错误
				const fullError = formatFullError(err);
				console.error("[Preview] Setting error state:", fullError);
				setParseError(fullError);

				// 清除 pending tex 请求
				if (pendingTexTimerRef.current) {
					clearTimeout(pendingTexTimerRef.current);
					pendingTexTimerRef.current = null;
				}
				pendingTexRef.current = null;
				// 如果有上一次成功的乐谱，恢复渲染
				if (lastValidScoreRef.current?.score && apiRef.current) {
					try {
						console.info("[Preview] Restoring last valid score after error");
						// 标记：这次 renderScore 是恢复操作，避免在 scoreLoaded 中清除 parseError
						lastLoadWasUserContentRef.current = false;
						// 记录恢复状态以便 UI 显示真实恢复发生过
						restorePerformedRef.current = true;
						setRestorePerformed(true);
						apiRef.current.renderScore(lastValidScoreRef.current.score, [0]);
					} catch (restoreErr) {
						console.error(
							"[Preview] Failed to restore last valid score:",
							restoreErr,
						);
					}
				}
			});

			// 5. 处理 scoreLoaded 事件：保存成功的乐谱并清除错误
			api.scoreLoaded.on((score) => {
				try {
					if (score?.tracks && score.tracks.length > 0) {
						bumpScoreVersion();

						// 🆕 新乐谱加载时，清除选区高亮和相关的 refs（避免旧乐谱的选区残留）
						useAppStore.getState().clearScoreSelection();
						isHighlightFromEditorCursorRef.current = false;
						lastEditorCursorSelectionRef.current = null;

						// Sanitize any invalid BarStyle.color entries to avoid serializer crashes
						try {
							sanitizeAllBarStyles(api);
						} catch (err) {
							console.error(
								"[BarColor] sanitizeAllBarStyles failed during scoreLoaded:",
								err,
							);
						}
						const currentContent = latestContentRef.current ?? "";
						// 如果当前有 pending 请求，并且内容匹配，则将其视为成功解析，保存为 lastValid
						if (
							pendingTexRef.current &&
							pendingTexRef.current.content === currentContent
						) {
							lastValidScoreRef.current = {
								score: score,
								content: currentContent,
							};
							// 清除错误与 pending 状态
							setParseError(null);
							if (pendingTexTimerRef.current) {
								clearTimeout(pendingTexTimerRef.current);
								pendingTexTimerRef.current = null;
							}
							pendingTexRef.current = null;
							// 如果之前有自动恢复过，清除该标记
							if (restorePerformedRef.current) {
								restorePerformedRef.current = false;
								setRestorePerformed(false);
							}
						} else {
							console.info(
								"[Preview] scoreLoaded does not match pending content; ignoring for lastValid",
							);
						}
						// 🆕 统一调用 applyTracksConfig，无论是首次还是重建
						if (apiRef.current) applyTracksConfig(apiRef.current);
						// 🆕 如果有挂起的小节号高亮请求，scoreLoaded 后执行
						if (apiRef.current && pendingBarColorRef.current !== null) {
							applyEditorBarNumberColor(
								apiRef.current,
								pendingBarColorRef.current,
							);
							pendingBarColorRef.current = null;
						}
						// Reset load flag after handling a scoreLoaded to avoid stale state
						lastLoadWasUserContentRef.current = false;
					}
				} catch (e) {
					console.error("[Preview] Failed to apply tracks config", e);
				}
			});
		};

		const initAlphaTab = async () => {
			try {
				// 1. 获取所有资源 URL（自动适配 dev 和打包环境）
				const urls = await getResourceUrls();
				const el = containerRef.current as HTMLElement;
				// 实际滚动容器：优先使用 scrollHostRef（overflow-auto），
				// 退回到原来的父元素以保持兼容性。
				const fallbackScrollEl = (el.parentElement ?? el) as HTMLElement;
				const scrollEl =
					(scrollHostRef.current as HTMLElement | null) ?? fallbackScrollEl;

				// 2. 加载 Bravura 字体
				try {
					await loadBravuraFont(urls.bravuraFontUrl);
				} catch (e) {
					console.warn("[Preview] Bravura font load failed:", e);
				}

				// 3. 如果 API 尚未初始化，创建它
				if (!apiRef.current) {
					// 获取当前主题的颜色
					const colors = getAlphaTabColorsForTheme();

					// 使用工具函数创建预览配置
					const settings = createPreviewSettings(urls as ResourceUrls, {
						scale: zoomRef.current / 100,
						scrollElement: scrollEl,
						enablePlayer: !editorHasFocusRef.current,
						colors,
					});

					apiRef.current = new alphaTab.AlphaTabApi(el, settings);
					bumpApiInstanceId();

					// 🆕 新建 API 时清除选区高亮（避免旧 API 的选区残留）
					useAppStore.getState().clearScoreSelection();

					// 初始应用全局状态的播放速度与节拍器音量
					try {
						apiRef.current.playbackSpeed = playbackSpeedRef.current;
						apiRef.current.metronomeVolume = metronomeVolumeRef.current;
					} catch {
						// Failed to apply initial speed/metronome
					}

					// 4. 附加监听器
					attachApiListeners(apiRef.current);

					// 5. 设置主题监听器（监听暗色模式变化）
					const unsubscribeTheme = setupThemeObserver(() => {
						// 当主题变化时，重建 API 以应用新的颜色配置

						if (apiRef.current && latestContentRef.current) {
							// 使用 void 操作符确保异步操作在后台执行（不阻塞回调）
							void (async () => {
								try {
									// 保存当前的 tracks 配置
									if (apiRef.current?.score?.tracks?.[0]) {
										const st = apiRef.current.score.tracks[0].staves?.[0];
										if (st) {
											trackConfigRef.current = {
												showTablature: st.showTablature,
												showStandardNotation: st.showStandardNotation,
												showSlash: st.showSlash,
												showNumbered: st.showNumbered,
											};
											// Saved tracks config before rebuild
										}
									}

									// 保存当前的乐谱内容（使用最新值，避免闭包过期）
									const currentContent = latestContentRef.current;

									// 销毁旧的 API
									apiRef.current?.destroy();

									// 🆕 销毁旧 API 时清除选区高亮（避免旧 API 的选区残留）
									useAppStore.getState().clearScoreSelection();

									// 获取新的颜色配置
									const newColors = getAlphaTabColorsForTheme();

									// 使用工具函数重新创建 API 配置
									const newSettings = createPreviewSettings(
										urls as ResourceUrls,
										{
											scale: zoomRef.current / 100,
											scrollElement:
												(scrollHostRef.current as HTMLElement | null) ??
												scrollEl,
											enablePlayer: !editorHasFocusRef.current,
											colors: newColors,
										},
									);

									// 创建新的 API
									apiRef.current = new alphaTab.AlphaTabApi(el, newSettings);
									bumpApiInstanceId();

									// 🆕 新建 API 时清除选区高亮（避免旧 API 的选区残留）
									useAppStore.getState().clearScoreSelection();

									// 重新应用全局状态的播放速度与节拍器音量
									try {
										apiRef.current.playbackSpeed = playbackSpeedRef.current;
										apiRef.current.metronomeVolume = metronomeVolumeRef.current;
									} catch {
										// Failed to reapply speed/metronome after rebuild
									}

									// 🆕 附加所有监听器（包括 scoreLoaded, error, playback 等）
									attachApiListeners(apiRef.current);

									// 重新加载音频
									await loadSoundFontFromUrl(apiRef.current, urls.soundFontUrl);

									// 重新设置乐谱内容
									// 这会触发 scoreLoaded，从而调用 applyTracksConfig 恢复配置
									try {
										// track pending as we do elsewhere
										texSeqRef.current += 1;
										const seq = texSeqRef.current;
										pendingTexRef.current = {
											id: seq,
											content: currentContent,
										};
										if (pendingTexTimerRef.current) {
											clearTimeout(pendingTexTimerRef.current);
										}
										pendingTexTimerRef.current = window.setTimeout(() => {
											if (pendingTexRef.current?.id === seq) {
												const msg = "AlphaTex 解析超时（theme 重建）";
												console.warn(
													"[Preview] tex timeout (theme rebuild), seq:",
													seq,
													"msg:",
													msg,
												);
												// 🆕 主题重建时的超时不显示错误 UI，因为内容通常是有效的
												// 仅在控制台记录警告
											}
										}, TEX_TIMEOUT_MS);

										// 标记：这次 load 是用户内容（theme 重建更新）
										lastLoadWasUserContentRef.current = true;
										apiRef.current.tex(currentContent);
									} catch (syncError) {
										console.error(
											"[Preview] Synchronous error in theme rebuild tex():",
											syncError,
										);
									}
								} catch (e) {
									console.error(
										"[Preview] Failed to rebuild alphaTab after theme change:",
										e,
									);
								}
							})();
						}
					});

					// 保存清理函数供后续使用
					(
						apiRef.current as unknown as Record<string, unknown>
					).__unsubscribeTheme = unsubscribeTheme;

					// 6. 加载音频字体
					try {
						await loadSoundFontFromUrl(apiRef.current, urls.soundFontUrl);
					} catch {
						// Could not load soundfont (this is optional)
					}
				} // 7. 设置内容
				if (apiRef.current && latestContentRef.current) {
					try {
						// Track pending tex call so we can detect parse failures even
						// if alphaTab doesn't emit an error event in some cases.
						texSeqRef.current += 1;
						const seq = texSeqRef.current;
						pendingTexRef.current = {
							id: seq,
							content: latestContentRef.current,
						};
						// 仍保留之前的解析错误，直到新的解析成功或明确失败
						if (pendingTexTimerRef.current) {
							clearTimeout(pendingTexTimerRef.current);
						}
						// If no scoreLoaded event occurs for this tex within timeout, mark as parse timeout (do NOT restore immediately)
						pendingTexTimerRef.current = window.setTimeout(() => {
							if (pendingTexRef.current?.id === seq) {
								const msg = "AlphaTex 解析超时（未加载新乐谱）";
								console.warn(
									"[Preview] tex timeout (content update), seq:",
									seq,
									"msg:",
									msg,
								);
								// 标记解析超时，但不要直接恢复旧乐谱 — 留待后续的 scoreLoaded 或 error 去处理
								setParseError(`${msg}（等待解析结果或检查语法）`);
							}
						}, TEX_TIMEOUT_MS);

						// 标记：这次 load 是用户内容
						lastLoadWasUserContentRef.current = true;
						apiRef.current.tex(latestContentRef.current);
					} catch (syncError) {
						// 同步错误：记录到控制台，但不要修改 parseError UI state.
						console.error("[Preview] Synchronous error in tex():", syncError);
						const errorMsg =
							syncError instanceof Error
								? syncError.message
								: String(syncError);
						console.warn(
							"[Preview] sync tex() call failed; not showing parse error UI:",
							errorMsg,
						);
					}
				} else if (apiRef.current && !latestContentRef.current) {
					// clear pending and errors
					if (pendingTexTimerRef.current) {
						clearTimeout(pendingTexTimerRef.current);
						pendingTexTimerRef.current = null;
					}
					pendingTexRef.current = null;
					setParseError(null);
					// 标记：这次 load 是用户内容（清空）
					lastLoadWasUserContentRef.current = true;
					apiRef.current.tex("");
				}
			} catch (err) {
				console.error("[Preview] Failed to initialize alphaTab:", err);
			}
		};

		initAlphaTab();

		// Cleanup on unmount
		return () => {
			if (apiRef.current) {
				// 清理主题观察者
				const unsubscribeTheme = (
					apiRef.current as unknown as Record<string, unknown>
				).__unsubscribeTheme;
				if (typeof unsubscribeTheme === "function") {
					unsubscribeTheme();
				}
				apiRef.current.destroy();
				apiRef.current = null;

				// 🆕 销毁 API 时清除选区高亮（避免旧 API 的选区残留）
				useAppStore.getState().clearScoreSelection();
			}
			// 清除 pending tex 相关计时器
			if (pendingTexTimerRef.current) {
				clearTimeout(pendingTexTimerRef.current);
				pendingTexTimerRef.current = null;
			}
			pendingTexRef.current = null;
		};
	}, [
		applyTracksConfig,
		reinitTrigger,
		applyZoom,
		applyEditorBarNumberColor,
		bumpScoreVersion,
		bumpApiInstanceId,
		sanitizeAllBarStyles,
		applyThemeColorsToPreviousBars,
	]);

	// 内容更新：仅调用 tex，不销毁 API，避免闪烁
	useEffect(() => {
		const api = apiRef.current;
		if (!api) return;

		// 🆕 内容变化时，清除选区高亮（避免旧文件的选区残留在新文件中）
		useAppStore.getState().clearScoreSelection();

		if (content) {
			try {
				texSeqRef.current += 1;
				const seq = texSeqRef.current;
				pendingTexRef.current = { id: seq, content };
				if (pendingTexTimerRef.current) {
					clearTimeout(pendingTexTimerRef.current);
				}
				pendingTexTimerRef.current = window.setTimeout(() => {
					if (pendingTexRef.current?.id === seq) {
						const msg = "AlphaTex 解析超时（未加载新乐谱）";
						console.warn(
							"[Preview] tex timeout (content update), seq:",
							seq,
							"msg:",
							msg,
						);
						// 标记解析超时，但不要直接恢复旧乐谱 — 以免在切换文件时回退到上一个文件
						setParseError(`${msg}（等待解析结果或检查语法）`);
					}
				}, TEX_TIMEOUT_MS);

				lastLoadWasUserContentRef.current = true;
				api.tex(content);
			} catch (syncError) {
				console.error("[Preview] Synchronous error in tex():", syncError);
				const errorMsg =
					syncError instanceof Error ? syncError.message : String(syncError);
				console.warn(
					"[Preview] sync tex() call failed; not showing parse error UI:",
					errorMsg,
				);
			}
		} else {
			if (pendingTexTimerRef.current) {
				clearTimeout(pendingTexTimerRef.current);
				pendingTexTimerRef.current = null;
			}
			pendingTexRef.current = null;
			setParseError(null);
			lastLoadWasUserContentRef.current = true;
			try {
				api.tex("");
			} catch (emptyErr) {
				console.error("[Preview] Failed to clear score:", emptyErr);
			}
		}
	}, [content]);

	// 管理打印预览的生命周期：销毁和重建 alphaTab API 以避免设置污染
	useEffect(() => {
		if (showPrintPreview) {
			// 打开打印预览：销毁当前 API 释放资源（特别是字体缓存）
			// Destroying API for print preview
			if (apiRef.current) {
				// 清理主题观察者
				const unsubscribeTheme = (
					apiRef.current as unknown as Record<string, unknown>
				).__unsubscribeTheme;
				if (typeof unsubscribeTheme === "function") {
					unsubscribeTheme();
				}
				// Unregister controls from store so bottom bar won't call destroyed API
				try {
					useAppStore.getState().unregisterPlayerControls();
				} catch {
					// Failed to unregister player controls
				}
				apiRef.current.destroy();
				apiRef.current = null;

				// 🆕 销毁 API 时清除选区高亮（避免旧 API 的选区残留）
				useAppStore.getState().clearScoreSelection();
			}
		} else if (!showPrintPreview && !apiRef.current) {
			// 关闭打印预览：延迟重新初始化 API，确保 PrintPreview 完全卸载
			const timer = setTimeout(() => {
				setReinitTrigger((prev) => prev + 1);
			}, 150);
			return () => clearTimeout(timer);
		}
	}, [showPrintPreview]);

	return (
		<TooltipProvider delayDuration={200}>
			<div
				className={`flex-1 flex flex-col h-full overflow-hidden ${className ?? ""}`}
			>
				{/* 当打印预览显示时，隐藏主预览区域以避免资源冲突 */}
				{!showPrintPreview && (
					<>
						{/* 错误提示已移到底部 */}
						<TopBar
							icon={
								<FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
							}
							title={
								<span className="sr-only">
									{fileName ?? t("common:preview")}
								</span>
							}
							trailing={
								<>
									{/* 导出按钮组 */}
									<div className="ml-2 flex items-center gap-1">
										{/* 导出 MIDI */}
										<Tooltip>
											<TooltipTrigger asChild>
												<IconButton
													onClick={() => {
														const api = apiRef.current;
														if (!api?.score) return;
														exportToMidi(api);
													}}
													disabled={!apiRef.current?.score}
												>
													<Music className="h-4 w-4" />
												</IconButton>
											</TooltipTrigger>
											<TooltipContent side="bottom">
												<p>{t("toolbar:export.midi")}</p>
											</TooltipContent>
										</Tooltip>
										{/* 导出 WAV */}
										<Tooltip>
											<TooltipTrigger asChild>
												<IconButton
													onClick={async () => {
														const api = apiRef.current;
														if (!api?.score) return;
														const filename = getDefaultExportFilename(
															fileName,
															"wav",
														);
														await exportToWav(api, filename);
													}}
													disabled={!apiRef.current?.score}
												>
													<FileDown className="h-4 w-4" />
												</IconButton>
											</TooltipTrigger>
											<TooltipContent side="bottom">
												<p>{t("toolbar:export.wav")}</p>
											</TooltipContent>
										</Tooltip>
										{/* 导出 GP */}
										<Tooltip>
											<TooltipTrigger asChild>
												<IconButton
													onClick={() => {
														const api = apiRef.current;
														if (!api?.score) return;
														const filename = getDefaultExportFilename(
															fileName,
															"gp",
														);
														exportToGp7(api, filename);
													}}
													disabled={!apiRef.current?.score}
												>
													<FileMusic className="h-4 w-4" />
												</IconButton>
											</TooltipTrigger>
											<TooltipContent side="bottom">
												<p>{t("toolbar:export.gp")}</p>
											</TooltipContent>
										</Tooltip>
										{/* 打印按钮 */}
										<Tooltip>
											<TooltipTrigger asChild>
												<IconButton
													onClick={() => setShowPrintPreview(true)}
													disabled={!content}
												>
													<Printer className="h-4 w-4" />
												</IconButton>
											</TooltipTrigger>
											<TooltipContent side="bottom">
												<p>{t("print:printPreview")}</p>
											</TooltipContent>
										</Tooltip>
									</div>
								</>
							}
						/>
						<div
							ref={scrollHostRef}
							className="flex-1 overflow-auto relative h-full"
						>
							<div className="w-full min-h-full pb-[var(--scroll-buffer)] overflow-x-hidden">
								<div ref={containerRef} className="w-full h-full" />
							</div>
							<div
								ref={cursorRef}
								className="pointer-events-none absolute z-20 bg-amber-300/40 rounded-sm hidden"
							/>
						</div>
						{parseError && (
							<div className="bg-destructive/10 text-destructive px-3 py-2 text-xs border-t border-destructive/20 flex items-start gap-2">
								<span className="font-semibold shrink-0">⚠️</span>
								<div className="flex-1 min-w-0">
									<div className="font-medium">{t("errors:parseError")}</div>
									<div className="mt-0.5 text-destructive/80 break-words">
										{parseError}
									</div>
									{restorePerformed && lastValidScoreRef.current && (
										<div className="mt-1 text-destructive/60 text-[11px]">
											{t("errors:restored")}
										</div>
									)}
								</div>
								<Tooltip>
									<TooltipTrigger asChild>
										<button
											type="button"
											onClick={() => setParseError(null)}
											className="shrink-0 text-destructive/60 hover:text-destructive text-lg leading-none"
										>
											×
										</button>
									</TooltipTrigger>
									<TooltipContent side="left">
										<p>{t("errors:dismissTooltip")}</p>
									</TooltipContent>
								</Tooltip>
							</div>
						)}
					</>
				)}

				{/* 打印预览模态窗口 */}
				{showPrintPreview && content && (
					<PrintPreview
						content={content}
						fileName={fileName}
						onClose={() => setShowPrintPreview(false)}
					/>
				)}
			</div>
		</TooltipProvider>
	);
}
