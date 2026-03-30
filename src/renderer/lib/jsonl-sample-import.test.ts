import { describe, expect, it } from "vitest";
import {
	collectJsonlFieldPaths,
	parseJsonlRecords,
	prepareJsonlSampleImports,
} from "./jsonl-sample-import";

describe("jsonl sample import", () => {
	it("parses jsonl records and collects nested field paths", () => {
		const records = parseJsonlRecords(`
{"title":"Verse","source":{"text":"A B C"},"meta":{"split":"train"}}
{"title":"Chorus","source":{"text":"D E F"},"tags":["lead","hook"]}
`);

		expect(records).toHaveLength(2);
		expect(collectJsonlFieldPaths(records)).toEqual([
			"meta",
			"meta.split",
			"source",
			"source.text",
			"tags",
			"title",
		]);
	});

	it("maps selected jsonl fields into sample payloads", () => {
		const records = parseJsonlRecords(`
{"name":"Verse 1","alphatex":"\\\\tempo 120\\n.","desc":"opening riff","split":"train","tags":["easy","riff"]}
`);

		const result = prepareJsonlSampleImports(records, {
			titleField: "name",
			sourceField: "alphatex",
			tagsField: "tags",
		});

		expect(result.errors).toEqual([]);
			expect(result.samples).toEqual([
			{
				title: "Verse 1",
				sourceText: "\\tempo 120\n.",
				tags: ["easy", "riff"],
				metadata: {
					name: "Verse 1",
					alphatex: "\\tempo 120\n.",
					desc: "opening riff",
					split: "train",
					tags: ["easy", "riff"],
				},
			},
		]);
	});

	it("reports missing required mapped fields with line numbers", () => {
		const records = parseJsonlRecords(`
{"name":"Verse 1","alphatex":"A B C"}
{"name":"Verse 2"}
`);

		const result = prepareJsonlSampleImports(records, {
			titleField: "name",
			sourceField: "alphatex",
		});

		expect(result.samples).toHaveLength(1);
		expect(result.errors).toEqual([
			'Line 2 is missing a usable value for required field "alphatex".',
		]);
	});

	it("auto-generates title when titleField is empty", () => {
		const records = parseJsonlRecords(`
{"source":{"text":"A B C"}}
{"source":{"text":"D E F"}}
`);

		const result = prepareJsonlSampleImports(records, {
			titleField: "",
			sourceField: "source.text",
		});

		expect(result.errors).toEqual([]);
		expect(result.samples).toEqual([
			{ title: "Sample 1", sourceText: "A B C", tags: undefined, metadata: records[0] },
			{ title: "Sample 2", sourceText: "D E F", tags: undefined, metadata: records[1] },
		]);
	});
});
