import { ensureSyntaxTree, HighlightStyle } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { highlightTree, tags } from "@lezer/highlight";
import { describe, expect, it } from "vitest";
import { alphaTexParser } from "./alphatex-highlight";
import { atdocHighlightTags } from "./atdoc-highlight-tags";

interface HighlightSpan {
	text: string;
	cls: string;
}

function spansFor(doc: string): HighlightSpan[] {
	const state = EditorState.create({ doc, extensions: [alphaTexParser] });
	const tree = ensureSyntaxTree(state, state.doc.length, 2_000);
	if (!tree) {
		throw new Error("Expected a syntax tree for the sample document");
	}

	const highlighter = HighlightStyle.define([
		{ tag: tags.comment, color: "#999999", class: "cm-comment" },
		{ tag: tags.keyword, color: "#b1", class: "cm-keyword" },
		{ tag: tags.string, color: "#b2", class: "cm-string" },
		{ tag: tags.number, color: "#b3", class: "cm-number" },
		{ tag: tags.atom, color: "#b4", class: "cm-atom" },
		{ tag: atdocHighlightTags.section, color: "#a1", class: "atdoc-section" },
		{ tag: atdocHighlightTags.key, color: "#a2", class: "atdoc-key" },
		{ tag: atdocHighlightTags.operator, color: "#a3", class: "atdoc-operator" },
		{ tag: atdocHighlightTags.value, color: "#a4", class: "atdoc-value" },
		{ tag: atdocHighlightTags.string, color: "#a5", class: "atdoc-string" },
		{ tag: atdocHighlightTags.color, color: "#a6", class: "atdoc-color" },
		{ tag: atdocHighlightTags.tag, color: "#a7", class: "atdoc-tag" },
	]);

	const spans: HighlightSpan[] = [];
	highlightTree(tree, highlighter, (from, to, cls) => {
		if (cls) spans.push({ text: doc.slice(from, to), cls });
	});
	return spans;
}

function has(doc: string, text: string, cls: string): boolean {
	return spansFor(doc).some(
		(span) => span.text === text && span.cls.split(" ").includes(cls),
	);
}

describe("ATDOC layered highlighting (TSDoc/JSDoc style)", () => {
	it("highlights INI section headers", () => {
		const doc = `/**
 * [player]
 * speed=0.92
 * countIn=true
 */`;
		expect(has(doc, "[player]", "atdoc-section")).toBe(true);
	});

	it("highlights bare keys and values inside sections", () => {
		const doc = `/**
 * [player]
 * speed=0.92
 * countIn=true
 */`;
		expect(has(doc, "speed", "atdoc-key")).toBe(true);
		expect(has(doc, "0.92", "atdoc-value")).toBe(true);
		expect(has(doc, "countIn", "atdoc-key")).toBe(true);
		expect(has(doc, "true", "atdoc-value")).toBe(true);
		expect(has(doc, "=", "atdoc-operator")).toBe(true);
	});

	it("does not highlight bare keys outside any section", () => {
		const doc = `/**
 * speed=0.92
 */`;
		expect(has(doc, "speed", "atdoc-key")).toBe(false);
	});

	it("resets the active section on unknown sections", () => {
		const doc = `/**
 * [unknown]
 * speed=0.92
 */`;
		expect(has(doc, "[unknown]", "atdoc-section")).toBe(true);
		expect(has(doc, "speed", "atdoc-key")).toBe(false);
	});

	it("highlights dotted keys, operators and quoted string values", () => {
		const doc = `/**
 * at.meta.title="Flower Dance"
 * at.player.playbackSpeed=0.9
 */`;
		expect(has(doc, "at.meta.title", "atdoc-key")).toBe(true);
		expect(has(doc, '"Flower Dance"', "atdoc-string")).toBe(true);
		expect(has(doc, "at.player.playbackSpeed", "atdoc-key")).toBe(true);
		expect(has(doc, "0.9", "atdoc-value")).toBe(true);
	});

	it("highlights #tags on comment lines", () => {
		const doc = `/**
 * A #study piece, focus on #bends and #vibrato
 */`;
		expect(has(doc, "#study", "atdoc-tag")).toBe(true);
		expect(has(doc, "#bends", "atdoc-tag")).toBe(true);
		expect(has(doc, "#vibrato", "atdoc-tag")).toBe(true);
	});

	it("does not treat # inside words (e.g. C#m) as tags", () => {
		const doc = `/**
 * chord C#m here
 */`;
		expect(has(doc, "#m", "atdoc-tag")).toBe(false);
	});

	it("highlights hex color values as colors, not tags", () => {
		const doc = `/**
 * [coloring]
 * barNumberColor=#ef4444
 * staffLineColor="#334155"
 */`;
		expect(has(doc, "#ef4444", "atdoc-color")).toBe(true);
		expect(has(doc, "#ef4444", "atdoc-tag")).toBe(false);
		expect(has(doc, '"#334155"', "atdoc-color")).toBe(true);
		expect(has(doc, '"#334155"', "atdoc-string")).toBe(false);
	});

	it("supports // line comments", () => {
		const doc = `// [meta]
// status=released`;
		expect(has(doc, "[meta]", "atdoc-section")).toBe(true);
		expect(has(doc, "status", "atdoc-key")).toBe(true);
		expect(has(doc, "released", "atdoc-value")).toBe(true);
	});

	it("keeps score tokens free of atdoc classes", () => {
		const doc = `\\title "Song"
1.4.8 2.4.8`;
		expect(has(doc, "\\title", "cm-keyword")).toBe(true);
		expect(has(doc, '"Song"', "cm-string")).toBe(true);
		const spans = spansFor(doc);
		expect(spans.some((span) => span.cls.includes("cm-comment"))).toBe(false);
		expect(spans.every((span) => !span.cls.includes("atdoc-"))).toBe(true);
	});

	it("closes block comments on */ lines and continues scoring", () => {
		const doc = `/**
 * [player]
 * speed=0.92
 */
\\title "Song"`;
		expect(has(doc, "[player]", "atdoc-section")).toBe(true);
		expect(has(doc, "\\title", "cm-keyword")).toBe(true);
		expect(has(doc, '"Song"', "cm-string")).toBe(true);
	});
});
