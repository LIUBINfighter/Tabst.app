/**
 * AlphaTex Selection Sync
 *
 * Bidirectional sync between score selection and code editor; beat-level positioning.
 * Parsing lives in alphatex-parse-positions; cursor/playback extensions are in separate files.
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
import {
	type BeatCodePosition,
	type CodeRange,
	lineColToOffset,
	parseBeatPositions,
} from "./alphatex-parse-positions";

// Re-export cursor tracking and playback sync for backward compatibility
export { createCursorTrackingExtension } from "./alphatex-cursor-tracking";
// Re-export parse types/helpers for consumers that still import from this file
export type {
	BeatCodePosition,
	CodeRange,
	ParseResult,
} from "./alphatex-parse-positions";
export {
	getBarRanges,
	offsetToLineCol,
	parseBeatPositions,
	parseBeatPositionsAST,
} from "./alphatex-parse-positions";
export {
	createPlaybackSyncExtension,
	mapPlaybackToCodeRange,
	updateEditorPlaybackHighlight,
} from "./alphatex-playback-sync";

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
		return null;
	}

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
		return null;
	}

	// 🆕 验证范围有效性
	const from = startBeat.startOffset;
	const to = endBeat.endOffset;

	if (from < 0 || to < 0 || from >= to || to > text.length) {
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
			} catch {
				// 映射失败（文档变化太大），清除高亮
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

/**
 * Create selection sync extension
 *
 * @returns CodeMirror extension array
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
