import type { EditorTheme } from "./types";

function getLightModeTokenOverrides(
	editorTheme: EditorTheme,
): Partial<EditorTheme["colors"]> {
	if (editorTheme.id === "dracula") {
		return {
			comment: "#6b7280",
			keyword: "#c2185b",
			operator: "#c2185b",
			string: "#8b5e00",
			number: "#7e57c2",
			atom: "#b45309",
			function: "#0f766e",
			tag: "#c2185b",
			attribute: "#0f766e",
		};
	}

	return {};
}

function adaptDarkEditorThemeForLightUi(editorTheme: EditorTheme): EditorTheme {
	const lightModeTokenOverrides = getLightModeTokenOverrides(editorTheme);

	return {
		...editorTheme,
		variant: "universal",
		colors: {
			...editorTheme.colors,
			...lightModeTokenOverrides,
			variable: "hsl(var(--foreground))",
			bracket: "hsl(var(--foreground))",
			atomBackground:
				editorTheme.colors.atomBackground ?? "hsl(var(--primary) / 0.14)",
			matchBackground:
				editorTheme.colors.matchBackground ?? "hsl(var(--muted) / 0.18)",
			selectionMatch:
				editorTheme.colors.selectionMatch ?? "hsl(var(--primary) / 0.22)",
		},
		cmConfig: {
			background: "hsl(var(--card))",
			foreground: "hsl(var(--foreground))",
			gutterBackground: "transparent",
			gutterForeground: "hsl(var(--muted-foreground))",
			lineHighlight: "hsl(var(--muted) / 0.14)",
			selection: "hsl(var(--primary) / 0.16)",
			cursor: "hsl(var(--primary))",
		},
	};
}

export function getEditorThemeForUi(
	editorTheme: EditorTheme,
	isDarkUI: boolean,
): EditorTheme {
	if (isDarkUI || editorTheme.variant !== "dark") {
		return editorTheme;
	}

	return adaptDarkEditorThemeForLightUi(editorTheme);
}
