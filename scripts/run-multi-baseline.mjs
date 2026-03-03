import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const ROOT = process.cwd();
const OPS_DIR = path.join(ROOT, "docs", "dev", "ops");

function parseArgs() {
	const args = process.argv.slice(2);
	let runs = 10;
	let retries = 2;
	let coldDelayMs = 2_000;
	let idleDelayMs = 5_000;
	let prefix = "multi-baseline";
	let compareFile = "week2-baseline.json";

	for (let i = 0; i < args.length; i += 1) {
		const arg = args[i];
		if (arg === "--runs" && args[i + 1]) {
			runs = Number(args[i + 1]);
			i += 1;
			continue;
		}
		if (arg === "--retries" && args[i + 1]) {
			retries = Number(args[i + 1]);
			i += 1;
			continue;
		}
		if (arg === "--cold-delay-ms" && args[i + 1]) {
			coldDelayMs = Number(args[i + 1]);
			i += 1;
			continue;
		}
		if (arg === "--idle-delay-ms" && args[i + 1]) {
			idleDelayMs = Number(args[i + 1]);
			i += 1;
			continue;
		}
		if (arg === "--prefix" && args[i + 1]) {
			prefix = args[i + 1];
			i += 1;
			continue;
		}
		if (arg === "--compare" && args[i + 1]) {
			compareFile = args[i + 1];
			i += 1;
		}
	}

	return {
		runs,
		retries: Number.isFinite(retries) ? Math.max(0, Math.floor(retries)) : 2,
		coldDelayMs,
		idleDelayMs,
		prefix,
		compareFile,
	};
}

function runCollect(out, coldDelayMs, idleDelayMs) {
	return new Promise((resolve, reject) => {
		const child = spawn(
			process.execPath,
			[
				"scripts/collect-week1-baseline.mjs",
				"--out",
				out,
				"--cold-delay-ms",
				String(coldDelayMs),
				"--idle-delay-ms",
				String(idleDelayMs),
			],
			{ cwd: ROOT, stdio: "inherit" },
		);

		child.on("exit", (code) => {
			if (code === 0) resolve(undefined);
			else reject(new Error(`collect-week1-baseline exited with code ${code}`));
		});
	});
}

function metricFromDoc(doc) {
	const cold = doc.samples[0];
	const idle = doc.samples[1];
	return {
		cold_heap: cold.pageMetrics.JSHeapUsedSize,
		idle_heap: idle.pageMetrics.JSHeapUsedSize,
		heap_delta:
			idle.pageMetrics.JSHeapUsedSize - cold.pageMetrics.JSHeapUsedSize,
		cold_domcl: cold.navTiming?.domContentLoaded ?? null,
		cold_load: cold.navTiming?.loadEventEnd ?? null,
		cold_listeners: cold.pageMetrics.JSEventListeners,
		idle_listeners: idle.pageMetrics.JSEventListeners,
	};
}

function stats(values) {
	const sorted = [...values].sort((a, b) => a - b);
	const mean = values.reduce((acc, n) => acc + n, 0) / values.length;
	const median =
		sorted.length % 2 === 0
			? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
			: sorted[Math.floor(sorted.length / 2)];
	const p95 = sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)];
	return { mean, median, p95, min: sorted[0], max: sorted[sorted.length - 1] };
}

async function main() {
	fs.mkdirSync(OPS_DIR, { recursive: true });
	const { runs, retries, coldDelayMs, idleDelayMs, prefix, compareFile } =
		parseArgs();

	const runFiles = [];
	for (let i = 1; i <= runs; i += 1) {
		const out = `${prefix}-${i}.json`;
		runFiles.push(out);
		let success = false;
		let lastError = null;

		for (let attempt = 0; attempt <= retries; attempt += 1) {
			try {
				if (attempt > 0) {
					console.warn(
						`Retrying baseline run ${i}/${runs}, attempt ${attempt + 1}/${retries + 1}`,
					);
				}
				await runCollect(out, coldDelayMs, idleDelayMs);
				success = true;
				break;
			} catch (error) {
				lastError = error;
				if (attempt < retries) {
					await sleep(1_000 * (attempt + 1));
				}
			}
		}

		if (!success) {
			throw new Error(
				`Baseline run ${i}/${runs} failed after ${retries + 1} attempt(s): ${lastError instanceof Error ? lastError.message : String(lastError)}`,
			);
		}
	}

	const docs = runFiles.map((name) =>
		JSON.parse(fs.readFileSync(path.join(OPS_DIR, name), "utf8")),
	);
	const metrics = docs.map(metricFromDoc);

	const keys = Object.keys(metrics[0]);
	const summary = {};
	for (const key of keys) {
		summary[key] = stats(metrics.map((m) => m[key]).filter((v) => v !== null));
	}

	let compare = null;
	const comparePath = path.join(OPS_DIR, compareFile);
	if (fs.existsSync(comparePath)) {
		const baseline = metricFromDoc(
			JSON.parse(fs.readFileSync(comparePath, "utf8")),
		);
		compare = { baselineFile: compareFile, baseline };
		for (const key of keys) {
			summary[key].diffMeanVsBaseline = summary[key].mean - baseline[key];
			summary[key].diffMedianVsBaseline = summary[key].median - baseline[key];
		}
	}

	const result = {
		generatedAt: new Date().toISOString(),
		config: { runs, retries, coldDelayMs, idleDelayMs, prefix, compareFile },
		runFiles,
		metrics,
		summary,
		compare,
	};

	const outFile = path.join(OPS_DIR, `${prefix}-summary.json`);
	fs.writeFileSync(outFile, `${JSON.stringify(result, null, 2)}\n`, "utf8");
	console.log(`Saved multi-baseline summary to ${outFile}`);
}

main().catch((err) => {
	console.error("run-multi-baseline failed:", err);
	process.exit(1);
});
