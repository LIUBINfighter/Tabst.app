/**
 * AlphaTex Language Server Protocol (LSP) Integration
 *
 * Manages a Web Worker connection for AlphaTex language server.
 * Handles message routing between editor and worker.
 */

import type { Diagnostic } from "@codemirror/lint";

export interface LspDiagnostic {
	range: {
		start: { line: number; character: number };
		end: { line: number; character: number };
	};
	severity?: number;
	code?: string | number;
	source?: string;
	message?: string;
}

function buildLineOffsets(text: string): number[] {
	const offsets = [0];
	for (let i = 0; i < text.length; i++) {
		if (text[i] === "\n") {
			offsets.push(i + 1);
		}
	}
	return offsets;
}

function positionToOffset(
	position: { line: number; character: number },
	lineOffsets: number[],
	textLength: number,
): number {
	if (lineOffsets.length === 0) {
		return 0;
	}

	const safeLine = Math.max(0, Math.min(position.line, lineOffsets.length - 1));
	const lineStart = lineOffsets[safeLine] ?? 0;
	const lineEndExclusive =
		safeLine + 1 < lineOffsets.length
			? (lineOffsets[safeLine + 1] ?? textLength) - 1
			: textLength;
	const safeCharacter = Math.max(0, position.character);

	return Math.max(
		lineStart,
		Math.min(lineStart + safeCharacter, Math.max(lineStart, lineEndExclusive)),
	);
}

/**
 * Represents an LSP client connection
 */
export interface AlphaTexLSPClient {
	send(message: unknown): number | undefined;
	onMessage(listener: (message: unknown) => void): void;
	request(method: string, params?: unknown): Promise<unknown>;
	close(): void;
}

/**
 * Message ID counter for tracking requests
 */
let messageId = 0;

/**
 * Create a simple LSP client for AlphaTex
 * This client manages a Worker connection for language server communication
 * and provides methods to send requests and receive responses
 */
export function createAlphaTexLSPClient(
	_documentUri: string = "file:///main.atex",
): AlphaTexLSPClient {
	let worker: Worker | null = null;
	const messageListeners = new Map<
		number,
		(response: {
			result?: unknown;
			error?: { message?: string } | null;
		}) => void
	>();
	const generalListeners: Array<(message: unknown) => void> = [];

	return {
		/**
		 * Send a message to the worker and optionally get response
		 */
		send(message: unknown) {
			if (!worker) {
				// Lazy initialize worker on first send
				worker = new Worker(
					new URL("../workers/alphatex.worker.ts", import.meta.url),
					{
						type: "module",
					},
				);

				// Handle responses from worker
				worker.onmessage = (event) => {
					const { id, result, error } = event.data;

					// Route to specific request handler if ID matches
					if (id !== undefined && messageListeners.has(id)) {
						const handler = messageListeners.get(id);
						messageListeners.delete(id);
						handler?.({ result, error });
					}

					// Also notify general listeners
					for (const listener of generalListeners) {
						listener(event.data);
					}
				};

				worker.onerror = (error) => {
					console.error("AlphaTex Worker Error:", error);
				};
			}

			// Assign message ID if not present
			const msg = Object.assign({}, message as Record<string, unknown>);
			const method = (msg as { method?: string }).method;
			if (msg.id === undefined && method) {
				msg.id = ++messageId;
			}

			worker.postMessage(msg);
			return msg.id as number | undefined;
		},

		/**
		 * Listen for messages from the worker
		 */
		onMessage(listener: (message: unknown) => void) {
			generalListeners.push(listener);
		},

		/**
		 * Send a request and wait for response
		 */
		async request(method: string, params?: unknown): Promise<unknown> {
			return new Promise((resolve, reject) => {
				const id = ++messageId;

				messageListeners.set(id, ({ result, error }) => {
					if (error) {
						reject(new Error(error.message));
					} else {
						resolve(result);
					}
				});

				const message = {
					jsonrpc: "2.0",
					id,
					method,
					params,
				};

				this.send(message);

				// Timeout after 10 seconds
				setTimeout(() => {
					if (messageListeners.has(id)) {
						messageListeners.delete(id);
						reject(new Error(`Request timeout: ${method}`));
					}
				}, 10000);
			});
		},

		close() {
			if (worker) {
				worker.terminate();
				worker = null;
			}
			messageListeners.clear();
			generalListeners.length = 0;
		},
	};
}

/**
 * Extract diagnostics from LSP diagnostic messages
 */
export function lspDiagnosticsToCM6(
	diagnostics: LspDiagnostic[],
	text: string,
): Diagnostic[] {
	const lineOffsets = buildLineOffsets(text);
	const textLength = text.length;

	return diagnostics.map((diag) => {
		const from = positionToOffset(diag.range.start, lineOffsets, textLength);
		const rawTo = positionToOffset(diag.range.end, lineOffsets, textLength);
		const to =
			rawTo > from
				? rawTo
				: from < textLength
					? Math.min(textLength, from + 1)
					: from;

		const severity =
			diag.severity === 1 ? "error" : diag.severity === 2 ? "warning" : "info";

		const code =
			typeof diag.code === "string" || typeof diag.code === "number"
				? `[${diag.code}] `
				: "";

		return {
			from,
			to,
			severity,
			message: `${code}${diag.message ?? ""}`.trim(),
		};
	});
}
