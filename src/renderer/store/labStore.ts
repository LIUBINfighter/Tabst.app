import { create } from "zustand";
import type { DownloadProgress, OmrResult, SidecarStatus } from "../types/ai";

type LabJobStatus =
	| "idle"
	| "pending"
	| "running"
	| "completed"
	| "cancelled"
	| "failed";

export type LabOmrStage =
	| "idle"
	| "image-ready"
	| "checking-model"
	| "downloading-model"
	| "checking-sidecar"
	| "starting-sidecar"
	| "submitting-job"
	| "recognizing"
	| "validating"
	| "completed"
	| "failed"
	| "cancelled";

export type LabRuntimeHealth =
	| "unknown"
	| "checking"
	| "healthy"
	| "warning"
	| "error";

interface LabState {
	currentImage: string | null;
	sidecarState: SidecarStatus["state"];
	sidecarError: string | null;
	modelVersion: string;
	modelDownloaded: boolean;
	downloadProgress: DownloadProgress | null;
	currentJobId: string | null;
	jobStatus: LabJobStatus;
	omrStage: LabOmrStage;
	runtimeHealth: LabRuntimeHealth;
	runtimeMessage: string | null;
	lastHealthCheckedAt: number | null;
	omrResult: OmrResult | null;
	omrError: string | null;
	setCurrentImage: (image: string | null) => void;
	setSidecarState: (
		state: SidecarStatus["state"],
		error?: string | null,
	) => void;
	setModelStatus: (
		downloaded: boolean,
		progress?: DownloadProgress | null,
	) => void;
	setOmrStage: (stage: LabOmrStage) => void;
	setRuntimeHealth: (
		health: LabRuntimeHealth,
		message?: string | null,
		checkedAt?: number | null,
	) => void;
	prepareOmr: (stage: LabOmrStage) => void;
	clearOmrFeedback: (stage?: LabOmrStage) => void;
	startOmr: (jobId: string) => void;
	completeOmr: (result: OmrResult) => void;
	failOmr: (error: string) => void;
	cancelOmr: () => void;
	reset: () => void;
}

export const useLabStore = create<LabState>((set) => ({
	currentImage: null,
	sidecarState: "stopped",
	sidecarError: null,
	modelVersion: "v1",
	modelDownloaded: false,
	downloadProgress: null,
	currentJobId: null,
	jobStatus: "idle",
	omrStage: "idle",
	runtimeHealth: "unknown",
	runtimeMessage: null,
	lastHealthCheckedAt: null,
	omrResult: null,
	omrError: null,
	setCurrentImage: (image) =>
		set({
			currentImage: image,
			currentJobId: null,
			jobStatus: "idle",
			omrStage: image ? "image-ready" : "idle",
			omrResult: null,
			omrError: null,
		}),
	setSidecarState: (state, error = null) =>
		set({ sidecarState: state, sidecarError: error }),
	setModelStatus: (downloaded, progress = null) =>
		set({ modelDownloaded: downloaded, downloadProgress: progress }),
	setOmrStage: (stage) => set({ omrStage: stage }),
	setRuntimeHealth: (health, message = null, checkedAt = Date.now()) =>
		set({
			runtimeHealth: health,
			runtimeMessage: message,
			lastHealthCheckedAt: checkedAt,
		}),
	prepareOmr: (stage) =>
		set({
			currentJobId: null,
			jobStatus: "pending",
			omrStage: stage,
			omrResult: null,
			omrError: null,
		}),
	clearOmrFeedback: (stage) =>
		set((state) => ({
			currentJobId: null,
			jobStatus: "idle",
			omrStage: stage ?? state.omrStage,
			omrResult: null,
			omrError: null,
		})),
	startOmr: (jobId) =>
		set({
			currentJobId: jobId,
			jobStatus: "running",
			omrStage: "recognizing",
			omrResult: null,
			omrError: null,
		}),
	completeOmr: (result) =>
		set({ jobStatus: "completed", omrStage: "completed", omrResult: result }),
	failOmr: (error) =>
		set({ jobStatus: "failed", omrStage: "failed", omrError: error }),
	cancelOmr: () =>
		set({ jobStatus: "cancelled", omrStage: "cancelled", currentJobId: null }),
	reset: () =>
		set({
			currentImage: null,
			currentJobId: null,
			jobStatus: "idle",
			omrStage: "idle",
			omrResult: null,
			omrError: null,
		}),
}));
