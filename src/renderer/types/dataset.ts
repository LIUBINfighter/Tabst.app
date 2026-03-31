export type DatasetJsonValue =
	| string
	| number
	| boolean
	| null
	| DatasetJsonValue[]
	| { [key: string]: DatasetJsonValue };

export type SampleReviewStatus = "pending" | "approved" | "rejected";

export type ArtifactState = "missing" | "ready" | "stale";

export const DEFAULT_SAMPLE_ARTIFACT_FILES = {
	image: "render.png",
	midi: "score.mid",
	wav: "audio.wav",
} as const;

export const KNOWN_SAMPLE_ARTIFACT_ORDER = ["midi", "wav", "image"] as const;

export type KnownSampleArtifactKind =
	(typeof KNOWN_SAMPLE_ARTIFACT_ORDER)[number];

export type SampleArtifactKind = KnownSampleArtifactKind | (string & {});

export const DEFAULT_SUBSAMPLE_ID = "subsample-1" as const;

export const DEFAULT_SUBSAMPLE_OBJECT_FILES = {
	alphatex: "score.atex",
	image: "render.png",
	audio: "audio.wav",
	midi: "score.mid",
} as const;

export const KNOWN_SUBSAMPLE_OBJECT_ORDER = [
	"alphatex",
	"image",
	"audio",
	"midi",
] as const;

export type KnownSubsampleObjectKind =
	(typeof KNOWN_SUBSAMPLE_OBJECT_ORDER)[number];

export type SubsampleObjectKind = KnownSubsampleObjectKind | (string & {});

export interface DatasetManifest {
	schemaVersion: number;
	id: string;
	name: string;
	description?: string;
	createdAt: number;
	updatedAt: number;
}

export interface SampleSourceManifest {
	fileName: string;
	textHash: string;
	updatedAt: number;
}

export interface SampleArtifactManifest {
	fileName: string;
	state: ArtifactState;
	sourceHash?: string;
	updatedAt?: number;
}

export type SampleArtifactsManifest = Record<string, SampleArtifactManifest>;

export interface SubsampleManifest {
	id: string;
	title?: string;
	objects: SubsampleObjectsManifest;
	createdAt: number;
	updatedAt: number;
}

export type SubsampleObjectManifest = SampleArtifactManifest;
export type SubsampleObjectsManifest = Record<string, SubsampleObjectManifest>;

export interface SampleSummary {
	id: string;
	title: string;
	tags: string[];
	reviewStatus: SampleReviewStatus;
	reviewNotes?: string;
	metadata?: DatasetJsonValue;
	source: SampleSourceManifest;
	subsamples: SubsampleManifest[];
	createdAt: number;
	updatedAt: number;
}

export interface SampleManifest {
	schemaVersion: number;
	id: string;
	datasetId: string;
	title: string;
	tags: string[];
	reviewStatus: SampleReviewStatus;
	reviewNotes?: string;
	metadata?: DatasetJsonValue;
	source: SampleSourceManifest;
	subsamples: SubsampleManifest[];
	createdAt: number;
	updatedAt: number;
}

export interface LoadedDataset {
	dataset: DatasetManifest;
	samples: SampleSummary[];
}

export interface LoadedSample {
	sample: SampleManifest;
	sourceText: string;
}

export interface DatasetListEntry {
	dataset: DatasetManifest;
	sampleCount: number;
}

export interface DatasetCommandResponse<T> {
	success: boolean;
	data?: T;
	error?: string;
}

export interface CreateDatasetInput {
	id?: string;
	name: string;
	description?: string;
}

export interface CreateSampleInput {
	id?: string;
	title?: string;
	tags?: string[];
	sourceText?: string;
	metadata?: DatasetJsonValue;
}

export interface UpdateSampleInput {
	title?: string;
	tags?: string[];
	reviewStatus?: SampleReviewStatus;
	reviewNotes?: string;
	metadata?: DatasetJsonValue;
}

export interface DatasetExportResult {
	path: string;
	relativePath: string;
	exportedCount: number;
}

export interface SaveSampleArtifactInput {
	subsampleId: string;
	objectKind: SubsampleObjectKind;
	artifactKind: SampleArtifactKind;
	targetFileName: string;
	bytes: Uint8Array;
}

export interface CreateSubsampleInput {
	id?: string;
	title?: string;
}

function createMissingArtifact(fileName: string): SampleArtifactManifest {
	return {
		fileName,
		state: "missing",
	};
}

function createMissingSubsampleObject(
	fileName: string,
): SubsampleObjectManifest {
	return {
		fileName,
		state: "missing",
	};
}

export function normalizeSampleArtifacts(
	artifacts?: SampleArtifactsManifest,
): SampleArtifactsManifest {
	const normalized: SampleArtifactsManifest = {
		...(artifacts ?? {}),
	};

	if (!normalized.wav && normalized.audio) {
		normalized.wav = { ...normalized.audio };
	}

	for (const artifactKind of KNOWN_SAMPLE_ARTIFACT_ORDER) {
		if (!normalized[artifactKind]) {
			normalized[artifactKind] = createMissingArtifact(
				DEFAULT_SAMPLE_ARTIFACT_FILES[artifactKind],
			);
		}
	}

	return normalized;
}

function normalizeSubsampleObjects(
	objects?: SubsampleObjectsManifest,
): SubsampleObjectsManifest {
	const normalized: SubsampleObjectsManifest = {
		...(objects ?? {}),
	};

	if (!normalized.audio && normalized.wav) {
		normalized.audio = { ...normalized.wav };
	}

	for (const objectKind of KNOWN_SUBSAMPLE_OBJECT_ORDER) {
		if (!normalized[objectKind]) {
			normalized[objectKind] = createMissingSubsampleObject(
				DEFAULT_SUBSAMPLE_OBJECT_FILES[objectKind],
			);
		}
	}

	return normalized;
}

function migrateArtifactsToSubsample(
	artifacts?: SampleArtifactsManifest,
): SubsampleManifest {
	const normalizedArtifacts = normalizeSampleArtifacts(artifacts);
	const nextObjects: SubsampleObjectsManifest = {
		alphatex:
			normalizedArtifacts.alphatex ??
			createMissingSubsampleObject(DEFAULT_SUBSAMPLE_OBJECT_FILES.alphatex),
		image:
			normalizedArtifacts.image ??
			createMissingSubsampleObject(DEFAULT_SUBSAMPLE_OBJECT_FILES.image),
		audio:
			normalizedArtifacts.audio ??
			normalizedArtifacts.wav ??
			createMissingSubsampleObject(DEFAULT_SUBSAMPLE_OBJECT_FILES.audio),
		midi:
			normalizedArtifacts.midi ??
			createMissingSubsampleObject(DEFAULT_SUBSAMPLE_OBJECT_FILES.midi),
	};

	return {
		id: DEFAULT_SUBSAMPLE_ID,
		objects: normalizeSubsampleObjects(nextObjects),
		createdAt: 0,
		updatedAt: 0,
	};
}

export function normalizeSampleSubsamples(
	subsamples: SubsampleManifest[] | undefined,
	legacyArtifacts?: SampleArtifactsManifest,
): SubsampleManifest[] {
	if (!subsamples || subsamples.length === 0) {
		return [migrateArtifactsToSubsample(legacyArtifacts)];
	}

	return subsamples.map((subsample, index) => ({
		...subsample,
		id:
			typeof subsample.id === "string" && subsample.id.trim().length > 0
				? subsample.id
				: `${DEFAULT_SUBSAMPLE_ID}-${index + 1}`,
		objects: normalizeSubsampleObjects(subsample.objects),
	}));
}

export function getSubsampleObject(
	subsample: SubsampleManifest | undefined,
	objectKind: SubsampleObjectKind,
): SubsampleObjectManifest {
	const normalized = normalizeSubsampleObjects(subsample?.objects);
	return (
		normalized[objectKind] ??
		createMissingSubsampleObject(`${String(objectKind)}.bin`)
	);
}

export function getSampleArtifact(
	artifacts: SampleArtifactsManifest | undefined,
	artifactKind: SampleArtifactKind,
): SampleArtifactManifest {
	const normalized = normalizeSampleArtifacts(artifacts);
	return (
		normalized[artifactKind] ??
		createMissingArtifact(`${String(artifactKind)}.bin`)
	);
}

export function normalizeSampleSummary(sample: SampleSummary): SampleSummary {
	const legacy = sample as SampleSummary & {
		artifacts?: SampleArtifactsManifest;
	};
	return {
		...sample,
		tags: sample.tags ?? [],
		subsamples: normalizeSampleSubsamples(sample.subsamples, legacy.artifacts),
	};
}

export function normalizeSampleManifest(
	sample: SampleManifest,
): SampleManifest {
	const legacy = sample as SampleManifest & {
		artifacts?: SampleArtifactsManifest;
	};
	return {
		...sample,
		tags: sample.tags ?? [],
		subsamples: normalizeSampleSubsamples(sample.subsamples, legacy.artifacts),
	};
}

export function normalizeLoadedSample(
	loadedSample: LoadedSample,
): LoadedSample {
	return {
		...loadedSample,
		sample: normalizeSampleManifest(loadedSample.sample),
	};
}

export function normalizeLoadedDataset(
	loadedDataset: LoadedDataset,
): LoadedDataset {
	return {
		...loadedDataset,
		samples: loadedDataset.samples.map(normalizeSampleSummary),
	};
}
