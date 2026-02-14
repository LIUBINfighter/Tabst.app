export type ThemeMode = "light" | "dark" | "system";

export interface ThemePreference {
	uiThemeId: string;
	editorThemeId: string;
	mode: ThemeMode;
}

export interface GlobalSettings {
	locale?: "en" | "zh-cn";
	deleteBehavior?: "system-trash" | "repo-trash" | "ask-every-time";
	theme?: ThemePreference;
}
