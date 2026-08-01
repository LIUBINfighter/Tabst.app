import * as alphaTab from "@coderline/alphatab";
import {
	ATDOC_KEY_DEFINITIONS,
	ATDOC_LAYOUT_MODE_VALUES,
	ATDOC_META_LICENSE_VALUES,
	ATDOC_META_STATUS_VALUES,
	ATDOC_SCROLL_MODE_VALUES,
} from "../data/atdoc-keys";
import type { StaffDisplayOptions } from "./staff-config";

export interface AtDocWarning {
	line: number;
	message: string;
}

export interface AtDocConfig {
	meta?: {
		class?: string[];
		tag?: string[];
		status?: "draft" | "active" | "done" | "released";
		tabist?: string;
		app?: string;
		github?: string;
		license?:
			| "CC0-1.0"
			| "CC-BY-4.0"
			| "CC-BY-SA-4.0"
			| "CC-BY-NC-4.0"
			| "CC-BY-NC-SA-4.0"
			| "CC-BY-ND-4.0"
			| "CC-BY-NC-ND-4.0";
		source?: string;
		release?: string;
		alias?: string[];
		title?: string;
	};
	display?: {
		scale?: number;
		layoutMode?: alphaTab.LayoutMode;
	};
	player?: {
		scrollMode?: alphaTab.ScrollMode;
		scrollSpeed?: number;
		playbackSpeed?: number;
		volume?: number;
		muteTracks?: number[];
		soloTracks?: number[];
		metronomeVolume?: number;
		countInEnabled?: boolean;
		enableCursor?: boolean;
		enableElementHighlighting?: boolean;
		enableUserInteraction?: boolean;
	};
	coloring?: {
		enabled?: boolean;
		barNumberColor?: string;
		staffLineColor?: string;
		barSeparatorColor?: string;
		noteHeadColor?: string;
		fretNumberColor?: string;
		colorizeByFret?: boolean;
	};
	staff?: StaffDisplayOptions;
	print?: {
		zoom?: number;
		barsPerRow?: number;
		stretchForce?: number;
	};
}

export interface AtDocParseResult {
	cleanContent: string;
	config: AtDocConfig;
	warnings: AtDocWarning[];
	/** Tags collected from `#tag` tokens inside comment lines. */
	inlineTags: string[];
}

export interface AtDocCompletionItem {
	label: string;
	detail: string;
	documentation: string;
	insertText: string;
}

export interface AtDocFileMeta {
	metaClass: string[];
	metaTags: string[];
	metaStatus?: "draft" | "active" | "done" | "released";
	metaTabist?: string;
	metaApp?: string;
	metaGithub?: string;
	metaLicense?:
		| "CC0-1.0"
		| "CC-BY-4.0"
		| "CC-BY-SA-4.0"
		| "CC-BY-NC-4.0"
		| "CC-BY-NC-SA-4.0"
		| "CC-BY-ND-4.0"
		| "CC-BY-NC-ND-4.0";
	metaSource?: string;
	metaRelease?: string;
	metaAlias: string[];
	metaTitle?: string;
}

const ATDOC_KEY_DEFINITION_MAP = new Map(
	ATDOC_KEY_DEFINITIONS.map((def) => [def.key.toLowerCase(), def]),
);

function normalizeEnumName(value: string): string {
	const compact = value.replace(/\s+/g, "").toLowerCase();
	if (compact === "offscreen") return "OffScreen";
	if (compact === "horizontal") return "Horizontal";
	if (compact === "parchment") return "Parchment";
	if (compact === "page") return "Page";
	if (compact === "off") return "Off";
	if (compact === "continuous") return "Continuous";
	if (compact === "smooth") return "Smooth";
	return value;
}

function toBoolean(value: string): boolean | null {
	if (/^true$/i.test(value)) return true;
	if (/^false$/i.test(value)) return false;
	return null;
}

function toNumber(value: string): number | null {
	const n = Number(value);
	return Number.isFinite(n) ? n : null;
}

function unquote(value: string): string {
	const v = value.trim();
	if (
		(v.startsWith('"') && v.endsWith('"')) ||
		(v.startsWith("'") && v.endsWith("'"))
	) {
		return v.slice(1, -1);
	}
	return v;
}

function parseStringList(value: string): string[] {
	return value
		.split(",")
		.map((item) => unquote(item).trim())
		.filter((item) => item.length > 0);
}

function parseNonNegativeIntegerList(value: string): number[] | null {
	const tokens = value
		.split(",")
		.map((item) => item.trim())
		.filter((item) => item.length > 0);
	if (tokens.length === 0) return null;

	const out: number[] = [];
	const seen = new Set<number>();
	for (const token of tokens) {
		const n = Number(token);
		if (!Number.isInteger(n) || n < 0) {
			return null;
		}
		if (!seen.has(n)) {
			seen.add(n);
			out.push(n);
		}
	}
	return out;
}

function mergeUnique(base: string[] | undefined, incoming: string[]): string[] {
	const out = [...(base ?? [])];
	for (const item of incoming) {
		if (!out.includes(item)) out.push(item);
	}
	return out;
}

function parseLayoutMode(value: string): alphaTab.LayoutMode | null {
	const v = value.trim().toLowerCase();
	if (v === "page") return alphaTab.LayoutMode.Page;
	if (v === "horizontal") return alphaTab.LayoutMode.Horizontal;
	if (v === "parchment") return alphaTab.LayoutMode.Parchment;
	return null;
}

function parseScrollMode(value: string): alphaTab.ScrollMode | null {
	const v = value.trim().toLowerCase();
	if (v === "off") return alphaTab.ScrollMode.Off;
	if (v === "continuous") return alphaTab.ScrollMode.Continuous;
	if (v === "offscreen") return alphaTab.ScrollMode.OffScreen;
	if (v === "smooth") return alphaTab.ScrollMode.Smooth;
	return null;
}

function parseMetaStatus(
	value: string,
): "draft" | "active" | "done" | "released" | null {
	const lowered = value.trim().toLowerCase();
	if (
		lowered === "draft" ||
		lowered === "active" ||
		lowered === "done" ||
		lowered === "released"
	) {
		return lowered;
	}
	return null;
}

function parseMetaLicense(
	value: string,
):
	| "CC0-1.0"
	| "CC-BY-4.0"
	| "CC-BY-SA-4.0"
	| "CC-BY-NC-4.0"
	| "CC-BY-NC-SA-4.0"
	| "CC-BY-ND-4.0"
	| "CC-BY-NC-ND-4.0"
	| null {
	const normalized = value.trim().toUpperCase();
	if (ATDOC_META_LICENSE_VALUES.includes(normalized)) {
		return normalized as
			| "CC0-1.0"
			| "CC-BY-4.0"
			| "CC-BY-SA-4.0"
			| "CC-BY-NC-4.0"
			| "CC-BY-NC-SA-4.0"
			| "CC-BY-ND-4.0"
			| "CC-BY-NC-ND-4.0";
	}
	return null;
}

function applyDirective(
	key: string,
	rawValue: string,
	line: number,
	config: AtDocConfig,
	warnings: AtDocWarning[],
): void {
	const value = unquote(rawValue);

	switch (key) {
		case "at.meta.class":
		case "at.meta.tag":
		case "at.meta.alias": {
			const values = parseStringList(value);
			if (values.length === 0) {
				warnings.push({
					line,
					message: `${key} must be a non-empty string or comma-separated string list`,
				});
				return;
			}
			const meta = { ...(config.meta ?? {}) };
			if (key === "at.meta.class") {
				meta.class = mergeUnique(meta.class, values);
			} else if (key === "at.meta.tag") {
				meta.tag = mergeUnique(meta.tag, values);
			} else {
				meta.alias = mergeUnique(meta.alias, values);
			}
			config.meta = meta;
			return;
		}
		case "at.meta.title": {
			const title = unquote(rawValue).trim();
			if (!title) {
				warnings.push({
					line,
					message: "at.meta.title must be a non-empty string",
				});
				return;
			}
			config.meta = { ...(config.meta ?? {}), title };
			return;
		}
		case "at.meta.tabist":
		case "at.meta.app":
		case "at.meta.github":
		case "at.meta.source":
		case "at.meta.release": {
			const metaValue = unquote(rawValue).trim();
			if (!metaValue) {
				warnings.push({ line, message: `${key} must be a non-empty string` });
				return;
			}
			const meta = { ...(config.meta ?? {}) };
			if (key === "at.meta.tabist") meta.tabist = metaValue;
			if (key === "at.meta.app") meta.app = metaValue;
			if (key === "at.meta.github") meta.github = metaValue;
			if (key === "at.meta.source") meta.source = metaValue;
			if (key === "at.meta.release") meta.release = metaValue;
			config.meta = meta;
			return;
		}
		case "at.meta.license": {
			const license = parseMetaLicense(value);
			if (!license) {
				warnings.push({
					line,
					message: `at.meta.license must be one of: ${ATDOC_META_LICENSE_VALUES.join(
						", ",
					)}`,
				});
				return;
			}
			config.meta = { ...(config.meta ?? {}), license };
			return;
		}
		case "at.meta.status": {
			const status = parseMetaStatus(value);
			if (!status) {
				warnings.push({
					line,
					message:
						"at.meta.status must be one of: draft, active, done, released",
				});
				return;
			}
			config.meta = { ...(config.meta ?? {}), status };
			return;
		}
		case "at.display.scale": {
			const n = toNumber(value);
			if (n === null || n <= 0) {
				warnings.push({
					line,
					message: "at.display.scale must be a number > 0",
				});
				return;
			}
			config.display = { ...(config.display ?? {}), scale: n };
			return;
		}
		case "at.display.layoutMode": {
			const mode = parseLayoutMode(value);
			if (mode === null) {
				warnings.push({
					line,
					message:
						"at.display.layoutMode must be one of: Page, Horizontal, Parchment",
				});
				return;
			}
			config.display = { ...(config.display ?? {}), layoutMode: mode };
			return;
		}
		case "at.player.scrollMode": {
			const mode = parseScrollMode(value);
			if (mode === null) {
				warnings.push({
					line,
					message:
						"at.player.scrollMode must be one of: Off, Continuous, OffScreen, Smooth",
				});
				return;
			}
			config.player = { ...(config.player ?? {}), scrollMode: mode };
			return;
		}
		case "at.player.scrollSpeed": {
			const n = toNumber(value);
			if (n === null || n < 0) {
				warnings.push({
					line,
					message: "at.player.scrollSpeed must be a number >= 0",
				});
				return;
			}
			config.player = { ...(config.player ?? {}), scrollSpeed: n };
			return;
		}
		case "at.player.playbackSpeed": {
			const n = toNumber(value);
			if (n === null || n <= 0) {
				warnings.push({
					line,
					message: "at.player.playbackSpeed must be a number > 0",
				});
				return;
			}
			config.player = { ...(config.player ?? {}), playbackSpeed: n };
			return;
		}
		case "at.player.volume": {
			const n = toNumber(value);
			if (n === null || n < 0 || n > 1) {
				warnings.push({
					line,
					message: "at.player.volume must be a number in [0, 1]",
				});
				return;
			}
			config.player = { ...(config.player ?? {}), volume: n };
			return;
		}
		case "at.player.muteTracks":
		case "at.player.soloTracks": {
			const indexes = parseNonNegativeIntegerList(value);
			if (!indexes) {
				warnings.push({
					line,
					message: `${key} must be a comma-separated list of non-negative integers`,
				});
				return;
			}
			const player = { ...(config.player ?? {}) };
			if (key === "at.player.muteTracks") player.muteTracks = indexes;
			if (key === "at.player.soloTracks") player.soloTracks = indexes;
			config.player = player;
			return;
		}
		case "at.player.metronomeVolume": {
			const n = toNumber(value);
			if (n === null || n < 0 || n > 1) {
				warnings.push({
					line,
					message: "at.player.metronomeVolume must be a number in [0, 1]",
				});
				return;
			}
			config.player = { ...(config.player ?? {}), metronomeVolume: n };
			return;
		}
		case "at.player.countInEnabled": {
			const b = toBoolean(value);
			if (b === null) {
				warnings.push({
					line,
					message: "at.player.countInEnabled must be true or false",
				});
				return;
			}
			config.player = { ...(config.player ?? {}), countInEnabled: b };
			return;
		}
		case "at.player.enableCursor":
		case "at.player.enableElementHighlighting":
		case "at.player.enableUserInteraction": {
			const b = toBoolean(value);
			if (b === null) {
				warnings.push({ line, message: `${key} must be true or false` });
				return;
			}
			const player = { ...(config.player ?? {}) };
			if (key === "at.player.enableCursor") player.enableCursor = b;
			if (key === "at.player.enableElementHighlighting") {
				player.enableElementHighlighting = b;
			}
			if (key === "at.player.enableUserInteraction") {
				player.enableUserInteraction = b;
			}
			config.player = player;
			return;
		}
		case "at.coloring.enabled":
		case "at.coloring.colorizeByFret": {
			const b = toBoolean(value);
			if (b === null) {
				warnings.push({ line, message: `${key} must be true or false` });
				return;
			}
			const coloring = { ...(config.coloring ?? {}) };
			if (key === "at.coloring.enabled") coloring.enabled = b;
			if (key === "at.coloring.colorizeByFret") coloring.colorizeByFret = b;
			config.coloring = coloring;
			return;
		}
		case "at.coloring.barNumberColor":
		case "at.coloring.staffLineColor":
		case "at.coloring.barSeparatorColor":
		case "at.coloring.noteHeadColor":
		case "at.coloring.fretNumberColor": {
			if (!value) {
				warnings.push({ line, message: `${key} must be a valid color string` });
				return;
			}
			const coloring = { ...(config.coloring ?? {}) };
			if (key === "at.coloring.barNumberColor") coloring.barNumberColor = value;
			if (key === "at.coloring.staffLineColor") coloring.staffLineColor = value;
			if (key === "at.coloring.barSeparatorColor") {
				coloring.barSeparatorColor = value;
			}
			if (key === "at.coloring.noteHeadColor") coloring.noteHeadColor = value;
			if (key === "at.coloring.fretNumberColor") {
				coloring.fretNumberColor = value;
			}
			config.coloring = coloring;
			return;
		}
		case "at.staff.showTablature":
		case "at.staff.showStandardNotation":
		case "at.staff.showSlash":
		case "at.staff.showNumbered": {
			const b = toBoolean(value);
			if (b === null) {
				warnings.push({ line, message: `${key} must be true or false` });
				return;
			}
			const staff = { ...(config.staff ?? {}) };
			if (key === "at.staff.showTablature") staff.showTablature = b;
			if (key === "at.staff.showStandardNotation")
				staff.showStandardNotation = b;
			if (key === "at.staff.showSlash") staff.showSlash = b;
			if (key === "at.staff.showNumbered") staff.showNumbered = b;
			config.staff = staff;
			return;
		}
		case "at.print.zoom": {
			const n = toNumber(value);
			if (n === null || n <= 0) {
				warnings.push({ line, message: "at.print.zoom must be a number > 0" });
				return;
			}
			config.print = { ...(config.print ?? {}), zoom: n };
			return;
		}
		case "at.print.barsPerRow": {
			const n = toNumber(value);
			if (n === null || !Number.isInteger(n) || (n !== -1 && n <= 0)) {
				warnings.push({
					line,
					message: "at.print.barsPerRow must be -1 or a positive integer",
				});
				return;
			}
			config.print = { ...(config.print ?? {}), barsPerRow: n };
			return;
		}
		case "at.print.stretchForce": {
			const n = toNumber(value);
			if (n === null || n < 0) {
				warnings.push({
					line,
					message: "at.print.stretchForce must be a number >= 0",
				});
				return;
			}
			config.print = { ...(config.print ?? {}), stretchForce: n };
			return;
		}
		default:
			warnings.push({ line, message: `Unknown atdoc key: ${key}` });
	}
}

const ATDOC_SECTION_PATTERN = /^\[\s*([a-zA-Z][\w-]*)\s*\]$/;
const ATDOC_BARE_KEY_PATTERN = /^([a-zA-Z][\w-]*)\s*=\s*(.+)$/;

function stripCommentPrefix(line: string): string {
	let s = line.trim();
	if (!s) return s;
	if (s.startsWith("*")) s = s.slice(1).trim();
	if (s.startsWith("//")) s = s.slice(2).trim();
	return s;
}

function extractDirectiveFromLine(
	line: string,
): { key: string; value: string } | null {
	const s = stripCommentPrefix(line);
	if (!s) return null;

	if (!s.toLowerCase().startsWith("at.")) return null;
	const eq = s.indexOf("=");
	if (eq <= 0) return null;

	const key = s.slice(0, eq).trim();
	const value = s.slice(eq + 1).trim();
	if (!value) return null;

	return { key, value };
}

function extractSectionFromLine(line: string): string | null {
	const s = stripCommentPrefix(line);
	if (!s) return null;
	const match = ATDOC_SECTION_PATTERN.exec(s);
	return match ? match[1] : null;
}

function extractBareKeyFromLine(
	line: string,
): { key: string; value: string } | null {
	const s = stripCommentPrefix(line);
	if (!s) return null;
	const match = ATDOC_BARE_KEY_PATTERN.exec(s);
	if (!match) return null;
	const value = match[2].trim();
	if (!value) return null;
	return { key: match[1], value };
}

export function getAtDocSections(): string[] {
	const set = new Set<string>();
	for (const def of ATDOC_KEY_DEFINITIONS) {
		const [, domain] = def.key.split(".");
		if (domain) set.add(domain);
	}
	return [...set].sort();
}

const ATDOC_KNOWN_SECTIONS = new Set(getAtDocSections());

const INLINE_TAG_PATTERN = /^#([\p{L}\p{N}_-]+)[\p{P}\p{S}]*$/u;

function collectInlineTagsFromLine(line: string, out: string[]): void {
	const s = line.trim();
	if (!s.startsWith("*") && !s.startsWith("//")) return;

	for (const token of s.split(/\s+/)) {
		const match = INLINE_TAG_PATTERN.exec(token);
		if (match) out.push(match[1]);
	}
}

export function parseAtDoc(content: string | undefined): AtDocParseResult {
	const text = content ?? "";
	const lines = text.split(/\r?\n/);
	const warnings: AtDocWarning[] = [];
	const config: AtDocConfig = {};
	const inlineTags: string[] = [];
	const keptLines: string[] = [];
	let currentSection = "";

	for (let i = 0; i < lines.length; i++) {
		const directive = extractDirectiveFromLine(lines[i]);
		if (directive) {
			applyDirective(directive.key, directive.value, i + 1, config, warnings);
			continue;
		}

		const section = extractSectionFromLine(lines[i]);
		if (section !== null) {
			if (!ATDOC_KNOWN_SECTIONS.has(section)) {
				warnings.push({
					line: i + 1,
					message: `Unknown atdoc section: [${section}]`,
				});
				currentSection = "";
			} else {
				currentSection = section;
			}
			continue;
		}

		if (currentSection) {
			const bare = extractBareKeyFromLine(lines[i]);
			if (bare) {
				applyDirective(
					`at.${currentSection}.${bare.key}`,
					bare.value,
					i + 1,
					config,
					warnings,
				);
				continue;
			}
		}

		keptLines.push(lines[i]);
		collectInlineTagsFromLine(lines[i], inlineTags);
	}

	return {
		cleanContent: keptLines.join("\n"),
		config,
		warnings,
		inlineTags,
	};
}

export function buildAtDocCompletionItems(): AtDocCompletionItem[] {
	const snippetBoolean = "$" + "{1:true}";
	const snippetString = "$" + '{1:"value"}';
	const snippetStatus = "$" + "{1:active}";
	const snippetLicense = "$" + "{1:CC-BY-4.0}";
	const snippetLayoutMode = "$" + "{1:Page}";
	const snippetScrollMode = "$" + "{1:OffScreen}";
	const snippetColor = "$" + "{1:#22c55e}";
	const snippetNumber = "$" + "{1:1}";

	return ATDOC_KEY_DEFINITIONS.map((def) => ({
		label: def.key,
		detail: `ATDOC ${def.valueType}`,
		documentation: `${def.description}\n\nExample: \`${def.example}\``,
		insertText: `${def.key}=${
			def.valueType === "boolean"
				? snippetBoolean
				: def.valueType === "string"
					? snippetString
					: def.valueType === "enum:status"
						? snippetStatus
						: def.valueType === "enum:license"
							? snippetLicense
							: def.valueType === "enum:layoutMode"
								? snippetLayoutMode
								: def.valueType === "enum:scrollMode"
									? snippetScrollMode
									: def.valueType === "color"
										? snippetColor
										: snippetNumber
		}`,
	}));
}

export function getAtDocHoverText(key: string): string | null {
	const def = ATDOC_KEY_DEFINITION_MAP.get(key.toLowerCase());
	if (!def) return null;

	let allowedValues = "";
	if (def.valueType === "enum:layoutMode") {
		allowedValues = `Allowed: ${ATDOC_LAYOUT_MODE_VALUES.join(" | ")}`;
	}
	if (def.valueType === "enum:scrollMode") {
		allowedValues = `Allowed: ${ATDOC_SCROLL_MODE_VALUES.join(" | ")}`;
	}
	if (def.valueType === "enum:status") {
		allowedValues = `Allowed: ${ATDOC_META_STATUS_VALUES.join(" | ")}`;
	}
	if (def.valueType === "enum:license") {
		allowedValues = `Allowed: ${ATDOC_META_LICENSE_VALUES.join(" | ")}`;
	}

	return [
		`**${def.key}**`,
		def.description,
		allowedValues,
		`Example: \`${def.example}\``,
	]
		.filter(Boolean)
		.join("\n\n");
}

export function normalizeAtDocValueForDisplay(
	key: string,
	value: string,
): string {
	const def = ATDOC_KEY_DEFINITION_MAP.get(key.toLowerCase());
	if (!def) return value;
	if (
		def.valueType === "enum:status" ||
		def.valueType === "enum:license" ||
		def.valueType === "enum:layoutMode" ||
		def.valueType === "enum:scrollMode"
	) {
		return normalizeEnumName(value);
	}
	return value;
}

export function extractAtDocFileMeta(
	content: string | undefined,
): AtDocFileMeta {
	const parsed = parseAtDoc(content);
	return {
		metaClass: [...(parsed.config.meta?.class ?? [])],
		metaTags: mergeUnique(parsed.config.meta?.tag, parsed.inlineTags),
		metaStatus: parsed.config.meta?.status,
		metaTabist: parsed.config.meta?.tabist,
		metaApp: parsed.config.meta?.app,
		metaGithub: parsed.config.meta?.github,
		metaLicense: parsed.config.meta?.license,
		metaSource: parsed.config.meta?.source,
		metaRelease: parsed.config.meta?.release,
		metaAlias: [...(parsed.config.meta?.alias ?? [])],
		metaTitle: parsed.config.meta?.title,
	};
}
