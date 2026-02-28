export type UiShellCommandId =
	| "layout.sidebar.open"
	| "layout.sidebar.close"
	| "layout.sidebar.toggle"
	| "workspace.quick-switcher.open"
	| "workspace.global-command-palette.open"
	| "template.insert-picker.open"
	| "template.create-picker.open";

export const UI_SHELL_COMMAND_EVENT = "tabst:ui-shell-command";

export function dispatchUiShellCommand(commandId: UiShellCommandId) {
	window.dispatchEvent(
		new CustomEvent<UiShellCommandId>(UI_SHELL_COMMAND_EVENT, {
			detail: commandId,
		}),
	);
}
