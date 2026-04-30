import { create } from "zustand";
import type { DownloadProgress, OmrResult, SidecarStatus } from "../types/ai";

type LabJobStatus =
	| "idle"
	| "pending"
	| "running"
	| "completed"
	| "cancelled"
	| "failed";

interface LabState {
	currentImage: string | null;
	sidecarState: SidecarStatus["state"];
	sidecarError: string | null;
	modelVersion: string;
	modelDownloaded: boolean;
	downloadProgress: DownloadProgress | null;
	currentJobId: string | null;
	jobStatus: LabJobStatus;
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
	omrResult: null,
	omrError: null,
	setCurrentImage: (image) =>
		set({ currentImage: image, omrResult: null, omrError: null }),
	setSidecarState: (state, error = null) =>
		set({ sidecarState: state, sidecarError: error }),
	setModelStatus: (downloaded, progress = null) =>
		set({ modelDownloaded: downloaded, downloadProgress: progress }),
	startOmr: (jobId) =>
		set({
			currentJobId: jobId,
			jobStatus: "running",
			omrResult: null,
			omrError: null,
		}),
	completeOmr: (result) => set({ jobStatus: "completed", omrResult: result }),
	failOmr: (error) => set({ jobStatus: "failed", omrError: error }),
	cancelOmr: () => set({ jobStatus: "cancelled", currentJobId: null }),
	reset: () =>
		set({
			currentImage: null,
			currentJobId: null,
			jobStatus: "idle",
			omrResult: null,
			omrError: null,
		}),
}));
