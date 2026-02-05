import { useEffect, useMemo } from "react";
import { useThemeStore } from "../../store/themeStore";
import { getEditorTheme, getUITheme } from "./theme-registry";
import type { EditorTheme, ThemeMode, UITheme, UIThemeColors } from "./types";

export interface UseThemeReturn {
	uiTheme: UITheme;
	editorTheme: EditorTheme;
	effectiveColors: UIThemeColors;
	isDark: boolean;
	themeMode: ThemeMode;
	setUITheme: (themeId: string) => void;
	setEditorTheme: (themeId: string) => void;
	setThemeMode: (mode: ThemeMode) => void;
}

export function useTheme(): UseThemeReturn {
	const {
		currentUITheme,
		currentEditorTheme,
		themeMode,
		setUITheme,
		setEditorTheme,
		setThemeMode,
		getEffectiveVariant,
	} = useThemeStore();

	const effectiveVariant = getEffectiveVariant();
	const isDark = effectiveVariant === "dark";

	const uiTheme = useMemo(() => {
		const theme = getUITheme(currentUITheme) ?? getUITheme("github");
		if (!theme) {
			throw new Error(
				`UI theme "${currentUITheme}" not found and fallback "github" also not found`,
			);
		}
		return theme;
	}, [currentUITheme]);

	const editorTheme = useMemo(() => {
		const theme =
			getEditorTheme(currentEditorTheme) ?? getEditorTheme("github");
		if (!theme) {
			throw new Error(
				`Editor theme "${currentEditorTheme}" not found and fallback "github" also not found`,
			);
		}
		return theme;
	}, [currentEditorTheme]);

	const effectiveColors = useMemo(() => {
		return uiTheme[effectiveVariant];
	}, [uiTheme, effectiveVariant]);

	useEffect(() => {
		if (typeof document === "undefined") return;

		const root = document.documentElement;

		if (isDark) {
			root.classList.add("dark");
		} else {
			root.classList.remove("dark");
		}

		const colors = effectiveColors.semantic;
		const extended = effectiveColors;

		root.style.setProperty("--background", colors.background);
		root.style.setProperty("--foreground", colors.foreground);
		root.style.setProperty("--card", colors.card);
		root.style.setProperty("--card-foreground", colors.cardForeground);
		root.style.setProperty("--popover", colors.popover);
		root.style.setProperty("--popover-foreground", colors.popoverForeground);
		root.style.setProperty("--primary", colors.primary);
		root.style.setProperty("--primary-foreground", colors.primaryForeground);
		root.style.setProperty("--secondary", colors.secondary);
		root.style.setProperty(
			"--secondary-foreground",
			colors.secondaryForeground,
		);
		root.style.setProperty("--muted", colors.muted);
		root.style.setProperty("--muted-foreground", colors.mutedForeground);
		root.style.setProperty("--accent", colors.accent);
		root.style.setProperty("--accent-foreground", colors.accentForeground);
		root.style.setProperty("--destructive", colors.destructive);
		root.style.setProperty(
			"--destructive-foreground",
			colors.destructiveForeground,
		);
		root.style.setProperty("--border", colors.border);
		root.style.setProperty("--input", colors.input);
		root.style.setProperty("--ring", colors.ring);

		root.style.setProperty("--selection-overlay", extended.selectionOverlay);
		root.style.setProperty("--scrollbar", extended.scrollbar);
		root.style.setProperty("--focus-ring", extended.focusRing);

		if (extended.highlight) {
			root.style.setProperty("--highlight-bg", extended.highlight.background);
			root.style.setProperty("--highlight-text", extended.highlight.foreground);
		}
		if (extended.hover) {
			root.style.setProperty("--hover-bg", extended.hover.background);
			root.style.setProperty("--hover-text", extended.hover.foreground);
		}
		if (extended.score) {
			root.style.setProperty("--alphatab-main-glyph", extended.score.mainGlyph);
			root.style.setProperty(
				"--alphatab-secondary-glyph",
				extended.score.secondaryGlyph,
			);
			root.style.setProperty("--alphatab-staff-line", extended.score.staffLine);
			root.style.setProperty(
				"--alphatab-bar-separator",
				extended.score.barSeparator,
			);
			root.style.setProperty("--alphatab-bar-number", extended.score.barNumber);
			root.style.setProperty("--alphatab-score-info", extended.score.scoreInfo);
		}
		if (extended.playerCursor) {
			root.style.setProperty(
				"--player-cursor-bg",
				extended.playerCursor.background,
			);
			root.style.setProperty(
				"--player-cursor-border",
				extended.playerCursor.border,
			);
			root.style.setProperty(
				"--player-cursor-highlight",
				extended.playerCursor.barHighlight,
			);
		}
	}, [effectiveColors, isDark]);

	return {
		uiTheme,
		editorTheme,
		effectiveColors,
		isDark,
		themeMode,
		setUITheme,
		setEditorTheme,
		setThemeMode,
	};
}
