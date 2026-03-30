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

export interface SampleSummary {
	id: string;
	title: string;
	tags: string[];
	reviewStatus: SampleReviewStatus;
	reviewNotes?: string;
	metadata?: DatasetJsonValue;
	source: SampleSourceManifest;
	artifacts: SampleArtifactsManifest;
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
	artifacts: SampleArtifactsManifest;
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
	artifactKind: SampleArtifactKind;
	targetFileName: string;
	bytes: Uint8Array;
}

function createMissingArtifact(fileName: string): SampleArtifactManifest {
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
	return {
		...sample,
		tags: sample.tags ?? [],
		artifacts: normalizeSampleArtifacts(sample.artifacts),
	};
}

export function normalizeSampleManifest(
	sample: SampleManifest,
): SampleManifest {
	return {
		...sample,
		tags: sample.tags ?? [],
		artifacts: normalizeSampleArtifacts(sample.artifacts),
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
