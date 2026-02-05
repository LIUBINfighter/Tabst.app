import type * as alphaTab from "@coderline/alphatab";

export interface AlphaTabColors {
	mainGlyphColor: string;
	secondaryGlyphColor: string;
	staffLineColor: string;
	barSeparatorColor: string;
	barNumberColor: string;
	scoreInfoColor: string;
}

interface AlphaTabResources {
	mainGlyphColor?: string;
	secondaryGlyphColor?: string;
	staffLineColor?: string;
	barSeparatorColor?: string;
	barNumberColor?: string;
	scoreInfoColor?: string;
	smuflFont?: unknown;
	[key: string]: unknown;
}

function getCSSVariable(name: string): string {
	if (typeof document === "undefined") return "";
	const value = getComputedStyle(document.documentElement)
		.getPropertyValue(name)
		.trim();
	return value || "";
}

export function getAlphaTabColorsForTheme(): AlphaTabColors {
	const mainGlyph = getCSSVariable("--alphatab-main-glyph");
	const secondaryGlyph = getCSSVariable("--alphatab-secondary-glyph");
	const staffLine = getCSSVariable("--alphatab-staff-line");
	const barSeparator = getCSSVariable("--alphatab-bar-separator");
	const barNumber = getCSSVariable("--alphatab-bar-number");
	const scoreInfo = getCSSVariable("--alphatab-score-info");

	const isDarkMode = document.documentElement.classList.contains("dark");

	if (isDarkMode) {
		return {
			mainGlyphColor: mainGlyph || "#f1f5f9",
			secondaryGlyphColor: secondaryGlyph || "#f1f5f999",
			staffLineColor: staffLine || "#475569",
			barSeparatorColor: barSeparator || "#475569",
			barNumberColor: barNumber || "#94a3b8",
			scoreInfoColor: scoreInfo || "#cbd5e1",
		};
	}

	return {
		mainGlyphColor: mainGlyph || "#0f172a",
		secondaryGlyphColor: secondaryGlyph || "#0f172a99",
		staffLineColor: staffLine || "#cbd5e1",
		barSeparatorColor: barSeparator || "#cbd5e1",
		barNumberColor: barNumber || "#475569",
		scoreInfoColor: scoreInfo || "#1e293b",
	};
}

export function applyColorsToApi(
	api: alphaTab.AlphaTabApi | null,
	colors: AlphaTabColors,
): void {
	if (!api || !api.settings.display) {
		console.warn("[ThemeManager] Cannot apply colors: API not ready");
		return;
	}

	const resources = api.settings.display
		.resources as unknown as AlphaTabResources;

	resources.mainGlyphColor = colors.mainGlyphColor;
	resources.secondaryGlyphColor = colors.secondaryGlyphColor;
	resources.staffLineColor = colors.staffLineColor;
	resources.barSeparatorColor = colors.barSeparatorColor;
	resources.barNumberColor = colors.barNumberColor;
	resources.scoreInfoColor = colors.scoreInfoColor;
}

export function updateAlphaTabColorsForTheme(
	api: alphaTab.AlphaTabApi | null,
): void {
	if (!api) {
		console.warn("[ThemeManager] Cannot update colors: API not initialized");
		return;
	}

	const colors = getAlphaTabColorsForTheme();
	applyColorsToApi(api, colors);

	if (api.score) {
		api.render();
	}
}

export function setupThemeObserver(onThemeChange: () => void): () => void {
	const observer = new MutationObserver(() => {
		onThemeChange();
	});

	observer.observe(document.documentElement, {
		attributes: true,
		attributeFilter: ["class"],
	});

	return () => {
		observer.disconnect();
	};
}
