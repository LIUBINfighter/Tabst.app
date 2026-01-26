const fs = require("fs");
const path = require("path");

const srcDir = path.resolve(__dirname, "..", "src", "renderer", "data");
const vendorPrefix = "vendor-alphatex";
const siteBase = "https://alphatab.net";
const docsBase = "/docs";

function rewriteLink(target) {
	// target is the original href (inside parentheses)
	// leave absolute http(s) links untouched
	if (/^https?:\/\//i.test(target)) return target;

	// If link starts with '/': treat as site-rooted path
	if (target.startsWith("/")) {
		// remove .md or .mdx extension
		const cleaned = target.replace(/\.(mdx|md)$/, "");
		return siteBase + cleaned;
	}

	// If link is relative like './bar-metadata.mdx'
	const relMatch = /^\.\/([^#?]+)([#?].*)?$/.exec(target);
	if (relMatch) {
		const file = relMatch[1].replace(/^_/, "").replace(/\.(mdx|md)$/, "");
		const suffix = relMatch[2] || "";
		return `${siteBase}${docsBase}/alphatex/${file}${suffix}`;
	}

	// If link is ../something (go up one level). Common: ../reference/score.mdx
	const upMatch = /^\.\.\/([^#?]+)([#?].*)?$/.exec(target);
	if (upMatch) {
		const file = upMatch[1].replace(/\.(mdx|md)$/, "");
		// If it already starts with 'reference/' or other folder, map to /docs/<file>
		return `${siteBase}${docsBase}/${file}${upMatch[2] || ""}`;
	}

	// Generic doc-like reference without leading dot: 'bar-metadata.mdx' or 'bar-metadata'
	const plainMatch = /^([^#?]+)([#?].*)?$/.exec(target);
	if (plainMatch) {
		const file = plainMatch[1].replace(/^_/, "").replace(/\.(mdx|md)$/, "");
		return `${siteBase}${docsBase}/alphatex/${file}${plainMatch[2] || ""}`;
	}

	// Fallback: return original
	return target;
}

function processFile(filePath) {
	let text = fs.readFileSync(filePath, "utf8");
	const orig = text;

	// Replace markdown links: [label](href)
	text = text.replace(/\]\(([^)]+)\)/g, (m, p1) => {
		const href = p1.trim();
		const newHref = rewriteLink(href);
		return `](${newHref})`;
	});

	// Replace inline HTML anchors: href="..." or href='...'
	text = text.replace(/href=("|')([^"']+)("|')/g, (m, q, h) => {
		const newHref = rewriteLink(h);
		return `href=${q}${newHref}${q}`;
	});

	// Save if changed
	if (text !== orig) {
		fs.writeFileSync(filePath, text, "utf8");
		return true;
	}
	return false;
}

function main() {
	const files = fs
		.readdirSync(path.join(srcDir, "tutorials"))
		.filter((f) => f.startsWith(vendorPrefix) && f.endsWith(".mdx"))
		.map((f) => path.join(srcDir, "tutorials", f));

	const modified = [];
	for (const f of files) {
		const changed = processFile(f);
		if (changed) modified.push(f);
	}

	// Write changelog
	const changelog = path.join(
		srcDir,
		"tutorials",
		"vendor-alphatex-links-changelog.json",
	);
	fs.writeFileSync(
		changelog,
		JSON.stringify({ modified, timestamp: new Date().toISOString() }, null, 2),
	);
	console.log("Processed", files.length, "files. Modified:", modified.length);
	console.log("Changelog written to", changelog);
}

if (require.main === module) {
	main();
}

module.exports = { rewriteLink };
