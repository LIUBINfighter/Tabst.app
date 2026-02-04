import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
	getDefaultEditorThemeForUI,
	getUITheme,
} from "../lib/theme-system/theme-registry";
import type { CombinedTheme, ThemeState } from "../lib/theme-system/types";

const THEME_STORAGE_KEY = "tabst-theme-preference";

interface ThemeStore extends ThemeState {
	setUITheme: (themeId: string) => void;
	setEditorTheme: (themeId: string) => void;
	setFollowSystem: (follow: boolean) => void;
	setCombinedTheme: (combined: CombinedTheme) => void;
	getEffectiveTheme: () => { ui: string; editor: string };
}

function getSystemTheme(): "light" | "dark" {
	if (typeof window === "undefined") return "light";
	return window.matchMedia("(prefers-color-scheme: dark)").matches
		? "dark"
		: "light";
}

function getDefaultThemeForVariant(variant: "light" | "dark"): string {
	return variant === "dark" ? "github-dark" : "github-light";
}

export const useThemeStore = create<ThemeStore>()(
	persist(
		(set, get) => ({
			currentUITheme: "github-light",
			currentEditorTheme: "github",
			followSystem: true,
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

			setFollowSystem: (follow) => {
				set({ followSystem: follow });
			},

			setCombinedTheme: (combined) => {
				set({
					currentUITheme: combined.uiThemeId,
					currentEditorTheme: combined.editorThemeId,
					savedPreference: combined,
				});
			},

			getEffectiveTheme: () => {
				const state = get();
				if (!state.followSystem) {
					return {
						ui: state.currentUITheme,
						editor: state.currentEditorTheme,
					};
				}

				const systemVariant = getSystemTheme();
				const saved = state.savedPreference;

				if (saved) {
					const savedUI = getUITheme(saved.uiThemeId);
					if (savedUI && savedUI.variant === systemVariant) {
						return {
							ui: saved.uiThemeId,
							editor: saved.editorThemeId,
						};
					}
				}

				const defaultTheme = getDefaultThemeForVariant(systemVariant);
				return {
					ui: defaultTheme,
					editor: getDefaultEditorThemeForUI(defaultTheme),
				};
			},
		}),
		{
			name: THEME_STORAGE_KEY,
			partialize: (state) => ({
				savedPreference: state.savedPreference,
				followSystem: state.followSystem,
			}),
		},
	),
);
