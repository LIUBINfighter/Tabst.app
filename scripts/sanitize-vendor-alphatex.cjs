const fs = require("fs");
const path = require("path");

const regPath = path.resolve(
	__dirname,
	"..",
	"src",
	"renderer",
	"data",
	"tutorials",
	"vendor-alphatex-registry.json",
);
const destDir = path.resolve(
	__dirname,
	"..",
	"src",
	"renderer",
	"data",
	"tutorials",
);

if (!fs.existsSync(regPath)) {
	console.error("Registry file not found:", regPath);
	process.exit(1);
}

const regs = JSON.parse(fs.readFileSync(regPath, "utf8"));

function cleanTitle(raw) {
	if (!raw) return "";
	return raw.replace(/^#\s*/, "").trim();
}

regs.forEach((r) => {
	const fname = path.join(destDir, `${r.id}.mdx`);
	if (!fs.existsSync(fname)) {
		console.warn("File for registry entry not found:", fname);
		return;
	}
	let txt = fs.readFileSync(fname, "utf8");

	// Remove first frontmatter block if present
	txt = txt.replace(/^---[\s\S]*?---\s*/m, "");

	// Remove leading multiple headers like '# # Something' -> '# Something'
	txt = txt.replace(/^#\s*#\s*/m, "# ");

	// Ensure top heading is '# <clean title>'
	const clean = cleanTitle(r.title);
	// Remove any existing first-level header
	txt = txt.replace(/^#.*\n+/, "");
	txt = `# ${clean}\n\n${txt.trim()}\n`;

	fs.writeFileSync(fname, txt, "utf8");
	console.log("Sanitized", fname);
});

// Also update registry to clean titles
const cleaned = regs.map((r) => ({ ...r, title: cleanTitle(r.title) }));
fs.writeFileSync(regPath, JSON.stringify(cleaned, null, 2), "utf8");
console.log("Updated registry titles in", regPath);
