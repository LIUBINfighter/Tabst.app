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
const STARTUP_TIMEOUT_MS = 60_000;
const STARTUP_POLL_MS = 400;

function waitForChildExit(child, timeoutMs) {
	if (child.exitCode !== null) {
		return Promise.resolve();
	}

	return new Promise((resolve) => {
		let settled = false;
		const finish = () => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			child.removeListener("exit", onExit);
			child.removeListener("close", onExit);
			resolve();
		};
		const onExit = () => finish();
		const timer = setTimeout(() => finish(), timeoutMs);
		child.once("exit", onExit);
		child.once("close", onExit);
	});
}

async function terminateChild(child) {
	if (child.exitCode !== null) return;

	try {
		child.kill("SIGTERM");
	} catch {}
	await waitForChildExit(child, 2_500);

	if (child.exitCode !== null) return;

	try {
		child.kill("SIGKILL");
	} catch {}
	await waitForChildExit(child, 1_500);
}

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

function getChildExitSummary(child) {
	if (child.exitCode === null) {
		return null;
	}
	if (typeof child.signalCode === "string" && child.signalCode.length > 0) {
		return `signal ${child.signalCode}`;
	}
	return `code ${child.exitCode}`;
}

async function waitForJson(pathname, options = {}) {
	const { child = null, timeoutMs = STARTUP_TIMEOUT_MS } = options;
	const start = Date.now();
	while (Date.now() - start < timeoutMs) {
		const exitSummary = child ? getChildExitSummary(child) : null;
		if (exitSummary) {
			throw new Error(
				`Electron exited early (${exitSummary}) while waiting for ${pathname}`,
			);
		}

		try {
			const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}${pathname}`);
			if (res.ok) {
				return await res.json();
			}
		} catch {
			// ignore until timeout
		}
		await sleep(STARTUP_POLL_MS);
	}

	const exitSummary = child ? getChildExitSummary(child) : null;
	if (exitSummary) {
		throw new Error(
			`Timed out waiting for ${pathname}; Electron exited with ${exitSummary}`,
		);
	}

	throw new Error(`Timed out waiting for ${pathname} after ${timeoutMs}ms`);
}

function createElectronArgs() {
	const args = [
		".",
		`--remote-debugging-port=${DEBUG_PORT}`,
		"--remote-debugging-address=127.0.0.1",
	];

	if (process.platform === "linux" && process.env.CI === "true") {
		args.push("--disable-gpu", "--no-sandbox");
	}

	return args;
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

async function waitForRendererReady(page, timeoutMs = 20_000) {
	try {
		await page.waitForFunction(() => document.readyState === "complete", {
			timeout: timeoutMs,
		});
	} catch {}

	try {
		await page.waitForFunction(
			() => {
				const root = document.getElementById("root");
				if (!root) return false;
				if (document.querySelector(".cm-editor")) return true;
				return root.childElementCount > 0;
			},
			{ timeout: timeoutMs },
		);
	} catch {}
}

async function captureSample(page, label) {
	const cdp = await page.createCDPSession();
	await cdp.send("Performance.enable");
	try {
		await cdp.send("HeapProfiler.enable");
		await cdp.send("HeapProfiler.collectGarbage");
	} catch {}

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
	const child = spawn(electronBinary, createElectronArgs(), {
		cwd: ROOT,
		stdio: "ignore",
		env: {
			...process.env,
			NODE_ENV: "production",
			TABST_FORCE_PRODUCTION_WINDOW: "1",
		},
	});

	let browser;
	try {
		await sleep(500);
		const version = await waitForJson("/json/version", {
			child,
			timeoutMs: STARTUP_TIMEOUT_MS,
		});
		await waitForJson("/json/list", {
			child,
			timeoutMs: STARTUP_TIMEOUT_MS,
		});

		browser = await puppeteer.connect({
			browserURL: `http://127.0.0.1:${DEBUG_PORT}`,
			defaultViewport: null,
			protocolTimeout: 30_000,
		});

		const page = await selectRendererPage(browser);
		page.setDefaultTimeout(20_000);
		page.setDefaultNavigationTimeout(20_000);
		await waitForRendererReady(page);

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
		await terminateChild(child);
	}
}

main().catch((err) => {
	console.error("collect-week1-baseline failed:", err);
	process.exit(1);
});
