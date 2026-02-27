import { ATDOC_KEY_DEFINITIONS } from "../data/atdoc-keys";

export const ATDOC_INLINE_KEY_COMMAND_PREFIX = "insert-atdoc-key:";

export type StaticEditorCommandId =
	| "insert-atdoc-block"
	| "insert-atdoc-directive"
	| "insert-atdoc-meta-preset";

export type DynamicEditorCommandId =
	`${typeof ATDOC_INLINE_KEY_COMMAND_PREFIX}${string}`;

export type EditorCommandId = StaticEditorCommandId | DynamicEditorCommandId;

export type GlobalOnlyCommandId =
	| "open-quick-file"
	| "open-editor-command-palette"
	| "layout.sidebar.open"
	| "layout.sidebar.close"
	| "layout.sidebar.toggle"
	| "workspace.quick-switcher.open"
	| "workspace.global-command-palette.open"
	| "workspace.mode.editor"
	| "workspace.mode.enjoy.toggle"
	| "workspace.mode.tutorial"
	| "workspace.mode.settings"
	| "workspace.editor-inline-command.open"
	| "settings.playback.progress-bar.toggle"
	| "settings.playback.progress-seek.toggle"
	| "settings.playback.sync-scroll.toggle"
	| "settings.playback.cursor-broadcast.toggle"
	| "settings.playback.component.staff-controls.toggle"
	| "settings.playback.component.tracks-controls.toggle"
	| "settings.playback.component.zoom-controls.toggle"
	| "settings.playback.component.speed-controls.toggle"
	| "settings.playback.component.progress-controls.toggle"
	| "settings.playback.component.transport-controls.toggle"
	| "preview.export.midi"
	| "preview.export.wav"
	| "preview.export.gp7"
	| "preview.print-preview.open"
	| "playback.play"
	| "playback.pause"
	| "playback.stop"
	| "playback.refresh"
	| "playback.play-pause"
	| "playback.tracks-panel.toggle";

export type GlobalCommandId = GlobalOnlyCommandId | StaticEditorCommandId;
export type InlineCommandId = EditorCommandId | GlobalCommandId;

export type CommandIcon =
	| "command"
	| "file"
	| "tree"
	| "sparkles"
	| "key"
	| "layout"
	| "playback"
	| "printer"
	| "music";

export interface RegisteredCommand<TId extends string> {
	id: TId;
	label: string;
	description: string;
	keywords: string[];
	icon: CommandIcon;
}

const STATIC_EDITOR_COMMANDS: RegisteredCommand<StaticEditorCommandId>[] = [
	{
		id: "insert-atdoc-block",
		label: "Insert ATDOC Block",
		description: "Insert /** */ wrapper template",
		keywords: ["atdoc", "comment", "block", "wrapper"],
		icon: "tree",
	},
	{
		id: "insert-atdoc-directive",
		label: "Insert ATDOC Directive",
		description: "Insert * at.meta.status=released",
		keywords: ["atdoc", "directive", "meta", "status"],
		icon: "sparkles",
	},
	{
		id: "insert-atdoc-meta-preset",
		label: "Insert ATDOC Meta Preset",
		description: "Insert title/tag/status preset lines",
		keywords: ["atdoc", "meta", "preset", "alias", "title"],
		icon: "sparkles",
	},
];

const GLOBAL_ONLY_COMMANDS: RegisteredCommand<GlobalOnlyCommandId>[] = [
	{
		id: "open-quick-file",
		label: "Quick Open Files",
		description: "Open .atex files by name/tag",
		keywords: ["file", "open", "quick", "search", "tag"],
		icon: "file",
	},
	{
		id: "open-editor-command-palette",
		label: "Editor Command Palette",
		description: "Open line-level command palette",
		keywords: ["editor", "inline", "line", "command"],
		icon: "command",
	},
	{
		id: "layout.sidebar.open",
		label: "Open Sidebar",
		description: "Expand left sidebar",
		keywords: ["layout", "sidebar", "open", "expand"],
		icon: "layout",
	},
	{
		id: "layout.sidebar.close",
		label: "Close Sidebar",
		description: "Collapse left sidebar",
		keywords: ["layout", "sidebar", "close", "collapse"],
		icon: "layout",
	},
	{
		id: "layout.sidebar.toggle",
		label: "Toggle Sidebar",
		description: "Toggle left sidebar visibility",
		keywords: ["layout", "sidebar", "toggle"],
		icon: "layout",
	},
	{
		id: "workspace.quick-switcher.open",
		label: "Open Quick Switcher",
		description: "Open quick file switcher",
		keywords: ["workspace", "quick", "switcher", "file"],
		icon: "file",
	},
	{
		id: "workspace.global-command-palette.open",
		label: "Open Global Command Palette",
		description: "Open global command palette",
		keywords: ["workspace", "global", "palette", "command"],
		icon: "command",
	},
	{
		id: "workspace.mode.editor",
		label: "Switch To Editor",
		description: "Switch workspace mode to editor",
		keywords: ["workspace", "mode", "editor"],
		icon: "command",
	},
	{
		id: "workspace.mode.enjoy.toggle",
		label: "Toggle Enjoy Mode",
		description: "Toggle workspace between editor and enjoy",
		keywords: ["workspace", "mode", "enjoy", "toggle"],
		icon: "layout",
	},
	{
		id: "preview.export.midi",
		label: "Export MIDI",
		description: "Export current score as MIDI",
		keywords: ["preview", "export", "midi"],
		icon: "music",
	},
	{
		id: "preview.export.wav",
		label: "Export WAV",
		description: "Export current score as WAV",
		keywords: ["preview", "export", "wav", "audio"],
		icon: "music",
	},
	{
		id: "preview.export.gp7",
		label: "Export GP7",
		description: "Export current score as GP7",
		keywords: ["preview", "export", "gp7", "guitar pro"],
		icon: "music",
	},
	{
		id: "preview.print-preview.open",
		label: "Open Print Preview",
		description: "Open print preview modal",
		keywords: ["preview", "print", "export", "pdf"],
		icon: "printer",
	},
	{
		id: "workspace.mode.tutorial",
		label: "Switch To Tutorial",
		description: "Switch workspace mode to tutorial",
		keywords: ["workspace", "mode", "tutorial"],
		icon: "command",
	},
	{
		id: "workspace.mode.settings",
		label: "Switch To Settings",
		description: "Switch workspace mode to settings",
		keywords: ["workspace", "mode", "settings"],
		icon: "command",
	},
	{
		id: "workspace.editor-inline-command.open",
		label: "Open Inline Editor Commands",
		description: "Open editor inline command bar",
		keywords: ["workspace", "editor", "inline", "command"],
		icon: "command",
	},
	{
		id: "settings.playback.progress-bar.toggle",
		label: "Toggle Playback Progress Bar",
		description: "Show or hide playback progress bar",
		keywords: ["settings", "playback", "progress", "bar", "toggle"],
		icon: "playback",
	},
	{
		id: "settings.playback.progress-seek.toggle",
		label: "Toggle Playback Seek",
		description: "Enable or disable playback seek",
		keywords: ["settings", "playback", "seek", "toggle"],
		icon: "playback",
	},
	{
		id: "settings.playback.sync-scroll.toggle",
		label: "Toggle Sync Scroll",
		description: "Enable or disable editor sync scroll",
		keywords: ["settings", "playback", "sync", "scroll", "toggle"],
		icon: "playback",
	},
	{
		id: "settings.playback.cursor-broadcast.toggle",
		label: "Toggle Cursor Broadcast",
		description: "Enable or disable editor cursor broadcast",
		keywords: ["settings", "playback", "cursor", "broadcast", "toggle"],
		icon: "playback",
	},
	{
		id: "settings.playback.component.staff-controls.toggle",
		label: "Toggle Staff Controls",
		description: "Show or hide staff controls component",
		keywords: ["settings", "playback", "staff", "component", "toggle"],
		icon: "playback",
	},
	{
		id: "settings.playback.component.tracks-controls.toggle",
		label: "Toggle Tracks Controls",
		description: "Show or hide tracks controls component",
		keywords: ["settings", "playback", "tracks", "component", "toggle"],
		icon: "playback",
	},
	{
		id: "settings.playback.component.zoom-controls.toggle",
		label: "Toggle Zoom Controls",
		description: "Show or hide zoom controls component",
		keywords: ["settings", "playback", "zoom", "component", "toggle"],
		icon: "playback",
	},
	{
		id: "settings.playback.component.speed-controls.toggle",
		label: "Toggle Speed Controls",
		description: "Show or hide playback speed controls component",
		keywords: ["settings", "playback", "speed", "component", "toggle"],
		icon: "playback",
	},
	{
		id: "settings.playback.component.progress-controls.toggle",
		label: "Toggle Progress Controls",
		description: "Show or hide playback progress controls component",
		keywords: ["settings", "playback", "progress", "component", "toggle"],
		icon: "playback",
	},
	{
		id: "settings.playback.component.transport-controls.toggle",
		label: "Toggle Transport Controls",
		description: "Show or hide playback transport controls component",
		keywords: ["settings", "playback", "transport", "component", "toggle"],
		icon: "playback",
	},
	{
		id: "playback.play",
		label: "Playback Play",
		description: "Start playing current score",
		keywords: ["playback", "play", "transport"],
		icon: "playback",
	},
	{
		id: "playback.pause",
		label: "Playback Pause",
		description: "Pause current playback",
		keywords: ["playback", "pause", "transport"],
		icon: "playback",
	},
	{
		id: "playback.stop",
		label: "Playback Stop",
		description: "Stop current playback",
		keywords: ["playback", "stop", "transport"],
		icon: "playback",
	},
	{
		id: "playback.refresh",
		label: "Playback Refresh",
		description: "Refresh current score playback",
		keywords: ["playback", "refresh", "transport"],
		icon: "playback",
	},
	{
		id: "playback.play-pause",
		label: "Playback Play/Pause",
		description: "Toggle playback play/pause",
		keywords: ["playback", "play", "pause", "toggle"],
		icon: "playback",
	},
	{
		id: "playback.tracks-panel.toggle",
		label: "Toggle Tracks Panel",
		description: "Toggle tracks panel visibility",
		keywords: ["playback", "tracks", "panel", "toggle"],
		icon: "playback",
	},
];

const STATIC_EDITOR_COMMAND_SET = new Set<string>(
	STATIC_EDITOR_COMMANDS.map((command) => command.id),
);

export function isEditorCommandId(
	commandId: string,
): commandId is EditorCommandId {
	return (
		STATIC_EDITOR_COMMAND_SET.has(commandId) ||
		commandId.startsWith(ATDOC_INLINE_KEY_COMMAND_PREFIX)
	);
}

export function getGlobalCommands(): RegisteredCommand<GlobalCommandId>[] {
	return [...GLOBAL_ONLY_COMMANDS];
}

export function getInlineEditorCommands(): RegisteredCommand<EditorCommandId>[] {
	const dynamicAtdocCommands: RegisteredCommand<DynamicEditorCommandId>[] =
		ATDOC_KEY_DEFINITIONS.map((definition) => ({
			id: `${ATDOC_INLINE_KEY_COMMAND_PREFIX}${definition.key}`,
			label: `Insert ${definition.key}`,
			description: `${definition.description} · Example: ${definition.example}`,
			keywords: [
				"atdoc",
				"key",
				definition.key,
				...definition.key.split("."),
				definition.valueType,
			],
			icon: "key",
		}));

	return [...STATIC_EDITOR_COMMANDS, ...dynamicAtdocCommands];
}

export function getInlineCommands(): RegisteredCommand<InlineCommandId>[] {
	const merged = new Map<string, RegisteredCommand<InlineCommandId>>();

	for (const command of getInlineEditorCommands()) {
		merged.set(command.id, command as RegisteredCommand<InlineCommandId>);
	}

	for (const command of getGlobalCommands()) {
		if (!merged.has(command.id)) {
			merged.set(command.id, command as RegisteredCommand<InlineCommandId>);
		}
	}

	return [...merged.values()];
}
