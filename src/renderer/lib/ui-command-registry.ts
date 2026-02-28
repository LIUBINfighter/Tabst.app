import { useAppStore } from "../store/appStore";
import {
	dispatchEditorCommand,
	dispatchOpenInlineEditorCommand,
} from "./command-palette";
import {
	type GlobalCommandId,
	getGlobalCommands,
	getInlineCommands,
	type InlineCommandId,
	type StaticEditorCommandId,
} from "./command-registry";
import {
	dispatchPreviewCommand,
	type PreviewCommandId,
} from "./preview-command-events";
import { isTemplateCandidatePath } from "./template-utils";
import {
	dispatchUiShellCommand,
	type UiShellCommandId,
} from "./ui-shell-events";

type WorkspaceMode = "editor" | "enjoy" | "tutorial" | "settings" | "git";

export type UiCommandId = GlobalCommandId;

export interface UiCommandRunResult {
	ok: boolean;
	commandId: UiCommandId;
	action: string;
	warnings: string[];
}

export interface UiCommandAvailability {
	enabled: boolean;
	reason?: string;
}

export interface CommandWithAvailability {
	id: UiCommandId;
	label: string;
	description: string;
	keywords: string[];
	icon: import("./command-registry").CommandIcon;
	availability: UiCommandAvailability;
}

export interface InlineCommandWithAvailability {
	id: InlineCommandId;
	label: string;
	description: string;
	keywords: string[];
	icon: import("./command-registry").CommandIcon;
	availability: UiCommandAvailability;
}

function sortByPinnedAndMru<T extends { id: string }>(commands: T[]): T[] {
	const state = useAppStore.getState();
	const pinnedSet = new Set(state.pinnedCommandIds);
	const mruIndex = new Map(state.commandMruIds.map((id, index) => [id, index]));

	return [...commands].sort((left, right) => {
		const leftPinned = pinnedSet.has(left.id);
		const rightPinned = pinnedSet.has(right.id);
		if (leftPinned !== rightPinned) return leftPinned ? -1 : 1;

		const leftMru = mruIndex.get(left.id);
		const rightMru = mruIndex.get(right.id);
		const leftRank = leftMru ?? Number.MAX_SAFE_INTEGER;
		const rightRank = rightMru ?? Number.MAX_SAFE_INTEGER;
		if (leftRank !== rightRank) return leftRank - rightRank;

		return left.id.localeCompare(right.id);
	});
}

function isUiCommandId(commandId: InlineCommandId): commandId is UiCommandId {
	return getGlobalCommands().some((command) => command.id === commandId);
}

function hasActiveFile() {
	const state = useAppStore.getState();
	if (!state.activeFileId) return false;
	return state.files.some((file) => file.id === state.activeFileId);
}

function hasPlayerControls() {
	return Boolean(useAppStore.getState().playerControls);
}

function hasTemplateFiles() {
	return useAppStore.getState().templateFilePaths.length > 0;
}

function getActiveFilePath(): string | null {
	const state = useAppStore.getState();
	const activeFile = state.files.find((file) => file.id === state.activeFileId);
	return activeFile?.path ?? null;
}

export function getCommandAvailability(
	commandId: UiCommandId,
): UiCommandAvailability {
	const disabledCommandIds = useAppStore.getState().disabledCommandIds;
	if (disabledCommandIds.includes(commandId)) {
		return {
			enabled: false,
			reason: "Disabled in Settings > Commands.",
		};
	}

	if (
		commandId === "preview.export.midi" ||
		commandId === "preview.export.wav" ||
		commandId === "preview.export.gp7" ||
		commandId === "preview.print-preview.open"
	) {
		if (!hasActiveFile()) {
			return {
				enabled: false,
				reason: "No active score file.",
			};
		}
	}

	if (
		commandId === "playback.play" ||
		commandId === "playback.pause" ||
		commandId === "playback.stop" ||
		commandId === "playback.refresh" ||
		commandId === "playback.play-pause"
	) {
		if (!hasPlayerControls()) {
			return {
				enabled: false,
				reason: "Playback not ready. Open a score preview first.",
			};
		}
	}

	if (commandId === "template.new-from.open-picker" && !hasTemplateFiles()) {
		return {
			enabled: false,
			reason: "No templates yet. Mark at least one file as template.",
		};
	}

	if (
		commandId === "template.insert.open-picker" &&
		(!hasTemplateFiles() || !hasActiveFile())
	) {
		return {
			enabled: false,
			reason: !hasTemplateFiles()
				? "No templates yet. Mark at least one file as template."
				: "No active file.",
		};
	}

	if (commandId === "template.toggle-active-file" && !hasActiveFile()) {
		return {
			enabled: false,
			reason: "No active file.",
		};
	}

	if (commandId === "template.toggle-active-file") {
		const activeFilePath = getActiveFilePath();
		if (activeFilePath && !isTemplateCandidatePath(activeFilePath)) {
			return {
				enabled: false,
				reason: "Only .atex and .md files can be marked as templates.",
			};
		}
	}

	return { enabled: true };
}

export function getCommandsWithAvailability(): CommandWithAvailability[] {
	return sortByPinnedAndMru(
		getGlobalCommands().map((command) => ({
			...command,
			availability: getCommandAvailability(command.id),
		})),
	);
}

export function getInlineCommandsWithAvailability(): InlineCommandWithAvailability[] {
	return sortByPinnedAndMru(
		getInlineCommands().map((command) => ({
			...command,
			availability: isUiCommandId(command.id)
				? getCommandAvailability(command.id)
				: { enabled: true },
		})),
	);
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

export function getUiCommands() {
	return getGlobalCommands();
}

export function runUiCommand(commandId: UiCommandId): UiCommandRunResult {
	const warnings: string[] = [];
	const availability = getCommandAvailability(commandId);
	const success = (action: string): UiCommandRunResult => {
		useAppStore.getState().recordCommandUsage(commandId);
		return { ok: true, commandId, action, warnings };
	};

	if (!availability.enabled) {
		return {
			ok: false,
			commandId,
			action: "Command is disabled",
			warnings: availability.reason ? [availability.reason] : [],
		};
	}

	if (
		(
			[
				"layout.sidebar.open",
				"layout.sidebar.close",
				"layout.sidebar.toggle",
				"workspace.quick-switcher.open",
				"workspace.global-command-palette.open",
			] as UiShellCommandId[]
		).includes(commandId as UiShellCommandId)
	) {
		dispatchUiShellCommand(commandId as UiShellCommandId);
		return success(`Dispatch shell event: ${commandId}`);
	}

	if (commandId === "template.insert.open-picker") {
		dispatchUiShellCommand("template.insert-picker.open");
		return success("Dispatch shell event: template.insert-picker.open");
	}

	if (commandId === "template.new-from.open-picker") {
		dispatchUiShellCommand("template.create-picker.open");
		return success("Dispatch shell event: template.create-picker.open");
	}

	if (commandId === "template.toggle-active-file") {
		const activeFilePath = getActiveFilePath();
		if (!activeFilePath) {
			return {
				ok: false,
				commandId,
				action: "No active file",
				warnings: ["Open a file before toggling template flag."],
			};
		}

		useAppStore.getState().toggleFileTemplate(activeFilePath);
		return success(`Toggled template flag for: ${activeFilePath}`);
	}

	if (commandId === "open-quick-file") {
		dispatchUiShellCommand("workspace.quick-switcher.open");
		return success("Dispatch shell event: workspace.quick-switcher.open");
	}

	if (commandId === "open-editor-command-palette") {
		dispatchOpenInlineEditorCommand();
		useAppStore.getState().setWorkspaceMode("editor");
		return success("Open inline editor command bar and switch to editor mode");
	}

	const workspaceModes: Record<string, WorkspaceMode> = {
		"workspace.mode.editor": "editor",
		"workspace.mode.tutorial": "tutorial",
		"workspace.mode.settings": "settings",
		"workspace.mode.git": "git",
	};
	if (workspaceModes[commandId]) {
		const mode = workspaceModes[commandId];
		useAppStore.getState().setWorkspaceMode(mode);
		return success(`Set workspace mode: ${mode}`);
	}

	if (commandId === "workspace.mode.enjoy.toggle") {
		const state = useAppStore.getState();
		const nextMode = state.workspaceMode === "enjoy" ? "editor" : "enjoy";
		state.setWorkspaceMode(nextMode);
		return success(`Toggle enjoy mode to: ${nextMode}`);
	}

	if (commandId === "workspace.editor-inline-command.open") {
		dispatchOpenInlineEditorCommand();
		useAppStore.getState().setWorkspaceMode("editor");
		return success("Open inline editor command bar and switch to editor mode");
	}

	if (commandId.startsWith("settings.playback.")) {
		const action = runPlaybackSettingsToggleCommand(commandId);
		return success(action);
	}

	if (commandId.startsWith("preview.")) {
		dispatchPreviewCommand(commandId as PreviewCommandId);
		return success(`Dispatch preview command: ${commandId}`);
	}

	if (
		(
			[
				"insert-atdoc-block",
				"insert-atdoc-directive",
				"insert-atdoc-meta-preset",
			] as StaticEditorCommandId[]
		).includes(commandId as StaticEditorCommandId)
	) {
		dispatchEditorCommand(commandId as StaticEditorCommandId);
		useAppStore.getState().setWorkspaceMode("editor");
		return success(`Dispatch editor command: ${commandId}`);
	}

	if (commandId.startsWith("playback.")) {
		const state = useAppStore.getState();
		if (!state.playerControls) {
			warnings.push("No active player controls; command may be no-op now.");
		}
		const action = runPlaybackCommand(commandId);
		return success(action);
	}

	return { ok: false, commandId, action: "Unknown command", warnings };
}
