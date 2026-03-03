import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const OPS_DIR = path.join(ROOT, "docs", "dev", "ops");

function parseArgs() {
	const args = process.argv.slice(2);
	let baselineFile = "week4-multi-summary.json";
	let stressFile = "week4-long-stress-summary.json";
	let thresholdFile = ".github/perf-thresholds.json";

	for (let i = 0; i < args.length; i += 1) {
		const arg = args[i];
		if (arg === "--baseline" && args[i + 1]) {
			baselineFile = args[i + 1];
			i += 1;
			continue;
		}
		if (arg === "--stress" && args[i + 1]) {
			stressFile = args[i + 1];
			i += 1;
			continue;
		}
		if (arg === "--thresholds" && args[i + 1]) {
			thresholdFile = args[i + 1];
			i += 1;
		}
	}

	return {
		baselinePath: path.join(OPS_DIR, baselineFile),
		stressPath: path.join(OPS_DIR, stressFile),
		thresholdPath: path.join(ROOT, thresholdFile),
	};
}

function readJson(filePath) {
	if (!fs.existsSync(filePath)) {
		throw new Error(`File not found: ${filePath}`);
	}
	return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function evaluateBaseline(summary, thresholds) {
	const violations = [];

	if (summary.summary.cold_load.mean > thresholds.coldLoadMeanMsMax) {
		violations.push({
			scope: "baseline",
			metric: "cold_load.mean",
			actual: summary.summary.cold_load.mean,
			threshold: thresholds.coldLoadMeanMsMax,
		});
	}

	if (summary.summary.cold_load.p95 > thresholds.coldLoadP95MsMax) {
		violations.push({
			scope: "baseline",
			metric: "cold_load.p95",
			actual: summary.summary.cold_load.p95,
			threshold: thresholds.coldLoadP95MsMax,
		});
	}

	if (summary.summary.heap_delta.mean > thresholds.heapDeltaMeanBytesMax) {
		violations.push({
			scope: "baseline",
			metric: "heap_delta.mean",
			actual: summary.summary.heap_delta.mean,
			threshold: thresholds.heapDeltaMeanBytesMax,
		});
	}

	if (summary.summary.idle_listeners.p95 > thresholds.idleListenersP95Max) {
		violations.push({
			scope: "baseline",
			metric: "idle_listeners.p95",
			actual: summary.summary.idle_listeners.p95,
			threshold: thresholds.idleListenersP95Max,
		});
	}

	return violations;
}

function evaluateStress(summary, thresholds) {
	const violations = [];

	if (summary.durationMin < thresholds.minDurationMin) {
		violations.push({
			scope: "stress",
			metric: "durationMin",
			actual: summary.durationMin,
			threshold: thresholds.minDurationMin,
		});
	}

	if (summary.heap.deltaPerMin > thresholds.heapDeltaPerMinBytesMax) {
		violations.push({
			scope: "stress",
			metric: "heap.deltaPerMin",
			actual: summary.heap.deltaPerMin,
			threshold: thresholds.heapDeltaPerMinBytesMax,
		});
	}

	if (summary.listeners.stats.p95 > thresholds.listenersP95Max) {
		violations.push({
			scope: "stress",
			metric: "listeners.stats.p95",
			actual: summary.listeners.stats.p95,
			threshold: thresholds.listenersP95Max,
		});
	}

	if (summary.listeners.deltaPerMin > thresholds.listenersDeltaPerMinMax) {
		violations.push({
			scope: "stress",
			metric: "listeners.deltaPerMin",
			actual: summary.listeners.deltaPerMin,
			threshold: thresholds.listenersDeltaPerMinMax,
		});
	}

	return violations;
}

function main() {
	const { baselinePath, stressPath, thresholdPath } = parseArgs();
	const thresholds = readJson(thresholdPath);
	const baselineSummary = readJson(baselinePath);
	const stressSummary = readJson(stressPath);

	const violations = [
		...evaluateBaseline(baselineSummary, thresholds.baseline),
		...evaluateStress(stressSummary, thresholds.stress),
	];

	if (violations.length > 0) {
		console.error("Performance threshold check failed:");
		for (const violation of violations) {
			console.error(
				`- [${violation.scope}] ${violation.metric}: ${violation.actual} > ${violation.threshold}`,
			);
		}
		process.exit(1);
	}

	console.log("Performance threshold check passed.");
	console.log(
		`baseline=${path.basename(baselinePath)} stress=${path.basename(stressPath)} thresholds=${path.basename(thresholdPath)}`,
	);
}

main();
