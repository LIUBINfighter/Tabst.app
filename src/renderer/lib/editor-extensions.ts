/**
 * CodeMirror Editor Extensions
 *
 * Theme and language extensions for CodeMirror editor.
 */

import type { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { useAppStore } from "../store/appStore";
import { alphatexAbbreviations } from "./alphatex-abbreviations";
import { createAlphaTexBarlinesExtension } from "./alphatex-barlines";
import { createAlphaTexAutocomplete } from "./alphatex-completion";
import { getAlphaTexHighlight } from "./alphatex-highlight";
import type { AlphaTexLSPClient } from "./alphatex-lsp";
import {
	createCursorTrackingExtension,
	createPlaybackSyncExtension,
	createSelectionSyncExtension,
} from "./alphatex-selection-sync";

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
