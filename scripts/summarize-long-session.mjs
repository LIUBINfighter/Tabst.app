import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const OPS_DIR = path.join(ROOT, "docs", "dev", "ops");

function parseArgs() {
	const args = process.argv.slice(2);
	let input = "long-session-stress.json";
	let output = "long-session-stress-summary.json";

	for (let i = 0; i < args.length; i += 1) {
		const arg = args[i];
		if (arg === "--input" && args[i + 1]) {
			input = args[i + 1];
			i += 1;
			continue;
		}
		if (arg === "--output" && args[i + 1]) {
			output = args[i + 1];
			i += 1;
		}
	}

	return {
		inputPath: path.join(OPS_DIR, input),
		outputPath: path.join(OPS_DIR, output),
	};
}

function stat(arr) {
	const sorted = [...arr].sort((a, b) => a - b);
	const mean = arr.reduce((x, y) => x + y, 0) / arr.length;
	const median =
		sorted.length % 2 === 0
			? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
			: sorted[Math.floor(sorted.length / 2)];
	const p95 = sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)];
	return { mean, median, p95, min: sorted[0], max: sorted[sorted.length - 1] };
}

function main() {
	const { inputPath, outputPath } = parseArgs();
	const raw = JSON.parse(fs.readFileSync(inputPath, "utf8"));
	const samples = raw.samples ?? [];
	if (samples.length === 0) {
		throw new Error(`No samples found in ${inputPath}`);
	}

	const heaps = samples.map((s) => s.pageMetrics.JSHeapUsedSize);
	const listeners = samples.map((s) => s.pageMetrics.JSEventListeners);

	const first = samples[0];
	const last = samples[samples.length - 1];
	const durationMs =
		new Date(last.timestamp).getTime() - new Date(first.timestamp).getTime();
	const durationMin = durationMs / 60_000;

	const summary = {
		generatedAt: new Date().toISOString(),
		input: path.basename(inputPath),
		sampleCount: samples.length,
		durationMs,
		durationMin,
		heap: {
			stats: stat(heaps),
			start: heaps[0],
			end: heaps[heaps.length - 1],
			delta: heaps[heaps.length - 1] - heaps[0],
			deltaPerMin:
				durationMin > 0
					? (heaps[heaps.length - 1] - heaps[0]) / durationMin
					: 0,
		},
		listeners: {
			stats: stat(listeners),
			start: listeners[0],
			end: listeners[listeners.length - 1],
			delta: listeners[listeners.length - 1] - listeners[0],
			deltaPerMin:
				durationMin > 0
					? (listeners[listeners.length - 1] - listeners[0]) / durationMin
					: 0,
		},
	};

	fs.writeFileSync(outputPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
	console.log(`Saved long-session summary to ${outputPath}`);
}

main();
