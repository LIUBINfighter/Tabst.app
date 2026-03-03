import type { CodeRange } from "./alphatex-parse-positions";

export interface BeatPosition {
	barIndex: number;
	beatIndex: number;
	startOffset: number;
	endOffset: number;
	startLine: number;
	startColumn: number;
	endLine: number;
	endColumn: number;
}

type ParseBeats = (text: string) => BeatPosition[];
type ResolveBarRanges = (text: string, barIndex: number) => CodeRange[];

interface PlaybackRangeCacheOptions {
	maxEntries?: number;
	parseBeats: ParseBeats;
	resolveBarRanges: ResolveBarRanges;
}

interface CachedEntry {
	beats: BeatPosition[];
	barRangesByIndex: Map<number, CodeRange[]>;
}

export interface PlaybackRangeCache {
	getBeats(text: string): BeatPosition[];
	getBarRanges(text: string, barIndex: number): CodeRange[];
	clear(): void;
	size(): number;
}

function cloneRanges(ranges: CodeRange[]): CodeRange[] {
	return ranges.map((range) => ({ ...range }));
}

export function createPlaybackRangeCache(
	options: PlaybackRangeCacheOptions,
): PlaybackRangeCache {
	const maxEntries = Math.max(1, options.maxEntries ?? 3);
	const cache = new Map<string, CachedEntry>();

	const ensureEntry = (text: string): CachedEntry => {
		const existing = cache.get(text);
		if (existing) {
			cache.delete(text);
			cache.set(text, existing);
			return existing;
		}

		const entry: CachedEntry = {
			beats: options.parseBeats(text),
			barRangesByIndex: new Map(),
		};
		cache.set(text, entry);

		if (cache.size > maxEntries) {
			const oldestKey = cache.keys().next().value;
			if (typeof oldestKey === "string") {
				cache.delete(oldestKey);
			}
		}

		return entry;
	};

	return {
		getBeats(text: string): BeatPosition[] {
			return ensureEntry(text).beats;
		},
		getBarRanges(text: string, barIndex: number): CodeRange[] {
			const entry = ensureEntry(text);
			const cached = entry.barRangesByIndex.get(barIndex);
			if (cached) {
				return cloneRanges(cached);
			}

			const ranges = options.resolveBarRanges(text, barIndex);
			entry.barRangesByIndex.set(barIndex, cloneRanges(ranges));
			return cloneRanges(ranges);
		},
		clear() {
			cache.clear();
		},
		size() {
			return cache.size;
		},
	};
}
