const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const repoPath = path.resolve(
	__dirname,
	"..",
	"node_modules",
	"alphaTabWebsite",
);
const srcDocs = path.join(repoPath, "docs", "alphatex");
const destRoot = path.resolve(
	__dirname,
	"..",
	"docs",
	"vendor",
	"alphaTabWebsite",
);
const destDocs = path.join(destRoot, "alphatex");

function log(...args) {
	console.log("[vendor-alphatex]", ...args);
}

async function ensureDir(dir) {
	await fs.promises.mkdir(dir, { recursive: true });
}

async function copyRecursive(src, dest) {
	// Use fs.cp when available (Node 16+)
	if (fs.promises.cp) {
		await fs.promises.cp(src, dest, { recursive: true, force: true });
		return;
	}

	// Fallback: manual copy
	if ((await fs.promises.stat(src)).isDirectory()) {
		await ensureDir(dest);
		const entries = await fs.promises.readdir(src);
		for (const e of entries) {
			await copyRecursive(path.join(src, e), path.join(dest, e));
		}
	} else {
		await ensureDir(path.dirname(dest));
		await fs.promises.copyFile(src, dest);
	}
}

(async function main() {
	try {
		// 1. Try to pull remote updates for node_modules/alphaTabWebsite if it's a git repo
		try {
			log("Attempting to pull latest changes in", repoPath);
			execSync(`git -C "${repoPath}" pull --ff-only`, { stdio: "inherit" });
		} catch (err) {
			log("Git pull failed or not a git repo — continuing with local copy.");
		}

		// 2. Copy alphatex docs
		if (!fs.existsSync(srcDocs)) {
			console.error(`[vendor-alphatex] Source docs not found at ${srcDocs}`);
			process.exitCode = 1;
			return;
		}

		await ensureDir(destDocs);

		log("Copying alphatex docs to", destDocs);
		await copyRecursive(srcDocs, destDocs);

		// 3. Copy LICENSE and README from source repo root
		const licenseSrc = path.join(repoPath, "LICENSE");
		const readmeSrc = path.join(repoPath, "README.md");

		if (fs.existsSync(licenseSrc)) {
			await copyRecursive(licenseSrc, path.join(destRoot, "LICENSE"));
			log("Copied LICENSE to", path.join(destRoot, "LICENSE"));
		}

		if (fs.existsSync(readmeSrc)) {
			await copyRecursive(readmeSrc, path.join(destRoot, "UPSTREAM_README.md"));
			log(
				"Copied upstream README to",
				path.join(destRoot, "UPSTREAM_README.md"),
			);
		}

		// 4. Write local README.md describing source and license (overwrite)
		const localReadme =
			`# alphaTabWebsite (vendor copy)

This directory contains a vendor copy of the alphaTab project's documentation (the "AlphaTeX" docs) pulled from the ` +
			"node_modules/alphaTabWebsite" +
			` package.

Source: https://github.com/CoderLine/alphaTabWebsite

Files were copied with the script: 

    node scripts/vendor-alphatex.cjs

**License & attribution:** Upstream project license has been copied into this folder as \
\`LICENSE\`. Please refer to it for license terms. Original authors and contributors are preserved in the upstream project's repository.
`;

		await fs.promises.writeFile(
			path.join(destRoot, "README.md"),
			localReadme,
			"utf8",
		);
		log("Wrote vendor README to", path.join(destRoot, "README.md"));

		log(
			"Done. Please review docs/vendor/alphaTabWebsite/alphatex/ and commit changes.",
		);
	} catch (err) {
		console.error("[vendor-alphatex] Error:", err);
		process.exitCode = 2;
	}
})();
