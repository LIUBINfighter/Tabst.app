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

function getChildExitSummary(child) {
	if (child.exitCode === null) {
		return null;
	}
	if (typeof child.signalCode === "string" && child.signalCode.length > 0) {
		return `signal ${child.signalCode}`;
	}
	return `code ${child.exitCode}`;
}

function parseArgs() {
	const args = process.argv.slice(2);
	let durationMin = 15;
	let intervalSec = 30;
	let outFileName = "long-session-stress.json";

	for (let i = 0; i < args.length; i += 1) {
		const arg = args[i];
		if (arg === "--duration-min" && args[i + 1]) {
			durationMin = Number(args[i + 1]);
			i += 1;
			continue;
		}
		if (arg === "--interval-sec" && args[i + 1]) {
			intervalSec = Number(args[i + 1]);
			i += 1;
			continue;
		}
		if (arg === "--out" && args[i + 1]) {
			outFileName = args[i + 1];
			i += 1;
		}
	}

	return {
		durationMs: Math.max(60_000, durationMin * 60_000),
		intervalMs: Math.max(5_000, intervalSec * 1000),
		outputFile: path.join(OUTPUT_DIR, outFileName),
	};
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
			if (res.ok) return await res.json();
		} catch {}
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
	for (let i = 0; i < 30; i += 1) {
		const pages = await browser.pages();
		const page = pages.find((p) => {
			const u = p.url();
			return u.startsWith("file://") || u.includes("127.0.0.1:7777");
		});
		if (page) return page;
		await sleep(300);
	}
	throw new Error("Renderer page not found");
}

async function capture(page, cdp, label) {
	const [pageMetrics, perfMetrics, heapUsage, memoryInfo] = await Promise.all([
		page.metrics(),
		cdp.send("Performance.getMetrics"),
		cdp.send("Runtime.getHeapUsage"),
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

	return {
		label,
		timestamp: new Date().toISOString(),
		pageMetrics,
		perfMetrics,
		heapUsage,
		memoryInfo,
	};
}

async function stressActions(page, tick) {
	try {
		const width = 1280;
		const height = 800;
		await page.mouse.move((tick * 37) % width, (tick * 53) % height);
		await page.mouse.wheel({ deltaY: tick % 2 === 0 ? 400 : -300 });
		await page.keyboard.press("PageDown");
		await page.keyboard.press("PageUp");
	} catch (err) {
		console.warn("[stress] interaction tick failed, continuing:", err);
	}
}

function summarize(samples) {
	if (samples.length < 2) return {};
	const first = samples[0];
	const last = samples[samples.length - 1];
	const firstHeap = first.pageMetrics.JSHeapUsedSize;
	const lastHeap = last.pageMetrics.JSHeapUsedSize;
	const firstListeners = first.pageMetrics.JSEventListeners;
	const lastListeners = last.pageMetrics.JSEventListeners;
	const durationMs =
		new Date(last.timestamp).getTime() - new Date(first.timestamp).getTime();
	const durationMin = durationMs / 60_000;

	return {
		sampleCount: samples.length,
		durationMin,
		heapStart: firstHeap,
		heapEnd: lastHeap,
		heapDelta: lastHeap - firstHeap,
		heapDeltaPerMin: durationMin > 0 ? (lastHeap - firstHeap) / durationMin : 0,
		listenersStart: firstListeners,
		listenersEnd: lastListeners,
		listenersDelta: lastListeners - firstListeners,
		listenersDeltaPerMin:
			durationMin > 0 ? (lastListeners - firstListeners) / durationMin : 0,
	};
}

async function main() {
	fs.mkdirSync(OUTPUT_DIR, { recursive: true });
	const { durationMs, intervalMs, outputFile } = parseArgs();

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
		page.setDefaultTimeout(30_000);
		page.setDefaultNavigationTimeout(30_000);
		await sleep(Math.min(5_000, intervalMs));
		const cdp = await page.createCDPSession();
		await cdp.send("Performance.enable");
		const start = Date.now();
		const samples = [];
		let tick = 0;
		try {
			while (Date.now() - start <= durationMs) {
				await stressActions(page, tick);
				samples.push(await capture(page, cdp, `t${tick}`));
				tick += 1;
				await sleep(intervalMs);
			}
		} finally {
			try {
				await cdp.detach();
			} catch {}
		}

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
			config: { durationMs, intervalMs },
			summary: summarize(samples),
			samples,
		};

		fs.writeFileSync(
			outputFile,
			`${JSON.stringify(result, null, 2)}\n`,
			"utf8",
		);
		console.log(`Saved long-session stress report to ${outputFile}`);
	} finally {
		try {
			if (browser) await browser.disconnect();
		} catch {}
		await terminateChild(child);
	}
}

main().catch((err) => {
	console.error("run-long-session-stress failed:", err);
	process.exit(1);
});
