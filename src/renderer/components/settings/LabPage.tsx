import {
	Clipboard,
	Copy,
	FlaskConical,
	Play,
	RefreshCw,
	X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useOmrJob } from "../../hooks/useOmrJob";
import { useAppStore } from "../../store/appStore";
import { useLabStore } from "../../store/labStore";
import type { DownloadProgress } from "../../types/ai";
import { Button } from "../ui/button";
import { ImageDropzone } from "../ui/image-dropzone";

const MODEL_INPUT_SIZE = 448;

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

export function LabPage() {
	const { t } = useTranslation("settings");
	const [isWebRuntime, setIsWebRuntime] = useState(false);
	const [pageError, setPageError] = useState<string | null>(null);
	const [editableAlphaTex, setEditableAlphaTex] = useState("");
	const currentImage = useLabStore((state) => state.currentImage);
	const modelVersion = useLabStore((state) => state.modelVersion);
	const modelDownloaded = useLabStore((state) => state.modelDownloaded);
	const downloadProgress = useLabStore((state) => state.downloadProgress);
	const sidecarState = useLabStore((state) => state.sidecarState);
	const sidecarError = useLabStore((state) => state.sidecarError);
	const jobStatus = useLabStore((state) => state.jobStatus);
	const omrResult = useLabStore((state) => state.omrResult);
	const omrError = useLabStore((state) => state.omrError);
	const { canRecognize, startRecognition, cancelRecognition } = useOmrJob();

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
		let mounted = true;
		void Promise.all([
			window.desktopAPI.ai.getModelStatus(),
			window.desktopAPI.ai.getSidecarStatus(),
		])
			.then(([modelStatus, status]) => {
				if (!mounted) return;
				useLabStore.getState().setModelStatus(modelStatus.downloaded, null);
				useLabStore
					.getState()
					.setSidecarState(status.state, status.lastError ?? null);
			})
			.catch((error) => {
				if (mounted) {
					setPageError(error instanceof Error ? error.message : String(error));
				}
			});
		return () => {
			mounted = false;
		};
	}, [isWebRuntime]);

	useEffect(() => {
		setEditableAlphaTex(omrResult?.alphaTex ?? "");
	}, [omrResult]);

	const downloadPercent = useMemo(() => {
		if (!downloadProgress?.totalBytes) return 0;
		return Math.min(
			100,
			Math.round(
				(downloadProgress.downloadedBytes / downloadProgress.totalBytes) * 100,
			),
		);
	}, [downloadProgress]);

	const translateError = useCallback(
		(message: string) => t(`labErrors.${message}`, { defaultValue: message }),
		[t],
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
		try {
			await window.desktopAPI.ai.downloadModel(
				modelVersion,
				(progress: DownloadProgress) => {
					useLabStore.getState().setModelStatus(false, progress);
				},
			);
			useLabStore.getState().setModelStatus(true, {
				phase: "complete",
				downloadedBytes: downloadProgress?.totalBytes ?? 0,
				totalBytes: downloadProgress?.totalBytes ?? 0,
			});
		} catch (error) {
			setPageError(
				translateError(error instanceof Error ? error.message : String(error)),
			);
		}
	}, [downloadProgress?.totalBytes, modelVersion, translateError]);

	const handleInsertToEditor = useCallback(() => {
		if (!editableAlphaTex.trim()) return;
		if (
			omrResult &&
			!omrResult.isValidAlphaTex &&
			!window.confirm(t("labPage.invalidInsertConfirm"))
		) {
			return;
		}
		useAppStore.getState().setPendingOmrInsert(editableAlphaTex);
		useAppStore.getState().setWorkspaceMode("editor");
	}, [editableAlphaTex, omrResult, t]);

	const handleCopy = useCallback(async () => {
		if (!editableAlphaTex.trim()) return;
		await navigator.clipboard.writeText(editableAlphaTex);
	}, [editableAlphaTex]);

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
			<section className="bg-card border border-border rounded p-4">
				<div className="flex items-start justify-between gap-3">
					<div>
						<div className="flex items-center gap-2">
							<FlaskConical className="h-4 w-4 text-primary" />
							<h3 className="text-sm font-medium">{t("lab")}</h3>
						</div>
						<p className="mt-1 text-xs text-muted-foreground">{t("labDesc")}</p>
					</div>
					<div className="text-right text-xs text-muted-foreground">
						<p>{t("labPage.modelVersion", { version: modelVersion })}</p>
						<p>{t(`labPage.sidecar.${sidecarState}`)}</p>
					</div>
				</div>
				{sidecarError && (
					<p className="mt-2 text-xs text-destructive">{sidecarError}</p>
				)}
			</section>

			{!modelDownloaded && (
				<section className="bg-card border border-border rounded p-4 space-y-3">
					<h4 className="text-sm font-medium">{t("labPage.modelRequired")}</h4>
					<p className="text-xs text-muted-foreground">
						{t("labPage.modelRequiredHint")}
					</p>
					{downloadProgress && (
						<div className="space-y-1">
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
								})}
							</p>
						</div>
					)}
					<Button type="button" size="sm" onClick={handleDownloadModel}>
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
						<Play className="h-4 w-4" />
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

				<div className="text-xs text-muted-foreground">
					{t("labPage.status", { status: t(`labPage.jobStatus.${jobStatus}`) })}
				</div>
			</section>

			{(pageError || omrError) && (
				<section className="bg-destructive/10 border border-destructive rounded p-4">
					<p className="text-xs text-destructive">
						{pageError ?? translateError(omrError ?? "")}
					</p>
				</section>
			)}

			<section className="bg-card border border-border rounded p-4 space-y-3">
				<div className="flex items-center justify-between gap-2">
					<h4 className="text-sm font-medium">{t("labPage.result")}</h4>
					<div className="flex flex-wrap gap-2">
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => void startRecognition()}
							disabled={
								!currentImage || jobStatus === "running" || !modelDownloaded
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

				{omrResult && !omrResult.isValidAlphaTex && (
					<p className="text-xs text-amber-600">
						{t("labPage.invalidAlphaTex", {
							count: omrResult.diagnosticErrors?.length ?? 0,
						})}
					</p>
				)}

				<textarea
					className="min-h-56 w-full rounded border border-input bg-background p-3 font-mono text-xs outline-none focus:ring-1 focus:ring-[var(--focus-ring)]"
					value={editableAlphaTex}
					onChange={(event) => setEditableAlphaTex(event.currentTarget.value)}
					placeholder={t("labPage.resultPlaceholder")}
				/>
			</section>
		</div>
	);
}
