import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
	getDefaultEditorThemeForUI,
	getUITheme,
} from "../lib/theme-system/theme-registry";
import type {
	CombinedTheme,
	ThemeMode,
	ThemeState,
} from "../lib/theme-system/types";

const THEME_STORAGE_KEY = "tabst-theme-preference";

interface ThemeStore extends ThemeState {
	setUITheme: (themeId: string) => void;
	setEditorTheme: (themeId: string) => void;
	setThemeMode: (mode: ThemeMode) => void;
	setCombinedTheme: (combined: CombinedTheme) => void;
	getEffectiveVariant: () => "light" | "dark";
}

function getSystemTheme(): "light" | "dark" {
	if (typeof window === "undefined") return "light";
	return window.matchMedia("(prefers-color-scheme: dark)").matches
		? "dark"
		: "light";
}

export const useThemeStore = create<ThemeStore>()(
	persist(
		(set, get) => ({
			currentUITheme: "github",
			currentEditorTheme: "github",
			themeMode: "system",
			savedPreference: undefined,

			setUITheme: (themeId) => {
				const uiTheme = getUITheme(themeId);
				if (!uiTheme) return;

				const defaultEditor = getDefaultEditorThemeForUI(themeId);
				set({
					currentUITheme: themeId,
					currentEditorTheme: defaultEditor,
					savedPreference: {
						uiThemeId: themeId,
						editorThemeId: defaultEditor,
					},
				});
			},

			setEditorTheme: (themeId) => {
				set((state) => ({
					currentEditorTheme: themeId,
					savedPreference: {
						uiThemeId: state.currentUITheme,
						editorThemeId: themeId,
					},
				}));
			},

			setThemeMode: (mode) => {
				set({ themeMode: mode });
			},

			setCombinedTheme: (combined) => {
				set({
					currentUITheme: combined.uiThemeId,
					currentEditorTheme: combined.editorThemeId,
					savedPreference: combined,
				});
			},

			getEffectiveVariant: () => {
				const state = get();
				if (state.themeMode === "system") {
					return getSystemTheme();
				}
				return state.themeMode;
			},
		}),
		{
			name: THEME_STORAGE_KEY,
			partialize: (state) => ({
				savedPreference: state.savedPreference,
				themeMode: state.themeMode,
			}),
		},
	),
);
