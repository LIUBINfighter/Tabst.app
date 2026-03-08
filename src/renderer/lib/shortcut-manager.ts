import { useAppStore } from "../store/appStore";
import { handleAppZoomShortcut } from "./app-zoom";
import {
	findCommandByShortcut,
	getEffectiveCommandShortcuts,
	getShortcutFromKeyboardEvent,
	isEditableTarget,
} from "./shortcut-utils";
import { runUiCommand } from "./ui-command-registry";

export function runShortcutEvent(event: KeyboardEvent): boolean {
	if (event.defaultPrevented || event.isComposing || event.repeat) return false;
	if (handleAppZoomShortcut(event)) return true;
	if (isEditableTarget(event.target)) return false;

	const shortcut = getShortcutFromKeyboardEvent(event);
	if (!shortcut) return false;

	const state = useAppStore.getState();
	const effectiveShortcuts = getEffectiveCommandShortcuts(
		state.commandShortcuts,
	);
	const commandId = findCommandByShortcut(shortcut, effectiveShortcuts);
	if (!commandId) return false;

	const result = runUiCommand(commandId);
	if (!result.ok) return false;

	event.preventDefault();
	return true;
}

export function bindGlobalShortcutListener(): () => void {
	const handler = (event: KeyboardEvent) => {
		runShortcutEvent(event);
	};

	window.addEventListener("keydown", handler);
	return () => window.removeEventListener("keydown", handler);
}
