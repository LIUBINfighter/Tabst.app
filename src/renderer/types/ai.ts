export interface ModelStatus {
	version: string;
	downloaded: boolean;
	downloadedBytes: number;
	totalBytes: number;
	checksumVerified: boolean;
	error?: string;
}

export interface DownloadProgress {
	phase: "connecting" | "downloading" | "verifying" | "complete";
	downloadedBytes: number;
	totalBytes: number;
	speedBps?: number;
}

export interface OmrOptions {
	tuning?: string;
	instrument?: string;
	language?: string;
	maxNewTokens?: number;
	preprocess?: string;
	invert?: boolean;
}

export interface OmrRawResult {
	alphaTex: string;
	rawResponse: string;
	tokensUsed: number;
	durationMs: number;
}

export interface DiagnosticError {
	line: number;
	column: number;
	message: string;
	severity: "error" | "warning";
}

export interface OmrResult extends OmrRawResult {
	diagnosticErrors?: DiagnosticError[];
	isValidAlphaTex: boolean;
}

/**
 * Compatibility name retained for the existing desktop bridge. The current
 * HTTP-provider backend returns only `ready` or `failed`; broader states remain
 * for the web fallback and default store state until the bridge is renamed.
 */
export interface SidecarStatus {
	state: "stopped" | "starting" | "ready" | "busy" | "stopping" | "failed";
	currentJobId?: string;
	lastError?: string;
	resourceUsage?: SidecarResourceUsage;
}

export interface SidecarResourceUsage {
	pid: number;
	cpuPercent: number;
	memoryBytes: number;
}

export interface OmrJob {
	jobId: string;
	status: "pending" | "running" | "completed" | "cancelled" | "failed";
	createdAt: number;
	result?: OmrRawResult;
	error?: string;
}

export interface AiDesktopAPI {
	getModelStatus: () => Promise<ModelStatus>;
	downloadModel: (
		version: string,
		onProgress: (progress: DownloadProgress) => void,
	) => Promise<void>;
	transcribe: (imageBase64: string, options?: OmrOptions) => Promise<string>;
	getOmrResult: (jobId: string) => Promise<OmrJob>;
	cancelOmrJob: (jobId: string) => Promise<void>;
	getSidecarStatus: () => Promise<SidecarStatus>;
	stopSidecar: () => Promise<void>;
	restartSidecar: () => Promise<void>;
}
