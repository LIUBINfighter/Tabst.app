/**
 * AlphaTex Code Completion Extension for CodeMirror 6
 *
 * Provides autocomplete functionality for AlphaTex language using LSP
 */

import {
	autocompletion,
	type Completion,
	type CompletionContext,
	type CompletionResult,
	completionKeymap,
	snippet,
} from "@codemirror/autocomplete";
import { syntaxTree } from "@codemirror/language";
import type { Extension } from "@codemirror/state";
import { Prec } from "@codemirror/state";
import { keymap } from "@codemirror/view";
import type { AlphaTexLSPClient } from "./alphatex-lsp";

// Minimal LSP CompletionItem shape we currently use
interface LspCompletionItem {
	label: string;
	detail?: string;
	documentation?: { value?: string } | string;
	insertText?: string;
}

/**
 * Create a completion source that queries the LSP worker
 */
export function createAlphaTexCompletionSource(lspClient: AlphaTexLSPClient) {
	return async (
		context: CompletionContext,
	): Promise<CompletionResult | null> => {
		// Check if we are inside a comment using syntax tree
		const node = syntaxTree(context.state).resolveInner(context.pos, -1);
		if (node.name.toLowerCase().includes("comment")) {
			return null;
		}

		// Manual check for line comments as a fallback
		const line = context.state.doc.lineAt(context.pos);
		const textBefore = line.text.slice(0, context.pos - line.from);
		if (textBefore.trim().startsWith("//") || textBefore.includes(" //")) {
			return null;
		}

		// Get the word being completed (allow backslash prefix to trigger completion)
		// This will match either `\` or `\xxx` as well as normal word prefixes like `b`, and supports hyphen in property names (e.g. fade-in)
		const word = context.matchBefore(/\\?[\w-]*/);
		if (!word) return null;

		// Don't offer completions unless the user explicitly asked for them
		// (by pressing Ctrl+Space or after typing a trigger character).
		// However, if the previous character is a backslash (`\`), treat it as a trigger.
		if (!context.explicit && word.from === word.to) {
			const prev = context.state.doc.sliceString(
				Math.max(0, context.pos - 1),
				context.pos,
			);
			// If the previous character is not a backslash, don't trigger completions
			if (prev !== "\\") {
				return null;
			}
		}

		try {
			// Request completions from LSP worker
			const response = await lspClient.request("textDocument/completion", {
				textDocument: { uri: "file:///main.atex" },
				position: {
					line: context.state.doc.lineAt(context.pos).number - 1,
					character: context.pos - context.state.doc.lineAt(context.pos).from,
				},
				// Provide the prefix (including a leading backslash if present)
				// so the language server can tailor completion results accordingly.
				prefix: word.text,
			});

			const respObj = response as { items?: LspCompletionItem[] } | null;

			if (!respObj || !respObj.items) {
				return null;
			}

			// Convert LSP completion items to CodeMirror format
			const items = respObj.items as LspCompletionItem[];

			const completions: Completion[] = items.map((item) => {
				const insertText = item.insertText ?? item.label;
				const isSnippet = insertText.includes("${");

				return {
					label: item.label,
					detail: item.detail,
					info:
						typeof item.documentation === "string"
							? item.documentation
							: item.documentation?.value || "",
					apply: isSnippet ? snippet(insertText) : insertText,
				};
			});

			// Client-side filter: normalize the detected prefix, strip leading backslash for comparisons
			const prefixRaw = word.text ?? "";
			const prefix = prefixRaw.startsWith("\\")
				? prefixRaw.slice(1)
				: prefixRaw;
			const prefixLower = prefix.toLowerCase();

			// If the user typed a leading backslash, prioritize command completions (labels that begin with '\')
			let filteredCompletions: Completion[] = [];
			if (prefixRaw.startsWith("\\")) {
				filteredCompletions = completions.filter((c) => {
					const lbl = c.label ?? "";
					if (!lbl.startsWith("\\")) return false; // only keep commands starting with '\'
					const labelNormalized = lbl.slice(1); // remove leading backslash
					// Prefer prefix match (startsWith) for `\` commands
					return prefixLower.length === 0
						? true
						: labelNormalized.toLowerCase().startsWith(prefixLower);
				});
			} else {
				filteredCompletions = completions.filter((c) => {
					const lbl = c.label ?? "";
					const labelNormalized = lbl.startsWith("\\") ? lbl.slice(1) : lbl;
					return labelNormalized.toLowerCase().includes(prefixLower);
				});
			}

			// If nothing matched after filtering (shouldn't normally happen), fall back to original completions
			return {
				from: word.from,
				options:
					filteredCompletions.length > 0 ? filteredCompletions : completions,
			};
		} catch (e) {
			console.error("Completion error:", e);
			return null;
		}
	};
}

/**
 * Create CodeMirror autocomplete configuration for AlphaTex
 * Returns an array of extensions including the autocompletion extension
 * and the completionKeymap with highest precedence to ensure arrow keys
 * work correctly in the autocomplete dropdown.
 */
export function createAlphaTexAutocomplete(
	lspClient: AlphaTexLSPClient,
): Extension[] {
	const completionSource = createAlphaTexCompletionSource(lspClient);

	return [
		autocompletion({
			override: [completionSource],
			// Ensure typing characters (like `\`) can activate completions without requiring explicit Ctrl+Space
			activateOnTyping: true,
		}),
		// Use Prec.highest to ensure completionKeymap has highest precedence
		// This ensures arrow keys navigate the autocomplete menu instead of moving the cursor
		Prec.highest(keymap.of(completionKeymap)),
	];
}
