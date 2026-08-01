import * as alphaTab from "@coderline/alphatab";
import { describe, expect, it } from "vitest";
import { extractAtDocFileMeta, getAtDocSections, parseAtDoc } from "./atdoc";

describe("parseAtDoc player volume directives", () => {
	it("parses at.player.volume as overall player volume", () => {
		const result = parseAtDoc(["at.player.volume=0.72", "1.1.1"].join("\n"));

		expect(result.config.player?.volume).toBe(0.72);
		expect(result.warnings).toEqual([]);
		expect(result.cleanContent).toBe("1.1.1");
	});

	it("warns when at.player.volume is outside [0, 1]", () => {
		const result = parseAtDoc(["at.player.volume=1.2", "1.1.1"].join("\n"));

		expect(result.config.player?.volume).toBeUndefined();
		expect(result.warnings).toEqual([
			{
				line: 1,
				message: "at.player.volume must be a number in [0, 1]",
			},
		]);
		expect(result.cleanContent).toBe("1.1.1");
	});
});

describe("parseAtDoc player track mix directives", () => {
	it("parses at.player.muteTracks and at.player.soloTracks", () => {
		const result = parseAtDoc(
			["at.player.muteTracks=0,2,2", "at.player.soloTracks=1", "1.1.1"].join(
				"\n",
			),
		);

		expect(result.config.player?.muteTracks).toEqual([0, 2]);
		expect(result.config.player?.soloTracks).toEqual([1]);
		expect(result.warnings).toEqual([]);
		expect(result.cleanContent).toBe("1.1.1");
	});

	it("warns when track index list contains invalid item", () => {
		const result = parseAtDoc(
			["at.player.muteTracks=1,a", "at.player.soloTracks=-1"].join("\n"),
		);

		expect(result.config.player?.muteTracks).toBeUndefined();
		expect(result.config.player?.soloTracks).toBeUndefined();
		expect(result.warnings).toEqual([
			{
				line: 1,
				message:
					"at.player.muteTracks must be a comma-separated list of non-negative integers",
			},
			{
				line: 2,
				message:
					"at.player.soloTracks must be a comma-separated list of non-negative integers",
			},
		]);
	});
});

describe("parseAtDoc inline #tags", () => {
	it("collects #tags from * comment lines", () => {
		const result = parseAtDoc(
			["* practice this #rock #solo", "1.1.1"].join("\n"),
		);

		expect(result.inlineTags).toEqual(["rock", "solo"]);
		expect(result.warnings).toEqual([]);
	});

	it("collects #tags from // comment lines", () => {
		const result = parseAtDoc(["// warmup #caged", "1.1.1"].join("\n"));

		expect(result.inlineTags).toEqual(["caged"]);
	});

	it("collects #tags from tab-prefixed comment lines", () => {
		const result = parseAtDoc("\t* #练习曲 #和弦".concat("\n", "1.1.1"));

		expect(result.inlineTags).toEqual(["练习曲", "和弦"]);
	});

	it("allows trailing punctuation and hyphen/underscore in tags", () => {
		const result = parseAtDoc(
			"* tags: #rock, #finger-style #_warmup_1!".concat("\n"),
		);

		expect(result.inlineTags).toEqual(["rock", "finger-style", "_warmup_1"]);
	});

	it("ignores # inside ATDOC directive values such as colors", () => {
		const result = parseAtDoc(
			"* at.coloring.barNumberColor=#ef4444".concat("\n", "1.1.1"),
		);

		expect(result.inlineTags).toEqual([]);
	});

	it("ignores # inside non-comment content such as chord names", () => {
		const result = parseAtDoc('\t t "C#m"'.concat("\n", "1.1.1"));

		expect(result.inlineTags).toEqual([]);
	});

	it("keeps comment lines in cleanContent", () => {
		const result = parseAtDoc("* #rock comment".concat("\n", "1.1.1"));

		expect(result.cleanContent).toBe("* #rock comment\n1.1.1");
	});
});

describe("extractAtDocFileMeta inline #tags", () => {
	it("merges at.meta.tag and inline #tags, deduplicated with ATDOC first", () => {
		const meta = extractAtDocFileMeta(
			[
				'* at.meta.tag="rock, blues"',
				"* also #blues #metal #练习",
				"1.1.1",
			].join("\n"),
		);

		expect(meta.metaTags).toEqual(["rock", "blues", "metal", "练习"]);
	});

	it("returns inline #tags when no at.meta.tag exists", () => {
		const meta = extractAtDocFileMeta(["* #warmup #caged", "1.1.1"].join("\n"));

		expect(meta.metaTags).toEqual(["warmup", "caged"]);
	});

	it("returns no tags for content without comments", () => {
		const meta = extractAtDocFileMeta("1.1.1");

		expect(meta.metaTags).toEqual([]);
	});
});

describe("parseAtDoc INI sections", () => {
	it("applies bare keys inside a known section", () => {
		const result = parseAtDoc(
			["[player]", "volume=0.5", "countInEnabled=true", "1.1.1"].join("\n"),
		);

		expect(result.config.player?.volume).toBe(0.5);
		expect(result.config.player?.countInEnabled).toBe(true);
		expect(result.warnings).toEqual([]);
	});

	it("maps keys to their section domains", () => {
		const result = parseAtDoc(
			[
				"* [meta]",
				'* title="Flower Dance"',
				'* tag="acoustic, guitar"',
				"* [print]",
				"* barsPerRow=4",
				"* zoom=1.1",
				"1.1.1",
			].join("\n"),
		);

		expect(result.config.meta?.title).toBe("Flower Dance");
		expect(result.config.meta?.tag).toEqual(["acoustic", "guitar"]);
		expect(result.config.print?.barsPerRow).toBe(4);
		expect(result.config.print?.zoom).toBe(1.1);
		expect(result.warnings).toEqual([]);
	});

	it("mixes INI sections with dotted directives", () => {
		const result = parseAtDoc(
			[
				"* [display]",
				"* scale=0.8",
				"* at.display.layoutMode=Page",
				"* [player]",
				"* playbackSpeed=0.9",
				"1.1.1",
			].join("\n"),
		);

		expect(result.config.display?.scale).toBe(0.8);
		expect(result.config.display?.layoutMode).toBe(alphaTab.LayoutMode.Page);
		expect(result.config.player?.playbackSpeed).toBe(0.9);
	});

	it("warns on unknown section and ignores its keys", () => {
		const result = parseAtDoc(
			["[playr]", "volume=0.5", "[player]", "volume=0.7", "1.1.1"].join("\n"),
		);

		expect(result.config.player?.volume).toBe(0.7);
		expect(result.warnings).toEqual([
			{ line: 1, message: "Unknown atdoc section: [playr]" },
		]);
	});

	it("warns on unknown key inside a known section", () => {
		const result = parseAtDoc(
			["[player]", "volume=0.5", "wobble=3", "1.1.1"].join("\n"),
		);

		expect(result.config.player?.volume).toBe(0.5);
		expect(result.warnings).toEqual([
			{ line: 3, message: "Unknown atdoc key: at.player.wobble" },
		]);
	});

	it("ignores bare keys outside any section", () => {
		const result = parseAtDoc(["volume=0.5", "1.1.1"].join("\n"));

		expect(result.config.player?.volume).toBeUndefined();
		expect(result.warnings).toEqual([]);
	});

	it("strips section headers and bare keys from cleanContent", () => {
		const result = parseAtDoc(
			["* [player]", "* volume=0.5", "* comment stays", "1.1.1"].join("\n"),
		);

		expect(result.cleanContent).toBe("* comment stays\n1.1.1");
	});

	it("still collects #tags from prose inside a section block", () => {
		const result = parseAtDoc(
			["* [meta]", "* 练习曲 #摇滚", '* tag="caged"', "1.1.1"].join("\n"),
		);

		expect(result.config.meta?.tag).toEqual(["caged"]);
		expect(result.inlineTags).toEqual(["摇滚"]);
	});

	it("supports whitespace inside brackets and key = value spacing", () => {
		const result = parseAtDoc(
			["[ player ]", "scrollSpeed = 300", "1.1.1"].join("\n"),
		);

		expect(result.config.player?.scrollSpeed).toBe(300);
		expect(result.warnings).toEqual([]);
	});

	it("applies last value when the same key appears in INI and dotted form", () => {
		const result = parseAtDoc(
			[
				"[display]",
				"scale=0.8",
				"at.display.scale=0.9",
				"[display]",
				"scale=0.7",
				"1.1.1",
			].join("\n"),
		);

		expect(result.config.display?.scale).toBe(0.7);
	});

	it("exposes the known section names", () => {
		expect(getAtDocSections()).toEqual([
			"coloring",
			"display",
			"meta",
			"player",
			"print",
			"staff",
		]);
	});
});
