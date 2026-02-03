/**
 * AlphaTab 小节高亮与颜色恢复
 * 供 Preview 中编辑器光标对应小节号着色、停止播放时恢复主题色使用
 */

import * as alphaTab from "@coderline/alphatab";
import { getAlphaTabColorsForTheme } from "./themeManager";

export type LastColoredBars = {
	barIndex: number;
	bars: alphaTab.model.Bar[];
	score: alphaTab.model.Score | null;
} | null;

/**
 * Safely set a color in the bar style colors map (validates key/value).
 */
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

/**
 * Restore theme colors for bars that were previously highlighted (e.g. bar number color).
 * Caller passes the previous state; lib does not hold refs.
 */
export function clearBarNumberColor(
	_api: alphaTab.AlphaTabApi,
	previous: LastColoredBars,
): void {
	if (!previous?.bars?.length) return;

	const themeColors = getAlphaTabColorsForTheme();
	const barNumberColor = alphaTab.model.Color.fromJson(
		themeColors.barNumberColor,
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

		const backup = Array.from(style.colors.entries());
		try {
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
			style.colors.set(
				alphaTab.model.BarSubElement.StandardNotationStaffLine,
				staffLineColor,
			);
			style.colors.set(
				alphaTab.model.BarSubElement.GuitarTabsStaffLine,
				staffLineColor,
			);
			style.colors.set(
				alphaTab.model.BarSubElement.StandardNotationBarLines,
				barSeparatorColor,
			);
			style.colors.set(
				alphaTab.model.BarSubElement.GuitarTabsBarLines,
				barSeparatorColor,
			);
			for (const [_k, v] of style.colors.entries()) {
				if (
					v === undefined ||
					v === null ||
					typeof v?.toString !== "function"
				) {
					throw new Error("Invalid color value");
				}
			}
		} catch (err) {
			console.error("[BarColor] Failed to restore bar colors, reverting:", err);
			style.colors.clear?.();
			for (const [k, v] of backup) {
				style.colors.set(k, v);
			}
		}
	}
}

/**
 * Remove bar-number highlight from previously colored bars (simplified: delete keys so theme applies).
 * Caller passes the previous state.
 */
export function applyThemeColorsToPreviousBars(
	_api: alphaTab.AlphaTabApi,
	previous: LastColoredBars,
): void {
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
		for (const key of barNumberKeys) {
			style.colors.delete(key);
		}
		if (style.colors.size === 0) {
			try {
				(bar as { style?: alphaTab.model.BarStyle | null }).style = null;
			} catch {
				// keep empty BarStyle
			}
		}
	}
}

/**
 * Sanitize all bar style color maps to prevent serialization crashes.
 * Returns true if any fixes were applied.
 */
export function sanitizeAllBarStyles(api: alphaTab.AlphaTabApi): boolean {
	if (!api.score) return false;
	let fixes = 0;
	const themeColors = getAlphaTabColorsForTheme();

	let barNumberColor: alphaTab.model.Color | null = null;
	let mainGlyphColor: alphaTab.model.Color | null = null;
	let staffLineColor: alphaTab.model.Color | null = null;
	let barSeparatorColor: alphaTab.model.Color | null = null;

	try {
		barNumberColor = alphaTab.model.Color.fromJson(themeColors.barNumberColor);
		mainGlyphColor = alphaTab.model.Color.fromJson(themeColors.mainGlyphColor);
		staffLineColor = alphaTab.model.Color.fromJson(themeColors.staffLineColor);
		barSeparatorColor = alphaTab.model.Color.fromJson(
			themeColors.barSeparatorColor,
		);
		if (
			!barNumberColor ||
			!mainGlyphColor ||
			!staffLineColor ||
			!barSeparatorColor ||
			typeof barNumberColor.toString !== "function" ||
			typeof mainGlyphColor.toString !== "function" ||
			typeof staffLineColor.toString !== "function" ||
			typeof barSeparatorColor.toString !== "function"
		) {
			throw new Error("Invalid theme colors");
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

				const validEntries: Array<[number, alphaTab.model.Color]> = [];
				for (const [k, v] of Array.from(style.colors.entries())) {
					try {
						if (k === undefined || k === null || typeof k !== "number") {
							fixes++;
							continue;
						}
						if (v === undefined || v === null) {
							fixes++;
							continue;
						}
						if (typeof v === "string") {
							const parsed = alphaTab.model.Color.fromJson(v);
							if (parsed && typeof parsed.toString === "function") {
								validEntries.push([k, parsed]);
								fixes++;
							} else {
								fixes++;
							}
							continue;
						}
						if (typeof v?.toString !== "function") {
							const keyName = Object.keys(alphaTab.model.BarSubElement).find(
								(n) =>
									(
										alphaTab.model.BarSubElement as unknown as Record<
											string,
											number
										>
									)[n] === k,
							);
							let fallback = mainGlyphColor;
							if (keyName?.includes("BarNumber")) fallback = barNumberColor;
							else if (keyName?.includes("StaffLines"))
								fallback = staffLineColor;
							else if (keyName?.includes("BarSeparator"))
								fallback = barSeparatorColor;
							validEntries.push([k, fallback ?? mainGlyphColor]);
							fixes++;
							continue;
						}
						try {
							v.toString();
							validEntries.push([k, v as alphaTab.model.Color]);
						} catch {
							const keyName = Object.keys(alphaTab.model.BarSubElement).find(
								(n) =>
									(
										alphaTab.model.BarSubElement as unknown as Record<
											string,
											number
										>
									)[n] === k,
							);
							let fallback = mainGlyphColor;
							if (keyName?.includes("BarNumber")) fallback = barNumberColor;
							else if (keyName?.includes("StaffLines"))
								fallback = staffLineColor;
							else if (keyName?.includes("BarSeparator"))
								fallback = barSeparatorColor;
							validEntries.push([k, fallback ?? mainGlyphColor]);
							fixes++;
						}
					} catch {
						fixes++;
					}
				}
				style.colors.clear?.();
				for (const [k, v] of validEntries) {
					style.colors.set(k, v);
				}
			}
		}
	}
	return fixes > 0;
}

/**
 * Apply red bar-number highlight to the bar at barIndex.
 * Returns the new "last colored" state for the caller to store; does not hold refs.
 */
export function applyEditorBarNumberColor(
	api: alphaTab.AlphaTabApi,
	barIndex: number,
	lastColoredBars: LastColoredBars,
): { applied: boolean; newLastColored: LastColoredBars } {
	if (!api.score?.tracks?.length) {
		return { applied: false, newLastColored: lastColoredBars };
	}
	const currentScore = api.score ?? null;
	if (
		lastColoredBars?.barIndex === barIndex &&
		lastColoredBars?.score === currentScore
	) {
		return { applied: true, newLastColored: lastColoredBars };
	}

	sanitizeAllBarStyles(api);
	applyThemeColorsToPreviousBars(api, lastColoredBars);

	const bars: alphaTab.model.Bar[] = [];
	let highlightColor: alphaTab.model.Color | null = null;
	try {
		highlightColor = alphaTab.model.Color.fromJson("#ef4444");
		if (!highlightColor || typeof highlightColor.toString !== "function") {
			throw new Error("Invalid highlightColor");
		}
	} catch (err) {
		console.error("[BarColor] Failed to create highlightColor:", err);
		return { applied: false, newLastColored: lastColoredBars };
	}

	for (const track of api.score.tracks ?? []) {
		for (const staff of track.staves ?? []) {
			for (const bar of staff.bars ?? []) {
				if (bar.index !== barIndex) continue;
				bars.push(bar);
				if (!bar.style) {
					bar.style = new alphaTab.model.BarStyle();
				}
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

	const newLastColored: LastColoredBars =
		bars.length > 0 ? { barIndex, bars, score: currentScore } : null;

	try {
		sanitizeAllBarStyles(api);
	} catch {
		// continue to render
	}
	api.render?.();
	return { applied: true, newLastColored };
}
