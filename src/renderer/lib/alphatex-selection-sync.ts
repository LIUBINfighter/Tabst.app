/**
 * AlphaTex Selection Sync
 *
 * Bidirectional sync between score selection and code editor; beat-level positioning.
 * Parsing lives in alphatex-parse-positions; this file keeps selection/cursor/playback extensions.
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
import {
	type BeatCodePosition,
	type CodeRange,
	getBarRanges,
	lineColToOffset,
	parseBeatPositions,
} from "./alphatex-parse-positions";

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
			} catch {
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
	let rafId: number | null = null;
	let lastEmitted: EditorCursorInfo | null = null;

	return EditorView.updateListener.of((update) => {
		if (!update.selectionSet && !update.docChanged) {
			return;
		}

		const fromDocChange = update.docChanged;
		if (rafId !== null) return;
		rafId = window.requestAnimationFrame(() => {
			rafId = null;
			const { head } = update.state.selection.main;
			const line = update.state.doc.lineAt(head);
			const lineNumber = line.number - 1; // Convert to 0-based
			const column = head - line.from;

			const text = update.state.doc.toString();
			const beatInfo = findBeatAtPosition(text, lineNumber, column);

			if (!beatInfo) {
				if (lastEmitted !== null) {
					lastEmitted = null;
					onCursorChange(null);
				}
				return;
			}

			const next: EditorCursorInfo = {
				...beatInfo,
				fromDocChange,
			};

			if (lastEmitted && lastEmitted.barIndex === next.barIndex) {
				return;
			}

			lastEmitted = next;
			onCursorChange(next);
		});
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
