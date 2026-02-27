import { useAppStore } from "../store/appStore";
import {
	dispatchEditorCommand,
	dispatchOpenInlineEditorCommand,
} from "./command-palette";
import type { EditorCommandId } from "./command-registry";
import {
	dispatchPreviewCommand,
	type PreviewCommandId,
} from "./preview-command-events";
import {
	dispatchUiShellCommand,
	type UiShellCommandId,
} from "./ui-shell-events";

type WorkspaceMode = "editor" | "enjoy" | "tutorial" | "settings";

export type UiCommandId =
	| UiShellCommandId
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
	| PreviewCommandId
	| "editor.insert-atdoc-block"
	| "editor.insert-atdoc-directive"
	| "editor.insert-atdoc-meta-preset"
	| "playback.play"
	| "playback.pause"
	| "playback.stop"
	| "playback.refresh"
	| "playback.play-pause"
	| "playback.tracks-panel.toggle";

export interface UiCommandDefinition {
	id: UiCommandId;
	label: string;
	description: string;
	keywords: string[];
	domain: "layout" | "workspace" | "editor" | "playback";
}

export interface UiCommandRunResult {
	ok: boolean;
	commandId: UiCommandId;
	action: string;
	warnings: string[];
}

const UI_COMMANDS: UiCommandDefinition[] = [
	{
		id: "layout.sidebar.open",
		label: "Open Sidebar",
		description: "Expand left sidebar shell",
		keywords: ["layout", "sidebar", "open", "expand"],
		domain: "layout",
	},
	{
		id: "layout.sidebar.close",
		label: "Close Sidebar",
		description: "Collapse left sidebar shell",
		keywords: ["layout", "sidebar", "close", "collapse"],
		domain: "layout",
	},
	{
		id: "layout.sidebar.toggle",
		label: "Toggle Sidebar",
		description: "Toggle left sidebar shell",
		keywords: ["layout", "sidebar", "toggle"],
		domain: "layout",
	},
	{
		id: "workspace.quick-switcher.open",
		label: "Open Quick Switcher",
		description: "Open quick file switcher",
		keywords: ["workspace", "quick", "switcher", "file"],
		domain: "workspace",
	},
	{
		id: "workspace.global-command-palette.open",
		label: "Open Global Command Palette",
		description: "Open global command palette shell",
		keywords: ["workspace", "global", "palette", "command"],
		domain: "workspace",
	},
	{
		id: "workspace.mode.editor",
		label: "Switch To Editor",
		description: "Set workspace mode to editor",
		keywords: ["workspace", "mode", "editor"],
		domain: "workspace",
	},
	{
		id: "workspace.mode.enjoy.toggle",
		label: "Toggle Enjoy Mode",
		description: "Toggle workspace between editor and enjoy",
		keywords: ["workspace", "mode", "enjoy", "toggle"],
		domain: "workspace",
	},
	{
		id: "preview.export.midi",
		label: "Export MIDI",
		description: "Export current score as MIDI",
		keywords: ["preview", "export", "midi"],
		domain: "workspace",
	},
	{
		id: "preview.export.wav",
		label: "Export WAV",
		description: "Export current score as WAV",
		keywords: ["preview", "export", "wav", "audio"],
		domain: "workspace",
	},
	{
		id: "preview.export.gp7",
		label: "Export GP7",
		description: "Export current score as GP7",
		keywords: ["preview", "export", "gp7", "guitar pro"],
		domain: "workspace",
	},
	{
		id: "preview.print-preview.open",
		label: "Open Print Preview",
		description: "Open print preview modal for current score",
		keywords: ["preview", "print", "export", "pdf"],
		domain: "workspace",
	},
	{
		id: "workspace.mode.tutorial",
		label: "Switch To Tutorial",
		description: "Set workspace mode to tutorial",
		keywords: ["workspace", "mode", "tutorial"],
		domain: "workspace",
	},
	{
		id: "workspace.mode.settings",
		label: "Switch To Settings",
		description: "Set workspace mode to settings",
		keywords: ["workspace", "mode", "settings"],
		domain: "workspace",
	},
	{
		id: "workspace.editor-inline-command.open",
		label: "Open Inline Editor Commands",
		description: "Open editor inline command bar",
		keywords: ["workspace", "editor", "inline", "command"],
		domain: "workspace",
	},
	{
		id: "settings.playback.progress-bar.toggle",
		label: "Toggle Playback Progress Bar",
		description: "Show or hide playback progress bar",
		keywords: ["settings", "playback", "progress", "bar", "toggle"],
		domain: "playback",
	},
	{
		id: "settings.playback.progress-seek.toggle",
		label: "Toggle Playback Seek",
		description: "Enable or disable playback seek on progress bar",
		keywords: ["settings", "playback", "seek", "toggle"],
		domain: "playback",
	},
	{
		id: "settings.playback.sync-scroll.toggle",
		label: "Toggle Sync Scroll",
		description: "Enable or disable editor sync scroll during playback",
		keywords: ["settings", "playback", "sync", "scroll", "toggle"],
		domain: "playback",
	},
	{
		id: "settings.playback.cursor-broadcast.toggle",
		label: "Toggle Cursor Broadcast",
		description: "Enable or disable editor cursor broadcast",
		keywords: ["settings", "playback", "cursor", "broadcast", "toggle"],
		domain: "playback",
	},
	{
		id: "settings.playback.component.staff-controls.toggle",
		label: "Toggle Staff Controls",
		description: "Show or hide staff controls component",
		keywords: ["settings", "playback", "player", "staff", "toggle"],
		domain: "playback",
	},
	{
		id: "settings.playback.component.tracks-controls.toggle",
		label: "Toggle Tracks Controls",
		description: "Show or hide tracks controls component",
		keywords: ["settings", "playback", "player", "tracks", "toggle"],
		domain: "playback",
	},
	{
		id: "settings.playback.component.zoom-controls.toggle",
		label: "Toggle Zoom Controls",
		description: "Show or hide zoom controls component",
		keywords: ["settings", "playback", "player", "zoom", "toggle"],
		domain: "playback",
	},
	{
		id: "settings.playback.component.speed-controls.toggle",
		label: "Toggle Speed Controls",
		description: "Show or hide playback speed controls component",
		keywords: ["settings", "playback", "player", "speed", "toggle"],
		domain: "playback",
	},
	{
		id: "settings.playback.component.progress-controls.toggle",
		label: "Toggle Progress Controls",
		description: "Show or hide playback progress controls component",
		keywords: ["settings", "playback", "player", "progress", "toggle"],
		domain: "playback",
	},
	{
		id: "settings.playback.component.transport-controls.toggle",
		label: "Toggle Transport Controls",
		description: "Show or hide playback transport controls component",
		keywords: ["settings", "playback", "player", "transport", "toggle"],
		domain: "playback",
	},
	{
		id: "editor.insert-atdoc-block",
		label: "Insert ATDOC Block",
		description: "Insert ATDOC block template in editor",
		keywords: ["editor", "insert", "atdoc", "block"],
		domain: "editor",
	},
	{
		id: "editor.insert-atdoc-directive",
		label: "Insert ATDOC Directive",
		description: "Insert ATDOC directive line in editor",
		keywords: ["editor", "insert", "atdoc", "directive"],
		domain: "editor",
	},
	{
		id: "editor.insert-atdoc-meta-preset",
		label: "Insert ATDOC Meta Preset",
		description: "Insert ATDOC meta preset lines in editor",
		keywords: ["editor", "insert", "atdoc", "meta"],
		domain: "editor",
	},
	{
		id: "playback.play",
		label: "Playback Play",
		description: "Start playing current score",
		keywords: ["playback", "play", "transport"],
		domain: "playback",
	},
	{
		id: "playback.pause",
		label: "Playback Pause",
		description: "Pause playing current score",
		keywords: ["playback", "pause", "transport"],
		domain: "playback",
	},
	{
		id: "playback.stop",
		label: "Playback Stop",
		description: "Stop playing current score",
		keywords: ["playback", "stop", "transport"],
		domain: "playback",
	},
	{
		id: "playback.refresh",
		label: "Playback Refresh",
		description: "Re-render and refresh current score",
		keywords: ["playback", "refresh", "render"],
		domain: "playback",
	},
	{
		id: "playback.play-pause",
		label: "Playback Play/Pause",
		description: "Toggle play/pause for current score",
		keywords: ["playback", "play", "pause", "toggle"],
		domain: "playback",
	},
	{
		id: "playback.tracks-panel.toggle",
		label: "Toggle Tracks Panel",
		description: "Toggle tracks panel visibility",
		keywords: ["playback", "tracks", "panel", "toggle"],
		domain: "playback",
	},
];

function editorCommandFromUiCommand(
	commandId: UiCommandId,
): EditorCommandId | null {
	if (commandId === "editor.insert-atdoc-block") {
		return "insert-atdoc-block";
	}
	if (commandId === "editor.insert-atdoc-directive") {
		return "insert-atdoc-directive";
	}
	if (commandId === "editor.insert-atdoc-meta-preset") {
		return "insert-atdoc-meta-preset";
	}
	return null;
}

function workspaceModeFromUiCommand(
	commandId: UiCommandId,
): WorkspaceMode | null {
	if (commandId === "workspace.mode.editor") return "editor";
	if (commandId === "workspace.mode.tutorial") return "tutorial";
	if (commandId === "workspace.mode.settings") return "settings";
	return null;
}

function runPlaybackCommand(commandId: UiCommandId): string {
	const state = useAppStore.getState();
	const controls = state.playerControls;
	if (!controls) {
		return "Player controls unavailable (no active preview API)";
	}

	if (commandId === "playback.play") {
		controls.play?.();
		return "Called playerControls.play()";
	}
	if (commandId === "playback.pause") {
		controls.pause?.();
		return "Called playerControls.pause()";
	}
	if (commandId === "playback.stop") {
		controls.stop?.();
		return "Called playerControls.stop()";
	}
	if (commandId === "playback.refresh") {
		controls.refresh?.();
		return "Called playerControls.refresh()";
	}
	if (commandId === "playback.play-pause") {
		if (state.playerIsPlaying) {
			controls.pause?.();
			return "playerIsPlaying=true, called playerControls.pause()";
		}
		controls.play?.();
		return "playerIsPlaying=false, called playerControls.play()";
	}

	if (commandId === "playback.tracks-panel.toggle") {
		state.toggleTracksPanel();
		return "Called appStore.toggleTracksPanel()";
	}

	return "Unsupported playback command";
}

function runPlaybackSettingsToggleCommand(commandId: UiCommandId): string {
	const state = useAppStore.getState();

	if (commandId === "settings.playback.progress-bar.toggle") {
		state.setEnablePlaybackProgressBar(!state.enablePlaybackProgressBar);
		return `Set enablePlaybackProgressBar=${!state.enablePlaybackProgressBar}`;
	}
	if (commandId === "settings.playback.progress-seek.toggle") {
		state.setEnablePlaybackProgressSeek(!state.enablePlaybackProgressSeek);
		return `Set enablePlaybackProgressSeek=${!state.enablePlaybackProgressSeek}`;
	}
	if (commandId === "settings.playback.sync-scroll.toggle") {
		state.setEnableSyncScroll(!state.enableSyncScroll);
		return `Set enableSyncScroll=${!state.enableSyncScroll}`;
	}
	if (commandId === "settings.playback.cursor-broadcast.toggle") {
		state.setEnableCursorBroadcast(!state.enableCursorBroadcast);
		return `Set enableCursorBroadcast=${!state.enableCursorBroadcast}`;
	}
	if (commandId === "settings.playback.component.staff-controls.toggle") {
		state.togglePlayerComponent("staffControls");
		return "Toggled player component: staffControls";
	}
	if (commandId === "settings.playback.component.tracks-controls.toggle") {
		state.togglePlayerComponent("tracksControls");
		return "Toggled player component: tracksControls";
	}
	if (commandId === "settings.playback.component.zoom-controls.toggle") {
		state.togglePlayerComponent("zoomControls");
		return "Toggled player component: zoomControls";
	}
	if (commandId === "settings.playback.component.speed-controls.toggle") {
		state.togglePlayerComponent("playbackSpeedControls");
		return "Toggled player component: playbackSpeedControls";
	}
	if (commandId === "settings.playback.component.progress-controls.toggle") {
		state.togglePlayerComponent("playbackProgress");
		return "Toggled player component: playbackProgress";
	}
	if (commandId === "settings.playback.component.transport-controls.toggle") {
		state.togglePlayerComponent("playbackTransport");
		return "Toggled player component: playbackTransport";
	}

	return "Unsupported playback settings toggle command";
}

export function getUiCommands(): UiCommandDefinition[] {
	return UI_COMMANDS;
}

export function runUiCommand(commandId: UiCommandId): UiCommandRunResult {
	const warnings: string[] = [];

	const shellCommands: UiShellCommandId[] = [
		"layout.sidebar.open",
		"layout.sidebar.close",
		"layout.sidebar.toggle",
		"workspace.quick-switcher.open",
		"workspace.global-command-palette.open",
	];

	if (shellCommands.includes(commandId as UiShellCommandId)) {
		dispatchUiShellCommand(commandId as UiShellCommandId);
		return {
			ok: true,
			commandId,
			action: `Dispatch shell event: ${commandId}`,
			warnings,
		};
	}

	const workspaceMode = workspaceModeFromUiCommand(commandId);
	if (workspaceMode) {
		useAppStore.getState().setWorkspaceMode(workspaceMode);
		return {
			ok: true,
			commandId,
			action: `Set workspace mode: ${workspaceMode}`,
			warnings,
		};
	}

	if (commandId === "workspace.mode.enjoy.toggle") {
		const state = useAppStore.getState();
		const nextMode = state.workspaceMode === "enjoy" ? "editor" : "enjoy";
		state.setWorkspaceMode(nextMode);
		return {
			ok: true,
			commandId,
			action: `Toggle enjoy mode to: ${nextMode}`,
			warnings,
		};
	}

	if (commandId === "workspace.editor-inline-command.open") {
		dispatchOpenInlineEditorCommand();
		useAppStore.getState().setWorkspaceMode("editor");
		return {
			ok: true,
			commandId,
			action: "Open inline editor command bar and switch to editor mode",
			warnings,
		};
	}

	if (commandId.startsWith("settings.playback.")) {
		const action = runPlaybackSettingsToggleCommand(commandId);
		return {
			ok: true,
			commandId,
			action,
			warnings,
		};
	}

	if (commandId.startsWith("preview.")) {
		dispatchPreviewCommand(commandId as PreviewCommandId);
		return {
			ok: true,
			commandId,
			action: `Dispatch preview command: ${commandId}`,
			warnings,
		};
	}

	const editorCommand = editorCommandFromUiCommand(commandId);
	if (editorCommand) {
		dispatchEditorCommand(editorCommand);
		useAppStore.getState().setWorkspaceMode("editor");
		return {
			ok: true,
			commandId,
			action: `Dispatch editor command: ${editorCommand}`,
			warnings,
		};
	}

	if (commandId.startsWith("playback.")) {
		const state = useAppStore.getState();
		if (!state.playerControls) {
			warnings.push("No active player controls; command may be no-op now.");
		}
		const action = runPlaybackCommand(commandId);
		return {
			ok: true,
			commandId,
			action,
			warnings,
		};
	}

	return {
		ok: false,
		commandId,
		action: "Unknown command",
		warnings,
	};
}
