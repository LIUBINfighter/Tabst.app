interface ShouldSchedulePreviewReinitParams {
	showPrintPreview: boolean;
	hadPrintPreviewOpen: boolean;
	hasApi: boolean;
}

export function shouldSchedulePreviewReinit({
	showPrintPreview,
	hadPrintPreviewOpen,
	hasApi,
}: ShouldSchedulePreviewReinitParams): boolean {
	if (showPrintPreview) return false;
	if (!hadPrintPreviewOpen) return false;
	return !hasApi;
}
