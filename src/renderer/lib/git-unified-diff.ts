export type UnifiedDiffLineKind =
	| "header"
	| "hunk-header"
	| "context"
	| "add"
	| "remove"
	| "meta";

export interface UnifiedDiffLine {
	index: number;
	text: string;
	kind: UnifiedDiffLineKind;
	hunkIndex: number | null;
	oldLine: number | null;
	newLine: number | null;
	oldCursor: number | null;
	newCursor: number | null;
}

export interface UnifiedDiffHunk {
	index: number;
	headerLineIndex: number;
	bodyStartLineIndex: number;
	bodyEndLineIndex: number;
	oldStart: number;
	oldCount: number;
	newStart: number;
	newCount: number;
}

export interface ParsedUnifiedDiff {
	rawLines: string[];
	headerLines: string[];
	lines: UnifiedDiffLine[];
	hunks: UnifiedDiffHunk[];
}

const HUNK_HEADER_REGEX = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

function normalizePatchLines(patch: string): string[] {
	const normalized = patch.replace(/\r\n/g, "\n");
	if (normalized.length === 0) return [];
	if (normalized.endsWith("\n")) {
		const trimmed = normalized.slice(0, -1);
		return trimmed.length === 0 ? [] : trimmed.split("\n");
	}
	return normalized.split("\n");
}

export function parseUnifiedDiff(patch: string): ParsedUnifiedDiff | null {
	const rawLines = normalizePatchLines(patch);
	if (rawLines.length === 0) return null;

	const lines: UnifiedDiffLine[] = [];
	const hunks: UnifiedDiffHunk[] = [];

	let currentHunkIndex: number | null = null;
	let oldCursor = 0;
	let newCursor = 0;

	for (let i = 0; i < rawLines.length; i += 1) {
		const text = rawLines[i];
		const hunkMatch = text.match(HUNK_HEADER_REGEX);

		if (hunkMatch) {
			const oldStart = Number.parseInt(hunkMatch[1], 10);
			const oldCount = Number.parseInt(hunkMatch[2] ?? "1", 10);
			const newStart = Number.parseInt(hunkMatch[3], 10);
			const newCount = Number.parseInt(hunkMatch[4] ?? "1", 10);

			const hunk: UnifiedDiffHunk = {
				index: hunks.length,
				headerLineIndex: i,
				bodyStartLineIndex: i + 1,
				bodyEndLineIndex: i,
				oldStart,
				oldCount,
				newStart,
				newCount,
			};
			hunks.push(hunk);
			currentHunkIndex = hunk.index;
			oldCursor = oldStart;
			newCursor = newStart;

			lines.push({
				index: i,
				text,
				kind: "hunk-header",
				hunkIndex: currentHunkIndex,
				oldLine: null,
				newLine: null,
				oldCursor,
				newCursor,
			});
			continue;
		}

		if (currentHunkIndex === null) {
			lines.push({
				index: i,
				text,
				kind: "header",
				hunkIndex: null,
				oldLine: null,
				newLine: null,
				oldCursor: null,
				newCursor: null,
			});
			continue;
		}

		const oldBefore = oldCursor;
		const newBefore = newCursor;
		let kind: UnifiedDiffLineKind = "meta";
		let oldLine: number | null = null;
		let newLine: number | null = null;

		if (text.startsWith("+") && !text.startsWith("+++")) {
			kind = "add";
			newLine = newCursor;
			newCursor += 1;
		} else if (text.startsWith("-") && !text.startsWith("---")) {
			kind = "remove";
			oldLine = oldCursor;
			oldCursor += 1;
		} else if (text.startsWith(" ")) {
			kind = "context";
			oldLine = oldCursor;
			newLine = newCursor;
			oldCursor += 1;
			newCursor += 1;
		}

		hunks[currentHunkIndex].bodyEndLineIndex = i;

		lines.push({
			index: i,
			text,
			kind,
			hunkIndex: currentHunkIndex,
			oldLine,
			newLine,
			oldCursor: oldBefore,
			newCursor: newBefore,
		});
	}

	const firstHunkHeaderIndex = hunks[0]?.headerLineIndex;
	const headerLines =
		typeof firstHunkHeaderIndex === "number"
			? rawLines.slice(0, firstHunkHeaderIndex)
			: [...rawLines];

	return {
		rawLines,
		headerLines,
		lines,
		hunks,
	};
}

export function findHunkIndexForLine(
	parsed: ParsedUnifiedDiff,
	lineIndex: number,
): number | null {
	if (lineIndex < 0 || lineIndex >= parsed.lines.length) return null;
	const line = parsed.lines[lineIndex];
	if (line.hunkIndex === null) return null;
	return line.hunkIndex;
}

export function buildPatchForHunk(
	parsed: ParsedUnifiedDiff,
	hunkIndex: number,
): string | null {
	const hunk = parsed.hunks[hunkIndex];
	if (!hunk) return null;

	const patchLines = [
		...parsed.headerLines,
		...parsed.rawLines.slice(hunk.headerLineIndex, hunk.bodyEndLineIndex + 1),
	];
	if (patchLines.length === 0) return null;
	return `${patchLines.join("\n")}\n`;
}
