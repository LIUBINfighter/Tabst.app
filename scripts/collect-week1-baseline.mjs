import { spawn } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import puppeteer from "puppeteer";

const require = createRequire(import.meta.url);

const ROOT = process.cwd();
const DEBUG_PORT = 9333;
const OUTPUT_DIR = path.join(ROOT, "docs", "dev", "ops");

function parseArgs() {
	const args = process.argv.slice(2);
	let outFileName = "week1-baseline.json";
	let coldDelayMs = 2_000;
	let idleDelayMs = 5_000;

	for (let i = 0; i < args.length; i += 1) {
		const arg = args[i];
		if (arg === "--out" && args[i + 1]) {
			outFileName = args[i + 1];
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
		}
	}

	return {
		outputFile: path.join(OUTPUT_DIR, outFileName),
		coldDelayMs,
		idleDelayMs,
	};
}

async function waitForJson(pathname, timeoutMs = 20_000) {
	const start = Date.now();
	while (Date.now() - start < timeoutMs) {
		try {
			const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}${pathname}`);
			if (res.ok) {
				return await res.json();
			}
		} catch {
			// ignore until timeout
		}
		await sleep(300);
	}
	throw new Error(`Timed out waiting for ${pathname}`);
}

async function selectRendererPage(browser) {
	const pages = await browser.pages();
	const page = pages.find((p) => {
		const u = p.url();
		return u.startsWith("file://") || u.includes("127.0.0.1:7777");
	});
	if (page) return page;

	for (let i = 0; i < 15; i += 1) {
		await sleep(300);
		const retryPages = await browser.pages();
		const retry = retryPages.find((p) => {
			const u = p.url();
			return u.startsWith("file://") || u.includes("127.0.0.1:7777");
		});
		if (retry) return retry;
	}

	throw new Error("Renderer page not found");
}

async function captureSample(page, label) {
	const cdp = await page.createCDPSession();
	await cdp.send("Performance.enable");

	const [pageMetrics, perfMetrics, heapUsage, navTiming, memoryInfo] =
		await Promise.all([
			page.metrics(),
			cdp.send("Performance.getMetrics"),
			cdp.send("Runtime.getHeapUsage"),
			page.evaluate(() => {
				const nav = performance.getEntriesByType("navigation")[0];
				if (!nav) return null;
				return {
					domContentLoaded: nav.domContentLoadedEventEnd,
					loadEventEnd: nav.loadEventEnd,
					responseEnd: nav.responseEnd,
				};
			}),
			page.evaluate(() => {
				const m = performance.memory;
				if (!m) return null;
				return {
					usedJSHeapSize: m.usedJSHeapSize,
					totalJSHeapSize: m.totalJSHeapSize,
					jsHeapSizeLimit: m.jsHeapSizeLimit,
				};
			}),
		]);

	await cdp.detach();

	return {
		label,
		timestamp: new Date().toISOString(),
		url: page.url(),
		pageMetrics,
		perfMetrics,
		heapUsage,
		navTiming,
		memoryInfo,
	};
}

async function main() {
	fs.mkdirSync(OUTPUT_DIR, { recursive: true });
	const { outputFile, coldDelayMs, idleDelayMs } = parseArgs();

	const electronBinary = require("electron");
	const child = spawn(
		electronBinary,
		[".", `--remote-debugging-port=${DEBUG_PORT}`],
		{
			cwd: ROOT,
			stdio: "ignore",
			env: {
				...process.env,
				NODE_ENV: "production",
			},
		},
	);

	let browser;
	try {
		const version = await waitForJson("/json/version");
		await waitForJson("/json/list");

		browser = await puppeteer.connect({
			browserURL: `http://127.0.0.1:${DEBUG_PORT}`,
			defaultViewport: null,
		});

		const page = await selectRendererPage(browser);

		await sleep(coldDelayMs);
		const coldStart = await captureSample(
			page,
			`cold_start_t${Math.round(coldDelayMs / 1000)}s`,
		);

		await sleep(idleDelayMs);
		const idleSample = await captureSample(
			page,
			`idle_t${Math.round((coldDelayMs + idleDelayMs) / 1000)}s`,
		);

		const result = {
			generatedAt: new Date().toISOString(),
			environment: {
				platform: process.platform,
				arch: process.arch,
				node: process.version,
				hostname: os.hostname(),
				electronProtocolVersion: version?.ProtocolVersion ?? null,
				electronUserAgent: version?.UserAgent ?? null,
			},
			samples: [coldStart, idleSample],
		};

		fs.writeFileSync(
			outputFile,
			`${JSON.stringify(result, null, 2)}\n`,
			"utf8",
		);
		console.log(`Saved baseline metrics to ${outputFile}`);
	} finally {
		try {
			if (browser) {
				await browser.disconnect();
			}
		} catch {
			// ignore
		}

		if (!child.killed) {
			child.kill("SIGTERM");
			await sleep(1500);
			if (!child.killed) {
				child.kill("SIGKILL");
			}
		}
	}
}

main().catch((err) => {
	console.error("collect-week1-baseline failed:", err);
	process.exit(1);
});
