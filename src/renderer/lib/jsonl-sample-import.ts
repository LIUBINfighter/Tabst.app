import type { CreateSampleInput, DatasetJsonValue } from "../types/dataset";

type JsonRecord = Record<string, DatasetJsonValue>;

export interface PreparedJsonlSampleImport {
	title: string;
	sourceText: string;
	tags?: string[];
	metadata: DatasetJsonValue;
}

export interface JsonlSampleImportMapping {
	titleField: string;
	sourceField: string;
	tagsField?: string;
}

export interface PreparedJsonlSampleImports {
	samples: PreparedJsonlSampleImport[];
	errors: string[];
}

function isJsonRecord(value: DatasetJsonValue): value is JsonRecord {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUsableScalar(value: DatasetJsonValue | undefined): boolean {
	return value !== undefined && value !== null;
}

function toFlatText(value: DatasetJsonValue | undefined): string | undefined {
	if (!isUsableScalar(value)) return undefined;
	if (typeof value === "string") return value;
	if (
		typeof value === "number" ||
		typeof value === "boolean" ||
		Array.isArray(value)
	) {
		return String(value);
	}
	return JSON.stringify(value);
}

function toStringList(
	value: DatasetJsonValue | undefined,
): string[] | undefined {
	if (!isUsableScalar(value)) return undefined;
	if (Array.isArray(value)) {
		const tags = value
			.map((item) => toFlatText(item))
			.filter((item): item is string => Boolean(item?.trim().length));
		return tags.length > 0 ? tags : undefined;
	}

	const raw = toFlatText(value);
	if (!raw) return undefined;
	const tags = raw
		.split(",")
		.map((tag) => tag.trim())
		.filter((tag) => tag.length > 0);
	return tags.length > 0 ? tags : undefined;
}

function getFieldValue(
	record: JsonRecord,
	fieldPath?: string,
): DatasetJsonValue | undefined {
	if (!fieldPath) return undefined;

	const segments = fieldPath
		.split(".")
		.map((segment) => segment.trim())
		.filter((segment) => segment.length > 0);
	if (segments.length === 0) return undefined;

	let current: DatasetJsonValue | undefined = record;
	for (const segment of segments) {
		if (!isJsonRecord(current)) {
			return undefined;
		}
		current = current[segment];
	}
	return current;
}

function visitFieldPaths(
	value: DatasetJsonValue,
	prefix: string,
	paths: Set<string>,
): void {
	if (prefix.length > 0) {
		paths.add(prefix);
	}

	if (isJsonRecord(value)) {
		for (const [key, child] of Object.entries(value)) {
			visitFieldPaths(child, prefix ? `${prefix}.${key}` : key, paths);
		}
	}
}

export function parseJsonlRecords(text: string): JsonRecord[] {
	const records: JsonRecord[] = [];
	const lines = text.split(/\r?\n/);

	for (const [lineIndex, rawLine] of lines.entries()) {
		const line = rawLine.trim();
		if (line.length === 0) continue;

		let parsed: DatasetJsonValue;
		try {
			parsed = JSON.parse(line) as DatasetJsonValue;
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Unknown parse error";
			throw new Error(`Invalid JSON on line ${lineIndex + 1}: ${message}`);
		}
		if (!isJsonRecord(parsed)) {
			throw new Error(`Line ${lineIndex + 1} must be a JSON object.`);
		}
		records.push(parsed);
	}

	return records;
}

export function collectJsonlFieldPaths(records: JsonRecord[]): string[] {
	const paths = new Set<string>();
	for (const record of records) {
		visitFieldPaths(record, "", paths);
	}
	return [...paths].sort((left, right) => left.localeCompare(right));
}

export function toCreateSampleInput(
	sample: PreparedJsonlSampleImport,
): CreateSampleInput {
	return {
		title: sample.title,
		tags: sample.tags,
		metadata: sample.metadata,
	};
}

export function prepareJsonlSampleImports(
	records: JsonRecord[],
	mapping: JsonlSampleImportMapping,
): PreparedJsonlSampleImports {
	const samples: PreparedJsonlSampleImport[] = [];
	const errors: string[] = [];

	const normalizedTitleField = mapping.titleField.trim();

	for (const [index, record] of records.entries()) {
		const titleFromField = normalizedTitleField
			? toFlatText(getFieldValue(record, normalizedTitleField))?.trim()
			: null;

		const title = titleFromField ?? `Sample ${index + 1}`;
		if (!normalizedTitleField && !title.trim()) {
			// Should never happen, but keep the import from producing empty titles.
			errors.push(`Line ${index + 1} failed to auto-generate a usable title.`);
			continue;
		}
		if (normalizedTitleField && !titleFromField) {
			errors.push(
				`Line ${index + 1} is missing a usable value for required field "${normalizedTitleField}".`,
			);
			continue;
		}

		const sourceText = toFlatText(getFieldValue(record, mapping.sourceField));
		if (!sourceText?.trim()) {
			errors.push(
				`Line ${index + 1} is missing a usable value for required field "${mapping.sourceField}".`,
			);
			continue;
		}

		samples.push({
			title,
			sourceText,
			tags: toStringList(getFieldValue(record, mapping.tagsField)),
			metadata: record,
		});
	}

	return { samples, errors };
}
