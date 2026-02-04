import {
	HighlightStyle,
	StreamLanguage,
	syntaxHighlighting,
} from "@codemirror/language";
import type { Extension } from "@codemirror/state";
import { textMateGrammar } from "@coderline/alphatab-language-server";
import { tags } from "@lezer/highlight";
import type { EditorTheme } from "./theme-system/types";

const alphaTexParser = StreamLanguage.define({
	startState() {
		return { inBlockComment: false };
	},
	token(stream, state: { inBlockComment: boolean }) {
		if (state.inBlockComment) {
			while (!stream.eol()) {
				if (stream.match("*/")) {
					state.inBlockComment = false;
					break;
				}
				stream.next();
			}
			return "comment";
		}

		if (stream.eatSpace()) return null;

		if (stream.match("/*")) {
			state.inBlockComment = true;
			while (!stream.eol()) {
				if (stream.match("*/")) {
					state.inBlockComment = false;
					break;
				}
				stream.next();
			}
			return "comment";
		}

		if (stream.match("//")) {
			stream.skipToEnd();
			return "comment";
		}

		if (stream.match(/:(128|64|32|16|8|4|2|1)/)) {
			if (stream.peek() === ".") {
				const nextChar = stream.string[stream.pos + 1] ?? "";
				if (!/[0-9]/.test(nextChar)) {
					stream.next();
				}
			}
			if (stream.peek() === "{") {
				stream.next();
				while (!stream.eol() && stream.peek() !== "}") {
					stream.next();
				}
				if (stream.peek() === "}") {
					stream.next();
				}
			}
			return "atom";
		}

		if (stream.eat("\\")) {
			stream.eatWhile(/[-\w]/);
			return "keyword";
		}

		if (stream.eat('"')) {
			while (!stream.eol()) {
				if (stream.eat('"')) break;
				stream.next();
			}
			return "string";
		}

		if (stream.eat(/[{}[\]()]/)) return "bracket";

		if (stream.eat("|")) return "operator";

		if (/[0-9]/.test(stream.peek() ?? "")) {
			stream.eatWhile(/[0-9.]/);
			return "number";
		}

		stream.next();
		return null;
	},
});

export function createAlphaTexHighlightForTheme(
	theme: EditorTheme,
): Extension[] {
	const colors = theme.colors;

	const alphaTexTheme = HighlightStyle.define([
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

	return [alphaTexParser, syntaxHighlighting(alphaTexTheme)];
}

let cachedExtension: Extension[] | null = null;
let cachedThemeId: string | null = null;

export async function getAlphaTexHighlight(
	theme?: EditorTheme,
): Promise<Extension[]> {
	if (theme) {
		if (cachedThemeId === theme.id && cachedExtension) {
			return cachedExtension;
		}
		cachedThemeId = theme.id;
		cachedExtension = createAlphaTexHighlightForTheme(theme);
		return cachedExtension;
	}

	if (cachedExtension) return cachedExtension;

	const defaultTheme: EditorTheme = {
		id: "github",
		name: "GitHub",
		variant: "universal",
		colors: {
			comment: "#6a737d",
			keyword: "#d73a49",
			operator: "#d73a49",
			string: "#032f62",
			number: "#005cc5",
			atom: "#f59e0b",
			function: "#6f42c1",
			tag: "#22863a",
			attribute: "#6f42c1",
			variable: "#24292e",
			bracket: "#24292e",
			atomBackground: "rgba(245, 158, 11, 0.12)",
			matchBackground: "rgba(36, 41, 46, 0.04)",
			selectionMatch: "rgba(9, 105, 218, 0.18)",
		},
	};

	cachedThemeId = defaultTheme.id;
	cachedExtension = createAlphaTexHighlightForTheme(defaultTheme);
	return cachedExtension;
}

export function getAlphaTexGrammar() {
	return textMateGrammar;
}
