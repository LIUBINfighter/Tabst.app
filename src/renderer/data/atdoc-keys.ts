export type AtDocValueType =
	| "number"
	| "boolean"
	| "color"
	| "enum:layoutMode"
	| "enum:scrollMode";

export interface AtDocKeyDefinition {
	key: string;
	valueType: AtDocValueType;
	description: string;
	example: string;
}

export const ATDOC_KEY_DEFINITIONS: AtDocKeyDefinition[] = [
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

export const ATDOC_LAYOUT_MODE_VALUES = ["Page", "Horizontal", "Parchment"];
export const ATDOC_SCROLL_MODE_VALUES = [
	"Off",
	"Continuous",
	"OffScreen",
	"Smooth",
];
