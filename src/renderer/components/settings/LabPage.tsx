import {
	AlertTriangle,
	CheckCircle2,
	Circle,
	Clipboard,
	Copy,
	Download,
	FlaskConical,
	Loader2,
	Play,
	RefreshCw,
	RotateCcw,
	Server,
	ShieldCheck,
	X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useOmrJob } from "../../hooks/useOmrJob";
import { useAppStore } from "../../store/appStore";
import {
	type LabOmrStage,
	type LabRuntimeHealth,
	useLabStore,
} from "../../store/labStore";
import type { DownloadProgress, SidecarStatus } from "../../types/ai";
import { TutorialAlphaTexPlayground } from "../tutorial/TutorialAlphaTexPlayground";
import type { TutorialPlaygroundRenderStatus } from "../tutorial/TutorialPlaygroundPreview";
import { Button } from "../ui/button";
import { ImageDropzone } from "../ui/image-dropzone";

const MODEL_INPUT_SIZE = 448;
const LONG_STARTUP_HINT_MS = 10_000;
const RECOGNITION_TIMEOUT_HINT_MS = 60_000;
const TIMED_STAGES = new Set<LabOmrStage>([
	"checking-model",
	"downloading-model",
	"checking-sidecar",
	"starting-sidecar",
	"submitting-job",
	"recognizing",
	"validating",
]);

type StageTone = "idle" | "running" | "done" | "failed" | "cancelled";

type AlphaTexRenderValidation =
	| { state: "empty" | "pending" | "valid" }
	| { state: "invalid"; message: string };

interface PipelineStep {
	stage: LabOmrStage;
	tone: StageTone;
}

function formatBytes(bytes: number): string {
	if (bytes <= 0) return "0 B";
	const units = ["B", "KB", "MB", "GB"];
	const index = Math.min(
		Math.floor(Math.log(bytes) / Math.log(1024)),
		units.length - 1,
	);
	const value = bytes / 1024 ** index;
	return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatDuration(milliseconds: number): string {
	const seconds = Math.max(0, Math.floor(milliseconds / 1000));
	const minutes = Math.floor(seconds / 60);
	const remainingSeconds = seconds % 60;
	if (minutes <= 0) return `${remainingSeconds}s`;
	return `${minutes}m ${remainingSeconds.toString().padStart(2, "0")}s`;
}

function dataUrlToImage(dataUrl: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const image = new Image();
		image.onload = () => resolve(image);
		image.onerror = () => reject(new Error("image-format-unsupported"));
		image.src = dataUrl;
	});
}

async function resizeImageDataUrl(dataUrl: string): Promise<string> {
	const image = await dataUrlToImage(dataUrl);
	const scale = Math.min(
		1,
		MODEL_INPUT_SIZE / Math.max(image.naturalWidth, image.naturalHeight),
	);
	const width = Math.max(1, Math.round(image.naturalWidth * scale));
	const height = Math.max(1, Math.round(image.naturalHeight * scale));
	const canvas = document.createElement("canvas");
	canvas.width = width;
	canvas.height = height;
	const context = canvas.getContext("2d");
	if (!context) return dataUrl;
	context.drawImage(image, 0, 0, width, height);
	return canvas.toDataURL("image/png");
}

function getHealthToneClass(health: LabRuntimeHealth): string {
	switch (health) {
		case "healthy":
			return "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
		case "checking":
			return "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300";
		case "warning":
			return "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300";
		case "error":
			return "border-destructive/40 bg-destructive/10 text-destructive";
		default:
			return "border-border bg-muted/40 text-muted-foreground";
	}
}

function getStageToneClass(tone: StageTone): string {
	switch (tone) {
		case "running":
			return "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300";
		case "done":
			return "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
		case "failed":
			return "border-destructive/40 bg-destructive/10 text-destructive";
		case "cancelled":
			return "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300";
		default:
			return "border-border bg-background text-muted-foreground";
	}
}

function getHealthFromSidecar(
	modelDownloaded: boolean,
	status: SidecarStatus,
	modelError?: string,
): LabRuntimeHealth {
	if (modelError) return "error";
	if (!modelDownloaded) return "warning";
	if (status.state === "failed") return "error";
	if (status.state === "starting" || status.state === "stopping")
		return "checking";
	if (status.state === "stopped") return "warning";
	return "healthy";
}

function getStageSteps(stage: LabOmrStage, hasImage: boolean): PipelineStep[] {
	const order: LabOmrStage[] = [
		"image-ready",
		"checking-model",
		"downloading-model",
		"checking-sidecar",
		"starting-sidecar",
		"submitting-job",
		"recognizing",
		"validating",
		"completed",
	];
	const activeIndex = order.indexOf(stage);

	return order.map((step, index) => {
		if (stage === "failed") return { stage: step, tone: "failed" };
		if (stage === "cancelled") return { stage: step, tone: "cancelled" };
		if (step === "image-ready" && hasImage && activeIndex < 0) {
			return { stage: step, tone: "done" };
		}
		if (activeIndex < 0) return { stage: step, tone: "idle" };
		if (index < activeIndex) return { stage: step, tone: "done" };
		if (index === activeIndex) {
			return { stage: step, tone: step === "completed" ? "done" : "running" };
		}
		return { stage: step, tone: "idle" };
	});
}

export function LabPage() {
	const { t } = useTranslation("settings");
	const [isWebRuntime, setIsWebRuntime] = useState(false);
	const [pageError, setPageError] = useState<string | null>(null);
	const [editableAlphaTex, setEditableAlphaTex] = useState("");
	const editableAlphaTexRef = useRef("");
	const [alphaTexRenderValidation, setAlphaTexRenderValidation] =
		useState<AlphaTexRenderValidation>({ state: "empty" });
	const [busySince, setBusySince] = useState<number | null>(null);
	const [now, setNow] = useState(() => Date.now());
	const currentImage = useLabStore((state) => state.currentImage);
	const modelVersion = useLabStore((state) => state.modelVersion);
	const activeModel = useLabStore((state) => state.activeModel);
	const modelDownloaded = useLabStore((state) => state.modelDownloaded);
	const downloadProgress = useLabStore((state) => state.downloadProgress);
	const sidecarState = useLabStore((state) => state.sidecarState);
	const sidecarError = useLabStore((state) => state.sidecarError);
	const sidecarResourceUsage = useLabStore(
		(state) => state.sidecarResourceUsage,
	);
	const sidecarCurrentJobId = useLabStore((state) => state.sidecarCurrentJobId);
	const jobStatus = useLabStore((state) => state.jobStatus);
	const omrStage = useLabStore((state) => state.omrStage);
	const runtimeHealth = useLabStore((state) => state.runtimeHealth);
	const runtimeMessage = useLabStore((state) => state.runtimeMessage);
	const lastHealthCheckedAt = useLabStore((state) => state.lastHealthCheckedAt);
	const omrResult = useLabStore((state) => state.omrResult);
	const omrError = useLabStore((state) => state.omrError);
	const { canRecognize, startRecognition, cancelRecognition } = useOmrJob();

	const translateError = useCallback(
		(message: string) => t(`labErrors.${message}`, { defaultValue: message }),
		[t],
	);

	const refreshRuntimeStatus = useCallback(async () => {
		setPageError(null);
		useLabStore.getState().setRuntimeHealth("checking", null);
		try {
			const [modelStatus, status] = await Promise.all([
				window.desktopAPI.ai.getModelStatus(),
				window.desktopAPI.ai.getSidecarStatus(),
			]);
			useLabStore
				.getState()
				.setModelStatus(
					modelStatus.downloaded,
					null,
					modelStatus.version,
					modelStatus.activeModel ?? null,
				);
			useLabStore
				.getState()
				.setSidecarState(
					status.state,
					status.lastError ?? null,
					status.resourceUsage ?? null,
					status.currentJobId ?? null,
				);
			const health = getHealthFromSidecar(
				modelStatus.downloaded,
				status,
				modelStatus.error,
			);
			const message = modelStatus.error
				? modelStatus.error
				: !modelStatus.downloaded
					? "model-not-found"
					: (status.lastError ??
						(status.state === "stopped" ? "sidecar-stopped" : null));
			useLabStore.getState().setRuntimeHealth(health, message);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			useLabStore.getState().setRuntimeHealth("error", message);
			setPageError(translateError(message));
		}
	}, [translateError]);

	useEffect(() => {
		let mounted = true;
		void window.desktopAPI
			.getAppVersion()
			.then((version) => {
				if (mounted) setIsWebRuntime(version === "web");
			})
			.catch(() => {
				if (mounted) setIsWebRuntime(false);
			});
		return () => {
			mounted = false;
		};
	}, []);

	useEffect(() => {
		if (isWebRuntime) return;
		void refreshRuntimeStatus();
	}, [isWebRuntime, refreshRuntimeStatus]);

	useEffect(() => {
		const nextAlphaTex = omrResult?.alphaTex ?? "";
		setEditableAlphaTex(nextAlphaTex);
		editableAlphaTexRef.current = nextAlphaTex;
		setAlphaTexRenderValidation(
			nextAlphaTex.trim() ? { state: "pending" } : { state: "empty" },
		);
	}, [omrResult?.alphaTex]);

	const handleAlphaTexChange = useCallback((nextAlphaTex: string) => {
		editableAlphaTexRef.current = nextAlphaTex;
		setEditableAlphaTex(nextAlphaTex);
		setAlphaTexRenderValidation(
			nextAlphaTex.trim() ? { state: "pending" } : { state: "empty" },
		);
		if (nextAlphaTex.trim()) {
			useLabStore.getState().setOmrStage("validating");
		}
	}, []);

	const handlePlaygroundRenderStatus = useCallback(
		(status: TutorialPlaygroundRenderStatus) => {
			if (status.content !== editableAlphaTexRef.current) return;

			if (status.state === "empty") {
				setAlphaTexRenderValidation({ state: "empty" });
				return;
			}

			if (status.state === "loading") {
				setAlphaTexRenderValidation({ state: "pending" });
				useLabStore.getState().setOmrStage("validating");
				return;
			}

			if (status.state === "success") {
				setAlphaTexRenderValidation({ state: "valid" });
				useLabStore.getState().setOmrAlphaTexValidation(true);
				return;
			}

			if (status.state === "error") {
				setAlphaTexRenderValidation({
					state: "invalid",
					message: status.error,
				});
				useLabStore.getState().setOmrAlphaTexValidation(false, status.error);
			}
		},
		[],
	);

	useEffect(() => {
		if (TIMED_STAGES.has(omrStage) && busySince === null) {
			setBusySince(Date.now());
			return;
		}
		if (!TIMED_STAGES.has(omrStage)) {
			setBusySince(null);
		}
	}, [busySince, omrStage]);

	useEffect(() => {
		if (!TIMED_STAGES.has(omrStage) && runtimeHealth !== "checking") return;
		const timer = window.setInterval(() => setNow(Date.now()), 1000);
		return () => window.clearInterval(timer);
	}, [omrStage, runtimeHealth]);

	const busyElapsedMs = busySince ? now - busySince : 0;
	const isLongStartup =
		omrStage === "checking-sidecar" && busyElapsedMs > LONG_STARTUP_HINT_MS;
	const healthLabel = t(`labPage.runtimeHealth.${runtimeHealth}`);
	const healthDetail = runtimeMessage ? translateError(runtimeMessage) : null;
	const lastCheckedLabel = lastHealthCheckedAt
		? t("labPage.lastChecked", {
				time: formatDuration(Date.now() - lastHealthCheckedAt),
			})
		: t("labPage.notChecked");
	const sidecarResourceLabel = sidecarResourceUsage
		? t("labPage.resourceUsage", {
				pid: sidecarResourceUsage.pid,
				cpu: sidecarResourceUsage.cpuPercent.toFixed(1),
				memory: formatBytes(sidecarResourceUsage.memoryBytes),
			})
		: t("labPage.resourceIdle");
	const hasBusySidecar =
		Boolean(sidecarCurrentJobId) || sidecarState === "busy";

	const downloadPercent = useMemo(() => {
		if (!downloadProgress?.totalBytes) return 0;
		return Math.min(
			100,
			Math.round(
				(downloadProgress.downloadedBytes / downloadProgress.totalBytes) * 100,
			),
		);
	}, [downloadProgress]);

	const downloadEta = useMemo(() => {
		if (!downloadProgress?.speedBps || !downloadProgress.totalBytes)
			return null;
		const remainingBytes = Math.max(
			0,
			downloadProgress.totalBytes - downloadProgress.downloadedBytes,
		);
		if (remainingBytes <= 0) return null;
		return formatDuration((remainingBytes / downloadProgress.speedBps) * 1000);
	}, [downloadProgress]);

	const pipelineSteps = useMemo(
		() => getStageSteps(omrStage, Boolean(currentImage)),
		[currentImage, omrStage],
	);

	const handleImage = useCallback(
		async (dataUrl: string) => {
			setPageError(null);
			try {
				useLabStore
					.getState()
					.setCurrentImage(await resizeImageDataUrl(dataUrl));
			} catch (error) {
				setPageError(
					translateError(
						error instanceof Error ? error.message : String(error),
					),
				);
			}
		},
		[translateError],
	);

	const handlePaste = useCallback(async () => {
		setPageError(null);
		try {
			if (!navigator.clipboard?.read) {
				throw new Error("clipboard-no-image");
			}
			const items = await navigator.clipboard.read();
			for (const item of items) {
				const imageType = item.types.find((type) => type.startsWith("image/"));
				if (!imageType) continue;
				const blob = await item.getType(imageType);
				const file = new File([blob], "clipboard-image", { type: imageType });
				const reader = new FileReader();
				const dataUrl = await new Promise<string>((resolve, reject) => {
					reader.onload = () => {
						if (typeof reader.result === "string") resolve(reader.result);
						else reject(new Error("clipboard-no-image"));
					};
					reader.onerror = () => reject(new Error("clipboard-no-image"));
					reader.readAsDataURL(file);
				});
				await handleImage(dataUrl);
				return;
			}
			throw new Error("clipboard-no-image");
		} catch (error) {
			setPageError(
				translateError(error instanceof Error ? error.message : String(error)),
			);
		}
	}, [handleImage, translateError]);

	const handleDownloadModel = useCallback(async () => {
		setPageError(null);
		useLabStore.getState().clearOmrFeedback("downloading-model");
		useLabStore.getState().setOmrStage("downloading-model");
		useLabStore.getState().setRuntimeHealth("checking", "provider-unavailable");
		try {
			await window.desktopAPI.ai.downloadModel(
				modelVersion,
				(progress: DownloadProgress) => {
					useLabStore.getState().setModelStatus(false, progress);
				},
			);
			const completedBytes =
				useLabStore.getState().downloadProgress?.totalBytes ?? 0;
			useLabStore.getState().setModelStatus(
				true,
				{
					phase: "complete",
					downloadedBytes: completedBytes,
					totalBytes: completedBytes,
				},
				modelVersion,
			);
			useLabStore
				.getState()
				.clearOmrFeedback(currentImage ? "image-ready" : "idle");
			await refreshRuntimeStatus();
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			useLabStore.getState().setRuntimeHealth("error", message);
			useLabStore.getState().setOmrStage("failed");
			setPageError(translateError(message));
		}
	}, [currentImage, modelVersion, refreshRuntimeStatus, translateError]);

	const handleRestartSidecar = useCallback(async () => {
		setPageError(null);
		useLabStore.getState().clearOmrFeedback("checking-sidecar");
		useLabStore.getState().setOmrStage("checking-sidecar");
		useLabStore.getState().setRuntimeHealth("checking", null);
		try {
			await refreshRuntimeStatus();
			useLabStore.getState().setOmrStage(currentImage ? "image-ready" : "idle");
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			useLabStore.getState().setRuntimeHealth("error", message);
			useLabStore.getState().setOmrStage("failed");
			setPageError(translateError(message));
		}
	}, [currentImage, refreshRuntimeStatus, translateError]);

	const handleInsertToEditor = useCallback(() => {
		if (!editableAlphaTex.trim()) return;
		if (
			alphaTexRenderValidation.state === "invalid" &&
			!window.confirm(t("labPage.invalidInsertConfirm"))
		) {
			return;
		}
		useAppStore.getState().setPendingOmrInsert(editableAlphaTex);
		useAppStore.getState().setWorkspaceMode("editor");
	}, [alphaTexRenderValidation.state, editableAlphaTex, t]);

	const handleCopy = useCallback(async () => {
		if (!editableAlphaTex.trim()) return;
		await navigator.clipboard.writeText(editableAlphaTex);
	}, [editableAlphaTex]);

	const errorMessage =
		pageError ?? (omrError ? translateError(omrError) : null);

	if (isWebRuntime) {
		return (
			<section className="bg-card border border-border rounded p-4">
				<h3 className="text-sm font-medium mb-2">{t("lab")}</h3>
				<p className="text-xs text-muted-foreground">
					{t("labPage.desktopOnly")}
				</p>
			</section>
		);
	}

	return (
		<div className="space-y-4">
			<section className="bg-card border border-border rounded p-4 space-y-4">
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div>
						<div className="flex items-center gap-2">
							<FlaskConical className="h-4 w-4 text-primary" />
							<h3 className="text-sm font-medium">{t("lab")}</h3>
						</div>
						<p className="mt-1 text-xs text-muted-foreground">{t("labDesc")}</p>
					</div>
					<div className="flex flex-wrap gap-2">
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => void refreshRuntimeStatus()}
						>
							<RefreshCw className="h-4 w-4" />
							{t("labPage.refreshStatus")}
						</Button>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => void handleRestartSidecar()}
							disabled={
								jobStatus === "running" ||
								jobStatus === "pending" ||
								hasBusySidecar
							}
						>
							<RotateCcw className="h-4 w-4" />
							{t("labPage.restartService")}
						</Button>
					</div>
				</div>

				<div
					className={`rounded border p-3 ${getHealthToneClass(runtimeHealth)}`}
				>
					<div className="flex flex-wrap items-center justify-between gap-2">
						<div className="flex items-center gap-2">
							{runtimeHealth === "checking" ? (
								<Loader2 className="h-4 w-4 animate-spin" />
							) : runtimeHealth === "error" ? (
								<AlertTriangle className="h-4 w-4" />
							) : runtimeHealth === "healthy" ? (
								<ShieldCheck className="h-4 w-4" />
							) : (
								<Server className="h-4 w-4" />
							)}
							<div>
								<p className="text-sm font-medium">{healthLabel}</p>
								<p className="text-xs opacity-80">
									{healthDetail ?? t("labPage.runtimeReadyHint")}
								</p>
							</div>
						</div>
						<div className="text-right text-xs opacity-80">
							<p>{t("labPage.activeModel", { model: activeModel ?? "—" })}</p>
							<p>{t("labPage.modelVersion", { version: modelVersion })}</p>
							<p>{t(`labPage.sidecar.${sidecarState}`)}</p>
							<p>{sidecarResourceLabel}</p>
							<p>{lastCheckedLabel}</p>
						</div>
					</div>
					{sidecarError && (
						<p className="mt-2 text-xs text-destructive">{sidecarError}</p>
					)}
				</div>
			</section>

			{!modelDownloaded && (
				<section className="bg-card border border-border rounded p-4 space-y-3">
					<div className="flex items-start gap-2">
						<Download className="mt-0.5 h-4 w-4 text-primary" />
						<div>
							<h4 className="text-sm font-medium">
								{t("labPage.modelRequired")}
							</h4>
							<p className="text-xs text-muted-foreground">
								{t("labPage.modelRequiredHint")}
							</p>
						</div>
					</div>
					{downloadProgress && (
						<div className="space-y-1" aria-live="polite">
							<div className="h-2 rounded bg-muted overflow-hidden">
								<div
									className="h-full bg-primary transition-all"
									style={{ width: `${downloadPercent}%` }}
								/>
							</div>
							<p className="text-xs text-muted-foreground">
								{t("labPage.downloadProgress", {
									phase: t(`labPage.downloadPhase.${downloadProgress.phase}`),
									percent: downloadPercent,
									downloaded: formatBytes(downloadProgress.downloadedBytes),
									total: formatBytes(downloadProgress.totalBytes),
									speed: downloadProgress.speedBps
										? formatBytes(downloadProgress.speedBps)
										: "—",
									eta: downloadEta ?? "—",
								})}
							</p>
						</div>
					)}
					<Button
						type="button"
						size="sm"
						onClick={handleDownloadModel}
						disabled={omrStage === "downloading-model"}
					>
						{omrStage === "downloading-model" && (
							<Loader2 className="h-4 w-4 animate-spin" />
						)}
						{t("labPage.downloadModel")}
					</Button>
				</section>
			)}

			<section className="bg-card border border-border rounded p-4 space-y-4">
				<div className="flex flex-wrap items-center gap-2">
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={handlePaste}
					>
						<Clipboard className="h-4 w-4" />
						{t("labPage.paste")}
					</Button>
					<Button
						type="button"
						size="sm"
						onClick={() => void startRecognition()}
						disabled={!modelDownloaded || !canRecognize}
					>
						{jobStatus === "running" ? (
							<Loader2 className="h-4 w-4 animate-spin" />
						) : (
							<Play className="h-4 w-4" />
						)}
						{t("labPage.startRecognition")}
					</Button>
					{jobStatus === "running" && (
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={cancelRecognition}
						>
							<X className="h-4 w-4" />
							{t("labPage.cancel")}
						</Button>
					)}
				</div>

				<ImageDropzone
					onImage={(dataUrl) => void handleImage(dataUrl)}
					onError={(message) => setPageError(translateError(message))}
					selectLabel={t("labPage.selectImage")}
					dropLabel={t("labPage.dropLabel")}
					dropHint={t("labPage.dropHint")}
				/>

				{currentImage && (
					<div className="rounded border border-border p-2">
						<img
							src={currentImage}
							alt={t("labPage.previewAlt")}
							className="max-h-64 max-w-full rounded object-contain"
						/>
					</div>
				)}
			</section>

			<section className="bg-card border border-border rounded p-4 space-y-3">
				<div className="flex flex-wrap items-center justify-between gap-2">
					<div>
						<h4 className="text-sm font-medium">
							{t("labPage.pipelineTitle")}
						</h4>
						<p className="text-xs text-muted-foreground">
							{t(`labPage.stageHint.${omrStage}`)}
						</p>
					</div>
					{jobStatus === "running" && (
						<div className="flex items-center gap-1 text-xs text-muted-foreground">
							<Loader2 className="h-3.5 w-3.5 animate-spin" />
							{t("labPage.elapsed", { time: formatDuration(busyElapsedMs) })}
						</div>
					)}
				</div>
				<div className="grid gap-2 md:grid-cols-4">
					{pipelineSteps.map((step) => (
						<div
							key={step.stage}
							className={`rounded border p-2 ${getStageToneClass(step.tone)}`}
						>
							<div className="flex items-center gap-2 text-xs font-medium">
								{step.tone === "running" ? (
									<Loader2 className="h-3.5 w-3.5 animate-spin" />
								) : step.tone === "done" ? (
									<CheckCircle2 className="h-3.5 w-3.5" />
								) : step.tone === "failed" ? (
									<AlertTriangle className="h-3.5 w-3.5" />
								) : (
									<Circle className="h-3.5 w-3.5" />
								)}
								{t(`labPage.stage.${step.stage}`)}
							</div>
						</div>
					))}
				</div>
				{isLongStartup && (
					<p className="flex items-center gap-2 text-xs text-amber-600">
						<AlertTriangle className="h-3.5 w-3.5" />
						{t("labPage.longStartupHint")}
					</p>
				)}
				{jobStatus === "running" &&
					busyElapsedMs > RECOGNITION_TIMEOUT_HINT_MS && (
						<p className="flex items-center gap-2 text-xs text-amber-600">
							<AlertTriangle className="h-3.5 w-3.5" />
							{t("labPage.longRecognitionHint")}
						</p>
					)}
			</section>

			{errorMessage && (
				<section className="bg-destructive/10 border border-destructive rounded p-4 space-y-3">
					<div className="flex items-start gap-2">
						<AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" />
						<div>
							<h4 className="text-sm font-medium text-destructive">
								{t("labPage.recoveryTitle")}
							</h4>
							<p className="text-xs text-destructive">{errorMessage}</p>
							<p className="mt-1 text-xs text-muted-foreground">
								{t("labPage.recoveryHint")}
							</p>
						</div>
					</div>
					<div className="flex flex-wrap gap-2">
						{!modelDownloaded && (
							<Button
								type="button"
								size="sm"
								onClick={handleDownloadModel}
								disabled={omrStage === "downloading-model"}
							>
								{omrStage === "downloading-model" ? (
									<Loader2 className="h-4 w-4 animate-spin" />
								) : (
									<Download className="h-4 w-4" />
								)}
								{t("labPage.downloadModel")}
							</Button>
						)}
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => void refreshRuntimeStatus()}
						>
							<RefreshCw className="h-4 w-4" />
							{t("labPage.refreshStatus")}
						</Button>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => void handleRestartSidecar()}
							disabled={
								!modelDownloaded ||
								jobStatus === "running" ||
								jobStatus === "pending" ||
								hasBusySidecar ||
								sidecarState === "starting" ||
								sidecarState === "stopping"
							}
						>
							<RotateCcw className="h-4 w-4" />
							{t("labPage.restartService")}
						</Button>
						{currentImage &&
							modelDownloaded &&
							jobStatus !== "running" &&
							jobStatus !== "pending" && (
								<Button
									type="button"
									size="sm"
									onClick={() => void startRecognition()}
								>
									<Play className="h-4 w-4" />
									{t("labPage.retry")}
								</Button>
							)}
					</div>
				</section>
			)}

			<section className="bg-card border border-border rounded p-4 space-y-3">
				<div className="flex items-center justify-between gap-2">
					<div>
						<h4 className="text-sm font-medium">{t("labPage.result")}</h4>
						{omrStage === "validating" && (
							<p className="flex items-center gap-1 text-xs text-muted-foreground">
								<Loader2 className="h-3.5 w-3.5 animate-spin" />
								{t("labPage.validating")}
							</p>
						)}
					</div>
					<div className="flex flex-wrap gap-2">
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => void startRecognition()}
							disabled={
								!currentImage ||
								jobStatus === "running" ||
								jobStatus === "pending" ||
								!modelDownloaded
							}
						>
							<RefreshCw className="h-4 w-4" />
							{t("labPage.retry")}
						</Button>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => void handleCopy()}
							disabled={!editableAlphaTex.trim()}
						>
							<Copy className="h-4 w-4" />
							{t("labPage.copy")}
						</Button>
						<Button
							type="button"
							size="sm"
							onClick={handleInsertToEditor}
							disabled={!editableAlphaTex.trim()}
						>
							{t("labPage.insertToEditor")}
						</Button>
					</div>
				</div>

				{alphaTexRenderValidation.state === "invalid" && (
					<p className="flex items-center gap-2 text-xs text-amber-600">
						<AlertTriangle className="h-3.5 w-3.5" />
						{t("labPage.invalidAlphaTex", {
							message: alphaTexRenderValidation.message,
						})}
					</p>
				)}

				{alphaTexRenderValidation.state === "valid" && (
					<p className="flex items-center gap-2 text-xs text-emerald-600">
						<CheckCircle2 className="h-3.5 w-3.5" />
						{t("labPage.validAlphaTex")}
					</p>
				)}

				<TutorialAlphaTexPlayground
					initialContent={editableAlphaTex}
					fileName="omr-result.atex"
					title={t("labPage.playgroundTitle")}
					labels={{
						enableMetronome: t("labPage.playground.enableMetronome"),
						disableMetronome: t("labPage.playground.disableMetronome"),
						play: t("labPage.playground.play"),
						pause: t("labPage.playground.pause"),
						stop: t("labPage.playground.stop"),
						emptyPreview: t("labPage.resultPlaceholder"),
						loadingPreview: t("labPage.playground.loadingPreview"),
					}}
					className="my-0 max-w-none"
					onChange={handleAlphaTexChange}
					onRenderStatusChange={handlePlaygroundRenderStatus}
				/>
			</section>
		</div>
	);
}
