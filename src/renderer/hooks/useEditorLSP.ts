/**
 * Editor LSP Hook
 *
 * Manages LSP client and language extensions for CodeMirror editor.
 */

import { markdown } from "@codemirror/lang-markdown";
import type { Extension } from "@codemirror/state";
import { Compartment } from "@codemirror/state";
import { EditorView } from "codemirror";
import { useCallback, useRef } from "react";
import type { AlphaTexLSPClient } from "../lib/alphatex-lsp";
import { createAlphaTexLSPClient } from "../lib/alphatex-lsp";
import { createAlphaTexExtensions } from "../lib/editor-extensions";

export function useEditorLSP() {
	const lspClientRef = useRef<AlphaTexLSPClient | null>(null);
	const languageCompartmentRef = useRef<Compartment>(new Compartment());

	const getLanguageForFile = useCallback((filePath: string) => {
		if (filePath.endsWith(".atex")) return "alphatex";
		if (filePath.endsWith(".md")) return "markdown";
		return "plaintext";
	}, []);

	const loadLanguageExtensions = useCallback(
		async (language: string, filePath: string): Promise<Extension[]> => {
			const extensions: Extension[] = [];

			if (language === "alphatex") {
				if (!lspClientRef.current) {
					lspClientRef.current = createAlphaTexLSPClient(filePath);
					lspClientRef.current
						.request("initialize", {
							rootUri: "file:///",
							capabilities: {},
						})
						.catch((e: unknown) => console.error("LSP init failed:", e));
				}
				const alphaTexExts = await createAlphaTexExtensions(
					filePath,
					lspClientRef,
				);
				extensions.push(...alphaTexExts);
			} else if (language === "markdown") {
				extensions.push(markdown());
				extensions.push(EditorView.lineWrapping);
			}

			return extensions;
		},
		[],
	);

	const cleanupLSP = useCallback(() => {
		if (lspClientRef.current) {
			lspClientRef.current.close?.();
			lspClientRef.current = null;
		}
	}, []);

	return {
		lspClientRef,
		languageCompartment: languageCompartmentRef.current,
		getLanguageForFile,
		loadLanguageExtensions,
		cleanupLSP,
	};
}
