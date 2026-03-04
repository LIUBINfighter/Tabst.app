import {
	ensureSyntaxTree,
	HighlightStyle,
	StreamLanguage,
} from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { highlightTree, tags } from "@lezer/highlight";
import { describe, expect, it } from "vitest";

describe("CodeMirror stream highlighting regression", () => {
	it("does not throw when highlighting a stream language parse tree", () => {
		const parser = StreamLanguage.define({
			startState() {
				return {};
			},
			token(stream) {
				if (stream.eatSpace()) return null;
				if (stream.eat("\\")) {
					stream.eatWhile(/[-\w]/);
					return "keyword";
				}
				if (/[0-9]/.test(stream.peek() ?? "")) {
					stream.eatWhile(/[0-9.]/);
					return "number";
				}
				stream.next();
				return null;
			},
		});

		const state = EditorState.create({
			doc: '\\title "Song"\n1.4.8 2.4.8',
			extensions: [parser],
		});
		const tree = ensureSyntaxTree(state, state.doc.length, 1_000);
		const highlighter = HighlightStyle.define([
			{ tag: tags.keyword, color: "#d73a49" },
			{ tag: tags.number, color: "#005cc5" },
		]);

		expect(tree).not.toBeNull();
		if (!tree) {
			throw new Error("Expected a syntax tree for the sample document");
		}
		expect(() => {
			highlightTree(tree, highlighter, () => {});
		}).not.toThrow();
	});
});
