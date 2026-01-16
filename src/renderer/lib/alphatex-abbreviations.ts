import type { Completion } from "@codemirror/autocomplete";
import { snippet } from "@codemirror/autocomplete";
import { syntaxTree } from "@codemirror/language";
import { ViewPlugin, type ViewUpdate } from "@codemirror/view";
import commandsJSON from "../data/alphatex-commands.json";

/**
 * AlphaTex Abbreviation Expansion Plugin
 *
 * Automatically expands short abbreviations (like 'cho') into full snippets
 * (like '\chord "{cursor}"') immediately upon typing the last character,
 * without requiring the autocomplete menu or Enter key.
 */

const abbreviations =
	(commandsJSON as { abbreviations?: Record<string, string> }).abbreviations ||
	{};

export const alphatexAbbreviations = ViewPlugin.fromClass(
	class {
		update(update: ViewUpdate) {
			// Only trigger on document changes caused by user typing
			if (!update.docChanged) return;

			// Check if this was a simple text insertion
			let isInsertion = false;
			update.changes.iterChanges((_fromA, _toA, _fromB, _toB, inserted) => {
				if (inserted.length > 0) isInsertion = true;
			});
			if (!isInsertion) return;

			const pos = update.state.selection.main.head;
			const line = update.state.doc.lineAt(pos);
			const textBefore = line.text.slice(0, pos - line.from);

			for (const [abbr, expansion] of Object.entries(abbreviations)) {
				if (textBefore.endsWith(abbr as string)) {
					// Check if we are inside a comment, but allow '/*' to trigger expansion
					// because typing '/*' immediately makes the node a comment.
					const node = syntaxTree(update.state).resolveInner(pos, -1);
					if (node.name.toLowerCase().includes("comment") && abbr !== "/*") {
						continue;
					}

					// Ensure it's a standalone word (not part of another word)
					const start = pos - abbr.length;
					const prevChar =
						start > line.from ? line.text[start - line.from - 1] : "";

					// If the abbreviation starts with a letter/number, ensure it's not part of a larger word
					if (
						/^[a-zA-Z0-9]/.test(abbr) &&
						prevChar &&
						/[a-zA-Z0-9\\]/.test(prevChar)
					)
						continue;

					// Trigger the snippet expansion
					// 🆕 使用 setTimeout(0) 代替 requestAnimationFrame 避免与滚动冲突
					setTimeout(() => {
						const view = update.view;
						// Double check if the view is still valid, attached, and the text is still there
						if (
							!view.dom.parentNode ||
							view.state.doc.sliceString(start, pos) !== abbr
						)
							return;

						// Create a dummy completion object for the snippet function
						const dummyCompletion: Completion = { label: abbr };
						// Apply the snippet
						snippet(expansion as string)(view, dummyCompletion, start, pos);
					}, 0);

					break;
				}
			}
		}
	},
);
