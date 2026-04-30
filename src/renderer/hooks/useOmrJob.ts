import { useCallback, useEffect, useRef } from "react";
import { validateAlphaTex } from "../lib/omr-validation";
import { useLabStore } from "../store/labStore";
import type { OmrOptions } from "../types/ai";

const POLL_INTERVAL_MS = 2000;

function dataUrlToBase64(dataUrl: string): string {
	const commaIndex = dataUrl.indexOf(",");
	return commaIndex >= 0 ? dataUrl.slice(commaIndex + 1) : dataUrl;
}

export function useOmrJob() {
	const pollTimerRef = useRef<number | null>(null);
	const currentImage = useLabStore((state) => state.currentImage);
	const currentJobId = useLabStore((state) => state.currentJobId);
	const jobStatus = useLabStore((state) => state.jobStatus);

	const clearPollTimer = useCallback(() => {
		if (pollTimerRef.current !== null) {
			window.clearTimeout(pollTimerRef.current);
			pollTimerRef.current = null;
		}
	}, []);

	const pollJob = useCallback(async (jobId: string) => {
		try {
			const job = await window.desktopAPI.ai.getOmrResult(jobId);
			if (job.status === "completed" && job.result) {
				useLabStore.getState().completeOmr(validateAlphaTex(job.result));
				return;
			}
			if (job.status === "failed") {
				useLabStore.getState().failOmr(job.error ?? "omr-request-failed");
				return;
			}
			if (job.status === "cancelled") {
				useLabStore.getState().cancelOmr();
				return;
			}

			pollTimerRef.current = window.setTimeout(() => {
				void pollJob(jobId);
			}, POLL_INTERVAL_MS);
		} catch (error) {
			useLabStore
				.getState()
				.failOmr(error instanceof Error ? error.message : String(error));
		}
	}, []);

	const startRecognition = useCallback(
		async (options?: OmrOptions) => {
			if (!currentImage) {
				useLabStore.getState().failOmr("image-required");
				return;
			}

			clearPollTimer();
			try {
				const sidecarStatus = await window.desktopAPI.ai.getSidecarStatus();
				useLabStore
					.getState()
					.setSidecarState(
						sidecarStatus.state,
						sidecarStatus.lastError ?? null,
					);
				if (
					sidecarStatus.state === "stopped" ||
					sidecarStatus.state === "failed"
				) {
					await window.desktopAPI.ai.restartSidecar();
				}

				const jobId = await window.desktopAPI.ai.transcribe(
					dataUrlToBase64(currentImage),
					options,
				);
				useLabStore.getState().startOmr(jobId);
				void pollJob(jobId);
			} catch (error) {
				useLabStore
					.getState()
					.failOmr(error instanceof Error ? error.message : String(error));
			}
		},
		[clearPollTimer, currentImage, pollJob],
	);

	const cancelRecognition = useCallback(async () => {
		if (!currentJobId) return;
		clearPollTimer();
		try {
			await window.desktopAPI.ai.cancelOmrJob(currentJobId);
		} finally {
			useLabStore.getState().cancelOmr();
		}
	}, [clearPollTimer, currentJobId]);

	useEffect(() => clearPollTimer, [clearPollTimer]);

	return {
		canRecognize: Boolean(currentImage) && jobStatus !== "running",
		startRecognition,
		cancelRecognition,
	};
}
