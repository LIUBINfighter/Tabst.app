/**
 * AlphaTex Selection Sync
 *
 * 实现乐谱选区与代码编辑器之间的双向同步。
 * 支持 Beat 级别的精确定位。
 *
 * 🆕 使用 alphaTab 内置的 AlphaTexParser 解析 AST，
 * 获取精确的源码位置信息，避免手写解析器的边界情况。
 *
 * @see docs/dev/SelectionAPI.md
 */

import {
	type Extension,
	RangeSetBuilder,
	StateEffect,
	StateField,
} from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView } from "@codemirror/view";
import * as alphaTab from "@coderline/alphatab";
import type {
	EditorCursorInfo,
	PlaybackBeatInfo,
	ScoreSelectionInfo,
} from "../store/appStore";

// alphaTab 内部类型别名（已移除未使用的别名）

/**
 * 代码中的位置范围
 */
export interface CodeRange {
	/** 起始位置 (字符偏移) */
	from: number;
	/** 结束位置 (字符偏移) */
	to: number;
	/** 起始行 (0-based) */
	startLine: number;
	/** 起始列 (0-based) */
	startColumn: number;
	/** 结束行 (0-based) */
	endLine: number;
	/** 结束列 (0-based) */
	endColumn: number;
}

/**
 * Beat 在代码中的位置信息
 */
export interface BeatCodePosition {
	/** 小节索引 (0-based) */
	barIndex: number;
	/** Beat 在小节内的索引 (0-based) */
	beatIndex: number;
	/** Beat 起始位置 (代码中的字符偏移) */
	startOffset: number;
	/** Beat 结束位置 (代码中的字符偏移) */
	endOffset: number;
	/** Beat 起始行 (0-based) */
	startLine: number;
	/** Beat 起始列 (0-based) */
	startColumn: number;
	/** Beat 结束行 (0-based) */
	endLine: number;
	/** Beat 结束列 (0-based) */
	endColumn: number;
}

/**
 * 解析结果
 */
export interface ParseResult {
	/** 所有 Beat 的位置信息 */
	beats: BeatCodePosition[];
	/** 内容起始偏移 (跳过元数据后) */
	contentStart: number;
}

// ============================================================================
// 🆕 基于 alphaTab AST 的解析器 (优先使用)
// ============================================================================

/**
 * 使用 alphaTab 内置的 AlphaTexParser 解析 AST
 * 获取精确的源码位置信息
 *
 * @param text AlphaTex 源代码
 * @returns 解析结果，包含所有 Beat 的位置信息
 */
export function parseBeatPositionsAST(text: string): ParseResult {
	const beats: BeatCodePosition[] = [];
	let contentStart = 0;

	try {
		// 使用 alphaTab 的完整 AST 解析模式
		const parser = new alphaTab.importer.alphaTex.AlphaTexParser(text);
		parser.mode = alphaTab.importer.alphaTex.AlphaTexParseMode.Full;
		const scoreNode = parser.read();

		if (!scoreNode || !scoreNode.bars) {
			console.debug("[parseBeatPositionsAST] No bars found in AST");
			return { beats, contentStart };
		}

		// 追踪当前小节索引（跳过纯元数据的 bar）
		let barIndex = 0;

		for (const barNode of scoreNode.bars) {
			// 检查是否有实际的 beat 内容
			if (!barNode.beats || barNode.beats.length === 0) {
				// 没有 beat，可能是纯元数据的 bar，继续但不增加 barIndex
				continue;
			}

			// 第一个有 beat 的 bar 确定 contentStart
			if (contentStart === 0 && barNode.beats.length > 0) {
				const firstBeat = barNode.beats[0];
				if (firstBeat.start) {
					contentStart = firstBeat.start.offset;
				}
			}

			// 遍历 bar 中的每个 beat
			let beatIndex = 0;
			for (const beatNode of barNode.beats) {
				// 只处理有实际内容的 beat（有 notes 或 rest）
				if (!beatNode.notes && !beatNode.rest) {
					// 这可能是一个纯时值修饰符，跳过
					continue;
				}

				// 获取 beat 的源码位置
				// 优先使用 notes 或 rest 的位置（更精确）
				let startOffset: number;
				let endOffset: number;

				if (beatNode.notes) {
					// 有音符列表
					const notesNode = beatNode.notes;
					startOffset = notesNode.start?.offset ?? beatNode.start?.offset ?? 0;
					endOffset =
						notesNode.end?.offset ?? beatNode.end?.offset ?? startOffset;
				} else if (beatNode.rest) {
					// 休止符
					startOffset =
						beatNode.rest.start?.offset ?? beatNode.start?.offset ?? 0;
					endOffset =
						beatNode.rest.end?.offset ?? beatNode.end?.offset ?? startOffset;
				} else {
					continue;
				}

				// 如果有时值后缀（如 .4），扩展范围到包含它
				if (beatNode.durationDot?.end && beatNode.durationValue?.end) {
					endOffset = beatNode.durationValue.end.offset;
				}

				// 🆕 关键修复：验证 offset 不超出文本长度
				const textLength = text.length;
				if (startOffset >= textLength) {
					console.debug(
						`[parseBeatPositionsAST] Skip beat: startOffset ${startOffset} >= textLength ${textLength}`,
					);
					continue;
				}
				if (endOffset > textLength) {
					// 截断到文本末尾
					endOffset = textLength;
				}

				// 验证位置有效性
				if (startOffset < 0 || endOffset <= startOffset) {
					continue;
				}

				// 计算行列位置（AST 的 line/col 是 1-based，我们需要 0-based）
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

			// 只有当这个 bar 有实际的 beat 时才增加 barIndex
			if (beatIndex > 0) {
				barIndex++;
			}
		}

		console.debug(
			`[parseBeatPositionsAST] Parsed ${beats.length} beats from AST`,
		);
		return { beats, contentStart };
	} catch (err) {
		console.warn(
			"[parseBeatPositionsAST] Failed to parse AST, falling back:",
			err,
		);
		// AST 解析失败，返回空结果，让调用者使用后备解析器
		return { beats: [], contentStart: 0 };
	}
}

/**
 * 解析 AlphaTex 代码，建立 Beat 到代码位置的精确映射
 *
 * 优先使用 alphaTab 内置 AST 解析器，如果失败则使用自定义解析器作为后备
 *
 * @param text AlphaTex 源代码
 * @returns 解析结果，包含所有 Beat 的位置信息
 */
export function parseBeatPositions(text: string): ParseResult {
	// 优先使用 AST 解析器
	const astResult = parseBeatPositionsAST(text);
	if (astResult.beats.length > 0) {
		return astResult;
	}

	// 使用后备的自定义解析器
	console.debug("[parseBeatPositions] Using legacy parser");
	return parseBeatPositionsLegacy(text);
}

// ============================================================================
// 后备的自定义解析器 (当 AST 解析失败时使用)
// ============================================================================

// 元数据命令列表
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

/**
 * 判断一个 token 是否是非 beat 的修饰符
 */
function isNonBeatToken(token: string): boolean {
	const trimmed = token.trim();

	if (!trimmed) return true;

	if (/^\.(\d+\.?|\d*\{[^}]*\})$/.test(trimmed)) {
		return true;
	}

	if (/^:\d+/.test(trimmed)) {
		const pureModifierPattern = /^:\d+\.?(\{[^}]*\})?$/;
		if (pureModifierPattern.test(trimmed)) {
			return true;
		}
		return false;
	}

	if (/^\{[^}]*\}$/.test(trimmed)) {
		return true;
	}

	return false;
}

/**
 * 从 token 中提取实际的 beat 内容（去除时值前缀）
 */
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
			return {
				content: rest,
				prefixLength: prefix.length,
			};
		}
	}

	return { content: trimmed, prefixLength: 0 };
}

/**
 * 辅助函数：根据字符偏移计算行和列
 */
function offsetToLineCol(
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

/**
 * 辅助函数：根据行和列计算字符偏移
 */
function lineColToOffset(text: string, line: number, column: number): number {
	const lines = text.split("\n");
	let offset = 0;

	for (let i = 0; i < line && i < lines.length; i++) {
		offset += lines[i].length + 1; // +1 for newline
	}

	if (line < lines.length) {
		offset += Math.min(column, lines[line].length);
	}

	return offset;
}

/**
 * 后备解析器：自定义的 AlphaTex 解析逻辑
 */
function parseBeatPositionsLegacy(text: string): ParseResult {
	const beats: BeatCodePosition[] = [];

	// 🆕 查找音符内容的起始位置：从 "." 开始
	// AlphaTex 格式中，"." 标记音符内容的开始，之前都是元数据
	let contentStart = 0;
	let foundDot = false;

	// 查找单独的 "." 作为内容起始标记
	for (let i = 0; i < text.length; i++) {
		const char = text[i];

		// 跳过注释
		if (char === "/" && text[i + 1] === "/") {
			// 行注释，跳到行尾
			while (i < text.length && text[i] !== "\n") {
				i++;
			}
			continue;
		}
		if (char === "/" && text[i + 1] === "*") {
			// 块注释，跳到 */
			i += 2;
			while (i < text.length - 1 && !(text[i] === "*" && text[i + 1] === "/")) {
				i++;
			}
			i++; // 跳过 /
			continue;
		}

		// 跳过字符串
		if (char === '"') {
			i++;
			while (i < text.length && text[i] !== '"') {
				if (text[i] === "\\" && i + 1 < text.length) {
					i++; // 跳过转义字符
				}
				i++;
			}
			continue;
		}

		// 🆕 查找单独的 "."（作为内容起始标记，不是小数点）
		// 条件：前后是空白或行首/行尾
		if (char === ".") {
			const prevChar = i > 0 ? text[i - 1] : " ";
			const nextChar = i + 1 < text.length ? text[i + 1] : " ";

			// 如果 "." 前面不是数字，后面也不是数字，则认为是内容起始标记
			const isPrevDigit = /\d/.test(prevChar);
			const isNextDigit = /\d/.test(nextChar);

			if (!isPrevDigit && !isNextDigit) {
				// 找到了内容起始标记，内容从 "." 之后开始
				contentStart = i + 1;
				foundDot = true;
				break;
			}
		}
	}

	// 如果没有找到 "."，使用旧的逻辑作为后备
	if (!foundDot) {
		const lines = text.split("\n");
		let lineOffset = 0;

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			const trimmedLine = line.trim();

			// 跳过空行
			if (!trimmedLine) {
				lineOffset += line.length + 1;
				continue;
			}

			// 跳过注释行
			if (trimmedLine.startsWith("//")) {
				lineOffset += line.length + 1;
				continue;
			}

			// 跳过块注释开始
			if (trimmedLine.startsWith("/*")) {
				lineOffset += line.length + 1;
				continue;
			}

			// 检查是否是元数据命令
			const isMetadata = METADATA_COMMANDS.some((cmd) =>
				trimmedLine.toLowerCase().startsWith(cmd.toLowerCase()),
			);

			if (isMetadata) {
				lineOffset += line.length + 1;
				continue;
			}

			// 找到第一个非元数据内容
			const firstNonSpaceIndex = line.search(/\S/);
			if (firstNonSpaceIndex >= 0) {
				contentStart = lineOffset + firstNonSpaceIndex;
			} else {
				contentStart = lineOffset;
			}
			break;
		}
	}

	// 跳过 contentStart 后的空白
	while (contentStart < text.length && /\s/.test(text[contentStart])) {
		contentStart++;
	}

	// 解析状态
	let barIndex = 0;
	let beatIndex = 0;
	let inString = false;
	let inBlockComment = false;
	let inLineComment = false;
	let inChord = false; // 🆕 是否在和弦括号内
	let chordDepth = 0; // 🆕 括号嵌套深度

	// 当前 beat 的起始位置
	let beatStartOffset = contentStart;
	// 是否在一个有效的 beat 内容中
	let inBeatContent = false;

	for (let i = contentStart; i < text.length; i++) {
		const char = text[i];
		const nextChar = text[i + 1] || "";
		const prevChar = text[i - 1] || "";

		// 处理换行 - 重置行注释状态
		if (char === "\n") {
			inLineComment = false;
			// 如果当前在 beat 内容中，换行不结束 beat（允许跨行）
			continue;
		}

		// 处理块注释
		if (!inString && !inLineComment && char === "/" && nextChar === "*") {
			inBlockComment = true;
			i++; // 跳过 '*'
			continue;
		}
		if (inBlockComment) {
			if (char === "*" && nextChar === "/") {
				inBlockComment = false;
				i++; // 跳过 '/'
			}
			continue;
		}

		// 处理行注释
		if (!inString && char === "/" && nextChar === "/") {
			inLineComment = true;
			continue;
		}
		if (inLineComment) {
			continue;
		}

		// 处理字符串
		if (char === '"' && prevChar !== "\\") {
			inString = !inString;
			if (!inBeatContent) {
				inBeatContent = true;
				beatStartOffset = i;
			}
			continue;
		}
		if (inString) {
			continue;
		}

		// 🆕 处理和弦括号 - 括号内的内容作为一个整体 beat
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
				// 🆕 检查后面是否紧跟时值后缀（如 .4, .8）
				// 格式：)后紧跟 "." + 数字
				let lookAhead = i + 1;
				if (lookAhead < text.length && text[lookAhead] === ".") {
					// 检查是否是时值后缀（.数字）
					lookAhead++;
					while (lookAhead < text.length && /\d/.test(text[lookAhead])) {
						lookAhead++;
					}
					// 如果读取到了数字，跳过这些字符（它们属于当前和弦）
					if (lookAhead > i + 2) {
						// 还可能有附点 .4. 或修饰符 .4{...}
						if (lookAhead < text.length && text[lookAhead] === ".") {
							lookAhead++; // 附点
						}
						if (lookAhead < text.length && text[lookAhead] === "{") {
							// 跳过花括号修饰符
							while (lookAhead < text.length && text[lookAhead] !== "}") {
								lookAhead++;
							}
							if (lookAhead < text.length) {
								lookAhead++; // 跳过 }
							}
						}
						i = lookAhead - 1; // -1 因为循环会 i++
					}
				}
			}
			continue;
		}

		// 🆕 如果在和弦内，空格不作为分隔符
		if (inChord) {
			continue;
		}

		// 检测小节线 '|'
		if (char === "|") {
			// 保存当前 beat（如果有内容）
			if (inBeatContent && beatStartOffset < i) {
				// 去除尾部空白
				let endOffset = i;
				while (endOffset > beatStartOffset && /\s/.test(text[endOffset - 1])) {
					endOffset--;
				}

				if (endOffset > beatStartOffset) {
					// 🆕 检查是否是时值修饰符（不是真正的 beat）
					const content = text.slice(beatStartOffset, endOffset).trim();
					if (!isNonBeatToken(content)) {
						// 🆕 提取实际的 beat 内容（去除时值前缀）
						const { content: beatContent, prefixLength } =
							extractBeatContent(content);
						const adjustedStart = beatStartOffset + prefixLength;

						// 如果提取后还有内容，才添加为 beat
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

			// 重置为下一个小节
			barIndex++;
			beatIndex = 0;
			inBeatContent = false;

			// 跳过 '|' 后的空白
			let nextStart = i + 1;
			while (nextStart < text.length && /[ \t]/.test(text[nextStart])) {
				nextStart++;
			}
			if (text[nextStart] === "\n") {
				nextStart++;
				while (nextStart < text.length && /[ \t]/.test(text[nextStart])) {
					nextStart++;
				}
			}
			beatStartOffset = nextStart;
			continue;
		}

		// 检测 beat 分隔符（空格，但不是字符串内的空格）
		if (/\s/.test(char)) {
			if (inBeatContent) {
				// 检查是否有实际内容（不只是空白）
				const content = text.slice(beatStartOffset, i).trim();
				if (content.length > 0) {
					// 🆕 检查是否是时值修饰符等非 beat token
					if (!isNonBeatToken(content)) {
						// 去除尾部空白
						let endOffset = i;
						while (
							endOffset > beatStartOffset &&
							/\s/.test(text[endOffset - 1])
						) {
							endOffset--;
						}

						// 🆕 提取实际的 beat 内容（去除时值前缀）
						const { content: beatContent, prefixLength } =
							extractBeatContent(content);
						const adjustedStart = beatStartOffset + prefixLength;

						// 如果提取后还有内容，才添加为 beat
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
				inBeatContent = false;
			}
			continue;
		}

		// 其他字符 - 开始或继续一个 beat
		if (!inBeatContent) {
			inBeatContent = true;
			beatStartOffset = i;
		}
	}

	// 处理最后一个 beat
	if (inBeatContent && beatStartOffset < text.length) {
		let endOffset = text.length;
		while (endOffset > beatStartOffset && /\s/.test(text[endOffset - 1])) {
			endOffset--;
		}

		if (endOffset > beatStartOffset) {
			// 🆕 检查是否是时值修饰符等非 beat token
			const content = text.slice(beatStartOffset, endOffset).trim();
			if (!isNonBeatToken(content)) {
				// 🆕 提取实际的 beat 内容（去除时值前缀）
				const { content: beatContent, prefixLength } =
					extractBeatContent(content);
				const adjustedStart = beatStartOffset + prefixLength;

				// 如果提取后还有内容，才添加为 beat
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

/**
 * 根据乐谱选区信息，计算对应的代码范围（Beat 级别精确定位）
 *
 * @param text AlphaTex 源代码
 * @param selection 乐谱选区信息
 * @returns 代码范围，如果无法映射则返回 null
 */
export function mapSelectionToCodeRange(
	text: string,
	selection: ScoreSelectionInfo,
): CodeRange | null {
	const { beats } = parseBeatPositions(text);

	if (beats.length === 0) {
		console.debug("[mapSelectionToCodeRange] No beats found");
		return null;
	}

	console.debug("[mapSelectionToCodeRange] Selection:", selection);
	console.debug("[mapSelectionToCodeRange] Available beats:", beats.length);

	// 查找起始 Beat
	let startBeat = beats.find(
		(b) =>
			b.barIndex === selection.startBarIndex &&
			b.beatIndex === selection.startBeatIndex,
	);

	// 如果找不到精确匹配，尝试只匹配小节
	if (!startBeat) {
		startBeat = beats.find((b) => b.barIndex === selection.startBarIndex);
	}

	// 如果还是找不到，使用最接近的
	if (!startBeat) {
		startBeat = beats.reduce((prev, curr) => {
			const prevDist =
				Math.abs(curr.barIndex - selection.startBarIndex) * 100 +
				Math.abs(curr.beatIndex - selection.startBeatIndex);
			const currDist =
				Math.abs(prev.barIndex - selection.startBarIndex) * 100 +
				Math.abs(prev.beatIndex - selection.startBeatIndex);
			return prevDist < currDist ? curr : prev;
		});
	}

	// 查找结束 Beat
	let endBeat = beats.find(
		(b) =>
			b.barIndex === selection.endBarIndex &&
			b.beatIndex === selection.endBeatIndex,
	);

	if (!endBeat) {
		endBeat = beats.find((b) => b.barIndex === selection.endBarIndex);
	}

	if (!endBeat) {
		endBeat = beats.reduce((prev, curr) => {
			const prevDist =
				Math.abs(curr.barIndex - selection.endBarIndex) * 100 +
				Math.abs(curr.beatIndex - selection.endBeatIndex);
			const currDist =
				Math.abs(prev.barIndex - selection.endBarIndex) * 100 +
				Math.abs(prev.beatIndex - selection.endBeatIndex);
			return prevDist < currDist ? curr : prev;
		});
	}

	if (!startBeat || !endBeat) {
		console.debug("[mapSelectionToCodeRange] Could not find beats");
		return null;
	}

	console.debug("[mapSelectionToCodeRange] Found beats:", {
		startBeat,
		endBeat,
	});

	// 🆕 验证范围有效性
	const from = startBeat.startOffset;
	const to = endBeat.endOffset;

	if (from < 0 || to < 0 || from >= to || to > text.length) {
		console.debug("[mapSelectionToCodeRange] Invalid range:", {
			from,
			to,
			textLength: text.length,
		});
		return null;
	}

	return {
		from,
		to,
		startLine: startBeat.startLine,
		startColumn: startBeat.startColumn,
		endLine: endBeat.endLine,
		endColumn: endBeat.endColumn,
	};
}

/**
 * 根据代码位置（行、列）查找对应的 Beat 信息
 * 用于编辑器 → 乐谱的反向同步
 *
 * @param text AlphaTex 源代码
 * @param line 行号 (0-based)
 * @param column 列号 (0-based)
 * @returns 对应的 Beat 位置信息，如果不在任何 beat 内则返回 null
 */
export function findBeatAtPosition(
	text: string,
	line: number,
	column: number,
): EditorCursorInfo | null {
	const { beats, contentStart } = parseBeatPositions(text);
	const offset = lineColToOffset(text, line, column);

	// 检查是否在内容区域之前
	if (offset < contentStart) {
		return { line, column, barIndex: -1, beatIndex: -1 };
	}

	// 查找包含该位置的 beat
	for (const beat of beats) {
		if (offset >= beat.startOffset && offset <= beat.endOffset) {
			return {
				line,
				column,
				barIndex: beat.barIndex,
				beatIndex: beat.beatIndex,
			};
		}
	}

	// 如果不在任何 beat 内，查找最近的 beat
	let closestBeat: BeatCodePosition | null = null;
	let minDistance = Infinity;

	for (const beat of beats) {
		// 计算到 beat 的距离
		let distance: number;
		if (offset < beat.startOffset) {
			distance = beat.startOffset - offset;
		} else if (offset > beat.endOffset) {
			distance = offset - beat.endOffset;
		} else {
			distance = 0;
		}

		if (distance < minDistance) {
			minDistance = distance;
			closestBeat = beat;
		}
	}

	if (closestBeat && minDistance < 50) {
		// 在 50 字符范围内认为是相关的
		return {
			line,
			column,
			barIndex: closestBeat.barIndex,
			beatIndex: closestBeat.beatIndex,
		};
	}

	return { line, column, barIndex: -1, beatIndex: -1 };
}

// ============================================================================
// CodeMirror 扩展部分
// ============================================================================

/**
 * Effect to update selection highlight in the editor
 */
export const setSelectionHighlightEffect =
	StateEffect.define<CodeRange | null>();

/**
 * 选区高亮装饰样式
 */
const selectionHighlightMark = Decoration.mark({
	class: "cm-score-selection-highlight",
});

/**
 * State field to manage selection highlight decorations
 */
export const selectionHighlightField = StateField.define<DecorationSet>({
	create() {
		return Decoration.none;
	},
	update(highlights, tr) {
		// 🆕 先处理 effect，如果有新的高亮设置，直接返回新值
		for (const e of tr.effects) {
			if (e.is(setSelectionHighlightEffect)) {
				if (!e.value) {
					return Decoration.none;
				}

				try {
					const range = e.value;
					const docLength = tr.state.doc.length;

					// 加强范围验证
					const from = Math.max(0, Math.min(range.from, docLength));
					const to = Math.max(0, Math.min(range.to, docLength));

					if (from >= to || from < 0) {
						return Decoration.none;
					}

					const builder = new RangeSetBuilder<Decoration>();
					builder.add(from, to, selectionHighlightMark);
					return builder.finish();
				} catch (err) {
					console.error(
						"[SelectionSync] Error building selection highlight:",
						err,
					);
					return Decoration.none;
				}
			}
		}

		// 如果文档发生变化，尝试映射旧的高亮位置
		if (tr.docChanged) {
			try {
				return highlights.map(tr.changes);
			} catch (err) {
				// 映射失败（文档变化太大），清除高亮
				console.debug(
					"[SelectionSync] Failed to map highlights, clearing",
					err,
				);
				return Decoration.none;
			}
		}

		return highlights;
	},
	provide: (f) => EditorView.decorations.from(f),
});

/**
 * 选区高亮的主题样式
 */
export const selectionHighlightTheme = EditorView.baseTheme({
	".cm-score-selection-highlight": {
		backgroundColor: "hsl(var(--primary) / 0.25)",
		borderRadius: "2px",
		boxShadow: "0 0 0 1px hsl(var(--primary) / 0.4)",
	},
});

// ============================================================================
// 播放所在小节高亮部分
// ============================================================================

/**
 * Effect to update playback bar highlight in the editor
 */
export const setPlaybackBarHighlightEffect = StateEffect.define<{
	ranges: CodeRange[];
} | null>();

/**
 * 播放所在小节高亮装饰样式 - 使用黄色调
 */
const playbackBarHighlightMark = Decoration.mark({
	class: "cm-playback-bar-highlight",
});

/**
 * State field to manage playback bar highlight decorations
 */
export const playbackBarHighlightField = StateField.define<DecorationSet>({
	create() {
		return Decoration.none;
	},
	update(highlights, tr) {
		// 处理 effect
		for (const e of tr.effects) {
			if (e.is(setPlaybackBarHighlightEffect)) {
				if (!e.value || e.value.ranges.length === 0) {
					return Decoration.none;
				}

				try {
					const docLength = tr.state.doc.length;
					const builder = new RangeSetBuilder<Decoration>();

					// 添加所有范围（按位置排序）
					const sortedRanges = [...e.value.ranges].sort(
						(a, b) => a.from - b.from,
					);

					for (const range of sortedRanges) {
						const from = Math.max(0, Math.min(range.from, docLength));
						const to = Math.max(0, Math.min(range.to, docLength));

						if (from < to) {
							builder.add(from, to, playbackBarHighlightMark);
						}
					}

					return builder.finish();
				} catch (err) {
					console.error(
						"[SelectionSync] Error building playback bar highlight:",
						err,
					);
					return Decoration.none;
				}
			}
		}

		// 如果文档发生变化，尝试映射旧的高亮位置
		if (tr.docChanged) {
			try {
				return highlights.map(tr.changes);
			} catch (err) {
				console.debug(
					"[SelectionSync] Failed to map playback bar highlights, clearing",
					err,
				);
				return Decoration.none;
			}
		}

		return highlights;
	},
	provide: (f) => EditorView.decorations.from(f),
});

/**
 * 播放所在小节高亮的主题样式 - 黄色背景
 */
export const playbackBarHighlightTheme = EditorView.baseTheme({
	".cm-playback-bar-highlight": {
		backgroundColor: "hsl(45 100% 60% / 0.25)", // 黄色
		borderRadius: "2px",
	},
});

/**
 * 获取指定小节的所有 beat 范围
 */
function getBarRanges(text: string, barIndex: number): CodeRange[] {
	const { beats } = parseBeatPositions(text);
	const barBeats = beats.filter((b) => b.barIndex === barIndex);

	if (barBeats.length === 0) {
		return [];
	}

	// 返回每个 beat 作为独立的范围
	return barBeats.map((beat) => ({
		from: beat.startOffset,
		to: beat.endOffset,
		startLine: beat.startLine,
		startColumn: beat.startColumn,
		endLine: beat.endLine,
		endColumn: beat.endColumn,
	}));
}

/**
 * 创建选区同步扩展
 *
 * @returns CodeMirror 扩展数组
 */
export function createSelectionSyncExtension(): Extension[] {
	return [selectionHighlightField, selectionHighlightTheme];
}

/**
 * 安全地 dispatch effect，避免在视图更新期间冲突
 */
function safeDispatch(
	view: EditorView,
	effect: StateEffect<CodeRange | null>,
): void {
	// 检查 view 是否有效
	if (!view || !view.dom || !document.contains(view.dom)) {
		return;
	}

	// 🆕 使用 setTimeout(0) 代替 requestAnimationFrame
	// requestAnimationFrame 会在下一帧绘制前执行，可能与滚动事件冲突
	// setTimeout(0) 会在当前事件循环结束后执行，更安全
	setTimeout(() => {
		// 再次检查
		if (!view || !view.dom || !document.contains(view.dom)) {
			return;
		}
		try {
			view.dispatch({ effects: effect });
		} catch (err) {
			console.error("[SelectionSync] Failed to dispatch:", err);
		}
	}, 0);
}

/**
 * 更新编辑器中的选区高亮
 *
 * @param view CodeMirror EditorView
 * @param text AlphaTex 源代码
 * @param selection 乐谱选区信息
 */
export function updateEditorSelectionHighlight(
	view: EditorView,
	text: string,
	selection: ScoreSelectionInfo | null,
): void {
	if (!selection) {
		safeDispatch(view, setSelectionHighlightEffect.of(null));
		return;
	}

	const codeRange = mapSelectionToCodeRange(text, selection);
	safeDispatch(view, setSelectionHighlightEffect.of(codeRange));
}

/**
 * 创建光标位置监听扩展
 * 当光标移动时，计算对应的 Beat 位置并更新 store
 *
 * @param onCursorChange 光标变化回调
 * @returns CodeMirror 扩展
 */
export function createCursorTrackingExtension(
	onCursorChange: (cursor: EditorCursorInfo | null) => void,
): Extension {
	let debounceTimer: number | null = null;

	return EditorView.updateListener.of((update) => {
		if (update.selectionSet || update.docChanged) {
			// 防抖处理，避免频繁更新
			if (debounceTimer) {
				clearTimeout(debounceTimer);
			}

			debounceTimer = window.setTimeout(() => {
				const { head } = update.state.selection.main;
				const line = update.state.doc.lineAt(head);
				const lineNumber = line.number - 1; // Convert to 0-based
				const column = head - line.from;

				const text = update.state.doc.toString();
				const beatInfo = findBeatAtPosition(text, lineNumber, column);

				onCursorChange(beatInfo);
				debounceTimer = null;
			}, 100);
		}
	});
}

// ============================================================================
// 播放进度高亮部分
// ============================================================================

/**
 * Effect to update playback highlight in the editor
 */
export const setPlaybackHighlightEffect =
	StateEffect.define<CodeRange | null>();

/**
 * 播放进度高亮装饰样式 - 使用不同于选区的颜色（绿色/青色调）
 */
const playbackHighlightMark = Decoration.mark({
	class: "cm-playback-highlight",
});

/**
 * State field to manage playback highlight decorations
 */
export const playbackHighlightField = StateField.define<DecorationSet>({
	create() {
		return Decoration.none;
	},
	update(highlights, tr) {
		// 🆕 先处理 effect，如果有新的高亮设置，直接返回新值
		for (const e of tr.effects) {
			if (e.is(setPlaybackHighlightEffect)) {
				if (!e.value) {
					return Decoration.none;
				}

				try {
					const range = e.value;
					const docLength = tr.state.doc.length;

					// 加强范围验证
					const from = Math.max(0, Math.min(range.from, docLength));
					const to = Math.max(0, Math.min(range.to, docLength));

					if (from >= to || from < 0) {
						return Decoration.none;
					}

					const builder = new RangeSetBuilder<Decoration>();
					builder.add(from, to, playbackHighlightMark);
					return builder.finish();
				} catch (err) {
					console.error(
						"[SelectionSync] Error building playback highlight:",
						err,
					);
					return Decoration.none;
				}
			}
		}

		// 如果文档发生变化，尝试映射旧的高亮位置
		if (tr.docChanged) {
			try {
				return highlights.map(tr.changes);
			} catch (err) {
				// 映射失败（文档变化太大），清除高亮
				console.debug(
					"[SelectionSync] Failed to map playback highlights, clearing",
					err,
				);
				return Decoration.none;
			}
		}

		return highlights;
	},
	provide: (f) => EditorView.decorations.from(f),
});

/**
 * 播放进度高亮的主题样式 - 使用绿色调，与选区高亮区分
 */
export const playbackHighlightTheme = EditorView.baseTheme({
	".cm-playback-highlight": {
		backgroundColor: "hsl(142 76% 36% / 0.3)",
		borderRadius: "2px",
		boxShadow: "0 0 0 1px hsl(142 76% 36% / 0.5)",
		// 添加动画效果
		transition: "background-color 0.1s ease-out",
	},
});

/**
 * 创建播放进度同步扩展
 * 包含：当前 beat 高亮（绿色）+ 当前小节高亮（黄色）
 *
 * @returns CodeMirror 扩展数组
 */
export function createPlaybackSyncExtension(): Extension[] {
	return [
		playbackHighlightField,
		playbackHighlightTheme,
		playbackBarHighlightField,
		playbackBarHighlightTheme,
	];
}

/**
 * 根据播放位置信息计算代码范围
 *
 * @param text AlphaTex 源代码
 * @param playback 播放位置信息
 * @returns 代码范围，如果无法映射则返回 null
 */
export function mapPlaybackToCodeRange(
	text: string,
	playback: PlaybackBeatInfo,
): CodeRange | null {
	const { beats } = parseBeatPositions(text);

	if (beats.length === 0) {
		return null;
	}

	// 查找对应的 Beat
	let targetBeat = beats.find(
		(b) =>
			b.barIndex === playback.barIndex && b.beatIndex === playback.beatIndex,
	);

	// 如果找不到精确匹配，尝试只匹配小节的第一个 beat
	if (!targetBeat) {
		targetBeat = beats.find((b) => b.barIndex === playback.barIndex);
	}

	if (!targetBeat) {
		return null;
	}

	return {
		from: targetBeat.startOffset,
		to: targetBeat.endOffset,
		startLine: targetBeat.startLine,
		startColumn: targetBeat.startColumn,
		endLine: targetBeat.endLine,
		endColumn: targetBeat.endColumn,
	};
}

/**
 * 更新编辑器中的播放进度高亮
 *
 * 播放中：显示绿色高亮（当前音符）
 * 未播放：显示黄色高亮（播放器光标所在小节）
 *
 * @param view CodeMirror EditorView
 * @param text AlphaTex 源代码
 * @param playback 正在播放的位置信息（播放时有值）
 * @param cursorPosition 播放器光标位置（暂停时也保留）
 * @param isPlaying 是否正在播放
 * @param autoScroll 是否自动滚动到高亮位置（默认 true）
 */
export function updateEditorPlaybackHighlight(
	view: EditorView,
	text: string,
	playback: PlaybackBeatInfo | null,
	cursorPosition: PlaybackBeatInfo | null,
	isPlaying: boolean,
	autoScroll = true,
): void {
	if (isPlaying && playback) {
		// 🎵 正在播放：显示绿色高亮（当前音符），清除黄色小节高亮
		const codeRange = mapPlaybackToCodeRange(text, playback);
		safeDispatch(view, setPlaybackHighlightEffect.of(codeRange));
		safeDispatchBarHighlight(view, null); // 播放时不显示黄色小节高亮

		// 自动滚动
		if (autoScroll && codeRange) {
			scrollToPlaybackHighlight(view, codeRange);
		}
	} else if (!isPlaying && cursorPosition) {
		// ⏸️ 未播放但有光标位置：显示黄色小节高亮，清除绿色高亮
		safeDispatch(view, setPlaybackHighlightEffect.of(null));
		const barRanges = getBarRanges(text, cursorPosition.barIndex);
		safeDispatchBarHighlight(
			view,
			barRanges.length > 0 ? { ranges: barRanges } : null,
		);

		// 🆕 自动滚动到黄色小节高亮位置（视窗 33% 位置）
		if (autoScroll && barRanges.length > 0) {
			scrollToBarHighlight(view, barRanges[0]);
		}
	} else {
		// 没有任何位置信息：清除所有高亮
		safeDispatch(view, setPlaybackHighlightEffect.of(null));
		safeDispatchBarHighlight(view, null);
	}
}

/**
 * 安全地 dispatch 小节高亮 effect
 */
function safeDispatchBarHighlight(
	view: EditorView,
	value: { ranges: CodeRange[] } | null,
): void {
	if (!view || !view.dom || !document.contains(view.dom)) {
		return;
	}

	setTimeout(() => {
		if (!view || !view.dom || !document.contains(view.dom)) {
			return;
		}
		try {
			view.dispatch({ effects: setPlaybackBarHighlightEffect.of(value) });
		} catch (err) {
			// ignore
			void err;
		}
	}, 0);
}

/**
 * 滚动编辑器使播放高亮可见
 * 策略：始终滚动，让高亮保持在视口顶部附近
 * 播放时频繁调用，保持跟随效果
 *
 * @param view CodeMirror EditorView
 * @param codeRange 高亮的代码范围
 */
function scrollToPlaybackHighlight(
	view: EditorView,
	codeRange: CodeRange,
): void {
	if (!view || !view.dom || !document.contains(view.dom)) {
		return;
	}

	setTimeout(() => {
		if (!view || !view.dom || !document.contains(view.dom)) {
			return;
		}

		try {
			const targetPos = codeRange.from;

			// 获取像素坐标来判断是否需要滚动
			const coords = view.coordsAtPos(targetPos);
			const scrollDOM = view.scrollDOM;
			const editorRect = scrollDOM.getBoundingClientRect();

			// 计算舒适区域（像素）：视口高度的 15% ~ 70%
			const topThreshold = editorRect.top + editorRect.height * 0.15;
			const bottomThreshold = editorRect.top + editorRect.height * 0.7;

			// 如果坐标获取失败（位置未渲染）或超出舒适区域，触发滚动
			const needsScroll =
				!coords || coords.top < topThreshold || coords.top > bottomThreshold;

			if (needsScroll) {
				view.dispatch({
					effects: EditorView.scrollIntoView(targetPos, {
						y: "start",
						yMargin: 50,
					}),
				});
			}
		} catch (err) {
			console.error(
				"[SelectionSync] Failed to scroll to playback highlight:",
				err,
			);
		}
	}, 0);
}

/**
 * 滚动编辑器使小节高亮可见（滚动到视窗 33% 位置）
 * 策略：当高亮不在舒适区域时滚动
 *
 * @param view CodeMirror EditorView
 * @param codeRange 高亮的代码范围
 */
function scrollToBarHighlight(view: EditorView, codeRange: CodeRange): void {
	if (!view || !view.dom || !document.contains(view.dom)) {
		return;
	}

	setTimeout(() => {
		if (!view || !view.dom || !document.contains(view.dom)) {
			return;
		}

		try {
			const targetPos = codeRange.from;

			// 获取像素坐标来判断是否需要滚动
			const coords = view.coordsAtPos(targetPos);
			const scrollDOM = view.scrollDOM;
			const editorRect = scrollDOM.getBoundingClientRect();

			// 计算舒适区域（像素）：视口高度的 20% ~ 80%
			const topThreshold = editorRect.top + editorRect.height * 0.2;
			const bottomThreshold = editorRect.top + editorRect.height * 0.8;

			// 如果坐标获取失败（位置未渲染）或超出舒适区域，触发滚动
			const needsScroll =
				!coords || coords.top < topThreshold || coords.top > bottomThreshold;

			if (needsScroll) {
				// 滚动到 33% 位置
				const viewportHeight = editorRect.height;
				const targetMargin = Math.floor(viewportHeight * 0.33);

				view.dispatch({
					effects: EditorView.scrollIntoView(targetPos, {
						y: "start",
						yMargin: targetMargin,
					}),
				});
			}
		} catch (err) {
			console.error("[SelectionSync] Failed to scroll to bar highlight:", err);
		}
	}, 0);
}
