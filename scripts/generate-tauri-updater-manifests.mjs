#!/usr/bin/env node
import { promises as fs } from "node:fs";
import path from "node:path";

const workspaceRoot = process.cwd();
const bundleRoot = path.join(workspaceRoot, "src-tauri", "target", "release", "bundle");
const tauriConfigPath = path.join(workspaceRoot, "src-tauri", "tauri.conf.json");
const outputDir = path.join(bundleRoot, "updater-manifests");

const repository = process.env.GITHUB_REPOSITORY || "LIUBINfighter/Tabst.app";
const tag = process.env.GITHUB_REF_NAME;

if (!tag) {
	console.error("[updater-manifest] missing GITHUB_REF_NAME");
	process.exit(1);
}

function getTauriTargetPrefix() {
	const archMap = {
		x64: "x86_64",
		arm64: "aarch64",
		ia32: "i686",
	};
	const osMap = {
		win32: "windows",
		darwin: "darwin",
		linux: "linux",
	};

	const arch = archMap[process.arch];
	const os = osMap[process.platform];
	if (!arch || !os) {
		throw new Error(
			`Unsupported host platform for updater manifest: ${process.platform}/${process.arch}`,
		);
	}
	return `${os}-${arch}`;
}

async function listFiles(dirPath) {
	try {
		const entries = await fs.readdir(dirPath, { withFileTypes: true });
		return entries
			.filter((entry) => entry.isFile())
			.map((entry) => path.join(dirPath, entry.name));
	} catch {
		return [];
	}
}

async function findArtifact(bundleType) {
	const byPlatform = {
		win32: {
			nsis: { dir: "nsis", ext: ".exe", rejectIncludes: [".zip"] },
			msi: { dir: "msi", ext: ".msi", rejectIncludes: [] },
		},
		darwin: {
			app: { dir: "macos", ext: ".app.tar.gz", rejectIncludes: [] },
		},
		linux: {
			appimage: { dir: "appimage", ext: ".AppImage", rejectIncludes: [".tar.gz"] },
			deb: { dir: "deb", ext: ".deb", rejectIncludes: [] },
			rpm: { dir: "rpm", ext: ".rpm", rejectIncludes: [] },
		},
	};

	const platformConfig = byPlatform[process.platform]?.[bundleType];
	if (!platformConfig) {
		return null;
	}

	const dirPath = path.join(bundleRoot, platformConfig.dir);
	const files = await listFiles(dirPath);
	const matched = files
		.filter((filePath) => filePath.endsWith(platformConfig.ext))
		.filter(
			(filePath) =>
				!platformConfig.rejectIncludes.some((segment) => filePath.includes(segment)),
		)
		.sort((left, right) => left.localeCompare(right));

	if (matched.length === 0) return null;

	const artifactPath = matched[0];
	const signaturePath = `${artifactPath}.sig`;
	try {
		await fs.access(signaturePath);
	} catch {
		throw new Error(
			`Missing signature for updater artifact: ${path.basename(artifactPath)}`,
		);
	}

	return { artifactPath, signaturePath };
}

async function writeManifest(fileName, manifest) {
	const manifestPath = path.join(outputDir, fileName);
	await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, "\t")}\n`, "utf8");
	return manifestPath;
}

function toReleaseAssetUrl(assetFileName) {
	return `https://github.com/${repository}/releases/download/${encodeURIComponent(tag)}/${encodeURIComponent(assetFileName)}`;
}

async function main() {
	const tauriConfigRaw = await fs.readFile(tauriConfigPath, "utf8");
	const tauriConfig = JSON.parse(tauriConfigRaw);
	const version = tauriConfig.version;
	if (typeof version !== "string" || version.length === 0) {
		throw new Error("Invalid version in src-tauri/tauri.conf.json");
	}

	await fs.mkdir(outputDir, { recursive: true });

	const target = getTauriTargetPrefix();
	const bundleOrderByPlatform = {
		win32: ["nsis", "msi"],
		darwin: ["app"],
		linux: ["appimage", "deb", "rpm"],
	};

	const bundleOrder = bundleOrderByPlatform[process.platform] || [];
	const manifests = [];

	for (const bundleType of bundleOrder) {
		const match = await findArtifact(bundleType);
		if (!match) continue;

		const signature = (await fs.readFile(match.signaturePath, "utf8")).trim();
		if (!signature) {
			throw new Error(`Empty signature file: ${path.basename(match.signaturePath)}`);
		}

		const artifactName = path.basename(match.artifactPath);
		const manifest = {
			version,
			notes: `https://github.com/${repository}/releases/tag/${tag}`,
			pub_date: new Date().toISOString(),
			url: toReleaseAssetUrl(artifactName),
			signature,
		};

		const specificFile = `latest-${target}-${bundleType}.json`;
		const writtenSpecific = await writeManifest(specificFile, manifest);
		manifests.push({ bundleType, path: writtenSpecific });

		const genericFile = `latest-${target}.json`;
		const genericPath = path.join(outputDir, genericFile);
		try {
			await fs.access(genericPath);
		} catch {
			const writtenGeneric = await writeManifest(genericFile, manifest);
			manifests.push({ bundleType: "generic", path: writtenGeneric });
		}
	}

	if (manifests.length === 0) {
		throw new Error(
			`No updater artifacts found for ${process.platform}/${process.arch} under ${bundleRoot}`,
		);
	}

	console.log("[updater-manifest] generated files:");
	for (const item of manifests) {
		console.log(`- ${item.bundleType}: ${item.path}`);
	}
}

main().catch((error) => {
	console.error("[updater-manifest] failed:", error);
	process.exit(1);
});
