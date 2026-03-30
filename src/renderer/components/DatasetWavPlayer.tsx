import { AlertCircle, Loader2, Volume2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { SampleArtifactManifest } from "../types/dataset";

const EMPTY_VTT_TRACK = "data:text/vtt;charset=utf-8,WEBVTT%0A%0A";

export interface DatasetWavPlayerProps {
	repoPath: string | null;
	datasetId: string;
	sampleId: string;
	artifact: SampleArtifactManifest;
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

export function DatasetWavPlayer({
	repoPath,
	datasetId,
	sampleId,
	artifact,
}: DatasetWavPlayerProps) {
	const [audioUrl, setAudioUrl] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	// Keep height stable across state transitions (missing/stale/loading/ready).
	// Otherwise, when exporting WAV near the bottom, the scroll container can "jump".
	const minHeightClassName = "min-h-[92px]";

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
		if (artifact.state !== "ready" || !artifactPath) {
			setAudioUrl((currentUrl) => {
				if (currentUrl) {
					URL.revokeObjectURL(currentUrl);
				}
				return null;
			});
			setIsLoading(false);
			setError(null);
			return;
		}

		let cancelled = false;
		let nextObjectUrl: string | null = null;

		setIsLoading(true);
		setError(null);

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
					new Blob([toArrayBuffer(result.data)], { type: "audio/wav" }),
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

		return () => {
			cancelled = true;
			if (nextObjectUrl) {
				URL.revokeObjectURL(nextObjectUrl);
			}
		};
	}, [artifact.state, artifactPath]);

	if (artifact.state === "missing") {
		return (
			<div className={minHeightClassName}>
				<div className="rounded border border-dashed border-border/60 px-3 py-2 text-[11px] text-muted-foreground">
					Generate WAV to preview it here.
				</div>
			</div>
		);
	}

	if (artifact.state === "stale") {
		return (
			<div className={minHeightClassName}>
				<div className="rounded border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-700 dark:text-amber-300">
					The current WAV is stale. Regenerate it to listen to the latest
					source.
				</div>
			</div>
		);
	}

	if (isLoading) {
		return (
			<div className={minHeightClassName}>
				<div className="flex items-center gap-2 rounded border border-border/60 px-3 py-2 text-[11px] text-muted-foreground">
					<Loader2 className="h-3.5 w-3.5 animate-spin" />
					<span>Loading WAV preview…</span>
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className={minHeightClassName}>
				<div className="flex items-start gap-2 rounded border border-destructive/40 bg-destructive/10 px-3 py-2 text-[11px] text-destructive">
					<AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
					<span>{error}</span>
				</div>
			</div>
		);
	}

	// If artifact is "ready" but audioUrl hasn't been created yet,
	// return a placeholder instead of `null` to avoid layout jumps.
	if (!audioUrl) {
		return (
			<div className={minHeightClassName}>
				<div className="flex items-center gap-2 rounded border border-border/60 px-3 py-2 text-[11px] text-muted-foreground">
					<Loader2 className="h-3.5 w-3.5 animate-spin" />
					<span>Loading WAV preview…</span>
				</div>
			</div>
		);
	}

	return (
		<div className={minHeightClassName}>
			<div className="space-y-2">
				<div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
					<Volume2 className="h-3.5 w-3.5" />
					<span>WAV preview</span>
				</div>
				<audio controls preload="metadata" className="w-full" src={audioUrl}>
					<track kind="captions" src={EMPTY_VTT_TRACK} label="No captions" />
				</audio>
			</div>
		</div>
	);
}
