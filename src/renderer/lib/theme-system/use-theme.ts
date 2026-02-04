import { useEffect, useMemo } from "react";
import { useThemeStore } from "../../store/themeStore";
import { getEditorTheme, getUITheme, themeRegistry } from "./theme-registry";
import type { EditorTheme, UITheme } from "./types";

export interface UseThemeReturn {
	uiTheme: UITheme;
	editorTheme: EditorTheme;
	isDark: boolean;
	setUITheme: (themeId: string) => void;
	setEditorTheme: (themeId: string) => void;
	followSystem: boolean;
	setFollowSystem: (follow: boolean) => void;
	switchToVariant: (variant: "light" | "dark") => void;
}

export function useTheme(): UseThemeReturn {
	const {
		currentUITheme,
		currentEditorTheme,
		followSystem,
		setUITheme,
		setEditorTheme,
		setFollowSystem,
		getEffectiveTheme,
	} = useThemeStore();

	const effective = getEffectiveTheme();

	const uiTheme = useMemo(() => {
		return getUITheme(effective.ui) ?? getUITheme("github-light")!;
	}, [effective.ui]);

	const editorTheme = useMemo(() => {
		return getEditorTheme(effective.editor) ?? getEditorTheme("github")!;
	}, [effective.editor]);

	const isDark = uiTheme.variant === "dark";

	const switchToVariant = (variant: "light" | "dark") => {
		const variantThemeId = themeRegistry.getThemeVariant(uiTheme.id);
		if (variantThemeId) {
			setUITheme(variantThemeId);
		}
		// 如果没有对应变体，暂时不做任何操作
	};

	useEffect(() => {
		if (typeof document === "undefined") return;

		const root = document.documentElement;

		if (isDark) {
			root.classList.add("dark");
		} else {
			root.classList.remove("dark");
		}

		const colors = uiTheme.colors;
		const extended = uiTheme.extended;

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

		if (extended) {
			root.style.setProperty("--selection-overlay", extended.selectionOverlay);
			if (extended.scrollbar) {
				root.style.setProperty("--scrollbar", extended.scrollbar);
			}
			if (extended.focusRing) {
				root.style.setProperty("--focus-ring", extended.focusRing);
			}
			if (extended.score) {
				root.style.setProperty(
					"--alphatab-main-glyph",
					extended.score.mainGlyph,
				);
				root.style.setProperty(
					"--alphatab-secondary-glyph",
					extended.score.secondaryGlyph,
				);
				root.style.setProperty(
					"--alphatab-staff-line",
					extended.score.staffLine,
				);
				root.style.setProperty(
					"--alphatab-bar-separator",
					extended.score.barSeparator,
				);
				root.style.setProperty(
					"--alphatab-bar-number",
					extended.score.barNumber,
				);
				root.style.setProperty(
					"--alphatab-score-info",
					extended.score.scoreInfo,
				);
			}
		}
	}, [uiTheme, isDark]);

	return {
		uiTheme,
		editorTheme,
		isDark,
		setUITheme,
		setEditorTheme,
		followSystem,
		setFollowSystem,
		switchToVariant,
	};
}
