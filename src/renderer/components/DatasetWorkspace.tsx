import {
	ChevronLeft,
	ChevronRight,
	Database,
	Download,
	Loader2,
	Music,
	Save,
	Volume2,
	X,
} from "lucide-react";
import {
	type FormEvent,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import {
	generateMidiBytesFromAlphaTex,
	generateWavBytesFromAlphaTex,
} from "../lib/alphatab-export";
import { useAppStore } from "../store/appStore";
import {
	type ArtifactState,
	DEFAULT_SAMPLE_ARTIFACT_FILES,
	getSampleArtifact,
	KNOWN_SAMPLE_ARTIFACT_ORDER,
	normalizeSampleArtifacts,
	type SampleArtifactManifest,
	type SampleReviewStatus,
} from "../types/dataset";
import DatasetTopToast from "./DatasetTopToast";
import { DatasetWavPlayer } from "./DatasetWavPlayer";
import TopBar from "./TopBar";
import { TutorialAlphaTexPlayground } from "./tutorial/TutorialAlphaTexPlayground";
import { Button } from "./ui/button";
import IconButton from "./ui/icon-button";
import { Input } from "./ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "./ui/select";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "./ui/tooltip";

const REVIEW_STATUS_OPTIONS: SampleReviewStatus[] = [
	"pending",
	"approved",
	"rejected",
];
function parseTags(input: string): string[] {
	return input
		.split(",")
		.map((tag) => tag.trim())
		.filter((tag) => tag.length > 0);
}

function artifactTone(state: ArtifactState): string {
	if (state === "ready") {
		return "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
	}
	if (state === "stale") {
		return "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400";
	}
	return "border-border bg-muted text-muted-foreground";
}

function formatTimestamp(timestamp?: number): string {
	if (!timestamp || !Number.isFinite(timestamp)) return "-";
	return new Date(timestamp).toLocaleString();
}

export interface DatasetWorkspaceProps {
	showExpandSidebar?: boolean;
	onExpandSidebar?: () => void;
	onCollapseSidebar?: () => void;
}

export default function DatasetWorkspace({
	showExpandSidebar,
	onExpandSidebar,
	onCollapseSidebar,
}: DatasetWorkspaceProps) {
	const activeRepoId = useAppStore((s) => s.activeRepoId);
	const repos = useAppStore((s) => s.repos);
	const setWorkspaceMode = useAppStore((s) => s.setWorkspaceMode);

	const datasetActive = useAppStore((s) => s.datasetActive);
	const datasetSamples = useAppStore((s) => s.datasetSamples);
	const datasetActiveSample = useAppStore((s) => s.datasetActiveSample);
	const datasetSourceText = useAppStore((s) => s.datasetSourceText);
	const datasetSourceSavedText = useAppStore((s) => s.datasetSourceSavedText);
	const datasetSourceDirty = useAppStore((s) => s.datasetSourceDirty);
	const datasetSampleLoading = useAppStore((s) => s.datasetSampleLoading);
	const datasetMutationLoading = useAppStore((s) => s.datasetMutationLoading);
	const datasetError = useAppStore((s) => s.datasetError);
	const datasetMutationError = useAppStore((s) => s.datasetMutationError);
	const datasetLastExport = useAppStore((s) => s.datasetLastExport);

	const setDatasetSourceText = useAppStore((s) => s.setDatasetSourceText);
	const saveDatasetSampleSource = useAppStore((s) => s.saveDatasetSampleSource);
	const saveDatasetArtifact = useAppStore((s) => s.saveDatasetArtifact);
	const updateDatasetSample = useAppStore((s) => s.updateDatasetSample);
	const exportDatasetJsonl = useAppStore((s) => s.exportDatasetJsonl);
	const clearDatasetFeedback = useAppStore((s) => s.clearDatasetFeedback);

	const [tagsValue, setTagsValue] = useState("");
	const [reviewStatus, setReviewStatus] =
		useState<SampleReviewStatus>("pending");
	const [reviewNotes, setReviewNotes] = useState("");
	const [artifactGenerationKind, setArtifactGenerationKind] = useState<
		"midi" | "wav" | null
	>(null);
	const [artifactGenerationProgress, setArtifactGenerationProgress] = useState<
		number | null
	>(null);
	const [artifactGenerationError, setArtifactGenerationError] = useState<
		string | null
	>(null);
	const tagsFieldId = "dataset-sample-tags";
	const reviewStatusFieldId = "dataset-sample-review-status";
	const reviewNotesFieldId = "dataset-sample-review-notes";
	const activeRepoPath =
		repos.find((repo) => repo.id === activeRepoId)?.path ?? null;

	// Some export UI changes (WAV generation/progress) can cause layout shifts
	// that also make the scroll container "jump". Lock & restore while exporting.
	const scrollHostRef = useRef<HTMLDivElement | null>(null);
	const lockedScrollTopRef = useRef<number | null>(null);

	useEffect(() => {
		setArtifactGenerationKind(null);
		setArtifactGenerationProgress(null);
		setArtifactGenerationError(null);

		if (!datasetActiveSample) {
			setTagsValue("");
			setReviewStatus("pending");
			setReviewNotes("");
			return;
		}

		const sampleTags = datasetActiveSample.tags ?? [];
		setTagsValue(sampleTags.join(", "));
		setReviewStatus(datasetActiveSample.reviewStatus ?? "pending");
		setReviewNotes(datasetActiveSample.reviewNotes ?? "");
	}, [datasetActiveSample]);

	const errorMessage = datasetMutationError ?? datasetError;
	const busy =
		datasetSampleLoading ||
		datasetMutationLoading ||
		artifactGenerationKind !== null;

	const metadataDirty = useMemo(() => {
		if (!datasetActiveSample) return false;
		const normalizedTags = parseTags(tagsValue);
		const currentTags = datasetActiveSample.tags ?? [];
		const tagsChanged =
			normalizedTags.length !== currentTags.length ||
			normalizedTags.some((tag, index) => tag !== currentTags[index]);

		return (
			reviewStatus !== (datasetActiveSample.reviewStatus ?? "pending") ||
			reviewNotes !== (datasetActiveSample.reviewNotes ?? "") ||
			tagsChanged
		);
	}, [datasetActiveSample, reviewNotes, reviewStatus, tagsValue]);

	const imageArtifact = useMemo(
		() => getSampleArtifact(datasetActiveSample?.artifacts, "image"),
		[datasetActiveSample],
	);
	const midiArtifact = useMemo(
		() => getSampleArtifact(datasetActiveSample?.artifacts, "midi"),
		[datasetActiveSample],
	);
	const wavArtifact = useMemo(
		() => getSampleArtifact(datasetActiveSample?.artifacts, "wav"),
		[datasetActiveSample],
	);
	const extraArtifacts = useMemo(() => {
		const artifacts = normalizeSampleArtifacts(datasetActiveSample?.artifacts);
		return Object.entries(artifacts).filter(
			([artifactKind]) =>
				!KNOWN_SAMPLE_ARTIFACT_ORDER.includes(artifactKind as never),
		);
	}, [datasetActiveSample]);

	const formatArtifactLabel = (artifactKind: string) => {
		if (artifactKind === "midi") return "MIDI";
		if (artifactKind === "wav") return "WAV";
		if (artifactKind === "image") return "Image";
		return artifactKind;
	};

	const ensureSavedSourceForGeneration = async (): Promise<string | null> => {
		setArtifactGenerationError(null);
		if (datasetSourceDirty) {
			const saved = await saveDatasetSampleSource();
			if (!saved) return null;
		}

		const sourceText =
			useAppStore.getState().datasetSourceSavedText || datasetSourceSavedText;
		if (!sourceText.trim()) {
			setArtifactGenerationError("Source.atex is empty.");
			return null;
		}

		return sourceText;
	};

	const handleGenerateMidi = async () => {
		clearDatasetFeedback();
		setArtifactGenerationError(null);
		setArtifactGenerationKind("midi");
		setArtifactGenerationProgress(null);

		try {
			const sourceText = await ensureSavedSourceForGeneration();
			if (!sourceText) return;

			const bytes = generateMidiBytesFromAlphaTex(sourceText);
			await saveDatasetArtifact({
				artifactKind: "midi",
				targetFileName:
					midiArtifact.fileName || DEFAULT_SAMPLE_ARTIFACT_FILES.midi,
				bytes,
			});
		} catch (error) {
			setArtifactGenerationError(
				error instanceof Error ? error.message : "Failed to generate MIDI.",
			);
		} finally {
			setArtifactGenerationKind(null);
			setArtifactGenerationProgress(null);
		}
	};

	const handleGenerateWav = async () => {
		// Capture scroll position at the start of WAV generation.
		if (scrollHostRef.current) {
			lockedScrollTopRef.current = scrollHostRef.current.scrollTop;
		}

		clearDatasetFeedback();
		setArtifactGenerationError(null);
		setArtifactGenerationKind("wav");
		setArtifactGenerationProgress(0);

		try {
			const sourceText = await ensureSavedSourceForGeneration();
			if (!sourceText) return;

			const bytes = await generateWavBytesFromAlphaTex(
				sourceText,
				(progress) => {
					setArtifactGenerationProgress(progress);
				},
			);
			await saveDatasetArtifact({
				artifactKind: "wav",
				targetFileName:
					wavArtifact.fileName || DEFAULT_SAMPLE_ARTIFACT_FILES.wav,
				bytes,
			});
		} catch (error) {
			setArtifactGenerationError(
				error instanceof Error ? error.message : "Failed to generate WAV.",
			);
		} finally {
			setArtifactGenerationKind(null);
			setArtifactGenerationProgress(null);
		}
	};

	useLayoutEffect(() => {
		const host = scrollHostRef.current;
		if (!host) return;

		if (artifactGenerationKind === "wav") {
			const locked = lockedScrollTopRef.current;
			if (typeof locked === "number" && host.scrollTop !== locked) {
				host.scrollTop = locked;
			}
			return;
		}

		// WAV finished: if we captured a locked scrollTop at start, restore once
		// more so the scroll container doesn't appear to "jump" when the WAV card expands.
		const locked = lockedScrollTopRef.current;
		if (typeof locked === "number" && host.scrollTop !== locked) {
			host.scrollTop = locked;
		}
		lockedScrollTopRef.current = null;
	}, [artifactGenerationKind]);

	const handleSaveMetadata = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		clearDatasetFeedback();
		await updateDatasetSample({
			tags: parseTags(tagsValue),
			reviewStatus,
			reviewNotes,
		});
	};

	const handleSaveSource = async () => {
		clearDatasetFeedback();
		await saveDatasetSampleSource();
	};

	const handleExport = async () => {
		clearDatasetFeedback();
		await exportDatasetJsonl();
	};

	return (
		<TooltipProvider delayDuration={200}>
			<div className="flex-1 flex flex-col min-h-0 overflow-hidden">
				<TopBar
					leading={
						showExpandSidebar
							? onExpandSidebar && (
									<Tooltip>
										<TooltipTrigger asChild>
											<IconButton onClick={onExpandSidebar}>
												<ChevronRight className="h-4 w-4" />
											</IconButton>
										</TooltipTrigger>
										<TooltipContent side="bottom">
											<p>Expand sidebar</p>
										</TooltipContent>
									</Tooltip>
								)
							: onCollapseSidebar && (
									<Tooltip>
										<TooltipTrigger asChild>
											<IconButton onClick={onCollapseSidebar}>
												<ChevronLeft className="h-4 w-4" />
											</IconButton>
										</TooltipTrigger>
										<TooltipContent side="bottom">
											<p>Collapse sidebar</p>
										</TooltipContent>
									</Tooltip>
								)
					}
					icon={
						<Database className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
					}
					title="Dataset Workspace"
					trailing={
						<Tooltip>
							<TooltipTrigger asChild>
								<IconButton
									destructive
									onClick={() => setWorkspaceMode("editor")}
								>
									<X className="h-4 w-4" />
								</IconButton>
							</TooltipTrigger>
							<TooltipContent side="bottom">
								<p>Close</p>
							</TooltipContent>
						</Tooltip>
					}
				/>

				<div
					ref={scrollHostRef}
					className="flex-1 overflow-auto bg-background p-4 space-y-4"
				>
					<div className="pointer-events-none sticky top-0 z-50 flex min-h-10 justify-center pb-2">
						<DatasetTopToast />
					</div>
					{!activeRepoId ? (
						<div className="rounded border border-border bg-card p-4 text-sm text-muted-foreground">
							Select a repository first.
						</div>
					) : null}

					{activeRepoId && !datasetActive ? (
						<div className="rounded border border-border bg-card p-4 text-sm text-muted-foreground">
							Select or create a dataset from the sidebar.
						</div>
					) : null}

					{datasetActive ? (
						<>
							<div className="rounded border border-border bg-card p-4 space-y-3">
								<div className="flex flex-wrap items-center gap-2">
									<h2 className="text-sm font-semibold text-foreground">
										{datasetActive.name}
									</h2>
									<span className="text-[11px] text-muted-foreground">
										{datasetActive.id}
									</span>
									<div className="ml-auto">
										<Button
											type="button"
											variant="ghost"
											size="sm"
											className="h-8 rounded-md bg-muted text-muted-foreground border border-transparent hover:bg-[var(--hover-bg)] hover:text-[var(--hover-text)]"
											onClick={() => {
												void handleExport();
											}}
											disabled={busy}
										>
											{datasetMutationLoading ? (
												<Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
											) : (
												<Download className="h-3.5 w-3.5 mr-1" />
											)}
											Export JSONL
										</Button>
									</div>
								</div>
								{datasetActive.description ? (
									<p className="text-xs text-muted-foreground">
										{datasetActive.description}
									</p>
								) : null}
								<div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[11px] text-muted-foreground">
									<div>Created: {formatTimestamp(datasetActive.createdAt)}</div>
									<div>Updated: {formatTimestamp(datasetActive.updatedAt)}</div>
									<div>Samples: {datasetSamples.length}</div>
								</div>
								{datasetLastExport ? (
									<div className="rounded border border-border/60 bg-muted/40 px-2 py-1 text-[11px] text-muted-foreground">
										Last export: {datasetLastExport.relativePath} (
										{datasetLastExport.exportedCount}
										sample(s))
									</div>
								) : null}
							</div>

							{errorMessage ? (
								<div className="rounded border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
									{errorMessage}
								</div>
							) : null}

							{artifactGenerationError ? (
								<div className="rounded border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
									{artifactGenerationError}
								</div>
							) : null}

							{!datasetActiveSample ? (
								<div className="rounded border border-border bg-card p-4 text-sm text-muted-foreground">
									Select a sample from the sidebar to edit source and review
									fields.
								</div>
							) : (
								<div className="rounded border border-border bg-card p-4 space-y-3">
									<div className="flex items-center justify-between gap-2">
										<div>
											<h3 className="text-sm font-medium text-foreground">
												{datasetActiveSample.title}
											</h3>
											<p className="text-[11px] text-muted-foreground">
												{datasetActiveSample.id}
											</p>
										</div>
									</div>

									<div className="space-y-2">
										<div className="flex items-center justify-between gap-2">
											<h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
												Source.atex
											</h4>
											<Button
												type="button"
												variant="ghost"
												size="sm"
												className="h-8 rounded-md bg-muted text-muted-foreground border border-transparent hover:bg-[var(--hover-bg)] hover:text-[var(--hover-text)]"
												onClick={() => {
													void handleSaveSource();
												}}
												disabled={!datasetSourceDirty || busy}
											>
												{datasetMutationLoading ? (
													<Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
												) : (
													<Save className="h-3.5 w-3.5 mr-1" />
												)}
												Save source
											</Button>
										</div>

										<TutorialAlphaTexPlayground
											initialContent={datasetSourceText}
											fileName="source.atex"
											onChange={setDatasetSourceText}
											readOnly={busy}
											disablePlayer={false}
											showDisablePlayerToggle
											showRefresh
											variant="embedded"
											embeddedHeightPx={360}
											className="border-0 rounded-none bg-transparent max-w-none"
										/>

										<div className="text-[11px] text-muted-foreground">
											{datasetSourceDirty
												? "Unsaved changes"
												: "All changes saved"}
										</div>

										<div className="pt-3 space-y-2">
											<h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
												Artifacts
											</h4>
											<div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
												<div className="rounded border border-border/60 p-2 space-y-1">
													<div className="flex items-center justify-between">
														<span className="text-muted-foreground">Image</span>
														<span
															className={`inline-flex rounded border px-1.5 py-0 text-[10px] ${artifactTone(imageArtifact.state)}`}
														>
															{imageArtifact.state}
														</span>
													</div>
													<div className="text-[11px] text-muted-foreground">
														Source hash: {imageArtifact.sourceHash ?? "-"}
													</div>
													<div className="text-[11px] text-muted-foreground">
														File: {imageArtifact.fileName}
													</div>
												</div>
												<div className="rounded border border-border/60 p-2 space-y-1">
													<div className="flex items-center justify-between">
														<span className="text-muted-foreground">MIDI</span>
														<span
															className={`inline-flex rounded border px-1.5 py-0 text-[10px] ${artifactTone(midiArtifact.state)}`}
														>
															{midiArtifact.state}
														</span>
													</div>
													<div className="text-[11px] text-muted-foreground">
														Source hash: {midiArtifact.sourceHash ?? "-"}
													</div>
													<div className="text-[11px] text-muted-foreground">
														File: {midiArtifact.fileName}
													</div>
													<Button
														type="button"
														variant="ghost"
														size="sm"
														className="h-8 w-full rounded-md bg-muted text-muted-foreground border border-transparent hover:bg-[var(--hover-bg)] hover:text-[var(--hover-text)]"
														onClick={() => {
															void handleGenerateMidi();
														}}
														disabled={busy}
													>
														{artifactGenerationKind === "midi" ? (
															<Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
														) : (
															<Music className="mr-1 h-3.5 w-3.5" />
														)}
														Generate MIDI
													</Button>
												</div>
												<div className="rounded border border-border/60 p-2 space-y-1">
													<div className="flex items-center justify-between">
														<span className="text-muted-foreground">WAV</span>
														<span
															className={`inline-flex rounded border px-1.5 py-0 text-[10px] ${artifactTone(wavArtifact.state)}`}
														>
															{wavArtifact.state}
														</span>
													</div>
													<div className="text-[11px] text-muted-foreground">
														Source hash: {wavArtifact.sourceHash ?? "-"}
													</div>
													<div className="text-[11px] text-muted-foreground">
														File: {wavArtifact.fileName}
													</div>
													<Button
														type="button"
														variant="ghost"
														size="sm"
														className="h-8 w-full rounded-md bg-muted text-muted-foreground border border-transparent hover:bg-[var(--hover-bg)] hover:text-[var(--hover-text)]"
														onClick={() => {
															void handleGenerateWav();
														}}
														disabled={busy}
													>
														{artifactGenerationKind === "wav" ? (
															<Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
														) : (
															<Volume2 className="mr-1 h-3.5 w-3.5" />
														)}
														Generate WAV
													</Button>
													{artifactGenerationKind === "wav" &&
													artifactGenerationProgress !== null ? (
														<div className="text-[11px] text-muted-foreground">
															Progress:{" "}
															{Math.round(artifactGenerationProgress * 100)}%
														</div>
													) : null}
													<DatasetWavPlayer
														repoPath={activeRepoPath}
														datasetId={datasetActive.id}
														sampleId={datasetActiveSample.id}
														artifact={wavArtifact}
													/>
												</div>
												{extraArtifacts.map(([artifactKind, artifact]) => {
													const extraArtifact =
														artifact as SampleArtifactManifest;
													return (
														<div
															key={artifactKind}
															className="rounded border border-border/60 p-2 space-y-1 md:col-span-3"
														>
															<div className="flex items-center justify-between">
																<span className="text-muted-foreground">
																	{formatArtifactLabel(artifactKind)}
																</span>
																<span
																	className={`inline-flex rounded border px-1.5 py-0 text-[10px] ${artifactTone(extraArtifact.state)}`}
																>
																	{extraArtifact.state}
																</span>
															</div>
															<div className="text-[11px] text-muted-foreground">
																Source hash: {extraArtifact.sourceHash ?? "-"}
															</div>
															<div className="text-[11px] text-muted-foreground">
																File: {extraArtifact.fileName}
															</div>
														</div>
													);
												})}
											</div>
										</div>
									</div>

									{/* Tags / Review fields moved to bottom to reduce vertical height */}
									<div className="rounded border border-border/60 bg-muted/20 p-4 space-y-3">
										<form
											onSubmit={(event) => {
												void handleSaveMetadata(event);
											}}
											className="space-y-3"
										>
											<div className="flex items-center justify-between gap-2">
												<div>
													<h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
														Tags / Review
													</h4>
												</div>
												<Button
													type="submit"
													variant="ghost"
													size="sm"
													className="h-8 rounded-md bg-muted text-muted-foreground border border-transparent hover:bg-[var(--hover-bg)] hover:text-[var(--hover-text)]"
													disabled={!metadataDirty || busy}
												>
													<Save className="h-3.5 w-3.5 mr-1" />
													Save metadata
												</Button>
											</div>

											<div className="grid grid-cols-1 gap-3">
												<div className="space-y-1">
													<label
														className="text-xs text-muted-foreground"
														htmlFor={tagsFieldId}
													>
														Tags
													</label>
													<Input
														id={tagsFieldId}
														value={tagsValue}
														onChange={(event) =>
															setTagsValue(event.currentTarget.value)
														}
														className="h-8 text-xs"
														placeholder="tag1, tag2"
														disabled={busy}
													/>
												</div>
												<div className="space-y-1">
													<div
														className="text-xs text-muted-foreground"
														id={`${reviewStatusFieldId}-label`}
													>
														Review status
													</div>
													<Select
														aria-labelledby={`${reviewStatusFieldId}-label`}
														value={reviewStatus}
														onValueChange={(value: SampleReviewStatus) =>
															setReviewStatus(value)
														}
														disabled={busy}
													>
														<SelectTrigger className="h-8 text-xs">
															<SelectValue />
														</SelectTrigger>
														<SelectContent side="top" align="start">
															{REVIEW_STATUS_OPTIONS.map((option) => (
																<SelectItem key={option} value={option}>
																	{option}
																</SelectItem>
															))}
														</SelectContent>
													</Select>
												</div>
											</div>

											<div className="space-y-1">
												<label
													className="text-xs text-muted-foreground"
													htmlFor={reviewNotesFieldId}
												>
													Review notes
												</label>
												<textarea
													id={reviewNotesFieldId}
													value={reviewNotes}
													onChange={(event) =>
														setReviewNotes(event.currentTarget.value)
													}
													className="w-full min-h-[84px] rounded-md border border-input bg-background px-3 py-2 text-xs resize-y focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
													disabled={busy}
												/>
											</div>
										</form>
									</div>
								</div>
							)}
						</>
					) : null}
				</div>
			</div>
		</TooltipProvider>
	);
}
