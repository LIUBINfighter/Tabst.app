import * as alphaTab from "@coderline/alphatab";
import type { DiagnosticError, OmrRawResult, OmrResult } from "../types/ai";

export function postProcessAlphaTex(raw: string): string {
	return raw
		.replace(/```alphatex\n?/g, "")
		.replace(/```\n?/g, "")
		.trim();
}

export function validateAlphaTex(rawResult: OmrRawResult): OmrResult {
	const alphaTex = postProcessAlphaTex(rawResult.alphaTex);
	const diagnosticErrors: DiagnosticError[] = [];

	if (!alphaTex) {
		diagnosticErrors.push({
			line: 1,
			column: 1,
			message: "Recognition returned empty alphaTex",
			severity: "error",
		});
	} else {
		try {
			const parser = new alphaTab.importer.alphaTex.AlphaTexParser(alphaTex);
			parser.mode = alphaTab.importer.alphaTex.AlphaTexParseMode.Full;
			parser.read();
		} catch (error) {
			diagnosticErrors.push({
				line: 1,
				column: 1,
				message:
					error instanceof Error
						? error.message
						: "alphaTex parser rejected the recognition result",
				severity: "error",
			});
		}
	}

	return {
		...rawResult,
		alphaTex,
		diagnosticErrors,
		isValidAlphaTex: diagnosticErrors.length === 0,
	};
}
