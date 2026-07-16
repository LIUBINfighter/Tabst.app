import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];

function fail(message) {
	failures.push(message);
}

function read(relativePath) {
	return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function readJson(relativePath) {
	return JSON.parse(read(relativePath));
}

function walkMarkdown(relativeDirectory) {
	const directory = path.join(root, relativeDirectory);
	if (!fs.existsSync(directory)) return [];

	const results = [];
	for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
		const relativePath = path.join(relativeDirectory, entry.name);
		if (entry.isDirectory()) {
			results.push(...walkMarkdown(relativePath));
		} else if (entry.isFile() && entry.name.endsWith(".md")) {
			results.push(relativePath);
		}
	}
	return results;
}

function collectDocumentationFiles() {
	const files = new Set([
		"README.md",
		"README.zh.md",
		"ROADMAP.md",
		"AGENTS.md",
		path.join(".github", "pull_request_template.md"),
	]);

	for (const file of walkMarkdown(path.join("docs", "dev"))) {
		files.add(file);
	}
	for (const file of walkMarkdown("src")) {
		if (path.basename(file) === "AGENTS.md") files.add(file);
	}
	for (const file of walkMarkdown("src-tauri")) {
		if (path.basename(file) === "AGENTS.md") files.add(file);
	}

	return [...files].sort();
}

function normalizeLinkTarget(rawTarget) {
	let target = rawTarget.trim();
	if (target.startsWith("<") && target.endsWith(">")) {
		target = target.slice(1, -1);
	}

	const optionalTitle = target.match(/^(.*?)\s+["'][^"']*["']$/);
	if (optionalTitle) target = optionalTitle[1];

	return target;
}

function checkLocalMarkdownLinks(files) {
	let checkedLinks = 0;
	const markdownLink = /!?\[[^\]]*\]\(([^)]+)\)/g;

	for (const file of files) {
		const content = read(file);
		for (const match of content.matchAll(markdownLink)) {
			const target = normalizeLinkTarget(match[1]);
			if (
				!target ||
				target.startsWith("#") ||
				target.startsWith("/") ||
				/^[a-z][a-z0-9+.-]*:/i.test(target)
			) {
				continue;
			}

			const withoutAnchor = target.split("#", 1)[0].split("?", 1)[0];
			if (!withoutAnchor) continue;

			let decodedTarget;
			try {
				decodedTarget = decodeURIComponent(withoutAnchor);
			} catch {
				fail(`${file}: invalid URL encoding in link ${target}`);
				continue;
			}

			checkedLinks += 1;
			const resolved = path.resolve(root, path.dirname(file), decodedTarget);
			if (!fs.existsSync(resolved)) {
				fail(`${file}: missing local link target ${target}`);
			}
		}
	}

	return checkedLinks;
}

function checkPnpmScriptReferences(packageJson) {
	const files = ["README.md", "README.zh.md", "AGENTS.md"];
	const builtIns = new Set([
		"add",
		"approve-builds",
		"config",
		"dlx",
		"exec",
		"install",
		"remove",
		"run",
		"why",
	]);
	const scripts = new Set(Object.keys(packageJson.scripts ?? {}));
	const commandPattern = /^\s*pnpm(?:\s+run)?\s+([a-zA-Z0-9:._-]+)/gm;

	for (const file of files) {
		const content = read(file);
		for (const match of content.matchAll(commandPattern)) {
			const command = match[1];
			if (command.startsWith("-") || builtIns.has(command)) continue;
			if (!scripts.has(command)) {
				fail(`${file}: references missing package script "${command}"`);
			}
		}
	}
}

function matchTomlValue(content, key) {
	const match = content.match(new RegExp(`^${key}\\s*=\\s*"([^"]+)"`, "m"));
	return match?.[1] ?? null;
}

function checkRepositoryMetadata(packageJson) {
	const cargoToml = read(path.join("src-tauri", "Cargo.toml"));
	const tauriConfig = readJson(path.join("src-tauri", "tauri.conf.json"));
	const license = read("LICENSE");
	const readme = read("README.md");
	const readmeZh = read("README.zh.md");
	const publicReadme = read(path.join("public", "docs", "README.md"));
	const roadmap = read("ROADMAP.md");
	const publicRoadmap = read(path.join("public", "docs", "ROADMAP.md"));
	const pullRequestTemplate = read(path.join(".github", "pull_request_template.md"));
	const aboutPage = read(
		path.join("src", "renderer", "components", "settings", "AboutPage.tsx"),
	);
	const settingsEn = readJson(
		path.join("src", "renderer", "i18n", "locales", "en", "settings.json"),
	);
	const settingsZh = readJson(
		path.join("src", "renderer", "i18n", "locales", "zh-cn", "settings.json"),
	);

	const cargoVersion = matchTomlValue(cargoToml, "version");
	const cargoLicense = matchTomlValue(cargoToml, "license");
	const versions = [packageJson.version, tauriConfig.version, cargoVersion];
	if (versions.some((version) => !version) || new Set(versions).size !== 1) {
		fail(
			`Product versions differ: package=${packageJson.version}, tauri=${tauriConfig.version}, cargo=${cargoVersion}`,
		);
	}

	if (!license.startsWith("Mozilla Public License Version 2.0")) {
		fail("LICENSE is not the Mozilla Public License Version 2.0 text");
	}
	if (packageJson.license !== "MPL-2.0") {
		fail(`package.json license must be MPL-2.0, found ${packageJson.license}`);
	}
	if (cargoLicense !== "MPL-2.0") {
		fail(`src-tauri/Cargo.toml license must be MPL-2.0, found ${cargoLicense}`);
	}
	if (!readme.includes("Mozilla Public License 2.0")) {
		fail("README.md must name the Mozilla Public License 2.0");
	}
	if (!readmeZh.includes("Mozilla Public License 2.0")) {
		fail("README.zh.md must name the Mozilla Public License 2.0");
	}
	if (publicReadme !== readme) {
		fail("public/docs/README.md must match the root README.md");
	}
	if (publicRoadmap !== roadmap) {
		fail("public/docs/ROADMAP.md must match the root ROADMAP.md");
	}
	if (!pullRequestTemplate.includes("MPL-2.0")) {
		fail("Pull request template must license contributions under MPL-2.0");
	}
	if (!("../LICENSE" in (tauriConfig.bundle?.resources ?? {}))) {
		fail("Tauri bundle resources must include ../LICENSE");
	}
	if (!aboutPage.includes("settings:licenseName")) {
		fail("AboutPage must display the localized project license");
	}
	if (
		settingsEn.licenseName !== "Mozilla Public License 2.0" ||
		settingsZh.licenseName !== "Mozilla Public License 2.0"
	) {
		fail("About-page translations must name the Mozilla Public License 2.0");
	}
}

function checkPnpmWorkspaceConfiguration(packageJson) {
	const workspace = read("pnpm-workspace.yaml");
	if (Object.hasOwn(packageJson, "pnpm")) {
		fail("Move pnpm workspace settings out of package.json");
	}
	if (!/^overrides:/m.test(workspace)) {
		fail("pnpm-workspace.yaml must define overrides");
	}
	if (!/^\s+["']?@lezer\/common["']?:\s*["']?1\.5\.2["']?\s*$/m.test(workspace)) {
		fail("pnpm-workspace.yaml must pin @lezer/common to 1.5.2");
	}
	if (!/^allowBuilds:/m.test(workspace) || !/^\s+esbuild:\s*true\s*$/m.test(workspace)) {
		fail("pnpm-workspace.yaml must explicitly allow the esbuild build script");
	}
}

function checkHistoricalDocumentMarkers() {
	const historicalDocuments = [
		path.join(
			"docs",
			"dev",
			"archived",
			"tauri",
			"PHASE_1_MIGRATION_REPORT.md",
		),
		path.join("docs", "dev", "reports", "GROUNDING_REPORT.md"),
		path.join("docs", "dev", "reports", "REFACTOR_SPEED_PHASE_REPORT.md"),
		path.join(
			"docs",
			"dev",
			"archived",
			"ia",
			"INFORMATION_ARCHITECTURE_SNAPSHOT.md",
		),
		path.join(
			"docs",
			"dev",
			"plans",
			"completed",
			"WORKSPACE_PERSISTENCE_UNIFICATION.md",
		),
		path.join(
			"docs",
			"dev",
			"archived",
			"alphatab",
			"TRACKS_CONFIGURATION_PROPOSALS.md",
		),
		path.join(
			"docs",
			"dev",
			"archived",
			"alphatab",
			"SELECTION_API_1_8_MIGRATION.md",
		),
	];

	for (const file of historicalDocuments) {
		if (!read(file).includes("> **Status:** Historical")) {
			fail(`${file}: missing standardized Historical status marker`);
		}
	}
}

function checkAgentFreshness() {
	const agents = read("AGENTS.md");
	const forbiddenPatterns = [
		/^\*\*Generated:\*\*/m,
		/^\*\*Commit:\*\*/m,
		/^\*\*Branch:\*\*/m,
		/^Current branch:/m,
		/^Reference commit:/m,
		/packageManager:\s*pnpm@\d/i,
	];

	for (const pattern of forbiddenPatterns) {
		if (pattern.test(agents)) {
			fail(`AGENTS.md contains a dynamic repository snapshot matching ${pattern}`);
		}
	}
}

const packageJson = readJson("package.json");
const documentationFiles = collectDocumentationFiles();
const checkedLinks = checkLocalMarkdownLinks(documentationFiles);

checkPnpmScriptReferences(packageJson);
checkRepositoryMetadata(packageJson);
checkPnpmWorkspaceConfiguration(packageJson);
checkHistoricalDocumentMarkers();
checkAgentFreshness();

if (failures.length > 0) {
	console.error(`docs:check failed with ${failures.length} issue(s):`);
	for (const failure of failures) console.error(`- ${failure}`);
	process.exit(1);
}

console.log(
	`docs:check passed (${documentationFiles.length} Markdown files, ${checkedLinks} local links).`,
);
