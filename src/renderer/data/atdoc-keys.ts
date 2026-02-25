import commandsJSON from "./alphatex-commands.json";

export type AtDocValueType =
	| "number"
	| "boolean"
	| "string"
	| "enum:status"
	| "enum:license"
	| "color"
	| "enum:layoutMode"
	| "enum:scrollMode";

export interface AtDocKeyDefinition {
	key: string;
	valueType: AtDocValueType;
	description: string;
	example: string;
}

type CommandsJsonAtDocKey = {
	key?: string;
	valueType?: string;
	description?: string;
	example?: string;
};

type CommandsJsonAtDoc = {
	keys?: CommandsJsonAtDocKey[];
	enums?: {
		layoutMode?: string[];
		scrollMode?: string[];
		status?: string[];
		license?: string[];
	};
};

type CommandsJsonRoot = {
	atdoc?: CommandsJsonAtDoc;
};

const DEFAULT_ATDOC_KEY_DEFINITIONS: AtDocKeyDefinition[] = [
	{
		key: "at.meta.class",
		valueType: "string",
		description: "Document class labels (comma-separated supported)",
		example: 'at.meta.class="lesson, fingerstyle"',
	},
	{
		key: "at.meta.tag",
		valueType: "string",
		description: "Document tags (comma-separated supported)",
		example: 'at.meta.tag="warmup, caged"',
	},
	{
		key: "at.meta.status",
		valueType: "enum:status",
		description: "Document lifecycle status: draft | active | done | released",
		example: "at.meta.status=active",
	},
	{
		key: "at.meta.tabist",
		valueType: "string",
		description: "Tab score author name",
		example: 'at.meta.tabist="Your Name"',
	},
	{
		key: "at.meta.app",
		valueType: "string",
		description: "Application identifier",
		example: 'at.meta.app="tabst.app"',
	},
	{
		key: "at.meta.github",
		valueType: "string",
		description: "Project GitHub URL",
		example: 'at.meta.github="https://github.com/LIUBINfighter/Tabst.app"',
	},
	{
		key: "at.meta.license",
		valueType: "enum:license",
		description: "Creative Commons license id",
		example: "at.meta.license=CC-BY-4.0",
	},
	{
		key: "at.meta.source",
		valueType: "string",
		description: "Source reference URL",
		example: 'at.meta.source="https://example.com/original"',
	},
	{
		key: "at.meta.release",
		valueType: "string",
		description: "Release link URL",
		example: 'at.meta.release="https://example.com/release-note"',
	},
	{
		key: "at.meta.alias",
		valueType: "string",
		description: "Alternative search aliases (comma-separated supported)",
		example: 'at.meta.alias="cw1, caged-a"',
	},
	{
		key: "at.meta.title",
		valueType: "string",
		description: "Display title override for navigation/search",
		example: 'at.meta.title="CAGED Warmup 01"',
	},
	{
		key: "at.display.scale",
		valueType: "number",
		description: "Preview display scale (>0)",
		example: "at.display.scale=0.75",
	},
	{
		key: "at.display.layoutMode",
		valueType: "enum:layoutMode",
		description: "Layout mode: Page | Horizontal | Parchment",
		example: "at.display.layoutMode=Page",
	},
	{
		key: "at.player.scrollMode",
		valueType: "enum:scrollMode",
		description: "Scroll mode: Off | Continuous | OffScreen | Smooth",
		example: "at.player.scrollMode=OffScreen",
	},
	{
		key: "at.player.scrollSpeed",
		valueType: "number",
		description: "Player scroll speed (>=0)",
		example: "at.player.scrollSpeed=300",
	},
	{
		key: "at.player.playbackSpeed",
		valueType: "number",
		description: "Playback speed multiplier (>0)",
		example: "at.player.playbackSpeed=0.9",
	},
	{
		key: "at.player.metronomeVolume",
		valueType: "number",
		description: "Metronome volume in [0,1]",
		example: "at.player.metronomeVolume=0.4",
	},
	{
		key: "at.player.countInEnabled",
		valueType: "boolean",
		description: "Enable count-in before playback",
		example: "at.player.countInEnabled=true",
	},
	{
		key: "at.player.enableCursor",
		valueType: "boolean",
		description: "Enable alphaTab playback cursor rendering",
		example: "at.player.enableCursor=true",
	},
	{
		key: "at.player.enableElementHighlighting",
		valueType: "boolean",
		description: "Enable alphaTab playback element highlighting",
		example: "at.player.enableElementHighlighting=true",
	},
	{
		key: "at.player.enableUserInteraction",
		valueType: "boolean",
		description: "Enable alphaTab user interaction in preview",
		example: "at.player.enableUserInteraction=true",
	},
	{
		key: "at.coloring.enabled",
		valueType: "boolean",
		description: "Enable ATDOC score coloring pipeline",
		example: "at.coloring.enabled=true",
	},
	{
		key: "at.coloring.barNumberColor",
		valueType: "color",
		description: "Bar number color override",
		example: "at.coloring.barNumberColor=#ef4444",
	},
	{
		key: "at.coloring.staffLineColor",
		valueType: "color",
		description: "Staff line color override",
		example: "at.coloring.staffLineColor=#334155",
	},
	{
		key: "at.coloring.barSeparatorColor",
		valueType: "color",
		description: "Bar separator color override",
		example: "at.coloring.barSeparatorColor=#64748b",
	},
	{
		key: "at.coloring.noteHeadColor",
		valueType: "color",
		description: "Standard notation note head color override",
		example: "at.coloring.noteHeadColor=#22c55e",
	},
	{
		key: "at.coloring.fretNumberColor",
		valueType: "color",
		description: "Guitar tab fret number color override",
		example: "at.coloring.fretNumberColor=#38bdf8",
	},
	{
		key: "at.coloring.colorizeByFret",
		valueType: "boolean",
		description: "Color notes by fret range palette",
		example: "at.coloring.colorizeByFret=true",
	},
	{
		key: "at.staff.showTablature",
		valueType: "boolean",
		description: "Show tablature in first track staff",
		example: "at.staff.showTablature=true",
	},
	{
		key: "at.staff.showStandardNotation",
		valueType: "boolean",
		description: "Show standard notation in first track staff",
		example: "at.staff.showStandardNotation=false",
	},
	{
		key: "at.staff.showSlash",
		valueType: "boolean",
		description: "Show slash notation in first track staff",
		example: "at.staff.showSlash=false",
	},
	{
		key: "at.staff.showNumbered",
		valueType: "boolean",
		description: "Show numbered notation in first track staff",
		example: "at.staff.showNumbered=false",
	},
	{
		key: "at.print.zoom",
		valueType: "number",
		description: "Initial print preview zoom (>0)",
		example: "at.print.zoom=1.1",
	},
	{
		key: "at.print.barsPerRow",
		valueType: "number",
		description: "Print bars per row (-1 or positive integer)",
		example: "at.print.barsPerRow=4",
	},
	{
		key: "at.print.stretchForce",
		valueType: "number",
		description: "Print stretch force (>=0)",
		example: "at.print.stretchForce=1.0",
	},
];

const DEFAULT_ATDOC_LAYOUT_MODE_VALUES = ["Page", "Horizontal", "Parchment"];
const DEFAULT_ATDOC_SCROLL_MODE_VALUES = [
	"Off",
	"Continuous",
	"OffScreen",
	"Smooth",
];

const DEFAULT_ATDOC_META_STATUS_VALUES = [
	"draft",
	"active",
	"done",
	"released",
];

const DEFAULT_ATDOC_META_LICENSE_VALUES = [
	"CC0-1.0",
	"CC-BY-4.0",
	"CC-BY-SA-4.0",
	"CC-BY-NC-4.0",
	"CC-BY-NC-SA-4.0",
	"CC-BY-ND-4.0",
	"CC-BY-NC-ND-4.0",
];

function isAtDocValueType(value: string): value is AtDocValueType {
	return (
		value === "number" ||
		value === "boolean" ||
		value === "string" ||
		value === "enum:status" ||
		value === "enum:license" ||
		value === "color" ||
		value === "enum:layoutMode" ||
		value === "enum:scrollMode"
	);
}

function sanitizeStringList(input: unknown): string[] | null {
	if (!Array.isArray(input)) return null;
	const values = input
		.filter((item): item is string => typeof item === "string")
		.map((item) => item.trim())
		.filter((item) => item.length > 0);
	return values.length > 0 ? [...new Set(values)] : null;
}

function parseJsonAtDocKey(
	raw: CommandsJsonAtDocKey,
): AtDocKeyDefinition | null {
	const key = typeof raw.key === "string" ? raw.key.trim() : "";
	const valueTypeRaw =
		typeof raw.valueType === "string" ? raw.valueType.trim() : "";
	const description =
		typeof raw.description === "string" ? raw.description.trim() : "";
	const example = typeof raw.example === "string" ? raw.example.trim() : "";

	if (!key || !valueTypeRaw || !description || !example) return null;
	if (!isAtDocValueType(valueTypeRaw)) return null;

	return {
		key,
		valueType: valueTypeRaw,
		description,
		example,
	};
}

function mergeAtDocKeyDefinitions(
	defaults: AtDocKeyDefinition[],
	overrides: unknown,
): AtDocKeyDefinition[] {
	const merged = new Map<string, AtDocKeyDefinition>(
		defaults.map((definition) => [definition.key, definition]),
	);

	if (!Array.isArray(overrides)) {
		return [...merged.values()];
	}

	for (const item of overrides) {
		const parsed = parseJsonAtDocKey(item as CommandsJsonAtDocKey);
		if (!parsed) continue;
		merged.set(parsed.key, parsed);
	}

	return [...merged.values()];
}

const atDocFromJson = (commandsJSON as CommandsJsonRoot)?.atdoc;

export const ATDOC_KEY_DEFINITIONS = mergeAtDocKeyDefinitions(
	DEFAULT_ATDOC_KEY_DEFINITIONS,
	atDocFromJson?.keys,
);

export const ATDOC_LAYOUT_MODE_VALUES =
	sanitizeStringList(atDocFromJson?.enums?.layoutMode) ??
	DEFAULT_ATDOC_LAYOUT_MODE_VALUES;

export const ATDOC_SCROLL_MODE_VALUES =
	sanitizeStringList(atDocFromJson?.enums?.scrollMode) ??
	DEFAULT_ATDOC_SCROLL_MODE_VALUES;

export const ATDOC_META_STATUS_VALUES =
	sanitizeStringList(atDocFromJson?.enums?.status) ??
	DEFAULT_ATDOC_META_STATUS_VALUES;

export const ATDOC_META_LICENSE_VALUES =
	sanitizeStringList(atDocFromJson?.enums?.license) ??
	DEFAULT_ATDOC_META_LICENSE_VALUES;
