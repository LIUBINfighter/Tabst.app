import { describe, expect, it } from "vitest";
import {
	buildPrintDocumentTitle,
	buildPrintWindowUrl,
	isPrintWindowLocation,
	PRINT_WINDOW_QUERY_KEY,
	PRINT_WINDOW_STORAGE_KEY,
} from "./print-window";

describe("print-window helpers", () => {
	it("builds the PDF document title from the source file name", () => {
		expect(buildPrintDocumentTitle("Canon Rock.atex")).toBe("Canon Rock");
		expect(buildPrintDocumentTitle("arrangements/song.v2.atex")).toBe(
			"song.v2",
		);
		expect(buildPrintDocumentTitle("C:\\scores\\demo.gp5")).toBe("demo");
		expect(buildPrintDocumentTitle("Untitled")).toBe("Untitled");
	});

	it("builds a same-origin app url for the dedicated print window", () => {
		expect(
			buildPrintWindowUrl("https://tauri.localhost/index.html?foo=1#section"),
		).toBe(`https://tauri.localhost/index.html?${PRINT_WINDOW_QUERY_KEY}=1`);
	});

	it("detects the dedicated print window from search params", () => {
		expect(
			isPrintWindowLocation("https://tauri.localhost/?print-window=1"),
		).toBe(true);
		expect(isPrintWindowLocation("https://tauri.localhost/")).toBe(false);
	});

	it("uses a stable storage key for print payload handoff", () => {
		expect(PRINT_WINDOW_STORAGE_KEY).toBe("tabst:print-window:payload");
	});
});
