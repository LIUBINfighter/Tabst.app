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
	completionStatus,
	snippet,
	startCompletion,
} from "@codemirror/autocomplete";
import type { Extension } from "@codemirror/state";
import { Prec } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import {
	ATDOC_KEY_DEFINITIONS,
	ATDOC_LAYOUT_MODE_VALUES,
	ATDOC_META_LICENSE_VALUES,
	ATDOC_META_STATUS_VALUES,
	ATDOC_SCROLL_MODE_VALUES,
} from "./../data/atdoc-keys";
import type { AlphaTexLSPClient } from "./alphatex-lsp";

// Minimal LSP CompletionItem shape we currently use
interface LspCompletionItem {
	label: string;
	detail?: string;
	documentation?: { value?: string } | string;
	insertText?: string;
}

interface LayeredContext {
	kind: "domain" | "key" | "value";
	domainPrefix: string;
	keyPrefix: string;
	valuePrefix: string;
	replaceFrom: number;
	replaceTo: number;
	domain?: string;
	key?: string;
}

const ATDOC_DOMAIN_FALLBACKS = [
	"meta",
	"display",
	"player",
	"coloring",
	"staff",
	"print",
];

function getAtDocLayeredContext(
	context: CompletionContext,
): LayeredContext | null {
	const line = context.state.doc.lineAt(context.pos);
	const before = line.text.slice(0, context.pos - line.from);

	const atIndex = Math.max(before.lastIndexOf("at."), before.lastIndexOf("at"));
	if (atIndex < 0) return null;

	const fragment = before.slice(atIndex).trim();
	const replaceFrom = line.from + atIndex;
	const replaceTo = context.pos;

	if (fragment === "at") {
		return {
			kind: "domain",
			domainPrefix: "",
			keyPrefix: "",
			valuePrefix: "",
			replaceFrom,
			replaceTo,
		};
	}

	if (fragment === "at.") {
		return {
			kind: "domain",
			domainPrefix: "",
			keyPrefix: "",
			valuePrefix: "",
			replaceFrom,
			replaceTo,
		};
	}

	if (fragment.startsWith("at.") && !fragment.includes("=")) {
		const rest = fragment.slice(3);
		const parts = rest.split(".");
		if (parts.length === 1) {
			return {
				kind: "domain",
				domainPrefix: parts[0] ?? "",
				keyPrefix: "",
				valuePrefix: "",
				replaceFrom,
				replaceTo,
			};
		}
		if (parts.length >= 2) {
			const domain = parts[0] ?? "";
			const keyPrefix = parts.slice(1).join(".");
			return {
				kind: "key",
				domainPrefix: domain,
				keyPrefix,
				valuePrefix: "",
				replaceFrom,
				replaceTo,
				domain,
			};
		}
	}

	if (fragment.startsWith("at.") && /=\s*$/.test(fragment)) {
		const left = fragment.replace(/=\s*$/, "");
		const leftParts = left.slice(3).split(".");
		if (leftParts.length >= 2) {
			const domain = leftParts[0] ?? "";
			const key = leftParts.slice(1).join(".");
			return {
				kind: "value",
				domainPrefix: domain,
				keyPrefix: key,
				valuePrefix: "",
				replaceFrom,
				replaceTo,
				domain,
				key,
			};
		}
	}

	if (fragment.startsWith("at.") && fragment.includes("=")) {
		const [leftRaw, valuePrefixRaw = ""] = fragment.split("=");
		const left = leftRaw.trimEnd();
		const leftParts = left.slice(3).split(".");
		if (leftParts.length >= 2) {
			const domain = leftParts[0] ?? "";
			const key = leftParts.slice(1).join(".");
			return {
				kind: "value",
				domainPrefix: domain,
				keyPrefix: key,
				valuePrefix: valuePrefixRaw,
				replaceFrom,
				replaceTo,
				domain,
				key,
			};
		}
	}

	return null;
}

function buildLayeredCompletions(context: LayeredContext): CompletionResult {
	const domainSet = new Set<string>(ATDOC_DOMAIN_FALLBACKS);
	for (const def of ATDOC_KEY_DEFINITIONS) {
		const [, domain] = def.key.split(".");
		if (domain) domainSet.add(domain);
	}
	const domains = [...domainSet].sort();

	if (context.kind === "domain") {
		const filteredDomains = domains.filter((domain) =>
			domain.toLowerCase().startsWith(context.domainPrefix.toLowerCase()),
		);
		return {
			from: context.replaceFrom,
			to: context.replaceTo,
			filter: false,
			options: filteredDomains.map((domain) => ({
				label: domain,
				detail: "ATDOC domain",
				apply: `at.${domain}.`,
			})),
		};
	}

	if (context.kind === "key") {
		const domain = context.domain ?? "";
		const prefix = `at.${domain}.`;
		const keys = ATDOC_KEY_DEFINITIONS.filter((def) =>
			def.key.startsWith(prefix),
		)
			.map((def) => ({
				name: def.key.slice(prefix.length),
				detail: def.valueType,
				doc: `${def.description}\n\nExample: ${def.example}`,
			}))
			.filter((item) =>
				item.name.toLowerCase().startsWith(context.keyPrefix.toLowerCase()),
			);

		return {
			from: context.replaceFrom,
			to: context.replaceTo,
			filter: false,
			options: keys.map((item) => ({
				label: item.name,
				detail: item.detail,
				info: item.doc,
				apply: `at.${domain}.${item.name}=`,
			})),
		};
	}

	const keyName = context.key ?? "";
	const fullKey = `at.${context.domain}.${keyName}`;
	const def = ATDOC_KEY_DEFINITIONS.find((item) => item.key === fullKey);
	if (!def) {
		return { from: context.replaceFrom, to: context.replaceTo, options: [] };
	}

	const rawValuePrefix = context.valuePrefix.trim().replace(/^"|"$/g, "");
	const values: string[] =
		def.valueType === "enum:status"
			? [...ATDOC_META_STATUS_VALUES]
			: def.valueType === "enum:license"
				? [...ATDOC_META_LICENSE_VALUES]
				: def.valueType === "enum:layoutMode"
					? [...ATDOC_LAYOUT_MODE_VALUES]
					: def.valueType === "enum:scrollMode"
						? [...ATDOC_SCROLL_MODE_VALUES]
						: def.valueType === "boolean"
							? ["true", "false"]
							: [];

	const filtered = values.filter((value) =>
		value.toLowerCase().startsWith(rawValuePrefix.toLowerCase()),
	);
	return {
		from: context.replaceFrom,
		to: context.replaceTo,
		filter: false,
		options: filtered.map((value) => ({
			label: value,
			detail: `value for ${fullKey}`,
			apply: `at.${context.domain}.${keyName}=${value}`,
		})),
	};
}

/**
 * Create a completion source that queries the LSP worker
 */
export function createAlphaTexCompletionSource(lspClient: AlphaTexLSPClient) {
	return async (
		context: CompletionContext,
	): Promise<CompletionResult | null> => {
		const layeredContext = getAtDocLayeredContext(context);
		if (layeredContext) {
			return buildLayeredCompletions(layeredContext);
		}

		// Get the word being completed
		// Include dot so fragments like `at.` are captured as non-empty tokens.
		const word = context.matchBefore(/\\?[\w.-]*/);
		if (!word) return null;

		// Don't offer completions unless the user explicitly asked for them
		// (by pressing Ctrl+Space or after typing a trigger character).
		// However, if the previous character is a backslash (`\`), treat it as a trigger.
		if (!context.explicit && word.from === word.to) {
			const line = context.state.doc.lineAt(context.pos);
			const textBefore = line.text
				.slice(0, context.pos - line.from)
				.trimStart();
			const inAtDocHint = /\bat(?:\.[\w.]*)?(?:=[^\s]*)?$/.test(textBefore);
			if (inAtDocHint) {
				// Allow ATDOC fragments to trigger completion without requiring '\\'.
			} else {
				const prev = context.state.doc.sliceString(
					Math.max(0, context.pos - 1),
					context.pos,
				);
				// If the previous character is not a backslash, don't trigger completions
				if (prev !== "\\") {
					return null;
				}
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
	const triggerAtDocCompletion = EditorView.updateListener.of((update) => {
		if (!update.docChanged) return;
		if (!update.state.selection.main.empty) return;

		const pos = update.state.selection.main.head;
		const line = update.state.doc.lineAt(pos);
		const before = line.text.slice(0, pos - line.from);
		const trimmed = before.trimStart();

		const shouldTrigger = /\bat(?:\.[\w.]*)?(?:\s*=\s*[^\s]*)?$/.test(trimmed);
		if (!shouldTrigger) return;

		if (completionStatus(update.state) !== "active") {
			startCompletion(update.view);
		}
	});

	return [
		autocompletion({
			override: [completionSource],
			// Ensure typing characters (like `\`) can activate completions without requiring explicit Ctrl+Space
			activateOnTyping: true,
		}),
		triggerAtDocCompletion,
		// Use Prec.highest to ensure completionKeymap has highest precedence
		// This ensures arrow keys navigate the autocomplete menu instead of moving the cursor
		Prec.highest(keymap.of(completionKeymap)),
	];
}
