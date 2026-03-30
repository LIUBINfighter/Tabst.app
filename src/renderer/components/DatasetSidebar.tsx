import {
	ChevronDown,
	Database,
	Loader2,
	Plus,
	RefreshCw,
	Upload,
} from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import {
	collectJsonlFieldPaths,
	parseJsonlRecords,
	prepareJsonlSampleImports,
	toCreateSampleInput,
} from "../lib/jsonl-sample-import";
import { useAppStore } from "../store/appStore";
import type { SampleReviewStatus } from "../types/dataset";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { ScrollArea } from "./ui/scroll-area";

function parseTags(input: string): string[] {
	return input
		.split(",")
		.map((tag) => tag.trim())
		.filter((tag) => tag.length > 0);
}

function reviewTone(status: SampleReviewStatus): string {
	if (status === "approved") {
		return "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
	}
	if (status === "rejected") {
		return "border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-400";
	}
	return "border-border bg-muted/70 text-muted-foreground";
}

export function DatasetSidebar() {
	const activeRepoId = useAppStore((s) => s.activeRepoId);
	const repos = useAppStore((s) => s.repos);
	const datasetList = useAppStore((s) => s.datasetList);
	const datasetListLoading = useAppStore((s) => s.datasetListLoading);
	const datasetListError = useAppStore((s) => s.datasetListError);
	const datasetLoading = useAppStore((s) => s.datasetLoading);
	const datasetError = useAppStore((s) => s.datasetError);
	const datasetActiveId = useAppStore((s) => s.datasetActiveId);
	const datasetActive = useAppStore((s) => s.datasetActive);
	const datasetSamples = useAppStore((s) => s.datasetSamples);
	const datasetActiveSampleId = useAppStore((s) => s.datasetActiveSampleId);
	const datasetSampleLoading = useAppStore((s) => s.datasetSampleLoading);
	const datasetMutationLoading = useAppStore((s) => s.datasetMutationLoading);
	const datasetMutationError = useAppStore((s) => s.datasetMutationError);
	const listDatasets = useAppStore((s) => s.listDatasets);
	const createDataset = useAppStore((s) => s.createDataset);
	const loadDataset = useAppStore((s) => s.loadDataset);
	const createSample = useAppStore((s) => s.createSample);
	const loadSample = useAppStore((s) => s.loadSample);
	const clearDatasetFeedback = useAppStore((s) => s.clearDatasetFeedback);

	const [datasetName, setDatasetName] = useState("");
	const [datasetDescription, setDatasetDescription] = useState("");
	const [sampleTitle, setSampleTitle] = useState("");
	const [sampleTags, setSampleTags] = useState("");
	const [sampleSourceText, setSampleSourceText] = useState("");
	const [importFileName, setImportFileName] = useState("");
	const [importFieldPaths, setImportFieldPaths] = useState<string[]>([]);
	const [importTitleField, setImportTitleField] = useState("");
	const [importSourceField, setImportSourceField] = useState("");
	const [importTagsField, setImportTagsField] = useState("");
	const [importRecords, setImportRecords] = useState<
		ReturnType<typeof parseJsonlRecords>
	>([]);
	const [importLoading, setImportLoading] = useState(false);
	const [importError, setImportError] = useState<string | null>(null);
	const [importFeedback, setImportFeedback] = useState<string | null>(null);

	// Create-dataset panel:
	// - when there are no datasets yet: keep it expanded
	// - when there is at least one dataset: keep it collapsed
	const [isCreateDatasetExpanded, setIsCreateDatasetExpanded] = useState(() => {
		return datasetList.length === 0 && !datasetListLoading;
	});

	useEffect(() => {
		if (!activeRepoId) return;
		void listDatasets();
	}, [activeRepoId, listDatasets]);

	useEffect(() => {
		const shouldExpand = datasetList.length === 0 && !datasetListLoading;
		setIsCreateDatasetExpanded(shouldExpand);
	}, [datasetList.length, datasetListLoading]);

	// Create-sample panel:
	// - when there are fewer than 5 samples: keep it expanded
	// - when there are 5+ samples: keep it collapsed
	const [isCreateSampleExpanded, setIsCreateSampleExpanded] = useState(() => {
		// datasetSamples comes from store; default to expanded when empty.
		return datasetSamples.length < 5;
	});

	useEffect(() => {
		if (!datasetActive) return;
		if (datasetSampleLoading) return;
		setIsCreateSampleExpanded(datasetSamples.length < 5);
	}, [datasetSamples.length, datasetSampleLoading, datasetActive]);

	const activeRepoPath =
		repos.find((repo) => repo.id === activeRepoId)?.path ?? null;

	const busy =
		datasetListLoading ||
		datasetLoading ||
		datasetMutationLoading ||
		importLoading;
	const errorMessage = datasetMutationError ?? datasetError ?? datasetListError;
	const importPreview = importSourceField
		? prepareJsonlSampleImports(importRecords, {
				titleField: importTitleField || "",
				sourceField: importSourceField,
				tagsField: importTagsField || undefined,
			})
		: null;
	const importReadyCount = importPreview?.samples.length ?? 0;
	const importSkippedCount = importPreview?.errors.length ?? 0;
	const canImport =
		!busy &&
		Boolean(datasetActive) &&
		Boolean(activeRepoPath) &&
		Boolean(importSourceField) &&
		importReadyCount > 0;

	const previewFields = useMemo(
		() => importFieldPaths.slice(0, 12),
		[importFieldPaths],
	);

	const pickSuggestedField = (
		fieldPaths: string[],
		candidates: string[],
		fallback = "",
	) => {
		for (const candidate of candidates) {
			if (fieldPaths.includes(candidate)) {
				return candidate;
			}
		}
		return fallback;
	};

	const resetImportState = () => {
		setImportFileName("");
		setImportFieldPaths([]);
		setImportRecords([]);
		setImportTitleField("");
		setImportSourceField("");
		setImportTagsField("");
		setImportError(null);
		setImportFeedback(null);
	};

	const handleCreateDataset = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const ok = await createDataset({
			name: datasetName,
			description: datasetDescription,
		});
		if (!ok) return;
		setDatasetName("");
		setDatasetDescription("");
	};

	const handleCreateSample = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const ok = await createSample({
			title: sampleTitle,
			tags: parseTags(sampleTags),
			sourceText: sampleSourceText,
		});
		if (!ok) return;
		setSampleTitle("");
		setSampleTags("");
		setSampleSourceText("");
	};

	const handlePickJsonl = async () => {
		clearDatasetFeedback();
		setImportFeedback(null);
		setImportError(null);

		const pickedFile = await window.desktopAPI.openFile(["jsonl"]);
		if (!pickedFile) return;

		try {
			const records = parseJsonlRecords(pickedFile.content);
			if (records.length === 0) {
				setImportError("The selected JSONL file does not contain any records.");
				setImportFileName(pickedFile.name);
				setImportFieldPaths([]);
				setImportRecords([]);
				return;
			}

			const fieldPaths = collectJsonlFieldPaths(records);
			setImportFileName(pickedFile.name);
			setImportRecords(records);
			setImportFieldPaths(fieldPaths);
			setImportTitleField(
				pickSuggestedField(
					fieldPaths,
					["title", "name", "sample.title"],
					fieldPaths[0] ?? "",
				),
			);
			setImportSourceField(
				pickSuggestedField(fieldPaths, [
					"source.text",
					"source",
					"alphatex",
					"text",
					"content",
				]),
			);
			setImportTagsField(pickSuggestedField(fieldPaths, ["tags", "labels"]));
		} catch (error) {
			setImportError(
				error instanceof Error ? error.message : "Failed to parse JSONL.",
			);
			setImportFileName(pickedFile.name);
			setImportFieldPaths([]);
			setImportRecords([]);
		}
	};

	const handleImportJsonl = async () => {
		if (!datasetActive || !activeRepoPath || !canImport || !importPreview)
			return;

		clearDatasetFeedback();
		setImportFeedback(null);
		setImportError(null);
		setImportLoading(true);

		let importedCount = 0;
		let lastImportedSampleId: string | null = null;

		try {
			for (const sample of importPreview.samples) {
				const created = await window.desktopAPI.createSample(
					activeRepoPath,
					datasetActive.id,
					toCreateSampleInput(sample),
				);
				if (!created.success || !created.data) {
					throw new Error(
						created.error ?? `Failed to create sample "${sample.title}".`,
					);
				}

				const saved = await window.desktopAPI.saveSampleSource(
					activeRepoPath,
					datasetActive.id,
					created.data.sample.id,
					sample.sourceText,
				);
				if (!saved.success || !saved.data) {
					throw new Error(
						saved.error ??
							`Failed to save source for sample "${created.data.sample.title}".`,
					);
				}

				importedCount += 1;
				lastImportedSampleId = saved.data.sample.id;
			}

			await listDatasets();
			await loadDataset(datasetActive.id);
			if (lastImportedSampleId) {
				await loadSample(lastImportedSampleId);
			}

			const skippedSuffix =
				importSkippedCount > 0
					? ` Skipped ${importSkippedCount} record(s).`
					: "";
			setImportFeedback(
				`Imported ${importedCount} sample(s) from ${importFileName}.${skippedSuffix}`,
			);
		} catch (error) {
			setImportError(
				error instanceof Error ? error.message : "Failed to import JSONL.",
			);
		} finally {
			setImportLoading(false);
		}
	};

	if (!activeRepoId) {
		return (
			<div className="p-3 text-xs text-muted-foreground text-center">
				Select a repository to manage datasets.
			</div>
		);
	}

	return (
		<div className="flex h-full min-h-0 w-full flex-col">
			<div className="h-9 px-2 border-b border-border/60 flex items-center gap-2">
				<div className="text-xs font-medium flex items-center gap-1.5 truncate min-w-0">
					<Database className="h-3.5 w-3.5" />
					<span className="truncate">Dataset Workspace</span>
				</div>
				<button
					type="button"
					className="ml-auto inline-flex items-center justify-center h-7 w-7 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
					onClick={() => void listDatasets()}
					aria-label="Refresh datasets"
				>
					{datasetListLoading ? (
						<Loader2 className="h-3.5 w-3.5 animate-spin" />
					) : (
						<RefreshCw className="h-3.5 w-3.5" />
					)}
				</button>
			</div>

			{errorMessage ? (
				<div className="mx-2 mt-2 rounded border border-destructive/40 bg-destructive/10 px-2 py-1.5 text-xs text-destructive">
					{errorMessage}
				</div>
			) : null}

			<div className="border-b border-border/60 px-2 py-2 space-y-1.5">
				<button
					type="button"
					onClick={() => setIsCreateDatasetExpanded((v) => !v)}
					className="w-full flex items-center justify-between text-left"
				>
					<div className="text-[11px] uppercase tracking-wide text-muted-foreground">
						Create dataset
					</div>
					<ChevronDown
						className={`h-4 w-4 text-muted-foreground transition-transform ${
							isCreateDatasetExpanded ? "rotate-180" : ""
						}`}
					/>
				</button>

				{isCreateDatasetExpanded ? (
					<form
						onSubmit={(event) => {
							void handleCreateDataset(event);
						}}
						className="space-y-1.5"
					>
						<Input
							value={datasetName}
							onChange={(event) => setDatasetName(event.currentTarget.value)}
							placeholder="Dataset name"
							className="h-8 text-xs"
							disabled={busy}
						/>
						<Input
							value={datasetDescription}
							onChange={(event) =>
								setDatasetDescription(event.currentTarget.value)
							}
							placeholder="Description (optional)"
							className="h-8 text-xs"
							disabled={busy}
						/>
						<Button
							type="submit"
							variant="ghost"
							size="sm"
							className="h-8 w-full text-xs rounded-md bg-muted text-muted-foreground border border-transparent hover:bg-[var(--hover-bg)] hover:text-[var(--hover-text)]"
							disabled={busy || datasetName.trim().length === 0}
						>
							<Plus className="h-3.5 w-3.5 mr-1" />
							Create dataset
						</Button>
					</form>
				) : null}
			</div>

			<ScrollArea className="flex-1 w-full overflow-hidden min-h-0">
				<div className="py-1 w-full overflow-hidden">
					{datasetList.length === 0 && !datasetListLoading ? (
						<div className="p-3 text-xs text-muted-foreground text-center">
							No datasets yet.
						</div>
					) : null}

					{datasetList.map((entry) => {
						const selected = datasetActiveId === entry.dataset.id;
						return (
							<button
								type="button"
								key={entry.dataset.id}
								onClick={() => void loadDataset(entry.dataset.id)}
								disabled={busy}
								className={`w-full px-3 py-2 text-left text-xs transition-colors border-b border-border/30 ${
									selected
										? "bg-[var(--highlight-bg)] text-[var(--highlight-text)]"
										: "text-muted-foreground hover:bg-[var(--hover-bg)] hover:text-[var(--hover-text)]"
								}`}
							>
								<div className="font-medium truncate">{entry.dataset.name}</div>
								<div className="mt-0.5 text-[10px] text-muted-foreground">
									{entry.sampleCount} sample(s)
								</div>
							</button>
						);
					})}
				</div>
			</ScrollArea>

			{datasetActive ? (
				<div className="border-t border-border/60 p-2 space-y-2">
					<div className="text-[11px] uppercase tracking-wide text-muted-foreground truncate">
						{datasetActive.name}
					</div>

					<div className="relative">
						<button
							type="button"
							onClick={() => setIsCreateSampleExpanded((v) => !v)}
							className="w-full flex items-center justify-between text-left"
						>
							<div className="text-[11px] uppercase tracking-wide text-muted-foreground">
								Create sample
							</div>
							<ChevronDown
								className={`h-4 w-4 text-muted-foreground transition-transform ${
									isCreateSampleExpanded ? "rotate-180" : ""
								}`}
							/>
						</button>

						{isCreateSampleExpanded ? (
							<div className="absolute left-0 right-0 top-full z-20 mt-2 rounded-md border border-border/60 bg-card p-2">
								<form
									onSubmit={(event) => {
										void handleCreateSample(event);
									}}
									className="space-y-1.5"
								>
									<Input
										value={sampleTitle}
										onChange={(event) =>
											setSampleTitle(event.currentTarget.value)
										}
										placeholder="Sample title"
										className="h-8 text-xs"
										disabled={busy}
									/>
									<Input
										value={sampleTags}
										onChange={(event) =>
											setSampleTags(event.currentTarget.value)
										}
										placeholder="tag1, tag2"
										className="h-8 text-xs"
										disabled={busy}
									/>
									<textarea
										value={sampleSourceText}
										onChange={(event) =>
											setSampleSourceText(event.currentTarget.value)
										}
										placeholder="source.atex (AlphaTex content)"
										className="w-full min-h-[84px] rounded-md border border-input bg-background px-3 py-2 text-xs resize-y focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
										disabled={busy}
									/>
									<Button
										type="submit"
										variant="ghost"
										size="sm"
										className="h-8 w-full text-xs rounded-md bg-muted text-muted-foreground border border-transparent hover:bg-[var(--hover-bg)] hover:text-[var(--hover-text)]"
										disabled={
											busy ||
											(sampleTitle.trim().length === 0 &&
												sampleSourceText.trim().length === 0)
										}
									>
										<Plus className="h-3.5 w-3.5 mr-1" />
										Create sample
									</Button>
								</form>
							</div>
						) : null}
					</div>

					<div className="rounded-md border border-border/60 p-2 space-y-2">
						<div className="flex items-center justify-between gap-2">
							<div className="text-[11px] uppercase tracking-wide text-muted-foreground">
								Import JSONL
							</div>
							{importRecords.length > 0 ? (
								<button
									type="button"
									className="text-[10px] text-muted-foreground underline-offset-2 hover:underline"
									onClick={resetImportState}
									disabled={busy}
								>
									Clear
								</button>
							) : null}
						</div>

						<Button
							type="button"
							variant="ghost"
							size="sm"
							className="h-8 w-full text-xs rounded-md bg-muted text-muted-foreground border border-transparent hover:bg-[var(--hover-bg)] hover:text-[var(--hover-text)]"
							onClick={() => {
								void handlePickJsonl();
							}}
							disabled={busy}
						>
							<Upload className="h-3.5 w-3.5 mr-1" />
							{importFileName ? "Replace JSONL file" : "Choose JSONL file"}
						</Button>

						{importFileName ? (
							<div className="text-[11px] text-muted-foreground break-all">
								File: {importFileName}
							</div>
						) : null}

						{importFeedback ? (
							<div className="rounded border border-emerald-500/40 bg-emerald-500/10 px-2 py-1.5 text-[11px] text-emerald-700 dark:text-emerald-300">
								{importFeedback}
							</div>
						) : null}

						{importError ? (
							<div className="rounded border border-destructive/40 bg-destructive/10 px-2 py-1.5 text-[11px] text-destructive">
								{importError}
							</div>
						) : null}

						{importRecords.length > 0 ? (
							<>
								<div className="grid grid-cols-2 gap-1.5">
									<label className="space-y-1 text-[11px] text-muted-foreground">
										<span>Title field</span>
										<select
											value={importTitleField}
											onChange={(event) =>
												setImportTitleField(event.currentTarget.value)
											}
											className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs text-foreground"
											disabled={busy}
										>
											<option value="">Select field</option>
											{importFieldPaths.map((fieldPath) => (
												<option key={fieldPath} value={fieldPath}>
													{fieldPath}
												</option>
											))}
										</select>
									</label>
									<label className="space-y-1 text-[11px] text-muted-foreground">
										<span>Source field</span>
										<select
											value={importSourceField}
											onChange={(event) =>
												setImportSourceField(event.currentTarget.value)
											}
											className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs text-foreground"
											disabled={busy}
										>
											<option value="">Select field</option>
											{importFieldPaths.map((fieldPath) => (
												<option key={fieldPath} value={fieldPath}>
													{fieldPath}
												</option>
											))}
										</select>
									</label>
									<label className="col-span-2 space-y-1 text-[11px] text-muted-foreground">
										<span>Tags field</span>
										<select
											value={importTagsField}
											onChange={(event) =>
												setImportTagsField(event.currentTarget.value)
											}
											className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs text-foreground"
											disabled={busy}
										>
											<option value="">Do not import</option>
											{importFieldPaths.map((fieldPath) => (
												<option key={fieldPath} value={fieldPath}>
													{fieldPath}
												</option>
											))}
										</select>
									</label>
								</div>

								<div className="rounded border border-border/50 bg-muted/30 px-2 py-1.5 text-[11px] text-muted-foreground space-y-1">
									<div>
										Records: {importRecords.length} | Ready: {importReadyCount}
										{importSkippedCount > 0
											? ` | Skipped: ${importSkippedCount}`
											: ""}
									</div>
									<div className="break-all">
										Fields: {previewFields.join(", ")}
										{importFieldPaths.length > previewFields.length
											? ` +${importFieldPaths.length - previewFields.length} more`
											: ""}
									</div>
									{importPreview?.errors[0] ? (
										<div className="text-destructive">
											First skipped record: {importPreview.errors[0]}
										</div>
									) : null}
								</div>

								<Button
									type="button"
									variant="ghost"
									size="sm"
									className="h-8 w-full text-xs rounded-md bg-muted text-muted-foreground border border-transparent hover:bg-[var(--hover-bg)] hover:text-[var(--hover-text)]"
									onClick={() => {
										void handleImportJsonl();
									}}
									disabled={!canImport}
								>
									{importLoading ? (
										<Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
									) : (
										<Upload className="h-3.5 w-3.5 mr-1" />
									)}
									Import into samples
								</Button>
							</>
						) : null}
					</div>

					<div className="max-h-48 overflow-auto rounded-md border border-border/60">
						{datasetSamples.length === 0 && !datasetLoading ? (
							<div className="p-2 text-xs text-muted-foreground text-center">
								No samples in this dataset.
							</div>
						) : null}
						{datasetSamples.map((sample) => {
							const selected = datasetActiveSampleId === sample.id;
							return (
								<button
									type="button"
									key={sample.id}
									onClick={() => void loadSample(sample.id)}
									disabled={datasetSampleLoading || datasetMutationLoading}
									className={`w-full border-b border-border/40 px-2 py-1.5 text-left text-xs transition-colors last:border-b-0 ${
										selected
											? "bg-[var(--highlight-bg)] text-[var(--highlight-text)]"
											: "text-muted-foreground hover:bg-[var(--hover-bg)] hover:text-[var(--hover-text)]"
									}`}
								>
									<div className="truncate font-medium">{sample.title}</div>
									<div className="mt-1 flex flex-wrap items-center gap-1">
										<span
											className={`inline-flex rounded border px-1 py-0 text-[10px] ${reviewTone(sample.reviewStatus)}`}
										>
											{sample.reviewStatus}
										</span>
										<span className="inline-flex rounded border px-1 py-0 text-[10px] border-border bg-muted/70 text-muted-foreground">
											{sample.tags.length > 0
												? `${sample.tags.length} tag(s)`
												: "untagged"}
										</span>
									</div>
								</button>
							);
						})}
					</div>
				</div>
			) : null}
		</div>
	);
}
