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
	const { editorTheme, isDark } = useTheme();
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
				backgroundColor: isDark ? "#1e1e1e" : "#ffffff",
				color: isDark ? "#d4d4d4" : "#24292e",
				fontSize: "13px",
				fontFamily:
					"var(--font-mono, ui-monospace, SFMono-Regular, SFMono, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace)",
				borderRadius: "6px",
				overflow: "hidden",
			},
			".cm-content": {
				padding: "12px 8px",
			},
			".cm-line": {
				padding: "0 4px",
			},
			".cm-gutters": {
				backgroundColor: isDark ? "#1e1e1e" : "#f6f8fa",
				borderRight: `1px solid ${isDark ? "#333" : "#e1e4e8"}`,
				color: isDark ? "#6e7681" : "#6a737d",
			},
			".cm-activeLineGutter": {
				backgroundColor: "transparent",
			},
			".cm-cursor": {
				borderLeftColor: isDark ? "#d4d4d4" : "#24292e",
			},
			".cm-selectionBackground": {
				backgroundColor: isDark ? "#264f78" : "#b4d7ff",
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
	}, [editorTheme, isDark]);

	return (
		<div className="mt-4">
			<div className="rounded-md border border-border overflow-hidden">
				<div ref={editorRef} className="h-[280px]" />
			</div>
		</div>
	);
}

export default EditorPreview;
