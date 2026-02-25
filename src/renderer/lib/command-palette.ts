export type EditorCommandId =
	| "insert-atdoc-block"
	| "insert-atdoc-directive"
	| "insert-atdoc-meta-preset"
	| `insert-atdoc-key:${string}`;

export const ATDOC_INLINE_KEY_COMMAND_PREFIX = "insert-atdoc-key:";

export type GlobalCommandId =
	| "open-quick-file"
	| "open-editor-command-palette"
	| EditorCommandId;

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
