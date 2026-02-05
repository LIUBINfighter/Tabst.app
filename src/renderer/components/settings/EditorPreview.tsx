import { EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers } from "@codemirror/view";
import { useEffect, useRef } from "react";
import { createAlphaTexHighlightForTheme } from "../../lib/alphatex-highlight";
import { useTheme } from "../../lib/theme-system/use-theme";

const SAMPLE_ALPHATEX_CODE = `// Welcome to Tabst - Guitar Tab Editor
// This is a sample AlphaTex score

\\title "Sample Song"
\\artist "Demo Artist"
\\tempo 120

// Define a track with standard tuning
\\track "Guitar"
  \\instrument "Acoustic Guitar"
  \\tuning E4 B3 G3 D3 A2 E2

  // Main section
  \\section "Intro"
  0.4.8 1.4.8 2.4.8 3.4.8 | 0.4.4 0.4.8 1.4.8 |
  
  // Verse with chords
  \\section "Verse"
  (0.1.4 1.1.4 2.1.4) 3.1.2 | 0.2.4 1.2.4 2.2.4 3.2.4 |
  
  // Some techniques
  0.5.8 {h} 2.5.8 3.5.8 {p} 0.5.8 | 1.6.4 {b} (3.6.4) 1.6.4 |

// End of sample
`;

export function EditorPreview() {
	const { editorTheme } = useTheme();
	const editorRef = useRef<HTMLDivElement>(null);
	const viewRef = useRef<EditorView | null>(null);

	useEffect(() => {
		if (!editorRef.current) return;

		if (viewRef.current) {
			viewRef.current.destroy();
			viewRef.current = null;
		}

		const alphaTexHighlight = createAlphaTexHighlightForTheme(editorTheme);

		const baseTheme = EditorView.theme({
			"&": {
				backgroundColor: "hsl(var(--card))",
				color: "hsl(var(--foreground))",
				fontSize: "14px",
				fontFamily:
					'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
				borderRadius: "6px",
				height: "100%",
				display: "flex",
				flexDirection: "column",
			},
			".cm-scroller": {
				overflowX: "hidden",
				overflowY: "auto",
				height: "100%",
				minHeight: "0",
				fontFamily:
					'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
				scrollbarWidth: "thin",
			},
			".cm-content": {
				padding: "8px 0",
			},
			".cm-line": {
				padding: "0 8px",
			},
			".cm-gutters": {
				backgroundColor: "hsl(var(--card))",
				border: "none",
				color: "hsl(var(--muted-foreground))",
			},
			".cm-activeLineGutter": {
				backgroundColor: "transparent",
			},
			".cm-activeLine": {
				backgroundColor: "hsl(var(--muted) / 0.06)",
			},
			".cm-cursor": {
				borderLeftColor: "hsl(var(--primary))",
			},
			".cm-selectionBackground": {
				backgroundColor: "var(--selection-overlay)",
				color: "inherit",
				opacity: "1",
				mixBlendMode: "normal",
			},
		});

		const readOnlyExtension = EditorState.readOnly.of(true);

		const state = EditorState.create({
			doc: SAMPLE_ALPHATEX_CODE,
			extensions: [
				baseTheme,
				...alphaTexHighlight,
				lineNumbers(),
				readOnlyExtension,
				keymap.of([]),
				EditorView.editable.of(false),
			],
		});

		viewRef.current = new EditorView({
			state,
			parent: editorRef.current,
		});

		return () => {
			if (viewRef.current) {
				viewRef.current.destroy();
				viewRef.current = null;
			}
		};
	}, [editorTheme]);

	return (
		<div className="mt-4">
			<div className="rounded-md border border-border overflow-hidden">
				<div ref={editorRef} className="h-[280px]" />
			</div>
		</div>
	);
}

export default EditorPreview;
