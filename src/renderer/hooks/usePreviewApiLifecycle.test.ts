import { describe, expect, it } from "vitest";
import { shouldSchedulePreviewReinit } from "./preview-api-lifecycle";

describe("shouldSchedulePreviewReinit", () => {
	it("does not schedule a reinit on first mount before any print-preview session", () => {
		expect(
			shouldSchedulePreviewReinit({
				showPrintPreview: false,
				hadPrintPreviewOpen: false,
				hasApi: false,
			}),
		).toBe(false);
	});

	it("does not schedule while print preview is open", () => {
		expect(
			shouldSchedulePreviewReinit({
				showPrintPreview: true,
				hadPrintPreviewOpen: true,
				hasApi: false,
			}),
		).toBe(false);
	});

	it("schedules a reinit only after closing print preview with no live api", () => {
		expect(
			shouldSchedulePreviewReinit({
				showPrintPreview: false,
				hadPrintPreviewOpen: true,
				hasApi: false,
			}),
		).toBe(true);
	});

	it("does not schedule after closing print preview if the api is already back", () => {
		expect(
			shouldSchedulePreviewReinit({
				showPrintPreview: false,
				hadPrintPreviewOpen: true,
				hasApi: true,
			}),
		).toBe(false);
	});
});
