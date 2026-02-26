import { type Extension, RangeSetBuilder } from "@codemirror/state";
import {
	Decoration,
	type DecorationSet,
	type EditorView,
	ViewPlugin,
	type ViewUpdate,
	WidgetType,
} from "@codemirror/view";

const ATDOC_COLOR_LINE_REGEX =
	/^[ \t]*\*[ \t]*at\.[^\n]*?(#[0-9a-fA-F]{6})\b/gm;
const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;

function normalizeHexColor(hex: string): string {
	return hex.toUpperCase();
}

function isHexColor(hex: string): boolean {
	return HEX_COLOR_REGEX.test(hex);
}

class AtDocColorSwatchWidget extends WidgetType {
	constructor(
		readonly color: string,
		readonly from: number,
		readonly to: number,
	) {
		super();
	}

	eq(other: AtDocColorSwatchWidget): boolean {
		return (
			other.color === this.color &&
			other.from === this.from &&
			other.to === this.to
		);
	}

	toDOM(view: EditorView): HTMLElement {
		const swatch = document.createElement("button");
		swatch.type = "button";
		swatch.className = "cm-atdoc-color-swatch";
		swatch.title = `Pick color ${this.color}`;
		swatch.setAttribute("aria-label", `Pick color ${this.color}`);
		swatch.style.display = "inline-block";
		swatch.style.width = "0.78em";
		swatch.style.height = "0.78em";
		swatch.style.minWidth = "10px";
		swatch.style.minHeight = "10px";
		swatch.style.marginRight = "0.32em";
		swatch.style.border = "1px solid hsl(var(--border))";
		swatch.style.borderRadius = "3px";
		swatch.style.background = this.color;
		swatch.style.verticalAlign = "baseline";
		swatch.style.cursor = "pointer";
		swatch.style.padding = "0";
		swatch.style.boxSizing = "border-box";

		swatch.addEventListener("mousedown", (event) => {
			event.preventDefault();
		});

		swatch.addEventListener("click", (event) => {
			event.preventDefault();
			event.stopPropagation();

			const picker = document.createElement("input");
			picker.type = "color";
			picker.value = normalizeHexColor(this.color);
			picker.style.position = "fixed";
			picker.style.left = "-9999px";
			picker.style.top = "-9999px";

			const removePicker = () => {
				picker.remove();
			};

			const applyColor = (next: string) => {
				if (!isHexColor(next)) return;
				const normalized = normalizeHexColor(next);
				view.dispatch({
					changes: { from: this.from, to: this.to, insert: normalized },
				});
				view.focus();
			};

			picker.addEventListener("input", () => applyColor(picker.value));
			picker.addEventListener("change", () => {
				applyColor(picker.value);
				removePicker();
			});
			picker.addEventListener("blur", removePicker);

			document.body.appendChild(picker);
			picker.click();
		});

		return swatch;
	}

	ignoreEvent(): boolean {
		return false;
	}
}

function buildAtDocColorSwatches(view: EditorView): DecorationSet {
	const builder = new RangeSetBuilder<Decoration>();
	const text = view.state.doc.toString();

	for (const match of text.matchAll(ATDOC_COLOR_LINE_REGEX)) {
		const matched = match[0];
		const color = match[1];
		const lineStart = match.index;
		if (lineStart === undefined || !isHexColor(color)) continue;

		const colorOffset = matched.lastIndexOf(color);
		if (colorOffset < 0) continue;

		const from = lineStart + colorOffset;
		const to = from + color.length;
		builder.add(
			from,
			from,
			Decoration.widget({
				widget: new AtDocColorSwatchWidget(normalizeHexColor(color), from, to),
				side: -1,
			}),
		);
	}

	return builder.finish();
}

export function atDocColorSwatch(): Extension {
	const plugin = ViewPlugin.fromClass(
		class {
			decorations: DecorationSet;

			constructor(view: EditorView) {
				this.decorations = buildAtDocColorSwatches(view);
			}

			update(update: ViewUpdate) {
				if (update.docChanged || update.viewportChanged) {
					this.decorations = buildAtDocColorSwatches(update.view);
				}
			}
		},
		{
			decorations: (v) => v.decorations,
		},
	);

	return plugin;
}
