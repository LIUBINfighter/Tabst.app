import { linter } from "@codemirror/lint";
import type { Extension } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import type { AlphaTexLSPClient, LspDiagnostic } from "./alphatex-lsp";
import { lspDiagnosticsToCM6 } from "./alphatex-lsp";

type LspDiagnosticResult = {
	kind?: string;
	items?: LspDiagnostic[];
};

function extractDiagnostics(result: unknown): LspDiagnostic[] {
	if (Array.isArray(result)) {
		return result as LspDiagnostic[];
	}

	const response = result as LspDiagnosticResult | null;
	if (response?.items && Array.isArray(response.items)) {
		return response.items;
	}

	return [];
}

export function createAlphaTexDiagnosticsExtension(
	lspClient: AlphaTexLSPClient,
): Extension {
	return linter(
		async (view: EditorView) => {
			const text = view.state.doc.toString();
			const snapshot = text;

			if (snapshot.length === 0) {
				return [];
			}

			try {
				const response = await lspClient.request("textDocument/diagnostic", {
					textDocument: { uri: "file:///main.atex" },
					text: snapshot,
				});

				if (view.state.doc.toString() !== snapshot) {
					return [];
				}

				return lspDiagnosticsToCM6(extractDiagnostics(response), snapshot);
			} catch (error) {
				console.error("Failed to request AlphaTex diagnostics:", error);
				return [];
			}
		},
		{ delay: 300 },
	);
}
