import { create } from "zustand";
import type {
	DownloadProgress,
	OmrResult,
	SidecarResourceUsage,
	SidecarStatus,
} from "../types/ai";

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
	sidecarResourceUsage: SidecarResourceUsage | null;
	sidecarCurrentJobId: string | null;
	modelVersion: string;
	activeModel: string | null;
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
		resourceUsage?: SidecarResourceUsage | null,
		currentJobId?: string | null,
	) => void;
	setModelStatus: (
		downloaded: boolean,
		progress?: DownloadProgress | null,
		version?: string,
		activeModel?: string | null,
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
	setOmrAlphaTexValidation: (isValid: boolean, message?: string | null) => void;
	failOmr: (error: string) => void;
	cancelOmr: () => void;
	reset: () => void;
}

export const useLabStore = create<LabState>((set) => ({
	currentImage: null,
	sidecarState: "stopped",
	sidecarError: null,
	sidecarResourceUsage: null,
	sidecarCurrentJobId: null,
	modelVersion: "v1",
	activeModel: null,
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
	setSidecarState: (
		state,
		error = null,
		resourceUsage = null,
		currentJobId = null,
	) =>
		set({
			sidecarState: state,
			sidecarError: error,
			sidecarResourceUsage: resourceUsage,
			sidecarCurrentJobId: currentJobId,
		}),
	setModelStatus: (downloaded, progress = null, version, activeModel) =>
		set((state) => ({
			modelDownloaded: downloaded,
			downloadProgress: progress,
			modelVersion: version ?? state.modelVersion,
			activeModel: activeModel === undefined ? state.activeModel : activeModel,
		})),
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
		set({ jobStatus: "completed", omrStage: "validating", omrResult: result }),
	setOmrAlphaTexValidation: (isValid, message = null) =>
		set((state) => {
			if (!state.omrResult) return state;
			return {
				omrStage: "completed",
				omrResult: {
					...state.omrResult,
					isValidAlphaTex: isValid,
					diagnosticErrors: isValid
						? []
						: [
								{
									line: 1,
									column: 1,
									message: message ?? "alphaTab render failed",
									severity: "error",
								},
							],
				},
			};
		}),
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
