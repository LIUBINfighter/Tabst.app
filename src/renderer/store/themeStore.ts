import { create } from "zustand";
import { loadGlobalSettings, saveGlobalSettings } from "../lib/global-settings";
// Persist to ~/.tabst/settings.json via helper, not localStorage
import {
	getDefaultEditorThemeForUI,
	getUITheme,
} from "../lib/theme-system/theme-registry";
import type {
	CombinedTheme,
	ThemeMode,
	ThemeState,
} from "../lib/theme-system/types";

// Removed localStorage storage key; using global settings file instead

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

export const useThemeStore = create<ThemeStore>()((set, get) => ({
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
		void saveGlobalSettings({
			theme: {
				uiThemeId: themeId,
				editorThemeId: defaultEditor,
				mode: get().themeMode,
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
		void saveGlobalSettings({
			theme: {
				uiThemeId: get().currentUITheme,
				editorThemeId: themeId,
				mode: get().themeMode,
			},
		});
	},

	setThemeMode: (mode) => {
		set({ themeMode: mode });
		void saveGlobalSettings({
			theme: {
				uiThemeId: get().currentUITheme,
				editorThemeId: get().currentEditorTheme,
				mode: mode,
			},
		});
	},

	setCombinedTheme: (combined) => {
		set({
			currentUITheme: combined.uiThemeId,
			currentEditorTheme: combined.editorThemeId,
			savedPreference: combined,
		});
		void saveGlobalSettings({
			theme: {
				uiThemeId: combined.uiThemeId,
				editorThemeId: combined.editorThemeId,
				mode: get().themeMode,
			},
		});
	},

	getEffectiveVariant: () => {
		const state = get();
		if (state.themeMode === "system") {
			return getSystemTheme();
		}
		return state.themeMode;
	},
}));

// Hydrate initial theme preference from global settings file
void (async () => {
	try {
		const settings = await loadGlobalSettings();
		if (settings.theme) {
			useThemeStore.getState().setCombinedTheme({
				uiThemeId: settings.theme.uiThemeId,
				editorThemeId: settings.theme.editorThemeId,
			});
			useThemeStore.getState().setThemeMode(settings.theme.mode);
		}
	} catch {}
})();
