const fs = require("fs");
const path = require("path");

const srcDir = path.resolve(
	__dirname,
	"..",
	"docs",
	"vendor",
	"alphaTabWebsite",
	"alphatex",
);
const destDir = path.resolve(
	__dirname,
	"..",
	"src",
	"renderer",
	"data",
	"tutorials",
);

function readFile(p) {
	return fs.readFileSync(p, "utf8");
}

function writeFile(p, content) {
	fs.mkdirSync(path.dirname(p), { recursive: true });
	fs.writeFileSync(p, content, "utf8");
}

function extractFrontmatter(content) {
	const fm = { title: null };
	const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n/);
	if (!fmMatch) return { fm, body: content };
	const fmText = fmMatch[1];
	fmText.split(/\n+/).forEach((line) => {
		const m = line.match(/^(\w+):\s*(.*)$/);
		if (m) {
			const key = m[1].trim();
			const val = m[2].trim().replace(/^"|"$/g, "");
			fm[key] = val;
		}
	});
	const body = content.slice(fmMatch[0].length);
	return { fm, body };
}

function removeImportsAndComponents(body) {
	// Remove import lines
	let out = body.replace(/^import .*$/gm, "");
	// Remove JSX self-closing component tags like <Component /> with values prop we'll handle separately later
	// We'll handle ParameterValuesTable specially
	return out;
}

function inlineUnderscoreDocs(body, srcDir) {
	// detect import Doc from './_xxx.mdx' style. But earlier imports removed; check for "<Doc />" occurrence and attempt to inline from _xxx by finding matching file name
	// We'll look for patterns: import Doc from './_foo.mdx'; and <Doc /> and inline content from _foo
	const importRe = /import\s+(\w+)\s+from\s+'\.\/(\_[^']+)\.mdx';/g;
	let m;
	const imports = {};
	while ((m = importRe.exec(body))) {
		imports[m[1]] = m[2];
	}
	// For each imported alias, remove import lines (they were removed earlier but just in case), and replace <Alias /> with cleaned content of the referenced file
	Object.entries(imports).forEach(([alias, underscoreName]) => {
		const filePath = path.join(srcDir, `${underscoreName}.mdx`);
		if (fs.existsSync(filePath)) {
			let content = readFile(filePath);
			// clean the imported file recursively: remove its imports and convert AlphaTexSample
			content = processFileContent(content, srcDir);
			// remove any leading frontmatter
			const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n/);
			if (fmMatch) content = content.slice(fmMatch[0].length);
			// replace <Alias /> with content
			const aliasTagRe = new RegExp(`<${alias}\s*\/?>`, "g");
			body = body.replace(aliasTagRe, content);
		}
	});
	return body;
}

function convertAlphaTexSampleToCode(body) {
	// Replace <AlphaTexSample ... >{` content `}</AlphaTexSample> with ```alphatex\ncontent\n```
	// Also handle possible props and spacing
	const re =
		/<AlphaTexSample[\s\S]*?>\s*\{`([\s\S]*?)`\s*\}\s*<\/AlphaTexSample>/g;
	body = body.replace(re, (m, p1) => {
		return "\n```alphatex\n" + p1.trim() + "\n```\n";
	});
	return body;
}

function convertParameterValuesTable(body) {
	// Convert <ParameterValuesTable values={[['3','3:2 Tuplet'],['5','5:4 Tuplet']] } /> to a markdown table
	const re = /<ParameterValuesTable\s+values=\{([^}]+)\}\s*\/?>/g;
	return body.replace(re, (m, p1) => {
		// p1 is something like [["3","3:2 Tuplet"],["5","5:4 Tuplet"]]
		try {
			// Replace single quotes with double quotes for JSON parse, ensure valid JSON
			const jsonLike = p1.replace(/([\w\s]+)=>/g, "");
			const arr = eval(p1); // eval local trusted data
			if (Array.isArray(arr)) {
				const rows = arr.map((r) => `| ${r[0]} | ${r[1]} |`);
				return (
					"\n| Overload | Name | Values |\n|---|---|---|\n" +
					rows.join("\n") +
					"\n"
				);
			}
		} catch (err) {
			return "\n*Parameter values table omitted*\n";
		}
		return "\n*Parameter values table omitted*\n";
	});
}

function convertPlainSyntaxBlocks(body) {
	// Convert ```plain title="Syntax" to ```
	body = body.replace(/```plain\s*title=\"Syntax\"\n/g, "```");
	return body;
}

function processFileContent(content, srcDir) {
	// Remove frontmatter but capture title
	const { fm, body } = extractFrontmatter(content);
	let out = body;
	out = removeImportsAndComponents(out);
	out = inlineUnderscoreDocs(out, srcDir);
	out = convertAlphaTexSampleToCode(out);
	out = convertParameterValuesTable(out);
	out = convertPlainSyntaxBlocks(out);
	// also remove any remaining JSX tags like <> (basic)
	// Remove empty lines from import leftovers
	out = out.replace(/^\s*import .*$/gm, "");
	// Remove stray JSX components tags (self closing or opening/closing), but keep code fences
	out = out.replace(/<[^>]+>/g, (match) => {
		// if it's a code fence or HTML tag like <br>, we leave newlines; but to be safe, remove tags that are component-like
		if (
			match.startsWith("<!") ||
			match.startsWith("</") ||
			/^<\/?\w+>$/i.test(match)
		)
			return match;
		return "";
	});
	return { fm, out };
}

function main() {
	if (!fs.existsSync(srcDir)) {
		console.error("Source vendor alphatex dir not found:", srcDir);
		process.exit(1);
	}

	const files = fs
		.readdirSync(srcDir)
		.filter((f) => f.endsWith(".mdx") && !f.startsWith("_"));
	// Follow upstream order hard-coded from sidebars
	const order = [
		"introduction.mdx",
		"syntax.mdx",
		"document-structure.mdx",
		"structural-metadata.mdx",
		"score-metadata.mdx",
		"staff-metadata.mdx",
		"bar-metadata.mdx",
		"beat-properties.mdx",
		"note-properties.mdx",
		"importer.mdx",
		"lsp.mdx",
		"monaco.mdx",
	];

	const targetOrder = order.filter((name) => files.includes(name));

	let startOrder = 10;
	const registryAdditions = [];

	for (let i = 0; i < targetOrder.length; i++) {
		const fname = targetOrder[i];
		const full = path.join(srcDir, fname);
		const raw = readFile(full);
		const { fm, out } = processFileContent(raw, srcDir);

		const title =
			fm.title ||
			(() => {
				// try to find first H1
				const m = out.match(/^#\s*(.+)/m);
				if (m) return m[1].trim();
				// else use filename
				return fname.replace(/\.mdx?$/, "").replace(/-/g, " ");
			})();

		const header = `# ${title}\n\n`;
		const finalContent = header + out.trim() + "\n";

		const outName = `vendor-alphatex-${path.basename(fname, ".mdx")}.mdx`;
		const outPath = path.join(destDir, outName);
		writeFile(outPath, finalContent);

		registryAdditions.push({
			id: `vendor-alphatex-${path.basename(fname, ".mdx")}`,
			title: title,
			order: startOrder + i,
			category: "AlphaTeX (Reference)",
		});

		console.log("[import-vendor-alphatex] Wrote", outPath);
	}

	// Print registry JSON to clipboard or file for manual adding
	const regPath = path.join(destDir, "vendor-alphatex-registry.json");
	writeFile(regPath, JSON.stringify(registryAdditions, null, 2));
	console.log("[import-vendor-alphatex] Wrote registry additions to", regPath);
	console.log(
		"[import-vendor-alphatex] Done. Please add these entries to src/renderer/data/tutorials/index.ts with appropriate ordering.",
	);
}

main();
