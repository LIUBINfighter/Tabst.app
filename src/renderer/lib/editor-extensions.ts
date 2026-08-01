/**
 * CodeMirror Editor Extensions
 *
 * Theme and language extensions for CodeMirror editor.
 */

import type { Extension } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { useAppStore } from "../store/appStore";
import { alphatexAbbreviations } from "./alphatex-abbreviations";
import { createAlphaTexBarlinesExtension } from "./alphatex-barlines";
import { createAlphaTexAutocomplete } from "./alphatex-completion";
import { createAlphaTexDiagnosticsExtension } from "./alphatex-diagnostics";
import { getAlphaTexHighlight } from "./alphatex-highlight";
import type { AlphaTexLSPClient } from "./alphatex-lsp";
import {
	createCursorTrackingExtension,
	createPlaybackSyncExtension,
	createSelectionSyncExtension,
} from "./alphatex-selection-sync";

/**
 * ESC 取消编辑器聚焦（符合"按 ESC 退出编辑状态"的心智模型）。
 * 补全浮层的 Escape 绑定优先级更高（Prec.highest），浮层打开时先关闭浮层；
 * 浮层未打开时 ESC 直接让编辑器失焦。
 */
export function createEscapeBlurExtension(): Extension {
	return keymap.of([
		{
			key: "Escape",
			run: (view) => {
				view.contentDOM.blur();
				return true;
			},
		},
	]);
}

/**
 * Create theme extension for CodeMirror editor
 */
export function createThemeExtension(dark: boolean): Extension {
	const themeStyles = {
		"&": {
			height: "100%",
			display: "flex",
			flexDirection: "column",
			fontSize: "14px",
			backgroundColor: "hsl(var(--card))",
			color: "hsl(var(--foreground))",
		},
		".cm-scroller": {
			scrollbarWidth: "thin",
			scrollbarColor: "var(--scrollbar) transparent",
		},
		".cm-content": {
			padding: "8px 0 var(--scroll-buffer, 150px) 0",
		},
		".cm-gutters": {
			backgroundColor: "transparent",
			border: "none",
			color: "hsl(var(--muted-foreground))",
		},
		".cm-activeLineGutter": { backgroundColor: "transparent" },
		".cm-activeLine": { backgroundColor: "hsl(var(--muted) / 0.06)" },
		".cm-selectionBackground, .cm-selection": {
			backgroundColor: "var(--selection-overlay)",
			color: "inherit",
			opacity: "1",
			mixBlendMode: "normal",
		},
		".cm-selectionMatch": {
			backgroundColor: "hsl(var(--primary) / 0.18)",
			color: "inherit",
		},
		".cm-searchMatch": {
			backgroundColor: "hsl(var(--muted) / 0.12)",
			color: "inherit",
		},
		".cm-searchMatch.cm-searchMatch-selected": {
			backgroundColor: "hsl(var(--primary) / 0.22)",
			color: "inherit",
		},
		".cm-matchingBracket": {
			backgroundColor: "hsl(var(--primary) / 0.14)",
		},
		".cm-nonmatchingBracket": {
			backgroundColor: "hsl(var(--destructive) / 0.14)",
		},
		".cm-cursor": { borderLeftColor: "hsl(var(--primary))" },
		".cm-tooltip": {
			backgroundColor: "hsl(var(--popover))",
			color: "hsl(var(--popover-foreground))",
			border: "1px solid hsl(var(--border))",
		},
		".cm-gutterElement": { color: "hsl(var(--muted-foreground))" },
		"&.cm-focused": { outline: "none" },
		// 搜索面板外观适配（功能保持 CodeMirror 原生 Cmd+F 行为不变）
		"& .cm-panels": {
			backgroundColor: "hsl(var(--card))",
			color: "hsl(var(--foreground))",
			borderBottom: "1px solid hsl(var(--border))",
		},
		".cm-panel.cm-search": {
			padding: "6px 10px",
			display: "flex",
			alignItems: "center",
			gap: "6px",
			flexWrap: "wrap",
		},
		".cm-panel.cm-search input.cm-textfield": {
			backgroundColor: "hsl(var(--input))",
			color: "hsl(var(--foreground))",
			border: "1px solid hsl(var(--border))",
			borderRadius: "6px",
			padding: "3px 8px",
			fontFamily: "inherit",
			fontSize: "13px",
			outline: "none",
			"&:focus": {
				borderColor: "hsl(var(--primary))",
			},
		},
		".cm-panel.cm-search .cm-button": {
			backgroundColor: "hsl(var(--muted))",
			color: "hsl(var(--foreground))",
			border: "1px solid hsl(var(--border))",
			borderRadius: "6px",
			padding: "2px 10px",
			fontSize: "12px",
			cursor: "pointer",
			"&:hover": {
				backgroundColor: "hsl(var(--accent))",
			},
		},
		".cm-panel.cm-search [name=close]": {
			position: "static",
			backgroundColor: "transparent",
			border: "none",
			font: "inherit",
			padding: "0 4px",
			margin: "0",
			color: "hsl(var(--muted-foreground))",
			"&:hover": {
				color: "hsl(var(--foreground))",
			},
		},
		".cm-panel.cm-search label": {
			display: "flex",
			alignItems: "center",
			gap: "4px",
			fontSize: "12px",
			color: "hsl(var(--muted-foreground))",
			whiteSpace: "nowrap",
			"& input[type=checkbox]": {
				accentColor: "hsl(var(--primary))",
			},
		},
	} as const;

	return EditorView.theme(themeStyles, { dark });
}

/**
 * Create AlphaTex language extensions (highlight, LSP, completion, sync, etc.)
 */
export async function createAlphaTexExtensions(
	_filePath: string,
	lspClientRef: React.MutableRefObject<AlphaTexLSPClient | null>,
): Promise<Extension[]> {
	const extensions: Extension[] = [];

	try {
		const alphaTexHighlight = await getAlphaTexHighlight();
		if (alphaTexHighlight && alphaTexHighlight.length > 0) {
			extensions.push(alphaTexHighlight);
		}

		const lspClient = lspClientRef.current;
		if (!lspClient) {
			return extensions;
		}

		const completionExts = createAlphaTexAutocomplete(lspClient);
		extensions.push(...completionExts);

		const diagnosticsExt = createAlphaTexDiagnosticsExtension(lspClient);
		extensions.push(diagnosticsExt);

		const barlinesExt = createAlphaTexBarlinesExtension(lspClient);
		extensions.push(barlinesExt);

		extensions.push(alphatexAbbreviations);

		const selectionSyncExt = createSelectionSyncExtension();
		extensions.push(...selectionSyncExt);

		const playbackSyncExt = createPlaybackSyncExtension();
		extensions.push(...playbackSyncExt);

		const cursorTrackingExt = createCursorTrackingExtension((cursor) => {
			useAppStore.getState().setEditorCursor(cursor);
		});
		extensions.push(cursorTrackingExt);

		extensions.push(EditorView.lineWrapping);
	} catch (e) {
		console.error("Failed to load AlphaTex support:", e);
	}

	return extensions;
}
