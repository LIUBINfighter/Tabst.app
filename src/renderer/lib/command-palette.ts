export const EDITOR_OPEN_INLINE_COMMAND_EVENT =
	"tabst:editor-open-inline-command";

export function dispatchOpenInlineEditorCommand() {
	window.dispatchEvent(new CustomEvent(EDITOR_OPEN_INLINE_COMMAND_EVENT));
}
