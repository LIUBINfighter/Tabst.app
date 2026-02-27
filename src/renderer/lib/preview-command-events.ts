export type PreviewCommandId =
	| "preview.export.midi"
	| "preview.export.wav"
	| "preview.export.gp7"
	| "preview.print-preview.open";

export const PREVIEW_COMMAND_EVENT = "tabst:preview-command";

export function dispatchPreviewCommand(commandId: PreviewCommandId) {
	window.dispatchEvent(
		new CustomEvent<PreviewCommandId>(PREVIEW_COMMAND_EVENT, {
			detail: commandId,
		}),
	);
}
