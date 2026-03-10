import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const OPS_DIR = path.join(ROOT, "docs", "dev", "ops");

function parseArgs() {
	const args = process.argv.slice(2);
	let baselineFile = "tauri-performance-baseline-summary.json";
	let thresholdFile = ".github/perf-thresholds.json";

	for (let i = 0; i < args.length; i += 1) {
		const arg = args[i];
		if (arg === "--baseline" && args[i + 1]) {
			baselineFile = args[i + 1];
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

	if (summary.commands.webBuildMs > thresholds.webBuildMsMax) {
		violations.push({
			scope: "baseline",
			metric: "commands.webBuildMs",
			actual: summary.commands.webBuildMs,
			threshold: thresholds.webBuildMsMax,
		});
	}

	if (summary.commands.rustReleaseBuildMs > thresholds.rustReleaseBuildMsMax) {
		violations.push({
			scope: "baseline",
			metric: "commands.rustReleaseBuildMs",
			actual: summary.commands.rustReleaseBuildMs,
			threshold: thresholds.rustReleaseBuildMsMax,
		});
	}

	if (summary.commands.totalMeasuredMs > thresholds.totalMeasuredMsMax) {
		violations.push({
			scope: "baseline",
			metric: "commands.totalMeasuredMs",
			actual: summary.commands.totalMeasuredMs,
			threshold: thresholds.totalMeasuredMsMax,
		});
	}

	if (summary.artifacts.tauriBinary.bytes > thresholds.tauriBinaryMaxBytes) {
		violations.push({
			scope: "baseline",
			metric: "artifacts.tauriBinary.bytes",
			actual: summary.artifacts.tauriBinary.bytes,
			threshold: thresholds.tauriBinaryMaxBytes,
		});
	}

	return violations;
}

function evaluateBuild(summary, thresholds) {
	const violations = [];

	if (summary.artifacts.mainChunk.bytes > thresholds.mainChunkMaxBytes) {
		violations.push({
			scope: "build",
			metric: "artifacts.mainChunk.bytes",
			actual: summary.artifacts.mainChunk.bytes,
			threshold: thresholds.mainChunkMaxBytes,
		});
	}

	if (
		summary.artifacts.vendorAlphaTabChunk.bytes > thresholds.vendorAlphaTabMaxBytes
	) {
		violations.push({
			scope: "build",
			metric: "artifacts.vendorAlphaTabChunk.bytes",
			actual: summary.artifacts.vendorAlphaTabChunk.bytes,
			threshold: thresholds.vendorAlphaTabMaxBytes,
		});
	}

	if (
		summary.artifacts.vendorCodeMirrorChunk.bytes > thresholds.vendorCodeMirrorMaxBytes
	) {
		violations.push({
			scope: "build",
			metric: "artifacts.vendorCodeMirrorChunk.bytes",
			actual: summary.artifacts.vendorCodeMirrorChunk.bytes,
			threshold: thresholds.vendorCodeMirrorMaxBytes,
		});
	}

	return violations;
}

function main() {
	const { baselinePath, thresholdPath } = parseArgs();
	const thresholds = readJson(thresholdPath);
	const baselineSummary = readJson(baselinePath);

	const violations = [
		...evaluateBaseline(baselineSummary, thresholds.tauriBuild),
		...evaluateBuild(baselineSummary, thresholds.build),
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
		`baseline=${path.basename(baselinePath)} thresholds=${path.basename(thresholdPath)}`,
	);
}

main();
