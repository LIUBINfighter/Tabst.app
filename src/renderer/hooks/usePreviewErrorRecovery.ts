/**
 * Parse timeout detection and last-valid-score restoration for Preview.
 */

import type * as alphaTab from "@coderline/alphatab";
import { useCallback, useRef, useState } from "react";

export const TEX_TIMEOUT_MS = 3000;
const DEFAULT_TIMEOUT_MESSAGE = "AlphaTex 解析超时（未加载新乐谱）";

export interface UsePreviewErrorRecoveryReturn {
	parseError: string | null;
	setParseError: (msg: string | null) => void;
	restorePerformed: boolean;
	lastValidScoreRef: React.MutableRefObject<{
		score: alphaTab.model.Score;
		content: string;
	} | null>;
	lastLoadWasUserContentRef: React.MutableRefObject<boolean>;
	pendingTexRef: React.MutableRefObject<{
		id: number;
		content: string;
	} | null>;
	/** Call before api.tex(content); sets pending + timeout. On timeout optionally sets parseError. */
	scheduleTexTimeout: (
		content: string,
		options?: { timeoutMessage?: string; setErrorOnTimeout?: boolean },
	) => number;
	/** Clear timer and pending refs. */
	clearTexTimeout: () => void;
	/** Call from api.error handler: set error, optionally restore last valid score. */
	onError: (api: alphaTab.AlphaTabApi | null, fullError: string) => void;
	/** Call from api.scoreLoaded when content matches pending: save lastValid, clear error. */
	onScoreLoadedMatch: (
		score: alphaTab.model.Score,
		currentContent: string,
	) => void;
	/** Mark that the next load is from user content (e.g. before tex()). */
	markLoadAsUserContent: (value: boolean) => void;
}

export function usePreviewErrorRecovery(): UsePreviewErrorRecoveryReturn {
	const [parseError, setParseError] = useState<string | null>(null);
	const [restorePerformed, setRestorePerformed] = useState(false);

	const lastValidScoreRef = useRef<{
		score: alphaTab.model.Score;
		content: string;
	} | null>(null);
	const lastLoadWasUserContentRef = useRef(true);
	const pendingTexRef = useRef<{ id: number; content: string } | null>(null);
	const pendingTexTimerRef = useRef<number | null>(null);
	const texSeqRef = useRef(0);

	const scheduleTexTimeout = useCallback(
		(
			content: string,
			options?: { timeoutMessage?: string; setErrorOnTimeout?: boolean },
		) => {
			texSeqRef.current += 1;
			const seq = texSeqRef.current;
			const setErrorOnTimeout = options?.setErrorOnTimeout !== false;
			const timeoutMessage = options?.timeoutMessage ?? DEFAULT_TIMEOUT_MESSAGE;
			pendingTexRef.current = { id: seq, content };
			if (pendingTexTimerRef.current) {
				clearTimeout(pendingTexTimerRef.current);
			}
			pendingTexTimerRef.current = window.setTimeout(() => {
				if (pendingTexRef.current?.id === seq && setErrorOnTimeout) {
					setParseError(`${timeoutMessage}（等待解析结果或检查语法）`);
				}
			}, TEX_TIMEOUT_MS);
			return seq;
		},
		[],
	);

	const clearTexTimeout = useCallback(() => {
		if (pendingTexTimerRef.current) {
			clearTimeout(pendingTexTimerRef.current);
			pendingTexTimerRef.current = null;
		}
		pendingTexRef.current = null;
	}, []);

	const onError = useCallback(
		(api: alphaTab.AlphaTabApi | null, fullError: string) => {
			setParseError(fullError);
			if (pendingTexTimerRef.current) {
				clearTimeout(pendingTexTimerRef.current);
				pendingTexTimerRef.current = null;
			}
			pendingTexRef.current = null;
			if (lastValidScoreRef.current?.score && api) {
				try {
					lastLoadWasUserContentRef.current = false;
					setRestorePerformed(true);
					api.renderScore(lastValidScoreRef.current.score, [0]);
				} catch (err) {
					console.error(
						"[usePreviewErrorRecovery] Failed to restore last valid score:",
						err,
					);
				}
			}
		},
		[],
	);

	const onScoreLoadedMatch = useCallback(
		(score: alphaTab.model.Score, currentContent: string) => {
			if (
				pendingTexRef.current &&
				pendingTexRef.current.content === currentContent
			) {
				lastValidScoreRef.current = { score, content: currentContent };
				setParseError(null);
				if (pendingTexTimerRef.current) {
					clearTimeout(pendingTexTimerRef.current);
					pendingTexTimerRef.current = null;
				}
				pendingTexRef.current = null;
				setRestorePerformed(false);
			}
			lastLoadWasUserContentRef.current = false;
		},
		[],
	);

	const markLoadAsUserContent = useCallback((value: boolean) => {
		lastLoadWasUserContentRef.current = value;
	}, []);

	return {
		parseError,
		setParseError,
		restorePerformed,
		lastValidScoreRef,
		lastLoadWasUserContentRef,
		pendingTexRef,
		scheduleTexTimeout,
		clearTexTimeout,
		onError,
		onScoreLoadedMatch,
		markLoadAsUserContent,
	};
}
