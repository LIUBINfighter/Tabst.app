import {
	ChevronLeft,
	ChevronRight,
	Database,
	Image as ImageIcon,
	Loader2,
	Music,
	Save,
	Upload,
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

function shortHash6(input: string): string {
	// Stable non-crypto hash; keep ASCII-only output for filenames.
	// FNV-1a 64 -> hex -> first 6 chars.
	let hash = 0xcbf29ce484222325n;
	const mod = 1n << 64n;
	for (let i = 0; i < input.length; i += 1) {
		hash ^= BigInt(input.charCodeAt(i));
		hash = (hash * 0x100000001b3n) % mod;
	}
	const hex = hash.toString(16).padStart(16, "0");
	return hex.slice(0, 6);
}

function pad2(n: number): string {
	return String(n).padStart(2, "0");
}

function getUploadOrigin(now = new Date()): string {
	// upload-<hhmmss>-<yymmdd>
	const yymmdd = `${pad2(now.getFullYear() % 100)}${pad2(
		now.getMonth() + 1,
	)}${pad2(now.getDate())}`;
	const hhmmss = `${pad2(now.getHours())}${pad2(now.getMinutes())}${pad2(
		now.getSeconds(),
	)}`;
	const ms3 = String(now.getMilliseconds()).padStart(3, "0");
	return `upload-${hhmmss}${ms3}-${yymmdd}`;
}

function getExtension(fileName: string): string {
	const normalized = fileName.replace(/\\/g, "/");
	const base = normalized.split("/").pop() ?? normalized;
	const dot = base.lastIndexOf(".");
	if (dot <= 0) return "";
	return base.slice(dot + 1).toLowerCase();
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
	const datasetActiveSample = useAppStore((s) => s.datasetActiveSample);
	const datasetSourceText = useAppStore((s) => s.datasetSourceText);
	const datasetSourceSavedText = useAppStore((s) => s.datasetSourceSavedText);
	const datasetSourceDirty = useAppStore((s) => s.datasetSourceDirty);
	const datasetSampleLoading = useAppStore((s) => s.datasetSampleLoading);
	const datasetMutationLoading = useAppStore((s) => s.datasetMutationLoading);
	const datasetError = useAppStore((s) => s.datasetError);
	const datasetMutationError = useAppStore((s) => s.datasetMutationError);

	const setDatasetSourceText = useAppStore((s) => s.setDatasetSourceText);
	const saveDatasetSampleSource = useAppStore((s) => s.saveDatasetSampleSource);
	const saveDatasetArtifact = useAppStore((s) => s.saveDatasetArtifact);
	const updateDatasetSample = useAppStore((s) => s.updateDatasetSample);
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
	const [artifactUploadInProgress, setArtifactUploadInProgress] =
		useState(false);
	const [audioLoadAllNonce, setAudioLoadAllNonce] = useState(0);

	const [saveSourceFlash, setSaveSourceFlash] = useState<"idle" | "saved">(
		"idle",
	);
	const [saveMetadataFlash, setSaveMetadataFlash] = useState<"idle" | "saved">(
		"idle",
	);
	const saveSourceFlashTimerRef = useRef<number | null>(null);
	const saveMetadataFlashTimerRef = useRef<number | null>(null);
	const tagsFieldId = "dataset-sample-tags";
	const reviewStatusFieldId = "dataset-sample-review-status";
	const reviewNotesFieldId = "dataset-sample-review-notes";
	const activeRepoPath =
		repos.find((repo) => repo.id === activeRepoId)?.path ?? null;

	// Some export UI changes (Audio generation/progress) can cause layout shifts
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
		artifactGenerationKind !== null ||
		artifactUploadInProgress;

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

	// When user edits after a "saved" flash, immediately return to idle so
	// the button matches the current dirty state (yellow).
	useEffect(() => {
		if (datasetSourceDirty) setSaveSourceFlash("idle");
	}, [datasetSourceDirty]);
	useEffect(() => {
		if (metadataDirty) setSaveMetadataFlash("idle");
	}, [metadataDirty]);

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

	const sampleShortHash6 = useMemo(() => {
		if (!datasetActiveSample) return null;
		return shortHash6(datasetActiveSample.id);
	}, [datasetActiveSample]);

	const generatedMidiFileName = useMemo(() => {
		if (!sampleShortHash6) return DEFAULT_SAMPLE_ARTIFACT_FILES.midi;
		return `${sampleShortHash6}-auto.mid`;
	}, [sampleShortHash6]);

	const generatedAudioFileName = useMemo(() => {
		if (!sampleShortHash6) return DEFAULT_SAMPLE_ARTIFACT_FILES.wav;
		return `${sampleShortHash6}-auto.wav`;
	}, [sampleShortHash6]);

	const generatedImageFileName = useMemo(() => {
		if (!sampleShortHash6) return DEFAULT_SAMPLE_ARTIFACT_FILES.image;
		return `${sampleShortHash6}-auto.png`;
	}, [sampleShortHash6]);

	const uploadedMidiArtifacts = useMemo(() => {
		const midiExts = new Set(["mid", "midi"]);
		return extraArtifacts
			.map(([artifactKind, artifact]) => ({
				artifactKind,
				artifact: artifact as SampleArtifactManifest,
			}))
			.filter((entry) => midiExts.has(getExtension(entry.artifact.fileName)));
	}, [extraArtifacts]);

	const uploadedAudioArtifacts = useMemo(() => {
		const audioExts = new Set([
			"wav",
			"mp3",
			"m4a",
			"ogg",
			"oga",
			"flac",
			"mp4",
			"aac",
			"opus",
		]);
		return extraArtifacts
			.map(([artifactKind, artifact]) => ({
				artifactKind,
				artifact: artifact as SampleArtifactManifest,
			}))
			.filter((entry) => audioExts.has(getExtension(entry.artifact.fileName)));
	}, [extraArtifacts]);

	const uploadedImageArtifacts = useMemo(() => {
		const imageExts = new Set(["png", "jpg", "jpeg", "webp", "gif", "bmp"]);
		return extraArtifacts
			.map(([artifactKind, artifact]) => ({
				artifactKind,
				artifact: artifact as SampleArtifactManifest,
			}))
			.filter((entry) => imageExts.has(getExtension(entry.artifact.fileName)));
	}, [extraArtifacts]);

	const otherExtraArtifacts = useMemo(() => {
		const midiExts = new Set(["mid", "midi"]);
		const audioExts = new Set([
			"wav",
			"mp3",
			"m4a",
			"ogg",
			"oga",
			"flac",
			"mp4",
			"aac",
			"opus",
		]);
		const imageExts = new Set(["png", "jpg", "jpeg", "webp", "gif", "bmp"]);

		return extraArtifacts
			.map(([artifactKind, artifact]) => ({
				artifactKind,
				artifact: artifact as SampleArtifactManifest,
			}))
			.filter((entry) => {
				const ext = getExtension(entry.artifact.fileName);
				return !(midiExts.has(ext) || audioExts.has(ext) || imageExts.has(ext));
			});
	}, [extraArtifacts]);

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
			if (!datasetActiveSample) return;
			const hash6 = shortHash6(datasetActiveSample.id);
			const targetFileName = `${hash6}-auto.mid`;

			const sourceText = await ensureSavedSourceForGeneration();
			if (!sourceText) return;

			const bytes = generateMidiBytesFromAlphaTex(sourceText);
			await saveDatasetArtifact({
				artifactKind: "midi",
				targetFileName,
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
		// Capture scroll position at the start of Audio generation.
		if (scrollHostRef.current) {
			lockedScrollTopRef.current = scrollHostRef.current.scrollTop;
		}

		clearDatasetFeedback();
		setArtifactGenerationError(null);
		setArtifactGenerationKind("wav");
		setArtifactGenerationProgress(0);

		try {
			if (!datasetActiveSample) return;
			const hash6 = shortHash6(datasetActiveSample.id);
			const targetFileName = `${hash6}-auto.wav`;

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
				targetFileName,
				bytes,
			});
		} catch (error) {
			setArtifactGenerationError(
				error instanceof Error ? error.message : "Failed to generate Audio.",
			);
		} finally {
			setArtifactGenerationKind(null);
			setArtifactGenerationProgress(null);
		}
	};

	const handleUploadMidi = async () => {
		if (!datasetActiveSample) return;
		clearDatasetFeedback();
		setArtifactGenerationError(null);
		setArtifactUploadInProgress(true);

		try {
			const picked = await window.desktopAPI.pickFile(["mid", "midi"]);
			if (!picked) return;

			const ext = getExtension(picked.name);
			if (!ext) {
				throw new Error("Invalid MIDI file extension.");
			}

			const hash6 = shortHash6(datasetActiveSample.id);
			const origin = getUploadOrigin();
			const targetFileName = `${hash6}-${origin}.${ext}`;
			const artifactKind = `midi-${origin}`;

			const result = await window.desktopAPI.readFileBytes(picked.path);
			if (!result.data) {
				throw new Error(result.error ?? "Failed to read MIDI bytes.");
			}

			await saveDatasetArtifact({
				artifactKind,
				targetFileName,
				bytes: result.data,
			});
		} catch (error) {
			setArtifactGenerationError(
				error instanceof Error ? error.message : "Failed to upload MIDI.",
			);
		} finally {
			setArtifactUploadInProgress(false);
		}
	};

	const handleUploadAudio = async () => {
		if (!datasetActiveSample) return;
		clearDatasetFeedback();
		setArtifactGenerationError(null);
		setArtifactUploadInProgress(true);

		try {
			const picked = await window.desktopAPI.pickFile([
				"wav",
				"mp3",
				"m4a",
				"ogg",
				"oga",
				"flac",
				"mp4",
				"aac",
				"opus",
			]);
			if (!picked) return;

			const ext = getExtension(picked.name);
			if (!ext) {
				throw new Error("Invalid audio file extension.");
			}

			const hash6 = shortHash6(datasetActiveSample.id);
			const origin = getUploadOrigin();
			const targetFileName = `${hash6}-${origin}.${ext}`;
			const artifactKind = `audio-${origin}`;

			const result = await window.desktopAPI.readFileBytes(picked.path);
			if (!result.data) {
				throw new Error(result.error ?? "Failed to read audio bytes.");
			}

			await saveDatasetArtifact({
				artifactKind,
				targetFileName,
				bytes: result.data,
			});
		} catch (error) {
			setArtifactGenerationError(
				error instanceof Error ? error.message : "Failed to upload Audio.",
			);
		} finally {
			setArtifactUploadInProgress(false);
		}
	};

	const handleUploadImage = async () => {
		if (!datasetActiveSample) return;
		clearDatasetFeedback();
		setArtifactGenerationError(null);
		setArtifactUploadInProgress(true);

		try {
			const picked = await window.desktopAPI.pickFile([
				"png",
				"jpg",
				"jpeg",
				"webp",
				"gif",
				"bmp",
			]);
			if (!picked) return;

			const ext = getExtension(picked.name);
			if (!ext) {
				throw new Error("Invalid image file extension.");
			}

			const hash6 = shortHash6(datasetActiveSample.id);
			const origin = getUploadOrigin();
			const targetFileName = `${hash6}-${origin}.${ext}`;
			const artifactKind = `image-${origin}`;

			const result = await window.desktopAPI.readFileBytes(picked.path);
			if (!result.data) {
				throw new Error(result.error ?? "Failed to read image bytes.");
			}

			await saveDatasetArtifact({
				artifactKind,
				targetFileName,
				bytes: result.data,
			});
		} catch (error) {
			setArtifactGenerationError(
				error instanceof Error ? error.message : "Failed to upload Image.",
			);
		} finally {
			setArtifactUploadInProgress(false);
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

		// Audio finished: if we captured a locked scrollTop at start, restore once
		// more so the scroll container doesn't appear to "jump" when the Audio card expands.
		const locked = lockedScrollTopRef.current;
		if (typeof locked === "number" && host.scrollTop !== locked) {
			host.scrollTop = locked;
		}
		lockedScrollTopRef.current = null;
	}, [artifactGenerationKind]);

	const handleSaveMetadata = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		clearDatasetFeedback();
		const ok = await updateDatasetSample({
			tags: parseTags(tagsValue),
			reviewStatus,
			reviewNotes,
		});
		if (!ok) return;

		setSaveMetadataFlash("saved");
		if (saveMetadataFlashTimerRef.current) {
			window.clearTimeout(saveMetadataFlashTimerRef.current);
		}
		saveMetadataFlashTimerRef.current = window.setTimeout(() => {
			setSaveMetadataFlash("idle");
		}, 1800);
	};

	const handleSaveSource = async () => {
		clearDatasetFeedback();
		const ok = await saveDatasetSampleSource();
		if (!ok) return;

		setSaveSourceFlash("saved");
		if (saveSourceFlashTimerRef.current) {
			window.clearTimeout(saveSourceFlashTimerRef.current);
		}
		saveSourceFlashTimerRef.current = window.setTimeout(() => {
			setSaveSourceFlash("idle");
		}, 1800);
	};

	const saveSourceButtonClassName =
		saveSourceFlash === "saved"
			? "h-8 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/15"
			: datasetSourceDirty
				? "h-8 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30 hover:bg-amber-500/15"
				: "h-8 rounded-md bg-muted text-muted-foreground border border-transparent hover:bg-[var(--hover-bg)] hover:text-[var(--hover-text)]";

	const saveMetadataButtonClassName =
		saveMetadataFlash === "saved"
			? "h-8 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/15"
			: metadataDirty
				? "h-8 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30 hover:bg-amber-500/15"
				: "h-8 rounded-md bg-muted text-muted-foreground border border-transparent hover:bg-[var(--hover-bg)] hover:text-[var(--hover-text)]";

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
					title="Tabel: Tabst Label Dataset Workspace"
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
												className={saveSourceButtonClassName}
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
												{/* Image */}
												<div className="rounded border border-border/60 p-2 space-y-2">
													<div className="text-muted-foreground font-medium">
														Image
													</div>
													<div className="space-y-1">
														<div className="text-[11px] text-muted-foreground break-all">
															{imageArtifact.state === "missing"
																? generatedImageFileName
																: imageArtifact.fileName}
														</div>
														{uploadedImageArtifacts.map(
															({ artifactKind, artifact }) => (
																<div
																	key={artifactKind}
																	className="text-[11px] text-muted-foreground break-all"
																>
																	{artifact.fileName}
																</div>
															),
														)}
													</div>
													<div className="space-y-2">
														<Button
															type="button"
															variant="ghost"
															size="sm"
															className="h-8 w-full rounded-md bg-muted text-muted-foreground border border-transparent hover:bg-[var(--hover-bg)] hover:text-[var(--hover-text)]"
															disabled
														>
															<ImageIcon className="mr-1 h-3.5 w-3.5" />
															Generate Image (WIP)
														</Button>
														<Button
															type="button"
															variant="ghost"
															size="sm"
															className="h-8 w-full rounded-md bg-muted text-muted-foreground border border-transparent hover:bg-[var(--hover-bg)] hover:text-[var(--hover-text)]"
															onClick={() => {
																void handleUploadImage();
															}}
															disabled={busy}
														>
															<Upload className="mr-1 h-3.5 w-3.5" />
															Upload Image
														</Button>
													</div>
												</div>

												{/* MIDI */}
												<div className="rounded border border-border/60 p-2 space-y-2">
													<div className="text-muted-foreground font-medium">
														MIDI
													</div>
													<div className="space-y-1">
														<div className="text-[11px] text-muted-foreground break-all">
															{midiArtifact.state === "missing"
																? generatedMidiFileName
																: midiArtifact.fileName}
														</div>
														{uploadedMidiArtifacts.map(
															({ artifactKind, artifact }) => (
																<div
																	key={artifactKind}
																	className="text-[11px] text-muted-foreground break-all"
																>
																	{artifact.fileName}
																</div>
															),
														)}
													</div>
													<div className="space-y-2">
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
														<Button
															type="button"
															variant="ghost"
															size="sm"
															className="h-8 w-full rounded-md bg-muted text-muted-foreground border border-transparent hover:bg-[var(--hover-bg)] hover:text-[var(--hover-text)]"
															onClick={() => {
																void handleUploadMidi();
															}}
															disabled={busy}
														>
															<Upload className="mr-1 h-3.5 w-3.5" />
															Upload MIDI
														</Button>
													</div>
												</div>

												{/* Audio */}
												<div className="rounded border border-border/60 p-2 space-y-2">
													<div className="text-muted-foreground font-medium">
														Audio
													</div>
													<div className="space-y-2">
														<Button
															type="button"
															variant="ghost"
															size="sm"
															className="h-8 w-full rounded-md bg-muted text-muted-foreground border border-transparent hover:bg-[var(--hover-bg)] hover:text-[var(--hover-text)]"
															onClick={() => setAudioLoadAllNonce((n) => n + 1)}
															disabled={busy}
														>
															<Volume2 className="mr-1 h-3.5 w-3.5" />
															Load all Audio
														</Button>
													</div>
													<div className="space-y-2">
														<DatasetWavPlayer
															repoPath={activeRepoPath}
															datasetId={datasetActive.id}
															sampleId={datasetActiveSample.id}
															artifact={
																wavArtifact.state === "missing"
																	? {
																			...wavArtifact,
																			fileName: generatedAudioFileName,
																		}
																	: wavArtifact
															}
															loadAllNonce={audioLoadAllNonce}
															autoPlayOnExternalLoad={false}
														/>
														{uploadedAudioArtifacts.map(
															({ artifactKind, artifact }) => (
																<DatasetWavPlayer
																	key={artifactKind}
																	repoPath={activeRepoPath}
																	datasetId={datasetActive.id}
																	sampleId={datasetActiveSample.id}
																	artifact={artifact}
																	loadAllNonce={audioLoadAllNonce}
																	autoPlayOnExternalLoad={false}
																/>
															),
														)}
													</div>
													<div className="space-y-2">
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
															Generate Audio
														</Button>
														{artifactGenerationKind === "wav" &&
														artifactGenerationProgress !== null ? (
															<div className="text-[11px] text-muted-foreground">
																Progress:{" "}
																{Math.round(artifactGenerationProgress * 100)}%
															</div>
														) : null}
														<Button
															type="button"
															variant="ghost"
															size="sm"
															className="h-8 w-full rounded-md bg-muted text-muted-foreground border border-transparent hover:bg-[var(--hover-bg)] hover:text-[var(--hover-text)]"
															onClick={() => {
																void handleUploadAudio();
															}}
															disabled={busy}
														>
															<Upload className="mr-1 h-3.5 w-3.5" />
															Upload Audio
														</Button>
													</div>
												</div>
											</div>
											{otherExtraArtifacts.length ? (
												<div className="pt-2 space-y-1">
													<div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
														Other
													</div>
													<div className="space-y-1">
														{otherExtraArtifacts.map(
															({ artifactKind, artifact }) => (
																<div
																	key={artifactKind}
																	className="text-[11px] text-muted-foreground break-all"
																>
																	{artifact.fileName}
																</div>
															),
														)}
													</div>
												</div>
											) : null}
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
													disabled={!metadataDirty || busy}
													className={saveMetadataButtonClassName}
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
