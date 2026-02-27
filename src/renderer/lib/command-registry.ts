import { ATDOC_KEY_DEFINITIONS } from "../data/atdoc-keys";
import i18n from "../i18n";

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
	| "workspace.mode.git"
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
		label: i18n.t("settings:commandRegistry.insert_atdoc_block.label"),
		description: i18n.t(
			"settings:commandRegistry.insert_atdoc_block.description",
		),
		keywords: ["atdoc", "comment", "block", "wrapper"],
		icon: "tree",
	},
	{
		id: "insert-atdoc-directive",
		label: i18n.t("settings:commandRegistry.insert_atdoc_directive.label"),
		description: i18n.t(
			"settings:commandRegistry.insert_atdoc_directive.description",
		),
		keywords: ["atdoc", "directive", "meta", "status"],
		icon: "sparkles",
	},
	{
		id: "insert-atdoc-meta-preset",
		label: i18n.t("settings:commandRegistry.insert_atdoc_meta_preset.label"),
		description: i18n.t(
			"settings:commandRegistry.insert_atdoc_meta_preset.description",
		),
		keywords: ["atdoc", "meta", "preset", "alias", "title"],
		icon: "sparkles",
	},
];

const GLOBAL_ONLY_COMMANDS: RegisteredCommand<GlobalOnlyCommandId>[] = [
	{
		id: "open-quick-file",
		label: i18n.t("settings:commandRegistry.open_quick_file.label"),
		description: i18n.t("settings:commandRegistry.open_quick_file.description"),
		keywords: ["file", "open", "quick", "search", "tag"],
		icon: "file",
	},
	{
		id: "open-editor-command-palette",
		label: i18n.t("settings:commandRegistry.open_editor_command_palette.label"),
		description: i18n.t(
			"settings:commandRegistry.open_editor_command_palette.description",
		),
		keywords: ["editor", "inline", "line", "command"],
		icon: "command",
	},
	{
		id: "layout.sidebar.open",
		label: i18n.t("settings:commandRegistry.layout_sidebar_open.label"),
		description: i18n.t(
			"settings:commandRegistry.layout_sidebar_open.description",
		),
		keywords: ["layout", "sidebar", "open", "expand"],
		icon: "layout",
	},
	{
		id: "layout.sidebar.close",
		label: i18n.t("settings:commandRegistry.layout_sidebar_close.label"),
		description: i18n.t(
			"settings:commandRegistry.layout_sidebar_close.description",
		),
		keywords: ["layout", "sidebar", "close", "collapse"],
		icon: "layout",
	},
	{
		id: "layout.sidebar.toggle",
		label: i18n.t("settings:commandRegistry.layout_sidebar_toggle.label"),
		description: i18n.t(
			"settings:commandRegistry.layout_sidebar_toggle.description",
		),
		keywords: ["layout", "sidebar", "toggle"],
		icon: "layout",
	},
	{
		id: "workspace.quick-switcher.open",
		label: i18n.t(
			"settings:commandRegistry.workspace_quick_switcher_open.label",
		),
		description: i18n.t(
			"settings:commandRegistry.workspace_quick_switcher_open.description",
		),
		keywords: ["workspace", "quick", "switcher", "file"],
		icon: "file",
	},
	{
		id: "workspace.global-command-palette.open",
		label: i18n.t(
			"settings:commandRegistry.workspace_global_command_palette_open.label",
		),
		description: i18n.t(
			"settings:commandRegistry.workspace_global_command_palette_open.description",
		),
		keywords: ["workspace", "global", "palette", "command"],
		icon: "command",
	},
	{
		id: "workspace.mode.editor",
		label: i18n.t("settings:commandRegistry.workspace_mode_editor.label"),
		description: i18n.t(
			"settings:commandRegistry.workspace_mode_editor.description",
		),
		keywords: ["workspace", "mode", "editor"],
		icon: "command",
	},
	{
		id: "workspace.mode.enjoy.toggle",
		label: i18n.t("settings:commandRegistry.workspace_mode_enjoy_toggle.label"),
		description: i18n.t(
			"settings:commandRegistry.workspace_mode_enjoy_toggle.description",
		),
		keywords: ["workspace", "mode", "enjoy", "toggle"],
		icon: "layout",
	},
	{
		id: "preview.export.midi",
		label: i18n.t("settings:commandRegistry.preview_export_midi.label"),
		description: i18n.t(
			"settings:commandRegistry.preview_export_midi.description",
		),
		keywords: ["preview", "export", "midi"],
		icon: "music",
	},
	{
		id: "preview.export.wav",
		label: i18n.t("settings:commandRegistry.preview_export_wav.label"),
		description: i18n.t(
			"settings:commandRegistry.preview_export_wav.description",
		),
		keywords: ["preview", "export", "wav", "audio"],
		icon: "music",
	},
	{
		id: "preview.export.gp7",
		label: i18n.t("settings:commandRegistry.preview_export_gp7.label"),
		description: i18n.t(
			"settings:commandRegistry.preview_export_gp7.description",
		),
		keywords: ["preview", "export", "gp7", "guitar pro"],
		icon: "music",
	},
	{
		id: "preview.print-preview.open",
		label: i18n.t("settings:commandRegistry.preview_print_preview_open.label"),
		description: i18n.t(
			"settings:commandRegistry.preview_print_preview_open.description",
		),
		keywords: ["preview", "print", "export", "pdf"],
		icon: "printer",
	},
	{
		id: "workspace.mode.tutorial",
		label: i18n.t("settings:commandRegistry.workspace_mode_tutorial.label"),
		description: i18n.t(
			"settings:commandRegistry.workspace_mode_tutorial.description",
		),
		keywords: ["workspace", "mode", "tutorial"],
		icon: "command",
	},
	{
		id: "workspace.mode.settings",
		label: i18n.t("settings:commandRegistry.workspace_mode_settings.label"),
		description: i18n.t(
			"settings:commandRegistry.workspace_mode_settings.description",
		),
		keywords: ["workspace", "mode", "settings"],
		icon: "command",
	},
	{
		id: "workspace.mode.git",
		label: i18n.t("settings:commandRegistry.workspace_mode_git.label"),
		description: i18n.t(
			"settings:commandRegistry.workspace_mode_git.description",
		),
		keywords: ["workspace", "mode", "git", "source-control"],
		icon: "command",
	},
	{
		id: "workspace.editor-inline-command.open",
		label: i18n.t(
			"settings:commandRegistry.workspace_editor_inline_command_open.label",
		),
		description: i18n.t(
			"settings:commandRegistry.workspace_editor_inline_command_open.description",
		),
		keywords: ["workspace", "editor", "inline", "command"],
		icon: "command",
	},
	{
		id: "settings.playback.progress-bar.toggle",
		label: i18n.t(
			"settings:commandRegistry.settings_playback_progress_bar_toggle.label",
		),
		description: i18n.t(
			"settings:commandRegistry.settings_playback_progress_bar_toggle.description",
		),
		keywords: ["settings", "playback", "progress", "bar", "toggle"],
		icon: "playback",
	},
	{
		id: "settings.playback.progress-seek.toggle",
		label: i18n.t(
			"settings:commandRegistry.settings_playback_progress_seek_toggle.label",
		),
		description: i18n.t(
			"settings:commandRegistry.settings_playback_progress_seek_toggle.description",
		),
		keywords: ["settings", "playback", "seek", "toggle"],
		icon: "playback",
	},
	{
		id: "settings.playback.sync-scroll.toggle",
		label: i18n.t(
			"settings:commandRegistry.settings_playback_sync_scroll_toggle.label",
		),
		description: i18n.t(
			"settings:commandRegistry.settings_playback_sync_scroll_toggle.description",
		),
		keywords: ["settings", "playback", "sync", "scroll", "toggle"],
		icon: "playback",
	},
	{
		id: "settings.playback.cursor-broadcast.toggle",
		label: i18n.t(
			"settings:commandRegistry.settings_playback_cursor_broadcast_toggle.label",
		),
		description: i18n.t(
			"settings:commandRegistry.settings_playback_cursor_broadcast_toggle.description",
		),
		keywords: ["settings", "playback", "cursor", "broadcast", "toggle"],
		icon: "playback",
	},
	{
		id: "settings.playback.component.staff-controls.toggle",
		label: i18n.t(
			"settings:commandRegistry.settings_playback_component_staff_controls_toggle.label",
		),
		description: i18n.t(
			"settings:commandRegistry.settings_playback_component_staff_controls_toggle.description",
		),
		keywords: ["settings", "playback", "staff", "component", "toggle"],
		icon: "playback",
	},
	{
		id: "settings.playback.component.tracks-controls.toggle",
		label: i18n.t(
			"settings:commandRegistry.settings_playback_component_tracks_controls_toggle.label",
		),
		description: i18n.t(
			"settings:commandRegistry.settings_playback_component_tracks_controls_toggle.description",
		),
		keywords: ["settings", "playback", "tracks", "component", "toggle"],
		icon: "playback",
	},
	{
		id: "settings.playback.component.zoom-controls.toggle",
		label: i18n.t(
			"settings:commandRegistry.settings_playback_component_zoom_controls_toggle.label",
		),
		description: i18n.t(
			"settings:commandRegistry.settings_playback_component_zoom_controls_toggle.description",
		),
		keywords: ["settings", "playback", "zoom", "component", "toggle"],
		icon: "playback",
	},
	{
		id: "settings.playback.component.speed-controls.toggle",
		label: i18n.t(
			"settings:commandRegistry.settings_playback_component_speed_controls_toggle.label",
		),
		description: i18n.t(
			"settings:commandRegistry.settings_playback_component_speed_controls_toggle.description",
		),
		keywords: ["settings", "playback", "speed", "component", "toggle"],
		icon: "playback",
	},
	{
		id: "settings.playback.component.progress-controls.toggle",
		label: i18n.t(
			"settings:commandRegistry.settings_playback_component_progress_controls_toggle.label",
		),
		description: i18n.t(
			"settings:commandRegistry.settings_playback_component_progress_controls_toggle.description",
		),
		keywords: ["settings", "playback", "progress", "component", "toggle"],
		icon: "playback",
	},
	{
		id: "settings.playback.component.transport-controls.toggle",
		label: i18n.t(
			"settings:commandRegistry.settings_playback_component_transport_controls_toggle.label",
		),
		description: i18n.t(
			"settings:commandRegistry.settings_playback_component_transport_controls_toggle.description",
		),
		keywords: ["settings", "playback", "transport", "component", "toggle"],
		icon: "playback",
	},
	{
		id: "playback.play",
		label: i18n.t("settings:commandRegistry.playback_play.label"),
		description: i18n.t("settings:commandRegistry.playback_play.description"),
		keywords: ["playback", "play", "transport"],
		icon: "playback",
	},
	{
		id: "playback.pause",
		label: i18n.t("settings:commandRegistry.playback_pause.label"),
		description: i18n.t("settings:commandRegistry.playback_pause.description"),
		keywords: ["playback", "pause", "transport"],
		icon: "playback",
	},
	{
		id: "playback.stop",
		label: i18n.t("settings:commandRegistry.playback_stop.label"),
		description: i18n.t("settings:commandRegistry.playback_stop.description"),
		keywords: ["playback", "stop", "transport"],
		icon: "playback",
	},
	{
		id: "playback.refresh",
		label: i18n.t("settings:commandRegistry.playback_refresh.label"),
		description: i18n.t(
			"settings:commandRegistry.playback_refresh.description",
		),
		keywords: ["playback", "refresh", "transport"],
		icon: "playback",
	},
	{
		id: "playback.play-pause",
		label: i18n.t("settings:commandRegistry.playback_play_pause.label"),
		description: i18n.t(
			"settings:commandRegistry.playback_play_pause.description",
		),
		keywords: ["playback", "play", "pause", "toggle"],
		icon: "playback",
	},
	{
		id: "playback.tracks-panel.toggle",
		label: i18n.t(
			"settings:commandRegistry.playback_tracks_panel_toggle.label",
		),
		description: i18n.t(
			"settings:commandRegistry.playback_tracks_panel_toggle.description",
		),
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
			label: i18n.t("settings:commandRegistry.dynamicAtdocLabel", {
				key: definition.key,
			}),
			description: i18n.t("settings:commandRegistry.dynamicAtdocDescription", {
				description: definition.description,
				example: definition.example,
			}),
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
