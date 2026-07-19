export interface PreviewTracksPanelLayoutOptions {
	isImportedScoreFile: boolean;
	enjoyMode: boolean;
}

export function shouldMountPreviewTracksPanel({
	isImportedScoreFile,
	enjoyMode,
}: PreviewTracksPanelLayoutOptions): boolean {
	return isImportedScoreFile || enjoyMode;
}
