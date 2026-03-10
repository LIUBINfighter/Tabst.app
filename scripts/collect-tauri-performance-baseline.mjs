import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const ROOT = process.cwd();
const DIST_ASSETS_DIR = path.join(ROOT, "dist", "assets");
const OPS_DIR = path.join(ROOT, "docs", "dev", "ops");
const RELEASE_BINARY_NAME = process.platform === "win32" ? "tabst-tauri.exe" : "tabst-tauri";
const RELEASE_BINARY_PATH = path.join(ROOT, "src-tauri", "target", "release", RELEASE_BINARY_NAME);

function parseArgs() {
	const args = process.argv.slice(2);
	let output = "tauri-performance-baseline-summary.json";

	for (let i = 0; i < args.length; i += 1) {
		const arg = args[i];
		if (arg === "--output" && args[i + 1]) {
			output = args[i + 1];
			i += 1;
		}
	}

	return {
		outputPath: path.join(OPS_DIR, output),
	};
}

function ensureDir(filePath) {
	fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function runStep(command, args) {
	const startedAt = Date.now();
	const result = spawnSync(command, args, {
		cwd: ROOT,
		encoding: "utf8",
		stdio: "inherit",
		env: process.env,
	});
	const durationMs = Date.now() - startedAt;

	if (result.status !== 0) {
		throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status ?? -1}`);
	}

	return durationMs;
}

function findFirstAsset(prefix) {
	if (!fs.existsSync(DIST_ASSETS_DIR)) {
		throw new Error(`Assets directory not found: ${DIST_ASSETS_DIR}`);
	}

	const matches = fs
		.readdirSync(DIST_ASSETS_DIR)
		.filter((name) => name.startsWith(prefix) && name.endsWith(".js"))
		.sort();

	if (matches.length === 0) {
		throw new Error(`No asset matched prefix '${prefix}' in ${DIST_ASSETS_DIR}`);
	}

	const fileName = matches[0];
	const absolutePath = path.join(DIST_ASSETS_DIR, fileName);
	return {
		fileName,
		absolutePath,
		bytes: fs.statSync(absolutePath).size,
	};
}

function getBinaryMetric() {
	if (!fs.existsSync(RELEASE_BINARY_PATH)) {
		throw new Error(`Release binary not found: ${RELEASE_BINARY_PATH}`);
	}

	return {
		fileName: path.basename(RELEASE_BINARY_PATH),
		absolutePath: RELEASE_BINARY_PATH,
		bytes: fs.statSync(RELEASE_BINARY_PATH).size,
	};
}

function main() {
	const { outputPath } = parseArgs();

	const webBuildMs = runStep("pnpm", ["build:web"]);
	const rustReleaseBuildMs = runStep("cargo", [
		"build",
		"--release",
		"--manifest-path",
		"src-tauri/Cargo.toml",
	]);

	const summary = {
		generatedAt: new Date().toISOString(),
		platform: process.platform,
		arch: process.arch,
		hostname: os.hostname(),
		commands: {
			webBuildMs,
			rustReleaseBuildMs,
			totalMeasuredMs: webBuildMs + rustReleaseBuildMs,
		},
		artifacts: {
			mainChunk: findFirstAsset("main-"),
			vendorAlphaTabChunk: findFirstAsset("vendor-alphatab-"),
			vendorCodeMirrorChunk: findFirstAsset("vendor-codemirror-"),
			tauriBinary: getBinaryMetric(),
		},
	};

	ensureDir(outputPath);
	fs.writeFileSync(outputPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
	console.log(`Saved Tauri performance baseline to ${outputPath}`);
}

main();
