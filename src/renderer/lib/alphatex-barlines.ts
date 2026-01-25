import {
	type Extension,
	RangeSetBuilder,
	StateEffect,
	StateField,
} from "@codemirror/state";
import {
	Decoration,
	type DecorationSet,
	EditorView,
	ViewPlugin,
	type ViewUpdate,
	WidgetType,
} from "@codemirror/view";
import type { AlphaTexLSPClient } from "./alphatex-lsp";

/**
 * Effect to update barlines in the editor state
 */
export const setBarlinesEffect =
	StateEffect.define<
		Array<{ line: number; character: number; barNumber: number }>
	>();

/**
 * Widget to render a bar number next to or instead of the barline
 */
class BarlineWidget extends WidgetType {
	constructor(readonly barNumber: number) {
		super();
	}

	toDOM() {
		const wrapper = document.createElement("span");
		wrapper.className = "cm-barline-widget";
		const badgeWidth = 20;
		const badgeGap = 1;
		Object.assign(wrapper.style, {
			display: "inline-block",
			position: "relative",
			whiteSpace: "nowrap",
			verticalAlign: "baseline",
			lineHeight: "1",
			paddingRight: `${badgeWidth + badgeGap}px`,
			cursor: "default",
			userSelect: "none",
			pointerEvents: "none",
		});

		const barline = document.createElement("span");
		barline.textContent = "|";
		barline.style.marginRight = "1px";
		const isMajor = this.barNumber % 5 === 0;
		barline.style.color = isMajor
			? "hsl(var(--destructive))"
			: "hsl(var(--muted-foreground))";

		const badge = document.createElement("span");
		Object.assign(badge.style, {
			position: "absolute",
			right: "0",
			top: "50%",
			transform: "translateY(-50%)",
			display: "inline-flex",
			alignItems: "center",
			justifyContent: "center",
			backgroundColor: isMajor
				? "hsl(var(--primary) / 0.15)"
				: "hsl(var(--muted-foreground) / 0.12)",
			border: isMajor
				? "1.5px solid hsl(var(--primary) / 0.5)"
				: "1.5px solid hsl(var(--muted-foreground) / 0.35)",
			borderRadius: "3px",
			padding: "0 3px",
			fontSize: "10px",
			lineHeight: "1",
			height: "14px",
			minWidth: `${badgeWidth}px`,
			width: `${badgeWidth}px`,
			fontWeight: "bold",
			boxSizing: "border-box",
			color: isMajor ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))",
		});
		badge.textContent = this.barNumber.toString();
		badge.title = `Measure ${this.barNumber}`;

		wrapper.appendChild(barline);
		wrapper.appendChild(badge);
		return wrapper;
	}

	ignoreEvent() {
		return true;
	}
}

/**
 * State field to manage barline decorations
 */
const barlinesField = StateField.define<DecorationSet>({
	create() {
		return Decoration.none;
	},
	update(barlines, tr) {
		// 🆕 先处理 effect，如果有新的 barlines 设置，直接返回新值
		for (const e of tr.effects) {
			if (e.is(setBarlinesEffect)) {
				try {
					const builder = new RangeSetBuilder<Decoration>();
					const sortedBarlines = [...e.value].sort((a, b) => {
						if (a.line !== b.line) return a.line - b.line;
						return a.character - b.character;
					});

					let lastPos = -1;
					for (const bar of sortedBarlines) {
						try {
							if (bar.line + 1 > tr.state.doc.lines) continue;
							const line = tr.state.doc.line(bar.line + 1);
							const pos = line.from + bar.character;

							// Ensure position is strictly increasing for RangeSetBuilder
							if (pos <= lastPos) continue;

							// Ensure position is within bounds and actually a '|'
							if (pos < tr.state.doc.length) {
								const char = tr.state.doc.sliceString(pos, pos + 1);
								if (char === "|") {
									builder.add(
										pos,
										pos + 1,
										Decoration.replace({
											widget: new BarlineWidget(bar.barNumber),
											side: 0,
										}),
									);
									// Record the actual position used (pos) to keep ordering strict
									lastPos = pos;
								}
							}
						} catch (err) {
							void err; // Ignore errors during rapid edits
						}
					}
					return builder.finish();
				} catch (err) {
					console.error("Failed to build barline decorations:", err);
					return Decoration.none;
				}
			}
		}

		// 如果文档发生变化，尝试映射旧的 barlines 位置
		if (tr.docChanged) {
			try {
				return barlines.map(tr.changes);
			} catch (_err) {
				// 映射失败（文档变化太大），清除 barlines
				return Decoration.none;
			}
		}

		return barlines;
	},
	provide: (f) => EditorView.decorations.from(f),
});

/**
 * Extension that periodically updates barlines from LSP
 */
export function createAlphaTexBarlinesExtension(
	lspClient: AlphaTexLSPClient,
): Extension {
	const barlinesPlugin = ViewPlugin.fromClass(
		class {
			timer: number | null = null;
			requestId = 0;
			view: EditorView;

			constructor(view: EditorView) {
				this.view = view;
				// Schedule an initial run on mount
				this.schedule();
			}

			update(update: ViewUpdate) {
				// 🆕 只在文档内容变化时触发更新
				// 移除 viewportChanged 触发，因为滚动时频繁更新会导致冲突
				if (update.docChanged || update.startState.doc.length === 0) {
					this.schedule();
				}
			}

			schedule() {
				if (this.timer) clearTimeout(this.timer);
				// If autocompletion UI is currently open, postpone barline update
				// to avoid interfering with the completion dropdown (which can be
				// closed by editor state transactions).
				if (this.view.dom?.querySelector?.(".cm-tooltip-autocomplete")) {
					this.timer = window.setTimeout(() => {
						this.timer = null;
						this.schedule();
					}, 300);
					return;
				}
				const id = ++this.requestId;
				this.timer = window.setTimeout(() => {
					this.timer = null;
					const text = this.view.state.doc.toString();
					// Capture id at send time to detect stale responses
					const sentId = id;
					lspClient
						.request("textDocument/barlines", { text })
						.then((res) => {
							// If another request has been scheduled after this one, drop response
							if (sentId !== this.requestId) return;
							const { barlines } = res as {
								barlines: Array<{
									line: number;
									character: number;
									barNumber: number;
								}>;
							};
							if (!barlines) return;
							const view = this.view;
							// If the view was destroyed or detached before the LSP responded,
							// avoid dispatching to prevent internal view errors.
							if (!view || !view.dom || !document.contains(view.dom)) return;

							// 🆕 使用 setTimeout(0) 代替 requestAnimationFrame
							// requestAnimationFrame 可能在滚动事件处理期间执行导致冲突
							setTimeout(() => {
								// 再次检查 view 状态
								if (!view || !view.dom || !document.contains(view.dom)) return;
								if (sentId !== this.requestId) return;
								try {
									view.dispatch({ effects: setBarlinesEffect.of(barlines) });
								} catch (err) {
									console.error("Failed to apply barlines:", err);
								}
							}, 0);
						})
						.catch((err) => console.error("Failed to fetch barlines:", err));
				}, 500);
			}

			destroy() {
				if (this.timer) clearTimeout(this.timer);
				// Invalidate any in-flight responses
				this.requestId++;
			}
		},
		{
			// Nothing special in spec for now
		},
	);

	return [barlinesField, barlinesPlugin];
}
