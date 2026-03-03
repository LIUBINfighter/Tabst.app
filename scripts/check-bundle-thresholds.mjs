import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DIST_ASSETS_DIR = path.join(ROOT, "dist", "assets");

function parseArgs() {
	const args = process.argv.slice(2);
	let thresholdFile = ".github/perf-thresholds.json";

	for (let i = 0; i < args.length; i += 1) {
		const arg = args[i];
		if (arg === "--thresholds" && args[i + 1]) {
			thresholdFile = args[i + 1];
			i += 1;
		}
	}

	return {
		thresholdPath: path.join(ROOT, thresholdFile),
	};
}

function readJson(filePath) {
	if (!fs.existsSync(filePath)) {
		throw new Error(`File not found: ${filePath}`);
	}
	return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function getFileSize(filePath) {
	return fs.statSync(filePath).size;
}

function findFirstAsset(prefix) {
	if (!fs.existsSync(DIST_ASSETS_DIR)) {
		throw new Error(`Assets directory not found: ${DIST_ASSETS_DIR}`);
	}

	const candidates = fs
		.readdirSync(DIST_ASSETS_DIR)
		.filter((name) => name.startsWith(prefix) && name.endsWith(".js"));

	if (candidates.length === 0) {
		throw new Error(
			`No asset matched prefix '${prefix}' in ${DIST_ASSETS_DIR}`,
		);
	}

	const sorted = candidates.sort();
	return path.join(DIST_ASSETS_DIR, sorted[0]);
}

function validateSize(metric, filePath, maxBytes) {
	const size = getFileSize(filePath);
	if (size > maxBytes) {
		return {
			metric,
			file: path.basename(filePath),
			size,
			maxBytes,
		};
	}
	return null;
}

function main() {
	const { thresholdPath } = parseArgs();
	const thresholdConfig = readJson(thresholdPath);
	const buildThresholds = thresholdConfig.build;

	if (!buildThresholds) {
		throw new Error(`Missing 'build' section in ${thresholdPath}`);
	}

	const mainChunk = findFirstAsset("main-");
	const alphaTabChunk = findFirstAsset("vendor-alphatab-");
	const codeMirrorChunk = findFirstAsset("vendor-codemirror-");

	const violations = [
		validateSize("mainChunk", mainChunk, buildThresholds.mainChunkMaxBytes),
		validateSize(
			"vendorAlphaTabChunk",
			alphaTabChunk,
			buildThresholds.vendorAlphaTabMaxBytes,
		),
		validateSize(
			"vendorCodeMirrorChunk",
			codeMirrorChunk,
			buildThresholds.vendorCodeMirrorMaxBytes,
		),
	].filter(Boolean);

	if (violations.length > 0) {
		console.error("Bundle threshold check failed:");
		for (const violation of violations) {
			console.error(
				`- [${violation.metric}] ${violation.file}: ${violation.size} > ${violation.maxBytes}`,
			);
		}
		process.exit(1);
	}

	console.log("Bundle threshold check passed.");
	console.log(
		JSON.stringify(
			{
				mainChunk: path.basename(mainChunk),
				vendorAlphaTabChunk: path.basename(alphaTabChunk),
				vendorCodeMirrorChunk: path.basename(codeMirrorChunk),
			},
			null,
			2,
		),
	);
}

main();
