import {
	HighlightStyle,
	StreamLanguage,
	type StreamParser,
	syntaxHighlighting,
} from "@codemirror/language";
import type { Extension } from "@codemirror/state";
import { textMateGrammar } from "@coderline/alphatab-language-server";
import { tags } from "@lezer/highlight";
import { getAtDocSections } from "./atdoc";
import {
	atdocHighlightTags,
	buildAtDocHighlightSpecs,
} from "./atdoc-highlight-tags";
import type { EditorTheme } from "./theme-system/types";

interface AlphaTexStreamState {
	inBlockComment: boolean;
	inLineComment: boolean;
	/** 当前已知 ATDOC 分节（`[meta]` 等），未知分节会重置为空。 */
	currentSection: string;
	/** 处于 `key=` 之后的值位置。 */
	expectValue: boolean;
}

type AlphaTexStream = Parameters<
	NonNullable<StreamParser<AlphaTexStreamState>["token"]>
>[0];

const ATDOC_KNOWN_SECTIONS = new Set(getAtDocSections());

/**
 * 对注释内容做 TSDoc/JSDoc 风格的分层词法分析。
 * 语义与 `parseAtDoc` 保持一致：分节范围、未知分节重置、`#tag` 按空白分词。
 */
function tokenAtDocLine(
	stream: AlphaTexStream,
	state: AlphaTexStreamState,
): string | null {
	if (state.inBlockComment && stream.match("*/")) {
		state.inBlockComment = false;
		return "comment";
	}

	if (stream.eatSpace()) return "comment";

	const sectionMatch = stream.match(/^\[([a-zA-Z][\w-]*)\]/);
	if (sectionMatch && sectionMatch !== true) {
		state.currentSection = ATDOC_KNOWN_SECTIONS.has(sectionMatch[1])
			? sectionMatch[1]
			: "";
		return "atdocSection";
	}

	if (stream.match(/^at\.[a-zA-Z][\w.-]*(?=\s*=)/)) {
		return "atdocKey";
	}

	if (state.currentSection && stream.match(/^[a-zA-Z][\w-]*(?=\s*=)/)) {
		return "atdocKey";
	}

	if (stream.match(/^=\s*/)) {
		state.expectValue = true;
		return "atdocOperator";
	}

	if (state.expectValue) {
		const quoted = stream.match(/^"(?:[^"\\]|\\.)*"|^'(?:[^'\\]|\\.)*'/);
		if (quoted) {
			const inner = stream.current().slice(1, -1);
			return /^#[0-9a-fA-F]{6}$/.test(inner) ? "atdocColor" : "atdocString";
		}
		if (stream.match(/^#[0-9a-fA-F]{6}\b/)) {
			return "atdocColor";
		}
		if (stream.match(/^[^\s*]+/)) {
			return "atdocValue";
		}
	}

	if (stream.sol() || /\s/.test(stream.string[stream.pos - 1] ?? "")) {
		if (stream.match(/^#[\p{L}\p{N}_-]+/u)) {
			return "atdocTag";
		}
	}

	stream.next();
	return "comment";
}

export const alphaTexParser = StreamLanguage.define({
	startState(): AlphaTexStreamState {
		return {
			inBlockComment: false,
			inLineComment: false,
			currentSection: "",
			expectValue: false,
		};
	},
	token(stream, state: AlphaTexStreamState) {
		if (stream.sol()) {
			state.expectValue = false;
			state.inLineComment = false;
		}

		if (state.inBlockComment || state.inLineComment) {
			return tokenAtDocLine(stream, state);
		}

		if (stream.eatSpace()) return null;

		if (stream.match("/*")) {
			state.inBlockComment = true;
			return "comment";
		}

		if (stream.match("//")) {
			state.inLineComment = true;
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
	tokenTable: {
		atdocSection: atdocHighlightTags.section,
		atdocKey: atdocHighlightTags.key,
		atdocOperator: atdocHighlightTags.operator,
		atdocValue: atdocHighlightTags.value,
		atdocString: atdocHighlightTags.string,
		atdocColor: atdocHighlightTags.color,
		atdocTag: atdocHighlightTags.tag,
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
		...buildAtDocHighlightSpecs(colors),
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
			atdocSection: "#6f42c1",
			atdocKey: "#005cc5",
			atdocValue: "#22863a",
			atdocString: "#032f62",
			atdocColor: "#f59e0b",
			atdocTag: "#e36209",
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
