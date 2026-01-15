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
import type { EditorCursorInfo, ScoreSelectionInfo } from "../store/appStore";

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
	const lines = text.split("\n");

	// 查找音符内容的起始位置（跳过元数据）
	let contentStart = 0;
	let foundContent = false;
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
			foundContent = true;
		} else {
			contentStart = lineOffset;
			foundContent = true;
		}
		break;
	}

	if (!foundContent) {
		return { beats, contentStart: 0 };
	}

	// 解析状态
	let barIndex = 0;
	let beatIndex = 0;
	let inString = false;
	let inBlockComment = false;
	let inLineComment = false;

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
					const startPos = offsetToLineCol(text, beatStartOffset);
					const endPos = offsetToLineCol(text, endOffset);

					beats.push({
						barIndex,
						beatIndex,
						startOffset: beatStartOffset,
						endOffset,
						startLine: startPos.line,
						startColumn: startPos.column,
						endLine: endPos.line,
						endColumn: endPos.column,
					});
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
					// 去除尾部空白
					let endOffset = i;
					while (
						endOffset > beatStartOffset &&
						/\s/.test(text[endOffset - 1])
					) {
						endOffset--;
					}

					const startPos = offsetToLineCol(text, beatStartOffset);
					const endPos = offsetToLineCol(text, endOffset);

					beats.push({
						barIndex,
						beatIndex,
						startOffset: beatStartOffset,
						endOffset,
						startLine: startPos.line,
						startColumn: startPos.column,
						endLine: endPos.line,
						endColumn: endPos.column,
					});

					beatIndex++;
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
			const startPos = offsetToLineCol(text, beatStartOffset);
			const endPos = offsetToLineCol(text, endOffset);

			beats.push({
				barIndex,
				beatIndex,
				startOffset: beatStartOffset,
				endOffset,
				startLine: startPos.line,
				startColumn: startPos.column,
				endLine: endPos.line,
				endColumn: endPos.column,
			});
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

	return {
		from: startBeat.startOffset,
		to: endBeat.endOffset,
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
		highlights = highlights.map(tr.changes);

		for (const e of tr.effects) {
			if (e.is(setSelectionHighlightEffect)) {
				if (!e.value) {
					return Decoration.none;
				}

				const range = e.value;
				const builder = new RangeSetBuilder<Decoration>();

				try {
					const from = range.from;
					const to = range.to;

					if (from < to && from >= 0 && to <= tr.state.doc.length) {
						builder.add(from, to, selectionHighlightMark);
					}
				} catch (err) {
					console.error(
						"[SelectionSync] Failed to calculate highlight range:",
						err,
					);
				}

				return builder.finish();
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

/**
 * 创建选区同步扩展
 *
 * @returns CodeMirror 扩展数组
 */
export function createSelectionSyncExtension(): Extension[] {
	return [selectionHighlightField, selectionHighlightTheme];
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
		view.dispatch({
			effects: setSelectionHighlightEffect.of(null),
		});
		return;
	}

	const codeRange = mapSelectionToCodeRange(text, selection);
	view.dispatch({
		effects: setSelectionHighlightEffect.of(codeRange),
	});
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
