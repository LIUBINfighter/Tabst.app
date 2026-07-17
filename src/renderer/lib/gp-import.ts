import * as alphaTab from "@coderline/alphatab";

export const GP_EXTENSIONS = [".gp", ".gp3", ".gp4", ".gp5", ".gpx"];
export const MXL_EXTENSIONS = [".mxl"];
export const IMPORTABLE_SCORE_EXTENSIONS = [
	...GP_EXTENSIONS,
	...MXL_EXTENSIONS,
];

function hasExtension(
	filePath: string,
	extensions: readonly string[],
): boolean {
	const lower = filePath.toLowerCase();
	return extensions.some((ext) => lower.endsWith(ext));
}

export function isGpFilePath(filePath: string): boolean {
	return hasExtension(filePath, GP_EXTENSIONS);
}

export function isMxlFilePath(filePath: string): boolean {
	return hasExtension(filePath, MXL_EXTENSIONS);
}

export function isImportableScoreFilePath(filePath: string): boolean {
	return hasExtension(filePath, IMPORTABLE_SCORE_EXTENSIONS);
}

export function convertScoreBytesToAlphaTex(bytes: Uint8Array): string {
	const settings = new alphaTab.Settings();
	const score = alphaTab.importer.ScoreLoader.loadScoreFromBytes(
		bytes,
		settings,
	);
	const exporter = new alphaTab.exporter.AlphaTexExporter();
	return exporter.exportToString(score, settings);
}

export const convertGpBytesToAlphaTex = convertScoreBytesToAlphaTex;
