/**
 * AlphaTex LSP Worker
 *
 * This worker implements Language Server Protocol messages for AlphaTex language.
 * It uses the @coderline/alphatab-language-server documentation to provide
 * code completions, hover information, and other language features.
 */

import { documentation } from "@coderline/alphatab-language-server";
import commandsJSON from "../data/alphatex-commands.json";
import { ATDOC_KEY_DEFINITIONS } from "../data/atdoc-keys";

type CommandsJsonItem = {
	name?: string;
	label?: string;
	detail?: string;
	documentation?: string;
	insertText?: string;
	parameters?: unknown[];
	args?: unknown[];
	arguments?: unknown[];
	signatures?: unknown[];
};

type CommandsJson = {
	commands?: CommandsJsonItem[];
	properties?: CommandsJsonItem[];
};

const localCommands = commandsJSON as unknown as CommandsJson;

type DocumentationLike = {
	commands?: Iterable<[string, unknown]>;
	beatProperties?: Iterable<[string, unknown]>;
	noteProperties?: Iterable<[string, unknown]>;
	durationChangeProperties?: Iterable<[string, unknown]>;
};

const doc = documentation as unknown as DocumentationLike;

/**
 * Prebuild commands registry based on documentation.commands so we can provide
 * completions and hover docs without scanning the documentation every time.
 *
 * Each entry includes:
 *  - name: the command name without leading backslash (e.g. "title")
 *  - label: the label to present in completions (e.g. "\title")
 *  - detail: short description
 *  - documentation: long description
 */
const commandsRegistry: Array<{
	name: string;
	label: string;
	detail: string;
	documentation: string;
	insertText?: string;
}> = [];

/**
 * A map for quick lookup by command name (lower-cased).
 * Key: lower-cased command name (without backslash)
 * Value: entry from commandsRegistry
 */
const commandsByName = new Map<
	string,
	{
		name: string;
		label: string;
		detail: string;
		documentation: string;
		insertText?: string;
	}
>();

/**
 * Local properties registry (commandsJSON.properties) and lookup map.
 * We want to allow local overrides for property-based completions just like commands.
 */
const propertiesRegistry: Array<{
	name: string;
	label: string;
	detail: string;
	documentation: string;
	insertText?: string;
}> = [];

const propertiesByName = new Map<
	string,
	{
		name: string;
		label: string;
		detail: string;
		documentation: string;
		insertText?: string;
	}
>();

// If there is a local commands JSON, prioritize using it to populate the registry.
// This preserves local overrides and ensures consistent completions even if the upstream doc is incomplete.
if (Array.isArray(localCommands.commands)) {
	for (const it of localCommands.commands) {
		// Normalize the command name from either `name` or the `label` (strip leading backslash).
		const cmdName =
			(it &&
				(it.name ??
					(typeof it.label === "string"
						? it.label.replace(/^\\/, "")
						: undefined))) ??
			undefined;
		if (!cmdName) continue;
		// Avoid duplicate registration
		if (commandsByName.has(String(cmdName).toLowerCase())) continue;
		const entry = {
			name: String(cmdName),
			label: it.label ?? `\\${String(cmdName)}`,
			detail: it.detail ?? "",
			documentation: it.documentation ?? "",
			insertText: it.insertText ?? `\\${String(cmdName)}`,
		};
		commandsRegistry.push(entry);
		commandsByName.set(String(cmdName).toLowerCase(), entry);
	}
}

// If there is a local properties JSON inside commandsJSON, load them to the propertiesRegistry.
// Local properties should take precedence over upstream `documentation.*Properties`.
if (Array.isArray(localCommands.properties)) {
	for (const it of localCommands.properties) {
		// Normalize property name: prefer `name`, fall back to `label` if present
		const propName =
			(it &&
				(it.name ?? (typeof it.label === "string" ? it.label : undefined))) ??
			undefined;
		if (!propName) continue;
		// Prevent duplicates by name
		const key = String(propName).toLowerCase();
		if (propertiesByName.has(key)) continue;
		const entry = {
			name: String(propName),
			label: it.label ?? String(propName),
			detail: it.detail ?? "",
			documentation: it.documentation ?? "",
			insertText: it.insertText ?? undefined,
		};
		propertiesRegistry.push(entry);
		propertiesByName.set(key, entry);
	}
}

function buildInsertTextFromCmd(cmd: unknown, cmdName: string) {
	// Try a few fields commonly used to describe parameters/signatures in the documentation
	const cmdObj = (cmd as Record<string, unknown> | undefined) ?? undefined;

	let params: unknown[] = [];
	if (cmdObj) {
		const maybeParams = (cmdObj.parameters ??
			cmdObj.args ??
			cmdObj.arguments) as unknown;
		if (Array.isArray(maybeParams)) {
			params = maybeParams;
		} else if (Array.isArray(cmdObj.signatures as unknown)) {
			const signatures = cmdObj.signatures as unknown as Array<
				Record<string, unknown>
			>;
			const firstSignature = signatures[0];
			if (firstSignature && Array.isArray(firstSignature.parameters)) {
				params = firstSignature.parameters as unknown[];
			}
		}
	}

	const paramNames: string[] = Array.isArray(params)
		? (params.map((p: unknown) =>
				typeof p === "string"
					? p
					: ((p as Record<string, unknown>)?.name ??
						(p as Record<string, unknown>)?.id ??
						"arg"),
			) as string[])
		: [];

	if (!paramNames.length) return `\\${cmdName}`;

	// Use snippet-like placeholders (may require frontend to interpret)
	return `\\${cmdName} ${paramNames.map((n: string, idx: number) => `\${${idx + 1}:${n}}`).join(" ")}`;
}

if (doc.commands) {
	for (const [key, cmd] of doc.commands) {
		const cmdObj = cmd as Record<string, unknown> | undefined;
		const cmdName = String(
			(cmdObj &&
				(cmdObj.name ?? cmdObj.command ?? cmdObj.property ?? cmdObj.id)) ??
				String(key ?? ""),
		);
		const detail = String(
			(cmdObj && (cmdObj.shortDescription ?? cmdObj.longDescription)) ?? "",
		);
		const longDoc = String(
			(cmdObj && (cmdObj.longDescription ?? cmdObj.shortDescription)) ?? "",
		);
		const insertText = buildInsertTextFromCmd(cmdObj, String(cmdName ?? ""));
		const entry = {
			name: cmdName,
			label: `\\${cmdName}`,
			detail,
			documentation: longDoc,
			insertText,
		};
		commandsRegistry.push(entry);
		commandsByName.set(String(cmdName ?? "").toLowerCase(), entry);
	}
}

// Fill properties registry using upstream documentation if not already provided locally.
// This ensures local JSON is authoritative but we still have a fallback from upstream docs.
if (doc.beatProperties) {
	for (const [key, prop] of doc.beatProperties) {
		const propObj = prop as Record<string, unknown> | undefined;
		const propName =
			(propObj?.property as string | undefined) ?? String(key ?? "");
		if (!propName) continue;
		const keyLower = String(propName).toLowerCase();
		if (propertiesByName.has(keyLower)) continue;
		const entry = {
			name: propName,
			label: propName,
			detail: `(beat property)`,
			documentation: String(
				(propObj && (propObj.shortDescription ?? propObj.longDescription)) ??
					"",
			),
			insertText: undefined,
		};
		propertiesRegistry.push(entry);
		propertiesByName.set(keyLower, entry);
	}
}

if (doc.noteProperties) {
	for (const [key, prop] of doc.noteProperties) {
		const propObj = prop as Record<string, unknown> | undefined;
		const propName =
			(propObj?.property as string | undefined) ?? String(key ?? "");
		if (!propName) continue;
		const keyLower = String(propName).toLowerCase();
		if (propertiesByName.has(keyLower)) continue;
		const entry = {
			name: propName,
			label: propName,
			detail: `(note property)`,
			documentation: String(
				(propObj && (propObj.shortDescription ?? propObj.longDescription)) ??
					"",
			),
			insertText: undefined,
		};
		propertiesRegistry.push(entry);
		propertiesByName.set(keyLower, entry);
	}
}

if (doc.durationChangeProperties) {
	for (const [key, prop] of doc.durationChangeProperties) {
		const propObj = prop as Record<string, unknown> | undefined;
		const propName =
			(propObj?.property as string | undefined) ?? String(key ?? "");
		if (!propName) continue;
		const keyLower = String(propName).toLowerCase();
		if (propertiesByName.has(keyLower)) continue;
		const entry = {
			name: propName,
			label: propName,
			detail: `(duration)`,
			documentation: String(
				(propObj && (propObj.shortDescription ?? propObj.longDescription)) ??
					"",
			),
			insertText: undefined,
		};
		propertiesRegistry.push(entry);
		propertiesByName.set(keyLower, entry);
	}
}

// Register fallback commands into the registry if they don't already exist.
// This ensures hover/completion find them even if the `documentation` doesn't include them.
const fallbackCommandsList = [
	"subtitle",
	"composer",
	"arranger",
	"copyright",
	"date",
	"key",
	"time",
	"meter",
	"signature",
	"clef",
	"capo",
	"transpose",
	"ts",
	"instrument",
	"program",
	"channel",
	"track",
	"part",
	"voice",
	"lyrics",
	"lyric",
	"repeat",
	"endrepeat",
	"measure",
	"bar",
	"note",
	"chord",
	"volume",
	"pan",
	"mute",
	"score",
	"song",
	"staff",
	"scoreinfo",
	"repeatbar",
	"solo",
	"style",
	"author",
	"editor",
	"description",
	"comment",
];

for (const fb of fallbackCommandsList) {
	if (!commandsByName.has(String(fb).toLowerCase())) {
		const entry = {
			name: fb,
			label: `\\${fb}`,
			detail: "",
			documentation: "",
			insertText: `\\${fb}`,
		};
		commandsRegistry.push(entry);
		commandsByName.set(String(fb).toLowerCase(), entry);
	}
}

/**
 * Extract word at position for completion
 * Returns the partial word being typed
 */
function _getWordAtPosition(
	text: string,
	position: number,
): { word: string; start: number } {
	let start = position;
	while (start > 0 && /[a-zA-Z0-9_.]/.test(text[start - 1])) {
		start--;
	}
	const word = text.substring(start, position);
	return { word, start };
}

const atDocSnippetBoolean = "$" + "{1:true}";
const atDocSnippetString = "$" + '{1:"value"}';
const atDocSnippetStatus = "$" + "{1:active}";
const atDocSnippetLicense = "$" + "{1:CC-BY-4.0}";
const atDocSnippetLayout = "$" + "{1:Page}";
const atDocSnippetScroll = "$" + "{1:OffScreen}";
const atDocSnippetColor = "$" + "{1:#22c55e}";
const atDocSnippetNumber = "$" + "{1:1}";

const atDocCompletions = ATDOC_KEY_DEFINITIONS.map((def) => ({
	label: def.key,
	detail: `ATDOC ${def.valueType}`,
	documentation: `${def.description}\n\nExample: \`${def.example}\``,
	insertText: `${def.key}=${
		def.valueType === "boolean"
			? atDocSnippetBoolean
			: def.valueType === "string"
				? atDocSnippetString
				: def.valueType === "enum:status"
					? atDocSnippetStatus
					: def.valueType === "enum:license"
						? atDocSnippetLicense
						: def.valueType === "enum:layoutMode"
							? atDocSnippetLayout
							: def.valueType === "enum:scrollMode"
								? atDocSnippetScroll
								: def.valueType === "color"
									? atDocSnippetColor
									: atDocSnippetNumber
	}`,
}));

const atDocByName = new Map(
	ATDOC_KEY_DEFINITIONS.map((def) => [def.key.toLowerCase(), def]),
);

/**
 * Get completion items for a given word
 * Searches through all available AlphaTex properties
 */
function getCompletions(word: string): Array<{
	label: string;
	detail: string;
	documentation: string;
	insertText?: string;
}> {
	const completions: Array<{
		label: string;
		detail: string;
		documentation: string;
		insertText?: string;
	}> = [];

	if (
		String(word ?? "")
			.toLowerCase()
			.startsWith("at.")
	) {
		const prefix = String(word).toLowerCase();
		for (const item of atDocCompletions) {
			if (item.label.toLowerCase().startsWith(prefix)) {
				completions.push(item);
			}
		}
		return completions;
	}

	// Search properties from local registry first (local overrides), which already
	// includes merged upstream properties as fallback from initialization.
	if (propertiesRegistry && propertiesRegistry.length > 0) {
		const prefixLower = String(word ?? "").toLowerCase();
		for (const prop of propertiesRegistry) {
			const nameLower = String(prop.name ?? "").toLowerCase();
			if (nameLower.startsWith(prefixLower)) {
				completions.push({
					label: prop.label ?? prop.name,
					detail: prop.detail ?? `(property)`,
					documentation: prop.documentation ?? "",
					insertText: prop.insertText,
				});
			}
		}
	}

	// Add common AlphaTex keywords
	const keywords = [
		{ label: "\\title", detail: "Set song title", documentation: "" },
		{ label: "\\artist", detail: "Set artist name", documentation: "" },
		{ label: "\\album", detail: "Set album name", documentation: "" },
		{ label: "\\tempo", detail: "Set tempo/BPM", documentation: "" },
	];

	// Use a prebuilt command registry (if available) to populate `\` commands.
	// This avoids iterating the documentation object on every completion request
	// and keeps `label`/`detail`/`documentation` consistent for each command.
	for (const cmdEntry of commandsRegistry) {
		if (cmdEntry.name?.toLowerCase().startsWith(word.toLowerCase())) {
			completions.push({
				label: cmdEntry.label,
				detail: cmdEntry.detail ? ` ${cmdEntry.detail}` : "",
				documentation: cmdEntry.documentation ?? "",
				insertText: cmdEntry.insertText ?? cmdEntry.label,
			});
		}
	}

	for (const kw of keywords) {
		if (kw.label.toLowerCase().includes(word.toLowerCase())) {
			completions.push(kw);
		}
	}

	// Fallback commands are now registered at module-level in the commands registry.
	// They are already present in 'commandsRegistry' and can be returned by the
	// regular command registry scanning, so no per-call fallback list is needed here.

	// Deduplicate completions by label to avoid duplicates between
	// commands, keywords, and property-based completions.
	{
		const seen = new Set<string>();
		const unique: Array<{
			label: string;
			detail: string;
			documentation: string;
			insertText?: string;
		}> = [];
		for (const c of completions) {
			if (!seen.has(c.label)) {
				seen.add(c.label);
				unique.push(c);
			}
		}
		return unique;
	}
}

/**
 * Handle LSP initialize request
 */
function handleInitialize() {
	return {
		capabilities: {
			completionProvider: {
				triggerCharacters: ["\\", " ", "{", "["],
				resolveProvider: false,
			},
			hoverProvider: true,
			diagnosticProvider: {
				interFileDependencies: false,
				workspaceDiagnostics: false,
			},
		},
	};
}

/**
 * Handle textDocument/completion request
 */
function handleCompletion(params: unknown) {
	const {
		textDocument: _textDocument,
		position,
		prefix,
		text,
	} = params as {
		textDocument?: { uri?: string };
		position?: { line: number; character: number };
		prefix?: string;
		text?: string;
	};
	const _line = position?.line;
	const _character = position?.character;

	// Build the completion prefix from either provided prefix or the document content
	let word = "";

	if (typeof prefix === "string" && prefix.length > 0) {
		word = prefix;
	} else if (typeof text === "string" && position) {
		const lines = text.split(/\r?\n/);
		const lineIndex = Math.max(
			0,
			Math.min(lines.length - 1, position?.line ?? 0),
		);
		const charIndex = Math.max(
			0,
			Math.min(lines[lineIndex]?.length ?? 0, position?.character ?? 0),
		);
		let offset = 0;
		for (let i = 0; i < lineIndex; ++i) {
			offset += lines[i].length + 1; // include newline length
		}
		const absolutePos = offset + charIndex;
		const res = _getWordAtPosition(text, absolutePos);
		word = res.word;
	}

	// Remove leading backslash if present for matching logic
	if (typeof word === "string" && word.startsWith("\\")) word = word.slice(1);

	const items = getCompletions(word);

	return {
		isIncomplete: false,
		items: items.map((item) => ({
			label: item.label,
			kind: 7, // Variable kind
			detail: item.detail,
			documentation: {
				kind: "markdown",
				value: item.documentation,
			},
			insertText: item.insertText,
		})),
	};
}

/**
 * Hover handler - provide quick documentation for commands at a position.
 * Accepts the same parameters shape as completion (text + position) and returns
 * a simple Markup-like content for hover display.
 */
function handleHover(params: unknown) {
	const {
		textDocument: _textDocument,
		position,
		text,
	} = params as {
		textDocument?: { uri?: string };
		position?: { line: number; character: number };
		text?: string;
	};

	// Build the word (token) under cursor like we do in handleCompletion
	let word = "";
	if (typeof text === "string" && position) {
		const lines = text.split(/\r?\n/);
		const lineIndex = Math.max(
			0,
			Math.min(lines.length - 1, position?.line ?? 0),
		);
		const charIndex = Math.max(
			0,
			Math.min(lines[lineIndex]?.length ?? 0, position?.character ?? 0),
		);
		let offset = 0;
		for (let i = 0; i < lineIndex; ++i) offset += lines[i].length + 1; // newline
		const absolutePos = offset + charIndex;
		const res = _getWordAtPosition(text, absolutePos);
		word = res.word;
	}

	// If the token starts with a backslash, remove it for matching.
	if (typeof word === "string" && word.startsWith("\\")) word = word.slice(1);
	const key = (word ?? "").toLowerCase();
	if (key.startsWith("at.")) {
		const atDocDef = atDocByName.get(key);
		if (atDocDef) {
			return {
				contents: [
					`**${atDocDef.key}**`,
					atDocDef.description,
					`Example: \`${atDocDef.example}\``,
				].join("\n\n"),
			};
		}
	}

	// Try a direct lookup in the commands map, or fallback to a prefix search for helpful hover
	const exact = commandsByName.get(key);
	if (exact) {
		// Markdown-like content for hover
		return {
			contents: exact.documentation || exact.detail || `\\${exact.name}`,
		};
	}

	// If not a command, check properties (local registry first)
	const propExact = propertiesByName.get(key);
	if (propExact) {
		return {
			contents:
				propExact.documentation ||
				propExact.detail ||
				propExact.label ||
				propExact.name,
		};
	}

	// As a fallback, attempt to find the first command that starts with the prefix
	for (const cmdEntry of commandsRegistry) {
		if (cmdEntry.name?.toLowerCase().startsWith(key)) {
			return {
				contents:
					cmdEntry.documentation || cmdEntry.detail || `\\${cmdEntry.name}`,
			};
		}
	}

	// Last resort generic hover
	return { contents: "AlphaTex element" };
}

/**
 * Handle textDocument/barlines request
 * Scans the text for barline characters '|' and returns their positions and bar numbers.
 */
function handleBarlines(params: unknown) {
	const { text } = params as { text: string };
	if (typeof text !== "string") return { barlines: [] };

	const lines = text.split(/\r?\n/);
	const barlines: Array<{
		line: number;
		character: number;
		barNumber: number;
	}> = [];
	let barNumber = 1;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];

		// Reset bar counter on track/staff/voice changes to keep numbering per-track
		if (
			line.trim().startsWith("\\track") ||
			line.trim().startsWith("\\staff") ||
			line.trim().startsWith("\\voice")
		) {
			barNumber = 1;
		}

		for (let j = 0; j < line.length; j++) {
			if (line[j] === "|") {
				barlines.push({
					line: i,
					character: j,
					barNumber: barNumber++,
				});
			}
		}
	}
	return { barlines };
}

/**
 * Main message handler
 */
self.onmessage = (event: MessageEvent) => {
	const { id, method, params } = event.data;

	let result: unknown = null;
	let error: unknown = null;

	try {
		switch (method) {
			case "initialize":
				result = handleInitialize();
				break;

			case "textDocument/completion":
				result = handleCompletion(params);
				break;

			case "textDocument/hover":
				result = handleHover(params);
				break;

			case "textDocument/barlines":
				result = handleBarlines(params);
				break;

			case "initialized":
				// Server initialized, no response needed
				return;

			default:
				error = {
					code: -32601,
					message: `Method not found: ${method}`,
				};
		}
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		error = {
			code: -32603,
			message: `Internal error: ${message}`,
		} as const;
	}

	// Send response back to main thread
	if (id !== undefined) {
		self.postMessage({
			jsonrpc: "2.0",
			id,
			result,
			error,
		});
	}
};
