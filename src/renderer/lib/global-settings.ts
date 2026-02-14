import type { GlobalSettings } from "../types/settings";

// Thin wrapper around electronAPI for type-safety and defaults
export async function loadGlobalSettings(): Promise<GlobalSettings> {
	try {
		const res = await window.electronAPI.loadGlobalSettings();
		if (res?.success && res?.data && typeof res.data === "object") {
			const data = res.data as GlobalSettings;
			return {
				locale: data.locale ?? "zh-cn",
				deleteBehavior: data.deleteBehavior ?? "ask-every-time",
				theme: data.theme ?? {
					uiThemeId: "github",
					editorThemeId: "github",
					mode: "system",
				},
			};
		}
	} catch {}
	return {
		locale: "zh-cn",
		deleteBehavior: "ask-every-time",
		theme: {
			uiThemeId: "github",
			editorThemeId: "github",
			mode: "system",
		},
	};
}

export async function saveGlobalSettings(
	partial: Partial<GlobalSettings>,
): Promise<boolean> {
	// Merge with existing to avoid overwriting other keys
	const current = await loadGlobalSettings();
	const next: GlobalSettings = {
		locale: partial.locale ?? current.locale,
		deleteBehavior: partial.deleteBehavior ?? current.deleteBehavior,
		theme: partial.theme ?? current.theme,
	};
	const res = await window.electronAPI.saveGlobalSettings(next);
	return !!res?.success;
}
