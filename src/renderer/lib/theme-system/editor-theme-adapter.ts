import type { EditorTheme } from "./types";

function adaptDarkEditorThemeForLightUi(editorTheme: EditorTheme): EditorTheme {
	return {
		...editorTheme,
		variant: "universal",
		colors: {
			...editorTheme.colors,
			variable: "hsl(var(--foreground))",
			bracket: "hsl(var(--foreground))",
			atomBackground:
				editorTheme.colors.atomBackground ?? "hsl(var(--primary) / 0.14)",
			matchBackground:
				editorTheme.colors.matchBackground ?? "hsl(var(--muted) / 0.18)",
			selectionMatch: "hsl(var(--primary) / 0.22)",
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
