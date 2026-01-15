/**
 * AlphaTex Selection Sync
 *
 * 实现乐谱选区与代码编辑器之间的双向同步。
 * 支持 Beat 级别的精确定位。
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
import type {
	EditorCursorInfo,
	PlaybackBeatInfo,
	ScoreSelectionInfo,
} from "../store/appStore";

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
 * 🆕 判断一个 token 是否是非 beat 的修饰符
 * 这些 token 不应该被计入 beat 索引
 *
 * 包括：
 * - 时值修饰符：:1, :2, :4, :8, :16, :32, :64 等
 * - 附点：:4. :8. 等（带附点的时值）
 * - 三连音等：:4{tu 3} 等
 * - 力度标记：{dy ppp}, {dy fff} 等（以 { 开头）
 * - 效果标记：{g}, {h}, {p} 等
 *
 * 注意：如果时值修饰符后面紧跟音符（如 :8(3.2 0.3)），则不是非 beat token
 */
function isNonBeatToken(token: string): boolean {
	const trimmed = token.trim();

	// 空字符串不是 beat
	if (!trimmed) return true;

	// 时值修饰符：以 : 开头，后面是数字
	// 但如果后面还有音符内容（数字、括号等），则不是纯时值修饰符
	if (/^:\d+/.test(trimmed)) {
		// 提取时值部分后检查是否还有其他内容
		// :8 → 纯时值，跳过
		// :8. → 带附点的时值，跳过
		// :8{tu 3} → 三连音修饰，跳过
		// :8(3.2 0.3) → 时值+和弦，不跳过！
		// :83.2 → 时值+音符，不跳过！

		// 匹配纯时值修饰符的完整模式
		// :数字 + 可选的附点 + 可选的花括号修饰
		const pureModifierPattern = /^:\d+\.?(\{[^}]*\})?$/;
		if (pureModifierPattern.test(trimmed)) {
			return true;
		}
		// 否则，这个 token 包含实际音符，不跳过
		return false;
	}

	// 单独的修饰符（以 { 开头的效果/力度等）
	// 例如：{dy fff}, {g}, {h}
	if (/^\{[^}]*\}$/.test(trimmed)) {
		return true;
	}

	// 休止符标记 r 后面跟时值不算（r.4 是休止符，应该计入）
	// 但单独的 r 也是一个 beat

	return false;
}

/**
 * 🆕 从 token 中提取实际的 beat 内容（去除时值前缀）
 * 例如：:8(3.2 0.3) → (3.2 0.3)
 *       :83.2 → 3.2
 *       3.2 → 3.2
 */
function extractBeatContent(token: string): {
	content: string;
	prefixLength: number;
} {
	const trimmed = token.trim();

	// 检查是否以时值修饰符开头
	const match = trimmed.match(/^(:\d+\.?(?:\{[^}]*\})?)/);
	if (match) {
		const prefix = match[1];
		const rest = trimmed.slice(prefix.length);
		// 如果时值后面还有内容，返回去除前缀后的内容
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
 * 解析 AlphaTex 代码，建立 Beat 到代码位置的精确映射
 *
 * @param text AlphaTex 源代码
 * @returns 解析结果，包含所有 Beat 的位置信息
 */
export function parseBeatPositions(text: string): ParseResult {
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
		try {
			highlights = highlights.map(tr.changes);

			for (const e of tr.effects) {
				if (e.is(setSelectionHighlightEffect)) {
					if (!e.value) {
						return Decoration.none;
					}

					const range = e.value;
					const docLength = tr.state.doc.length;

					// 🆕 加强范围验证
					const from = Math.max(0, Math.min(range.from, docLength));
					const to = Math.max(0, Math.min(range.to, docLength));

					if (from >= to || from < 0 || to > docLength) {
						console.debug("[SelectionSync] Invalid selection range, skipping");
						return Decoration.none;
					}

					const builder = new RangeSetBuilder<Decoration>();
					builder.add(from, to, selectionHighlightMark);
					return builder.finish();
				}
			}

			return highlights;
		} catch (err) {
			console.error(
				"[SelectionSync] Error in selectionHighlightField update:",
				err,
			);
			return Decoration.none;
		}
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

	// 使用 requestAnimationFrame 避免在滚动等操作期间直接 dispatch
	requestAnimationFrame(() => {
		// 再次检查
		if (!view || !view.dom || !document.contains(view.dom)) {
			return;
		}
		try {
			view.dispatch({ effects: effect });
		} catch (err) {
			console.error("[SelectionSync] Failed to dispatch:", err);
		}
	});
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
		try {
			highlights = highlights.map(tr.changes);

			for (const e of tr.effects) {
				if (e.is(setPlaybackHighlightEffect)) {
					if (!e.value) {
						return Decoration.none;
					}

					const range = e.value;
					const docLength = tr.state.doc.length;

					// 🆕 加强范围验证
					const from = Math.max(0, Math.min(range.from, docLength));
					const to = Math.max(0, Math.min(range.to, docLength));

					if (from >= to || from < 0 || to > docLength) {
						console.debug("[SelectionSync] Invalid playback range, skipping");
						return Decoration.none;
					}

					const builder = new RangeSetBuilder<Decoration>();
					builder.add(from, to, playbackHighlightMark);
					return builder.finish();
				}
			}

			return highlights;
		} catch (err) {
			console.error(
				"[SelectionSync] Error in playbackHighlightField update:",
				err,
			);
			return Decoration.none;
		}
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
 *
 * @returns CodeMirror 扩展数组
 */
export function createPlaybackSyncExtension(): Extension[] {
	return [playbackHighlightField, playbackHighlightTheme];
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
 * @param view CodeMirror EditorView
 * @param text AlphaTex 源代码
 * @param playback 播放位置信息
 */
export function updateEditorPlaybackHighlight(
	view: EditorView,
	text: string,
	playback: PlaybackBeatInfo | null,
): void {
	if (!playback) {
		safeDispatch(view, setPlaybackHighlightEffect.of(null));
		return;
	}

	const codeRange = mapPlaybackToCodeRange(text, playback);
	safeDispatch(view, setPlaybackHighlightEffect.of(codeRange));
}
