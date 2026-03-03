import { describe, expect, it, vi } from "vitest";
import { createPlaybackRangeCache } from "./playback-range-cache";

describe("createPlaybackRangeCache", () => {
	it("reuses parsed beats for identical text", () => {
		const parseBeats = vi.fn((text: string) => [
			{
				barIndex: 0,
				beatIndex: 0,
				startOffset: 0,
				endOffset: text.length,
				startLine: 1,
				startColumn: 1,
				endLine: 1,
				endColumn: text.length,
			},
		]);
		const resolveBarRanges = vi.fn(() => []);

		const cache = createPlaybackRangeCache({ parseBeats, resolveBarRanges });

		cache.getBeats("a");
		cache.getBeats("a");
		cache.getBeats("a");

		expect(parseBeats).toHaveBeenCalledTimes(1);
	});

	it("caches bar ranges per text + bar index", () => {
		const parseBeats = vi.fn(() => []);
		const resolveBarRanges = vi.fn((_: string, barIndex: number) => [
			{
				from: barIndex,
				to: barIndex + 3,
				startLine: 1,
				startColumn: 1,
				endLine: 1,
				endColumn: 4,
			},
		]);

		const cache = createPlaybackRangeCache({ parseBeats, resolveBarRanges });

		const first = cache.getBarRanges("abc", 1);
		const second = cache.getBarRanges("abc", 1);
		const third = cache.getBarRanges("abc", 2);

		expect(resolveBarRanges).toHaveBeenCalledTimes(2);
		expect(first).toEqual(second);
		expect(third[0].from).toBe(2);
	});

	it("evicts least recently used text entries", () => {
		const parseBeats = vi.fn(() => []);
		const resolveBarRanges = vi.fn(() => []);

		const cache = createPlaybackRangeCache({
			maxEntries: 2,
			parseBeats,
			resolveBarRanges,
		});

		cache.getBeats("t1");
		cache.getBeats("t2");
		cache.getBeats("t3");

		expect(cache.size()).toBe(2);
		cache.getBeats("t2");
		cache.getBeats("t3");
		expect(parseBeats).toHaveBeenCalledTimes(3);
	});
});
