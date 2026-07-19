export const PRINT_WINDOW_QUERY_KEY = "print-window";
export const PRINT_WINDOW_STORAGE_KEY = "tabst:print-window:payload";

export interface PrintWindowPayload {
	fileName: string;
	printFontName: string;
	printFontUrl: string;
	contentWidthPx: number;
	contentHeightPx: number;
	marginMm: number;
	pageWidthMm: number;
	pageHeightMm: number;
	pagesHtml: string;
}

export function buildPrintDocumentTitle(fileName: string): string {
	const normalizedFileName = fileName.trim().replace(/\\/g, "/");
	const baseName = normalizedFileName.split("/").pop()?.trim() ?? "";
	if (!baseName) return "Tabst";

	const extensionIndex = baseName.lastIndexOf(".");
	if (extensionIndex <= 0) return baseName;

	return baseName.slice(0, extensionIndex).trim() || baseName;
}

export function buildPrintWindowUrl(currentHref: string): string {
	const url = new URL(currentHref);
	url.search = "";
	url.hash = "";
	url.searchParams.set(PRINT_WINDOW_QUERY_KEY, "1");
	return url.toString();
}

export function isPrintWindowLocation(href: string): boolean {
	const url = new URL(href);
	return url.searchParams.get(PRINT_WINDOW_QUERY_KEY) === "1";
}

export function writePrintWindowPayload(payload: PrintWindowPayload): void {
	window.localStorage.setItem(
		PRINT_WINDOW_STORAGE_KEY,
		JSON.stringify(payload),
	);
}

export function readPrintWindowPayload(): PrintWindowPayload | null {
	const raw = window.localStorage.getItem(PRINT_WINDOW_STORAGE_KEY);
	if (!raw) return null;
	try {
		return JSON.parse(raw) as PrintWindowPayload;
	} catch {
		return null;
	}
}
