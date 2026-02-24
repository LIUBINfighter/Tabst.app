import * as alphaTab from "@coderline/alphatab";

export const GP_EXTENSIONS = [".gp", ".gp3", ".gp4", ".gp5", ".gpx"];

export function isGpFilePath(filePath: string): boolean {
	const lower = filePath.toLowerCase();
	return GP_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export function convertGpBytesToAlphaTex(bytes: Uint8Array): string {
	const settings = new alphaTab.Settings();
	const score = alphaTab.importer.ScoreLoader.loadScoreFromBytes(
		bytes,
		settings,
	);
	const exporter = new alphaTab.exporter.AlphaTexExporter();
	return exporter.exportToString(score, settings);
}
