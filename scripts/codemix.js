#!/usr/bin/env node
// codemix - merge text files from selected directories into one shareable file
// See scripts/README.md for the required format

import fs from "fs";
import path from "path";

const groups = {
	main: ["./src/main"],
	render: ["./src/renderer"],
	doc: ["./docs"],
	config: ["./Agents.md", "./biome.json", "./package.json"],
};

function normalizeRel(p) {
	let r = path.relative(process.cwd(), p);
	// Make Windows paths use forward slashes for output
	r = r.split(path.sep).join("/");
	if (!r.startsWith("./") && !r.startsWith("../")) r = "./" + r;
	return r;
}

async function walk(dir) {
	const files = [];
	try {
		const entries = await fs.promises.readdir(dir, { withFileTypes: true });
		for (const e of entries) {
			const full = path.join(dir, e.name);
			if (e.isDirectory()) {
				if (["node_modules", "dist", "dist-electron", ".git"].includes(e.name))
					continue;
				files.push(...(await walk(full)));
			} else if (e.isFile()) {
				files.push(full);
			}
		}
	} catch {
		// ignore missing directories
	}
	return files;
}

async function isTextFile(filePath) {
	try {
		const buf = await fs.promises.readFile(filePath);
		// Heuristic: if contains any null bytes, consider binary
		for (let i = 0; i < Math.min(buf.length, 2048); i++) {
			if (buf[i] === 0) return false;
		}
		// Try decoding as utf-8
		const s = buf.toString("utf8");
		// If the decoded text contains many replacement characters, treat as binary
		if ((s.match(/\uFFFD/g) || []).length > 5) return false;
		return true;
	} catch {
		return false;
	}
}

function fenceLang(filePath) {
	const ext = path.extname(filePath).toLowerCase();
	switch (ext) {
		case ".ts":
			return "ts";
		case ".tsx":
			return "tsx";
		case ".js":
			return "js";
		case ".jsx":
			return "jsx";
		case ".json":
			return "json";
		case ".md":
			return "markdown";
		case ".html":
			return "html";
		case ".css":
			return "css";
		case ".cjs":
			return "cjs";
		case ".yml":
		case ".yaml":
			return "yaml";
		default:
			return "";
	}
}

async function gatherPaths(keys) {
	const result = new Set();
	for (const key of keys) {
		if (fs.existsSync(key)) {
			const s = fs.statSync(key);
			if (s.isDirectory()) {
				const list = await walk(key);
				for (const f of list) result.add(f);
			} else if (s.isFile()) {
				result.add(path.resolve(key));
			}
		}
	}
	return Array.from(result).sort();
}

async function build(keys, outPath) {
	// Read root README.md if there is
	const readmePath = path.join(process.cwd(), "README.md");
	let readmeContent = "";
	if (fs.existsSync(readmePath)) {
		readmeContent = await fs.promises.readFile(readmePath, "utf8");
	}

	const paths = await gatherPaths(keys);
	// Filter text files
	const textPaths = [];
	for (const p of paths) {
		if (await isTextFile(p)) textPaths.push(p);
	}

	let out = "";
	out += "<!-- 文件开头-->" + "\n\n";
	if (readmeContent) {
		out += readmeContent.trim() + "\n\n";
	}
	// List of relative paths
	for (const p of textPaths) {
		out += normalizeRel(p) + "\n";
	}

	out += "\n<!--文件主体-->\n\n";
	// Build a default omit list. We always omit alphaTab.min.js files because
	// they are large, minified binaries and don't make sense in the merged
	// text document. You can extend this via --omit CLI option.
	const defaultOmits = new Set(["alphaTab.min.js"]);
	// Merge with CLI-provided omit list
	// Parse --omit args: support both `--omit value1,value2` and `--omit=value1,value2`
	const cliArgs = process.argv.slice(2);
	const omitFromCLI = [];
	for (let i = 0; i < cliArgs.length; i++) {
		const a = cliArgs[i];
		if (a === "--omit" && argv[i + 1]) {
			omitFromCLI.push(...cliArgs[i + 1].split(","));
			i++;
			i++;
		} else if (a.startsWith("--omit=")) {
			omitFromCLI.push(...a.substring("--omit=".length).split(","));
		}
		const omitFromEnv = (process.env.CODEMIX_OMIT || "")
			.split(",")
			.map((s) => s.trim())
			.filter(Boolean);
		omitFromCLI.push(...omitFromEnv);
	}
	const cleaned = omitFromCLI.map((s) => s.trim()).filter(Boolean);
	const omitSet = new Set([...defaultOmits, ...cleaned]);

	function shouldOmit(filePath) {
		const basename = path.basename(filePath);
		if (omitSet.has(basename)) return true;
		// Also support pattern like "*.min.js" (simple suffix-based)
		if (basename.endsWith(".min.js") && omitSet.has("*.min.js")) return true;
		return false;
	}

	for (const p of textPaths) {
		const rel = normalizeRel(p);
		const content = await fs.promises.readFile(p, "utf8");
		const lang = fenceLang(p);
		out += `## ${rel}\n\n`;
		out += "```" + (lang || "") + "\n";
		if (shouldOmit(p)) {
			const basename = path.basename(p);
			const stats = fs.existsSync(p) ? fs.statSync(p) : null;
			const sizeInfo = stats ? ` (${stats.size} bytes)` : "";
			out += `// 文件 "${basename}" 已省略以减少合并文档大小${sizeInfo}\n`;
		} else {
			out += content.replace(/\r\n?/g, "\n");
		}
		if (!out.endsWith("\n")) out += "\n";
		out += "```\n\n";
	}
	out += "<!-- 文件结尾 -->\n\n============\n";

	await fs.promises.mkdir(path.dirname(outPath), { recursive: true });
	await fs.promises.writeFile(outPath, out, "utf8");
	console.log("Codemix written to", outPath);
}

async function main() {
	const argv = process.argv.slice(2);
	// Parse args: subcommand is first non-flag arg; flags are --out, --omit
	let sub;
	let outArg;
	const omitList = [];
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a.startsWith("--out=")) {
			outArg = a.substring("--out=".length);
			continue;
		}
		if (a === "--out" && argv[i + 1]) {
			outArg = argv[i + 1];
			i++;
			continue;
		}
		if (a.startsWith("--omit=")) {
			omitList.push(...a.substring("--omit=".length).split(","));
			continue;
		}
		if (a === "--omit" && argv[i + 1]) {
			omitList.push(...argv[i + 1].split(","));
			i++;
			continue;
		}
		if (!a.startsWith("--") && !sub) {
			sub = a;
		}
	}
	sub = sub || "mix";
	let keys = [];
	switch (sub) {
		case "mix":
			keys = [
				...groups.main,
				...groups.render,
				...groups.doc,
				...groups.config,
			];
			break;
		case "main":
			keys = groups.main;
			break;
		case "render":
			keys = groups.render;
			break;
		case "doc":
			keys = groups.doc;
			break;
		case "config":
			keys = groups.config;
			break;
		default:
			// allow example: node codemix.js ./src
			if (sub.startsWith(".") || path.isAbsolute(sub)) {
				keys = [sub];
			} else {
				console.error("Unknown subcommand:", sub);
				process.exit(1);
			}
	}

	const out = outArg || "dist/codemix.md";
	// propagate omitList via environment var for now; the build function reads process.argv too,
	// but to keep things simple set an env var so build() can parse or we can change build() to accept omitList.
	// We'll pass the omit via process.env.
	if (omitList.length > 0) {
		process.env.CODEMIX_OMIT = omitList.join(",");
	}
	await build(keys, out);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
