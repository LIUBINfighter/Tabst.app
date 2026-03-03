import { describe, expect, it } from "vitest";
import {
	evaluateBaselineThresholds,
	evaluateLongStressThresholds,
	evaluatePerformanceThresholds,
	type PerfThresholdConfig,
} from "./perf-thresholds";

const config: PerfThresholdConfig = {
	baseline: {
		coldLoadMeanMsMax: 450,
		coldLoadP95MsMax: 700,
		heapDeltaMeanBytesMax: 3_500_000,
		idleListenersP95Max: 3_000,
	},
	stress: {
		minDurationMin: 8,
		heapDeltaPerMinBytesMax: 600_000,
		listenersP95Max: 3_500,
		listenersDeltaPerMinMax: 30,
	},
};

describe("evaluateBaselineThresholds", () => {
	it("returns no violations when summary is within thresholds", () => {
		const baselineSummary = {
			summary: {
				cold_load: { mean: 312, p95: 520 },
				heap_delta: { mean: 120_000, p95: 200_000 },
				idle_listeners: { mean: 1100, p95: 2100 },
			},
		};

		expect(evaluateBaselineThresholds(baselineSummary, config)).toEqual([]);
	});

	it("returns violations for exceeded baseline metrics", () => {
		const baselineSummary = {
			summary: {
				cold_load: { mean: 600, p95: 820 },
				heap_delta: { mean: 4_200_000, p95: 5_000_000 },
				idle_listeners: { mean: 1200, p95: 3501 },
			},
		};

		const violations = evaluateBaselineThresholds(baselineSummary, config);
		expect(violations.map((v) => v.metric)).toEqual([
			"cold_load.mean",
			"cold_load.p95",
			"heap_delta.mean",
			"idle_listeners.p95",
		]);
	});
});

describe("evaluateLongStressThresholds", () => {
	it("returns no violations when stress summary is healthy", () => {
		const stressSummary = {
			durationMin: 12.5,
			heap: { deltaPerMin: 420_000 },
			listeners: { stats: { p95: 3200 }, deltaPerMin: 4 },
		};

		expect(evaluateLongStressThresholds(stressSummary, config)).toEqual([]);
	});

	it("returns violations for unhealthy stress metrics", () => {
		const stressSummary = {
			durationMin: 6.2,
			heap: { deltaPerMin: 760_000 },
			listeners: { stats: { p95: 4100 }, deltaPerMin: 48 },
		};

		const violations = evaluateLongStressThresholds(stressSummary, config);
		expect(violations.map((v) => v.metric)).toEqual([
			"durationMin",
			"heap.deltaPerMin",
			"listeners.stats.p95",
			"listeners.deltaPerMin",
		]);
	});
});

describe("evaluatePerformanceThresholds", () => {
	it("aggregates baseline and stress violations", () => {
		const baselineSummary = {
			summary: {
				cold_load: { mean: 520, p95: 600 },
				heap_delta: { mean: 100_000, p95: 150_000 },
				idle_listeners: { mean: 1100, p95: 1200 },
			},
		};
		const stressSummary = {
			durationMin: 4.5,
			heap: { deltaPerMin: 300_000 },
			listeners: { stats: { p95: 1500 }, deltaPerMin: 2 },
		};

		const violations = evaluatePerformanceThresholds(
			baselineSummary,
			stressSummary,
			config,
		);

		expect(violations.map((v) => v.metric)).toEqual([
			"cold_load.mean",
			"durationMin",
		]);
	});
});
