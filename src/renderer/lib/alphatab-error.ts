/**
 * AlphaTab 错误处理工具
 *
 * 用于处理和格式化 AlphaTab 产生的错误信息
 */

import i18n from "../i18n";

/**
 * AlphaTab 诊断信息类型
 */
export type AlphaTabDiagnostic = {
	message?: string;
	range?: { start?: { line?: number; character?: number } };
	line?: number;
	character?: number;
	col?: number;
};

/**
 * AlphaTab 错误类型（兼容多种错误格式）
 */
export type AlphaTabErrorLike = {
	message?: string;
	error?: string;
	type?: string | number;
	errorType?: string;
	lexerDiagnostics?: string;
	parserDiagnostics?: AlphaTabDiagnostic[];
	semanticDiagnostics?: AlphaTabDiagnostic[];
	diagnostics?: AlphaTabDiagnostic[] | unknown;
	toString?: () => string;
};

/**
 * 格式化诊断信息数组为字符串
 */
export function formatDiagnosticsArray(
	arr: unknown[] | undefined,
	name: string = i18n.t("errors:diagnostics"),
): string {
	if (!arr || !Array.isArray(arr) || arr.length === 0) return "";
	try {
		return (
			`${name}:\n` +
			arr
				.map((d) => {
					// Common diagnostic shapes may include 'message' and 'range' / 'line' fields
					const msg = (d as { message?: string })?.message ?? JSON.stringify(d);
					// range may be an object with start.line/character
					const start = (
						d as {
							range?: {
								start?: {
									line?: number;
									character?: number;
									row?: number;
									col?: number;
								};
							};
						}
					)?.range?.start;
					if (start) {
						const line = (start.line ?? start.row ?? 0) + 1;
						const ch = (start.character ?? start.col ?? 0) + 1;
						return `  - [${line}:${ch}] ${msg}`;
					}
					if (d && typeof (d as { line?: number }).line === "number") {
						const ln = ((d as { line?: number }).line ?? 0) + 1;
						const ch =
							((d as { character?: number; col?: number }).character ??
								(d as { character?: number; col?: number }).col ??
								0) + 1;
						return `  - [${ln}:${ch}] ${msg}`;
					}
					return `  - ${msg}`;
				})
				.join("\n")
		);
	} catch {
		return `${name}: ${JSON.stringify(arr)}`;
	}
}

/**
 * 格式化 AlphaTab 错误为可读的错误消息
 *
 * @param err 错误对象
 * @returns 格式化后的错误消息字符串
 */
export function formatAlphaTabError(err: unknown): string {
	const unknownErr = i18n.t("errors:unknown");
	if (!err) return unknownErr;

	const e = err as AlphaTabErrorLike;
	let errorMessage = e.message || e.error || e.toString?.() || unknownErr;

	if (e.lexerDiagnostics) {
		errorMessage += `\n\n${i18n.t("errors:lexerDiagnostics")}:\n${e.lexerDiagnostics}`;
	}

	if (Array.isArray(e.parserDiagnostics)) {
		errorMessage += `\n\n${formatDiagnosticsArray(e.parserDiagnostics, i18n.t("errors:parserDiagnostics"))}`;
	}

	if (Array.isArray(e.semanticDiagnostics)) {
		errorMessage += `\n\n${formatDiagnosticsArray(e.semanticDiagnostics, i18n.t("errors:semanticDiagnostics"))}`;
	}

	if (Array.isArray(e.diagnostics as unknown[])) {
		errorMessage += `\n\n${formatDiagnosticsArray(e.diagnostics as unknown[], i18n.t("errors:diagnostics"))}`;
	} else if (e.diagnostics) {
		try {
			errorMessage += `\n\n${i18n.t("errors:diagnostics")}:\n${JSON.stringify(e.diagnostics, null, 2)}`;
		} catch {
			// ignore
		}
	}

	return errorMessage;
}

/**
 * 从错误对象中提取错误类型
 */
export function getErrorType(err: unknown): string {
	if (!err) return i18n.t("errors:unknown");
	const e = err as AlphaTabErrorLike;
	return String(e.type ?? e.errorType ?? "AlphaTex");
}

/**
 * 格式化完整的错误信息（包含类型和消息）
 */
export function formatFullError(err: unknown): string {
	const errorType = getErrorType(err);
	const errorMessage = formatAlphaTabError(err);
	return `${errorType}: ${errorMessage}`;
}
