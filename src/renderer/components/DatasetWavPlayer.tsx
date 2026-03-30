import { AlertCircle, Loader2, Play, Volume2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { SampleArtifactManifest } from "../types/dataset";

const EMPTY_VTT_TRACK = "data:text/vtt;charset=utf-8,WEBVTT%0A%0A";

export interface DatasetWavPlayerProps {
	repoPath: string | null;
	datasetId: string;
	sampleId: string;
	artifact: SampleArtifactManifest;
	/**
	 * If provided, toggling this value triggers a "load all audio" behavior
	 * for this specific artifact (does not autoplay by default).
	 */
	loadAllNonce?: number;
	autoPlayOnExternalLoad?: boolean;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
	return bytes.buffer.slice(
		bytes.byteOffset,
		bytes.byteOffset + bytes.byteLength,
	) as ArrayBuffer;
}

function buildDatasetArtifactPath(
	repoPath: string,
	datasetId: string,
	sampleId: string,
	fileName: string,
): string {
	const separator = repoPath.includes("\\") ? "\\" : "/";
	const rootPath = repoPath.replace(/[\\/]+$/, "");
	return [
		rootPath,
		".tabel",
		"datasets",
		datasetId,
		"samples",
		sampleId,
		fileName,
	].join(separator);
}

function getAudioMimeType(fileName: string): string {
	const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
	switch (ext) {
		case "wav":
			return "audio/wav";
		case "mp3":
			return "audio/mpeg";
		case "m4a":
			return "audio/mp4";
		case "mp4":
			return "audio/mp4";
		case "ogg":
			return "audio/ogg";
		case "oga":
			return "audio/ogg";
		case "flac":
			return "audio/flac";
		default:
			return "application/octet-stream";
	}
}

export function DatasetWavPlayer({
	repoPath,
	datasetId,
	sampleId,
	artifact,
	loadAllNonce,
	autoPlayOnExternalLoad = false,
}: DatasetWavPlayerProps) {
	const [audioUrl, setAudioUrl] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [loadRequestKey, setLoadRequestKey] = useState<string | null>(null);
	const [autoPlayOnLoad, setAutoPlayOnLoad] = useState(false);
	const audioRef = useRef<HTMLAudioElement | null>(null);
	// Keep height stable across state transitions (missing/stale/loading/ready).
	// Otherwise, when exporting WAV near the bottom, the scroll container can "jump".
	const minHeightClassName = "min-h-[92px]";

	const currentKey = `${datasetId}:${sampleId}:${artifact.fileName}`;
	const shouldLoad = loadRequestKey === currentKey;

	const artifactPath = useMemo(() => {
		if (!repoPath || !artifact.fileName) return null;
		return buildDatasetArtifactPath(
			repoPath,
			datasetId,
			sampleId,
			artifact.fileName,
		);
	}, [artifact.fileName, datasetId, repoPath, sampleId]);

	useEffect(() => {
		// Reset when artifact becomes non-ready.
		if (artifact.state !== "ready" || !artifactPath) {
			setAudioUrl((currentUrl) => {
				if (currentUrl) {
					URL.revokeObjectURL(currentUrl);
				}
				return null;
			});
			setIsLoading(false);
			setError(null);
			setLoadRequestKey(null);
			setAutoPlayOnLoad(false);
			return;
		}

		// User-driven loading:
		// Only start reading bytes after the user clicks play.
		if (!shouldLoad) {
			setIsLoading(false);
			setError(null);
			setAudioUrl((currentUrl) => {
				if (currentUrl) {
					URL.revokeObjectURL(currentUrl);
				}
				return null;
			});
			return;
		}

		// When switching samples quickly but still user-initiated,
		// avoid kicking off heavy WAV IO for every intermediate selection.
		const LOAD_DEBOUNCE_MS = 200;
		let cancelled = false;
		let nextObjectUrl: string | null = null;
		let timeoutId: number | null = null;

		setIsLoading(true);
		setError(null);

		timeoutId = window.setTimeout(() => {
			void window.desktopAPI
				.readFileBytes(artifactPath)
				.then((result) => {
					if (cancelled) return;
					if (!result.data) {
						setError(result.error ?? "Failed to load WAV artifact.");
						setAudioUrl((currentUrl) => {
							if (currentUrl) {
								URL.revokeObjectURL(currentUrl);
							}
							return null;
						});
						return;
					}

					nextObjectUrl = URL.createObjectURL(
						new Blob([toArrayBuffer(result.data)], {
							type: getAudioMimeType(artifact.fileName),
						}),
					);
					setAudioUrl((currentUrl) => {
						if (currentUrl) {
							URL.revokeObjectURL(currentUrl);
						}
						return nextObjectUrl;
					});
				})
				.catch((loadError) => {
					if (cancelled) return;
					setError(
						loadError instanceof Error
							? loadError.message
							: "Failed to load WAV artifact.",
					);
					setAudioUrl((currentUrl) => {
						if (currentUrl) {
							URL.revokeObjectURL(currentUrl);
						}
						return null;
					});
				})
				.finally(() => {
					if (!cancelled) {
						setIsLoading(false);
					}
				});
		}, LOAD_DEBOUNCE_MS);

		return () => {
			cancelled = true;
			if (timeoutId) window.clearTimeout(timeoutId);
			if (nextObjectUrl) {
				URL.revokeObjectURL(nextObjectUrl);
			}
		};
	}, [artifact.fileName, artifact.state, artifactPath, shouldLoad]);

	// External "load all" trigger (parent controls whether it autoplay).
	useEffect(() => {
		if (typeof loadAllNonce !== "number") return;
		// nonce=0 means "not triggered yet" (so we don't auto-load on mount).
		if (loadAllNonce === 0) return;
		if (artifact.state !== "ready") return;
		if (audioUrl) return;

		setLoadRequestKey(currentKey);
		setAutoPlayOnLoad(Boolean(autoPlayOnExternalLoad));
	}, [
		loadAllNonce,
		artifact.state,
		audioUrl,
		currentKey,
		autoPlayOnExternalLoad,
	]);

	// If we just loaded and user requested autoplay, try to play.
	useEffect(() => {
		if (!autoPlayOnLoad) return;
		if (!audioUrl) return;

		// Attempt play; if blocked by browser, user can press Play again.
		audioRef.current?.play().catch(() => {});
		setAutoPlayOnLoad(false);
	}, [autoPlayOnLoad, audioUrl]);

	if (artifact.state === "missing") {
		return (
			<div className={minHeightClassName}>
				<div className="rounded border border-dashed border-border/60 px-3 py-2 space-y-2">
					<div className="text-[11px] text-muted-foreground break-all">
						{artifact.fileName}
					</div>
				</div>
			</div>
		);
	}

	if (artifact.state === "stale") {
		return (
			<div className={minHeightClassName}>
				<div className="rounded border border-amber-500/30 bg-amber-500/10 px-3 py-2 space-y-2">
					<div className="text-[11px] text-amber-700 dark:text-amber-300 break-all">
						{artifact.fileName}
					</div>
				</div>
			</div>
		);
	}

	// If ready but we haven't loaded yet, show a lightweight "Load (and play)" UI.
	if (artifact.state === "ready" && !audioUrl) {
		return (
			<div className={minHeightClassName}>
				<div className="rounded border border-border/60 px-3 py-2 space-y-2">
					<div className="text-[11px] text-muted-foreground break-all">
						{artifact.fileName}
					</div>
					<div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
						<div className="flex items-center gap-1.5">
							<Volume2 className="h-3.5 w-3.5" />
							<span className="sr-only">Audio preview</span>
						</div>
						<button
							type="button"
							className="inline-flex items-center justify-center rounded border border-border bg-background px-2 py-1 text-xs hover:bg-muted"
							onClick={() => {
								setLoadRequestKey(currentKey);
								setAutoPlayOnLoad(true);
							}}
						>
							<Play className="h-3.5 w-3.5 mr-1" />
							Load and Play
						</button>
					</div>
				</div>
			</div>
		);
	}

	if (isLoading) {
		return (
			<div className={minHeightClassName}>
				<div className="space-y-2 rounded border border-border/60 px-3 py-2">
					<div className="text-[11px] text-muted-foreground break-all">
						{artifact.fileName}
					</div>
					<div className="flex items-center gap-2 text-[11px] text-muted-foreground">
						<Loader2 className="h-3.5 w-3.5 animate-spin" />
						<span>Loading Audio preview…</span>
					</div>
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className={minHeightClassName}>
				<div className="space-y-2 rounded border border-destructive/40 bg-destructive/10 px-3 py-2">
					<div className="text-[11px] text-destructive break-all">
						{artifact.fileName}
					</div>
					<div className="flex items-start gap-2 text-[11px] text-destructive">
						<AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
						<span>{error}</span>
					</div>
				</div>
			</div>
		);
	}

	// If artifact is "ready" but audioUrl hasn't been created yet,
	// return a placeholder instead of `null` to avoid layout jumps.
	if (!audioUrl) {
		return (
			<div className={minHeightClassName}>
				<div className="space-y-2 rounded border border-border/60 px-3 py-2">
					<div className="text-[11px] text-muted-foreground break-all">
						{artifact.fileName}
					</div>
					<div className="flex items-center gap-2 text-[11px] text-muted-foreground">
						<Loader2 className="h-3.5 w-3.5 animate-spin" />
						<span>Loading Audio preview…</span>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className={minHeightClassName}>
			<div className="space-y-2">
				<div className="text-[11px] text-muted-foreground break-all">
					{artifact.fileName}
				</div>
				<div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
					<Volume2 className="h-3.5 w-3.5" />
					<span className="sr-only">Audio preview</span>
				</div>
				<audio
					controls
					preload="metadata"
					className="w-full"
					src={audioUrl}
					ref={audioRef}
				>
					<track kind="captions" src={EMPTY_VTT_TRACK} label="No captions" />
				</audio>
			</div>
		</div>
	);
}
