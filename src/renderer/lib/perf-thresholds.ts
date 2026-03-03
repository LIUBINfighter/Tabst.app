export interface PerfThresholdConfig {
	baseline: {
		coldLoadMeanMsMax: number;
		coldLoadP95MsMax: number;
		heapDeltaMeanBytesMax: number;
		idleListenersP95Max: number;
	};
	stress: {
		minDurationMin: number;
		heapDeltaPerMinBytesMax: number;
		listenersP95Max: number;
		listenersDeltaPerMinMax: number;
	};
}

export interface PerfViolation {
	scope: "baseline" | "stress";
	metric: string;
	actual: number;
	threshold: number;
	message: string;
}

interface BaselineMetricSummary {
	mean: number;
	p95: number;
}

interface BaselineSummary {
	summary: {
		cold_load: BaselineMetricSummary;
		heap_delta: BaselineMetricSummary;
		idle_listeners: BaselineMetricSummary;
	};
}

interface LongStressSummary {
	durationMin: number;
	heap: {
		deltaPerMin: number;
	};
	listeners: {
		stats: {
			p95: number;
		};
		deltaPerMin: number;
	};
}

export function evaluateBaselineThresholds(
	summary: BaselineSummary,
	config: PerfThresholdConfig,
): PerfViolation[] {
	const violations: PerfViolation[] = [];

	if (summary.summary.cold_load.mean > config.baseline.coldLoadMeanMsMax) {
		violations.push({
			scope: "baseline",
			metric: "cold_load.mean",
			actual: summary.summary.cold_load.mean,
			threshold: config.baseline.coldLoadMeanMsMax,
			message: "cold_load.mean exceeded threshold",
		});
	}

	if (summary.summary.cold_load.p95 > config.baseline.coldLoadP95MsMax) {
		violations.push({
			scope: "baseline",
			metric: "cold_load.p95",
			actual: summary.summary.cold_load.p95,
			threshold: config.baseline.coldLoadP95MsMax,
			message: "cold_load.p95 exceeded threshold",
		});
	}

	if (summary.summary.heap_delta.mean > config.baseline.heapDeltaMeanBytesMax) {
		violations.push({
			scope: "baseline",
			metric: "heap_delta.mean",
			actual: summary.summary.heap_delta.mean,
			threshold: config.baseline.heapDeltaMeanBytesMax,
			message: "heap_delta.mean exceeded threshold",
		});
	}

	if (
		summary.summary.idle_listeners.p95 > config.baseline.idleListenersP95Max
	) {
		violations.push({
			scope: "baseline",
			metric: "idle_listeners.p95",
			actual: summary.summary.idle_listeners.p95,
			threshold: config.baseline.idleListenersP95Max,
			message: "idle_listeners.p95 exceeded threshold",
		});
	}

	return violations;
}

export function evaluateLongStressThresholds(
	summary: LongStressSummary,
	config: PerfThresholdConfig,
): PerfViolation[] {
	const violations: PerfViolation[] = [];

	if (summary.durationMin < config.stress.minDurationMin) {
		violations.push({
			scope: "stress",
			metric: "durationMin",
			actual: summary.durationMin,
			threshold: config.stress.minDurationMin,
			message: "durationMin below required minimum",
		});
	}

	if (summary.heap.deltaPerMin > config.stress.heapDeltaPerMinBytesMax) {
		violations.push({
			scope: "stress",
			metric: "heap.deltaPerMin",
			actual: summary.heap.deltaPerMin,
			threshold: config.stress.heapDeltaPerMinBytesMax,
			message: "heap.deltaPerMin exceeded threshold",
		});
	}

	if (summary.listeners.stats.p95 > config.stress.listenersP95Max) {
		violations.push({
			scope: "stress",
			metric: "listeners.stats.p95",
			actual: summary.listeners.stats.p95,
			threshold: config.stress.listenersP95Max,
			message: "listeners.stats.p95 exceeded threshold",
		});
	}

	if (summary.listeners.deltaPerMin > config.stress.listenersDeltaPerMinMax) {
		violations.push({
			scope: "stress",
			metric: "listeners.deltaPerMin",
			actual: summary.listeners.deltaPerMin,
			threshold: config.stress.listenersDeltaPerMinMax,
			message: "listeners.deltaPerMin exceeded threshold",
		});
	}

	return violations;
}

export function evaluatePerformanceThresholds(
	baselineSummary: BaselineSummary,
	longStressSummary: LongStressSummary,
	config: PerfThresholdConfig,
): PerfViolation[] {
	return [
		...evaluateBaselineThresholds(baselineSummary, config),
		...evaluateLongStressThresholds(longStressSummary, config),
	];
}
