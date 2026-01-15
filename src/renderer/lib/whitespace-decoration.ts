import { type Extension, RangeSetBuilder, StateField } from "@codemirror/state";
import {
	Decoration,
	type DecorationSet,
	EditorView,
	WidgetType,
} from "@codemirror/view";

/**
 * Widget that displays a space as a visible dot (·)
 */
class SpaceWidget extends WidgetType {
	toDOM(): HTMLElement {
		const span = document.createElement("span");
		span.className = "cm-space-dot";
		span.textContent = " "; // Keep the space for correct width
		return span;
	}

	eq(): boolean {
		return true; // All space widgets are equal
	}

	ignoreEvent(): boolean {
		return false;
	}
}

// Single instance to reuse
const spaceWidget = Decoration.replace({
	widget: new SpaceWidget(),
});

/**
 * Build whitespace decorations for the entire document.
 * Uses replace widgets for stable rendering.
 */
function buildDecorations(doc: {
	length: number;
	sliceString: (from: number, to: number) => string;
}): DecorationSet {
	const builder = new RangeSetBuilder<Decoration>();

	for (let pos = 0; pos < doc.length; pos++) {
		if (doc.sliceString(pos, pos + 1) === " ") {
			builder.add(pos, pos + 1, spaceWidget);
		}
	}

	return builder.finish();
}

/**
 * StateField that manages whitespace decorations.
 * Only updates on document changes - never on scroll.
 */
const whitespaceField = StateField.define<DecorationSet>({
	create(state) {
		return buildDecorations(state.doc);
	},
	update(decorations, tr) {
		if (tr.docChanged) {
			return buildDecorations(tr.newDoc);
		}
		return decorations;
	},
	provide: (field) => EditorView.decorations.from(field),
});

/**
 * Theme for the space dot widget
 */
const whitespaceTheme = EditorView.theme({
	".cm-space-dot": {
		position: "relative",
		display: "inline-block",
		width: "1ch",
	},
	".cm-space-dot::after": {
		content: "'·'",
		position: "absolute",
		left: "0",
		right: "0",
		top: "0",
		textAlign: "center",
		color: "hsl(var(--muted-foreground) / 0.5)",
		pointerEvents: "none",
	},
});

/**
 * Extension to show spaces as dots using widget replacement
 */
export function whitespaceDecoration(): Extension {
	return [whitespaceField, whitespaceTheme];
}
