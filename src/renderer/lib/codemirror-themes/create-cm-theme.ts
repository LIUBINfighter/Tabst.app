import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import type { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { tags } from "@lezer/highlight";
import type { EditorTheme } from "../theme-system/types";

export function createCMThemeFromEditorTheme(
	editorTheme: EditorTheme,
	isDarkUI: boolean,
): Extension[] {
	const useLightSafeDracula = editorTheme.id === "dracula" && !isDarkUI;
	const colors = useLightSafeDracula
		? {
				...editorTheme.colors,
				keyword: "#c2185b",
				operator: "#c2185b",
				string: "#8b5e00",
				number: "#7e57c2",
				atom: "#b45309",
				function: "#0f766e",
				tag: "#c2185b",
				attribute: "#0f766e",
				variable: "hsl(var(--foreground))",
				bracket: "hsl(var(--foreground))",
				atomBackground: "hsl(var(--primary) / 0.16)",
				matchBackground: "hsl(var(--muted) / 0.24)",
				selectionMatch: "hsl(var(--primary) / 0.28)",
			}
		: editorTheme.colors;
	const cm = editorTheme.cmConfig;

	const highlightStyle = HighlightStyle.define([
		{ tag: tags.comment, color: colors.comment },
		{ tag: tags.keyword, color: colors.keyword, fontWeight: "bold" },
		{ tag: tags.operator, color: colors.operator },
		{ tag: tags.string, color: colors.string },
		{ tag: tags.character, color: colors.string },
		{ tag: tags.number, color: colors.number },
		{
			tag: tags.atom,
			color: colors.atom,
			...(colors.atomBackground && { backgroundColor: colors.atomBackground }),
			borderRadius: "3px",
			fontFamily:
				"var(--font-mono, ui-monospace, SFMono-Regular, SFMono, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace)",
		},
		{ tag: tags.function(tags.variableName), color: colors.function },
		{ tag: tags.tagName, color: colors.tag },
		{ tag: tags.attributeName, color: colors.attribute },
		{ tag: tags.variableName, color: colors.variable },
		{ tag: tags.bracket, color: colors.bracket },
	]);

	const themeStyles: Record<string, Record<string, string>> = {
		"&": {
			height: "100%",
			display: "flex",
			flexDirection: "column",
			fontSize: "14px",
		},
		".cm-scroller": {
			overflowX: "hidden",
			overflowY: "auto",
			height: "100%",
			minHeight: "0",
			fontFamily:
				'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
			scrollbarWidth: "thin",
		},
		".cm-content": {
			padding: "8px 0 var(--scroll-buffer, 150px) 0",
		},
		".cm-gutters": {
			backgroundColor: "transparent",
			border: "none",
		},
		".cm-activeLineGutter": { backgroundColor: "transparent" },
		".cm-selectionBackground, .cm-selection": {
			backgroundColor: "var(--selection-overlay)",
			color: "inherit",
			opacity: "1",
			mixBlendMode: "normal",
		},
		".cm-selectionMatch": {
			backgroundColor: colors.selectionMatch ?? "hsl(var(--primary) / 0.24)",
			color: "inherit",
		},
		".cm-searchMatch": {
			backgroundColor: colors.matchBackground ?? "hsl(var(--muted) / 0.2)",
			color: "inherit",
		},
		".cm-searchMatch.cm-searchMatch-selected": {
			backgroundColor: "hsl(var(--primary) / 0.28)",
			color: "inherit",
		},
		".cm-matchingBracket": {
			backgroundColor: "hsl(var(--primary) / 0.2)",
		},
		".cm-nonmatchingBracket": {
			backgroundColor: "hsl(var(--destructive) / 0.2)",
		},
		"&.cm-focused": { outline: "none" },
	};

	if (cm) {
		themeStyles["&"].backgroundColor = cm.background;
		themeStyles["&"].color = useLightSafeDracula
			? "hsl(var(--foreground))"
			: cm.foreground;
		themeStyles[".cm-gutters"].color = useLightSafeDracula
			? "hsl(var(--muted-foreground))"
			: cm.gutterForeground;
		themeStyles[".cm-selectionBackground, .cm-selection"] = {
			backgroundColor: useLightSafeDracula
				? "hsl(var(--primary) / 0.18)"
				: cm.selection,
			color: "inherit",
			opacity: "1",
			mixBlendMode: "normal",
		};
		themeStyles[".cm-activeLine"] = {
			backgroundColor: useLightSafeDracula
				? "hsl(var(--muted) / 0.14)"
				: cm.lineHighlight,
		};
		themeStyles[".cm-cursor"] = {
			borderLeftColor: useLightSafeDracula ? "hsl(var(--primary))" : cm.cursor,
		};
	} else {
		themeStyles["&"].backgroundColor = "hsl(var(--card))";
		themeStyles["&"].color = "hsl(var(--foreground))";
		themeStyles[".cm-gutters"].color = "hsl(var(--muted-foreground))";
		themeStyles[".cm-activeLine"] = {
			backgroundColor: "hsl(var(--muted) / 0.1)",
		};
		themeStyles[".cm-cursor"] = { borderLeftColor: "hsl(var(--primary))" };
	}

	const isDark =
		editorTheme.variant === "dark" ||
		(editorTheme.variant === "universal" && isDarkUI);
	const baseTheme = EditorView.theme(themeStyles, { dark: isDark });

	return [baseTheme, syntaxHighlighting(highlightStyle)];
}
