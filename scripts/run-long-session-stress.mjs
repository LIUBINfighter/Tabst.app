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

async function waitForJson(pathname, timeoutMs = 20_000) {
	const start = Date.now();
	while (Date.now() - start < timeoutMs) {
		try {
			const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}${pathname}`);
			if (res.ok) return await res.json();
		} catch {}
		await sleep(300);
	}
	throw new Error(`Timed out waiting for ${pathname}`);
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

async function capture(page, label) {
	const cdp = await page.createCDPSession();
	await cdp.send("Performance.enable");
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
	await cdp.detach();

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
	const width = 1280;
	const height = 800;
	await page.mouse.move((tick * 37) % width, (tick * 53) % height);
	await page.mouse.wheel({ deltaY: tick % 2 === 0 ? 400 : -300 });
	await page.keyboard.press("PageDown");
	await page.keyboard.press("PageUp");
	await page.evaluate((n) => {
		window.dispatchEvent(new Event("resize"));
		document.dispatchEvent(
			new KeyboardEvent("keydown", {
				key: n % 2 === 0 ? "ArrowRight" : "ArrowLeft",
				bubbles: true,
			}),
		);
	});
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
	const child = spawn(
		electronBinary,
		[".", `--remote-debugging-port=${DEBUG_PORT}`],
		{
			cwd: ROOT,
			stdio: "ignore",
			env: { ...process.env, NODE_ENV: "production" },
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
		const start = Date.now();
		const samples = [];
		let tick = 0;

		while (Date.now() - start <= durationMs) {
			await stressActions(page, tick);
			samples.push(await capture(page, `t${tick}`));
			tick += 1;
			await sleep(intervalMs);
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

		if (!child.killed) {
			child.kill("SIGTERM");
			await sleep(1500);
			if (!child.killed) child.kill("SIGKILL");
		}
	}
}

main().catch((err) => {
	console.error("run-long-session-stress failed:", err);
	process.exit(1);
});
