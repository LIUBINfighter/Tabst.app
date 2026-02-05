/**
 * AlphaTex 解析与 Beat 位置
 * AST/后备解析、行列与 getBarRanges，供选区/播放同步使用
 */

import * as alphaTab from "@coderline/alphatab";

/**
 * Position range in code
 */
export interface CodeRange {
	from: number;
	to: number;
	startLine: number;
	startColumn: number;
	endLine: number;
	endColumn: number;
}

/**
 * Beat position information in code
 */
export interface BeatCodePosition {
	barIndex: number;
	beatIndex: number;
	startOffset: number;
	endOffset: number;
	startLine: number;
	startColumn: number;
	endLine: number;
	endColumn: number;
}

/**
 * Parse result
 */
export interface ParseResult {
	beats: BeatCodePosition[];
	contentStart: number;
}

// ============================================================================
// AST-based parser (preferred)
// ============================================================================

export function parseBeatPositionsAST(text: string): ParseResult {
	const beats: BeatCodePosition[] = [];
	let contentStart = 0;

	try {
		const parser = new alphaTab.importer.alphaTex.AlphaTexParser(text);
		parser.mode = alphaTab.importer.alphaTex.AlphaTexParseMode.Full;
		const scoreNode = parser.read();

		if (!scoreNode || !scoreNode.bars) {
			return { beats, contentStart };
		}

		let barIndex = 0;

		for (const barNode of scoreNode.bars) {
			if (!barNode.beats || barNode.beats.length === 0) {
				continue;
			}

			if (contentStart === 0 && barNode.beats.length > 0) {
				const firstBeat = barNode.beats[0];
				if (firstBeat.start) {
					contentStart = firstBeat.start.offset;
				}
			}

			let beatIndex = 0;
			for (const beatNode of barNode.beats) {
				if (!beatNode.notes && !beatNode.rest) {
					continue;
				}

				let startOffset: number;
				let endOffset: number;

				if (beatNode.notes) {
					const notesNode = beatNode.notes;
					startOffset = notesNode.start?.offset ?? beatNode.start?.offset ?? 0;
					endOffset =
						notesNode.end?.offset ?? beatNode.end?.offset ?? startOffset;
				} else if (beatNode.rest) {
					startOffset =
						beatNode.rest.start?.offset ?? beatNode.start?.offset ?? 0;
					endOffset =
						beatNode.rest.end?.offset ?? beatNode.end?.offset ?? startOffset;
				} else {
					continue;
				}

				if (beatNode.durationDot?.end && beatNode.durationValue?.end) {
					endOffset = beatNode.durationValue.end.offset;
				}

				const textLength = text.length;
				if (startOffset >= textLength) continue;
				if (endOffset > textLength) endOffset = textLength;
				if (startOffset < 0 || endOffset <= startOffset) continue;

				const startLine =
					(beatNode.notes?.start?.line ?? beatNode.start?.line ?? 1) - 1;
				const startCol =
					(beatNode.notes?.start?.col ?? beatNode.start?.col ?? 1) - 1;
				const endLine = (beatNode.end?.line ?? startLine + 1) - 1;
				const endCol = (beatNode.end?.col ?? startCol + 1) - 1;

				beats.push({
					barIndex,
					beatIndex,
					startOffset,
					endOffset,
					startLine,
					startColumn: startCol,
					endLine,
					endColumn: endCol,
				});
				beatIndex++;
			}

			if (beatIndex > 0) {
				barIndex++;
			}
		}

		return { beats, contentStart };
	} catch (err) {
		console.warn("[parseBeatPositionsAST] Failed to parse AST:", err);
		return { beats: [], contentStart: 0 };
	}
}

// ============================================================================
// Fallback legacy parser
// ============================================================================

const METADATA_COMMANDS = [
	"\\title",
	"\\subtitle",
	"\\artist",
	"\\album",
	"\\words",
	"\\music",
	"\\copyright",
	"\\tempo",
	"\\instrument",
	"\\capo",
	"\\tuning",
	"\\staff",
	"\\ts",
	"\\ks",
	"\\clef",
];

function isNonBeatToken(token: string): boolean {
	const trimmed = token.trim();
	if (!trimmed) return true;
	if (/^\.(\d+\.?|\d*\{[^}]*\})$/.test(trimmed)) return true;
	if (/^:\d+/.test(trimmed)) {
		return /^:\d+\.?(\{[^}]*\})?$/.test(trimmed);
	}
	if (/^\{[^}]*\}$/.test(trimmed)) return true;
	return false;
}

function extractBeatContent(token: string): {
	content: string;
	prefixLength: number;
} {
	const trimmed = token.trim();
	const match = trimmed.match(/^(:\d+\.?(?:\{[^}]*\})?)/);
	if (match) {
		const prefix = match[1];
		const rest = trimmed.slice(prefix.length);
		if (rest.length > 0) {
			return { content: rest, prefixLength: prefix.length };
		}
	}
	return { content: trimmed, prefixLength: 0 };
}

export function offsetToLineCol(
	text: string,
	offset: number,
): { line: number; column: number } {
	let line = 0;
	let lastLineStart = 0;
	for (let i = 0; i < offset && i < text.length; i++) {
		if (text[i] === "\n") {
			line++;
			lastLineStart = i + 1;
		}
	}
	return { line, column: offset - lastLineStart };
}

export function lineColToOffset(
	text: string,
	line: number,
	column: number,
): number {
	const lines = text.split("\n");
	let offset = 0;
	for (let i = 0; i < line && i < lines.length; i++) {
		offset += lines[i].length + 1;
	}
	if (line < lines.length) {
		offset += Math.min(column, lines[line].length);
	}
	return offset;
}

function parseBeatPositionsLegacy(text: string): ParseResult {
	const beats: BeatCodePosition[] = [];
	let contentStart = 0;
	let foundDot = false;

	for (let i = 0; i < text.length; i++) {
		const char = text[i];
		if (char === "/" && text[i + 1] === "/") {
			while (i < text.length && text[i] !== "\n") i++;
			continue;
		}
		if (char === "/" && text[i + 1] === "*") {
			i += 2;
			while (i < text.length - 1 && !(text[i] === "*" && text[i + 1] === "/"))
				i++;
			i++;
			continue;
		}
		if (char === '"') {
			i++;
			while (i < text.length && text[i] !== '"') {
				if (text[i] === "\\" && i + 1 < text.length) i++;
				i++;
			}
			continue;
		}
		if (char === ".") {
			const prevChar = i > 0 ? text[i - 1] : " ";
			const nextChar = i + 1 < text.length ? text[i + 1] : " ";
			if (!/\d/.test(prevChar) && !/\d/.test(nextChar)) {
				contentStart = i + 1;
				foundDot = true;
				break;
			}
		}
	}

	if (!foundDot) {
		const lines = text.split("\n");
		let lineOffset = 0;
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			const trimmedLine = line.trim();
			if (!trimmedLine) {
				lineOffset += line.length + 1;
				continue;
			}
			if (trimmedLine.startsWith("//") || trimmedLine.startsWith("/*")) {
				lineOffset += line.length + 1;
				continue;
			}
			const isMetadata = METADATA_COMMANDS.some((cmd) =>
				trimmedLine.toLowerCase().startsWith(cmd.toLowerCase()),
			);
			if (isMetadata) {
				lineOffset += line.length + 1;
				continue;
			}
			const firstNonSpaceIndex = line.search(/\S/);
			contentStart =
				firstNonSpaceIndex >= 0 ? lineOffset + firstNonSpaceIndex : lineOffset;
			break;
		}
	}

	while (contentStart < text.length && /\s/.test(text[contentStart])) {
		contentStart++;
	}

	let barIndex = 0;
	let beatIndex = 0;
	let inString = false;
	let inBlockComment = false;
	let inLineComment = false;
	let inChord = false;
	let chordDepth = 0;
	let beatStartOffset = contentStart;
	let inBeatContent = false;

	for (let i = contentStart; i < text.length; i++) {
		const char = text[i];
		const nextChar = text[i + 1] || "";
		const prevChar = text[i - 1] || "";

		if (char === "\n") {
			inLineComment = false;
			continue;
		}
		if (!inString && !inLineComment && char === "/" && nextChar === "*") {
			inBlockComment = true;
			i++;
			continue;
		}
		if (inBlockComment) {
			if (char === "*" && nextChar === "/") {
				inBlockComment = false;
				i++;
			}
			continue;
		}
		if (!inString && char === "/" && nextChar === "/") {
			inLineComment = true;
			continue;
		}
		if (inLineComment) continue;
		if (char === '"' && prevChar !== "\\") {
			inString = !inString;
			if (!inBeatContent) {
				inBeatContent = true;
				beatStartOffset = i;
			}
			continue;
		}
		if (inString) continue;

		if (char === "(") {
			if (!inBeatContent) {
				inBeatContent = true;
				beatStartOffset = i;
			}
			inChord = true;
			chordDepth++;
			continue;
		}
		if (char === ")") {
			chordDepth--;
			if (chordDepth <= 0) {
				inChord = false;
				chordDepth = 0;
				let lookAhead = i + 1;
				if (lookAhead < text.length && text[lookAhead] === ".") {
					lookAhead++;
					while (lookAhead < text.length && /\d/.test(text[lookAhead])) {
						lookAhead++;
					}
					if (lookAhead > i + 2) {
						if (lookAhead < text.length && text[lookAhead] === ".") lookAhead++;
						if (lookAhead < text.length && text[lookAhead] === "{") {
							while (lookAhead < text.length && text[lookAhead] !== "}")
								lookAhead++;
							if (lookAhead < text.length) lookAhead++;
						}
						i = lookAhead - 1;
					}
				}
			}
			continue;
		}
		if (inChord) continue;

		if (char === "|") {
			if (inBeatContent && beatStartOffset < i) {
				let endOffset = i;
				while (endOffset > beatStartOffset && /\s/.test(text[endOffset - 1])) {
					endOffset--;
				}
				if (endOffset > beatStartOffset) {
					const content = text.slice(beatStartOffset, endOffset).trim();
					if (!isNonBeatToken(content)) {
						const { content: beatContent, prefixLength } =
							extractBeatContent(content);
						const adjustedStart = beatStartOffset + prefixLength;
						if (beatContent.length > 0 && adjustedStart < endOffset) {
							const startPos = offsetToLineCol(text, adjustedStart);
							const endPos = offsetToLineCol(text, endOffset);
							beats.push({
								barIndex,
								beatIndex,
								startOffset: adjustedStart,
								endOffset,
								startLine: startPos.line,
								startColumn: startPos.column,
								endLine: endPos.line,
								endColumn: endPos.column,
							});
							beatIndex++;
						}
					}
				}
			}
			barIndex++;
			beatIndex = 0;
			inBeatContent = false;
			let nextStart = i + 1;
			while (nextStart < text.length && /[ \t]/.test(text[nextStart]))
				nextStart++;
			if (text[nextStart] === "\n") {
				nextStart++;
				while (nextStart < text.length && /[ \t]/.test(text[nextStart]))
					nextStart++;
			}
			beatStartOffset = nextStart;
			continue;
		}

		if (/\s/.test(char)) {
			if (inBeatContent) {
				const content = text.slice(beatStartOffset, i).trim();
				if (content.length > 0 && !isNonBeatToken(content)) {
					let endOffset = i;
					while (
						endOffset > beatStartOffset &&
						/\s/.test(text[endOffset - 1])
					) {
						endOffset--;
					}
					const { content: beatContent, prefixLength } =
						extractBeatContent(content);
					const adjustedStart = beatStartOffset + prefixLength;
					if (beatContent.length > 0 && adjustedStart < endOffset) {
						const startPos = offsetToLineCol(text, adjustedStart);
						const endPos = offsetToLineCol(text, endOffset);
						beats.push({
							barIndex,
							beatIndex,
							startOffset: adjustedStart,
							endOffset,
							startLine: startPos.line,
							startColumn: startPos.column,
							endLine: endPos.line,
							endColumn: endPos.column,
						});
						beatIndex++;
					}
				}
				inBeatContent = false;
			}
			continue;
		}

		if (!inBeatContent) {
			inBeatContent = true;
			beatStartOffset = i;
		}
	}

	if (inBeatContent && beatStartOffset < text.length) {
		let endOffset = text.length;
		while (endOffset > beatStartOffset && /\s/.test(text[endOffset - 1])) {
			endOffset--;
		}
		if (endOffset > beatStartOffset) {
			const content = text.slice(beatStartOffset, endOffset).trim();
			if (!isNonBeatToken(content)) {
				const { content: beatContent, prefixLength } =
					extractBeatContent(content);
				const adjustedStart = beatStartOffset + prefixLength;
				if (beatContent.length > 0 && adjustedStart < endOffset) {
					const startPos = offsetToLineCol(text, adjustedStart);
					const endPos = offsetToLineCol(text, endOffset);
					beats.push({
						barIndex,
						beatIndex,
						startOffset: adjustedStart,
						endOffset,
						startLine: startPos.line,
						startColumn: startPos.column,
						endLine: endPos.line,
						endColumn: endPos.column,
					});
				}
			}
		}
	}

	return { beats, contentStart };
}

export function parseBeatPositions(text: string): ParseResult {
	const astResult = parseBeatPositionsAST(text);
	if (astResult.beats.length > 0) {
		return astResult;
	}
	return parseBeatPositionsLegacy(text);
}

/**
 * Get code ranges for all beats in a bar (for bar-level highlight in editor).
 */
export function getBarRanges(text: string, barIndex: number): CodeRange[] {
	const { beats } = parseBeatPositions(text);
	const barBeats = beats.filter((b) => b.barIndex === barIndex);
	return barBeats.map((beat) => ({
		from: beat.startOffset,
		to: beat.endOffset,
		startLine: beat.startLine,
		startColumn: beat.startColumn,
		endLine: beat.endLine,
		endColumn: beat.endColumn,
	}));
}
