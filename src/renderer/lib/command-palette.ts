import type { EditorCommandId } from "./command-registry";

export const EDITOR_COMMAND_EVENT = "tabst:editor-command";
export const EDITOR_OPEN_INLINE_COMMAND_EVENT =
	"tabst:editor-open-inline-command";

export function dispatchEditorCommand(commandId: EditorCommandId) {
	window.dispatchEvent(
		new CustomEvent<EditorCommandId>(EDITOR_COMMAND_EVENT, {
			detail: commandId,
		}),
	);
}

export function dispatchOpenInlineEditorCommand() {
	window.dispatchEvent(new CustomEvent(EDITOR_OPEN_INLINE_COMMAND_EVENT));
}
