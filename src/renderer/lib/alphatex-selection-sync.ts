/**
 * AlphaTex Selection Sync
 *
 * 实现乐谱选区与代码编辑器之间的双向同步。
 * 使用 alphaTab 1.8.0 Selection API 的 Beat 信息，
 * 映射到 AlphaTex 代码中的行和字符位置。
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
import type { ScoreSelectionInfo } from "../store/appStore";

/**
 * 代码中的位置范围
 */
export interface CodeRange {
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
 * 小节在代码中的位置信息
 */
interface BarCodePosition {
	/** 小节索引 (0-based) */
	barIndex: number;
	/** 小节起始位置 (代码中的字符偏移) */
	startOffset: number;
	/** 小节结束位置 (代码中的字符偏移，不含 '|') */
	endOffset: number;
	/** 小节起始行 (0-based) */
	startLine: number;
	/** 小节起始列 (0-based) */
	startColumn: number;
}

/**
 * 解析 AlphaTex 代码，建立小节到代码位置的映射
 *
 * @param text AlphaTex 源代码
 * @returns 小节位置映射数组
 */
export function parseBarPositions(text: string): BarCodePosition[] {
	const bars: BarCodePosition[] = [];
	const lines = text.split("\n");

	// 辅助函数：根据字符偏移计算行和列
	function offsetToLineCol(offset: number): { line: number; column: number } {
		let currentOffset = 0;
		for (let i = 0; i < lines.length; i++) {
			const lineLength = lines[i].length;
			if (currentOffset + lineLength >= offset) {
				return { line: i, column: offset - currentOffset };
			}
			currentOffset += lineLength + 1; // +1 for newline
		}
		// 如果超出范围，返回最后位置
		return {
			line: lines.length - 1,
			column: lines[lines.length - 1]?.length || 0,
		};
	}

	// 查找音符内容的起始位置（跳过元数据）
	let contentStart = 0;
	let foundContent = false;

	const metadataCommands = [
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

		// 检查是否是元数据命令
		const isMetadata = metadataCommands.some((cmd) =>
			trimmedLine.toLowerCase().startsWith(cmd.toLowerCase()),
		);

		if (isMetadata) {
			lineOffset += line.length + 1;
			continue;
		}

		// 找到第一个非元数据内容
		// 需要找到这一行中实际内容的起始位置（跳过前导空格）
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
		return bars;
	}

	console.debug(
		"[parseBarPositions] Content starts at offset:",
		contentStart,
		offsetToLineCol(contentStart),
	);

	// 解析小节
	let barIndex = 0;
	let barStartOffset = contentStart;
	let inString = false;
	let inBlockComment = false;

	for (let i = contentStart; i < text.length; i++) {
		const char = text[i];
		const nextChar = text[i + 1] || "";
		const prevChar = text[i - 1] || "";

		// 处理块注释
		if (!inString && char === "/" && nextChar === "*") {
			inBlockComment = true;
			continue;
		}
		if (inBlockComment) {
			if (char === "*" && nextChar === "/") {
				inBlockComment = false;
				i++; // 跳过 '/'
			}
			continue;
		}

		// 处理行注释 - 跳到行尾
		if (!inString && char === "/" && nextChar === "/") {
			while (i < text.length && text[i] !== "\n") {
				i++;
			}
			continue;
		}

		// 处理字符串
		if (char === '"' && prevChar !== "\\") {
			inString = !inString;
			continue;
		}
		if (inString) {
			continue;
		}

		// 检测小节线 '|'
		if (char === "|") {
			const startPos = offsetToLineCol(barStartOffset);

			bars.push({
				barIndex,
				startOffset: barStartOffset,
				endOffset: i,
				startLine: startPos.line,
				startColumn: startPos.column,
			});

			barIndex++;
			// 下一个小节从 '|' 后面开始，跳过可能的空白
			let nextStart = i + 1;
			while (
				nextStart < text.length &&
				(text[nextStart] === " " || text[nextStart] === "\t")
			) {
				nextStart++;
			}
			// 如果遇到换行，也跳过
			if (text[nextStart] === "\n") {
				nextStart++;
				// 跳过新行开头的空白
				while (
					nextStart < text.length &&
					(text[nextStart] === " " || text[nextStart] === "\t")
				) {
					nextStart++;
				}
			}
			barStartOffset = nextStart;
		}
	}

	// 处理最后一个小节（如果没有以 '|' 结尾）
	if (barStartOffset < text.length) {
		// 去除尾部空白
		let endOffset = text.length;
		while (endOffset > barStartOffset && /\s/.test(text[endOffset - 1])) {
			endOffset--;
		}
		if (endOffset > barStartOffset) {
			const startPos = offsetToLineCol(barStartOffset);
			bars.push({
				barIndex,
				startOffset: barStartOffset,
				endOffset,
				startLine: startPos.line,
				startColumn: startPos.column,
			});
		}
	}

	return bars;
}

/**
 * 根据乐谱选区信息，计算对应的代码范围
 *
 * @param text AlphaTex 源代码
 * @param selection 乐谱选区信息
 * @returns 代码范围，如果无法映射则返回 null
 */
export function mapSelectionToCodeRange(
	text: string,
	selection: ScoreSelectionInfo,
): CodeRange | null {
	const bars = parseBarPositions(text);

	console.debug("[mapSelectionToCodeRange] Looking for bars:", {
		startBarIndex: selection.startBarIndex,
		endBarIndex: selection.endBarIndex,
		availableBars: bars.map((b) => b.barIndex),
	});

	if (bars.length === 0) {
		console.debug("[mapSelectionToCodeRange] No bars found");
		return null;
	}

	// 查找起始小节
	let startBar = bars.find((b) => b.barIndex === selection.startBarIndex);
	// 查找结束小节
	let endBar = bars.find((b) => b.barIndex === selection.endBarIndex);

	// 如果找不到精确匹配，使用最接近的
	if (!startBar) {
		console.debug(
			"[mapSelectionToCodeRange] Start bar not found, using closest",
		);
		startBar = bars.reduce((prev, curr) =>
			Math.abs(curr.barIndex - selection.startBarIndex) <
			Math.abs(prev.barIndex - selection.startBarIndex)
				? curr
				: prev,
		);
	}

	if (!endBar) {
		console.debug("[mapSelectionToCodeRange] End bar not found, using closest");
		endBar = bars.reduce((prev, curr) =>
			Math.abs(curr.barIndex - selection.endBarIndex) <
			Math.abs(prev.barIndex - selection.endBarIndex)
				? curr
				: prev,
		);
	}

	console.debug("[mapSelectionToCodeRange] Using bars:", { startBar, endBar });

	// 计算结束位置的行和列
	const lines = text.split("\n");

	// 辅助函数
	function offsetToLineCol(offset: number): { line: number; column: number } {
		let currentOffset = 0;
		for (let i = 0; i < lines.length; i++) {
			const lineLength = lines[i].length;
			if (currentOffset + lineLength >= offset) {
				return { line: i, column: offset - currentOffset };
			}
			currentOffset += lineLength + 1;
		}
		return {
			line: lines.length - 1,
			column: lines[lines.length - 1]?.length || 0,
		};
	}

	const endPos = offsetToLineCol(endBar.endOffset);

	const result: CodeRange = {
		startLine: startBar.startLine,
		startColumn: startBar.startColumn,
		endLine: endPos.line,
		endColumn: endPos.column,
	};

	console.debug("[mapSelectionToCodeRange] Result:", result);
	return result;
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
					// 清除高亮
					return Decoration.none;
				}

				const range = e.value;
				const builder = new RangeSetBuilder<Decoration>();

				try {
					// 计算文档中的位置
					const startLine = tr.state.doc.line(range.startLine + 1);
					const endLine = tr.state.doc.line(range.endLine + 1);

					const from =
						startLine.from + Math.min(range.startColumn, startLine.length);
					const to = endLine.from + Math.min(range.endColumn, endLine.length);

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
		backgroundColor: "hsl(var(--primary) / 0.2)",
		borderRadius: "2px",
		boxShadow: "0 0 0 1px hsl(var(--primary) / 0.3)",
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
		console.debug("[SelectionSync] Clearing highlight (no selection)");
		view.dispatch({
			effects: setSelectionHighlightEffect.of(null),
		});
		return;
	}

	console.debug("[SelectionSync] Selection info:", selection);

	const bars = parseBarPositions(text);
	console.debug("[SelectionSync] Parsed bars:", bars);

	const codeRange = mapSelectionToCodeRange(text, selection);
	console.debug("[SelectionSync] Mapped code range:", codeRange);

	if (codeRange) {
		// 显示实际要高亮的文本内容
		const lines = text.split("\n");
		const startLine = lines[codeRange.startLine] || "";
		const endLine = lines[codeRange.endLine] || "";
		console.debug("[SelectionSync] Highlight text preview:", {
			startLine: `"${startLine}"`,
			startCol: codeRange.startColumn,
			endLine: `"${endLine}"`,
			endCol: codeRange.endColumn,
		});
	}

	view.dispatch({
		effects: setSelectionHighlightEffect.of(codeRange),
	});
}
