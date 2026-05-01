import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const scriptPath = path.join(scriptDir, "dev-tauri-with-sidecar.sh");
const passthroughArgs = process.argv.slice(2);

function cargoBinDir() {
	if (process.platform !== "win32") {
		return null;
	}

	return path.join(process.env.USERPROFILE ?? "", ".cargo", "bin");
}

function cargoExecutablePath() {
	const windowsCargoPath = cargoBinDir()
		? path.join(cargoBinDir(), "cargo.exe")
		: null;
	if (windowsCargoPath && existsSync(windowsCargoPath)) {
		return windowsCargoPath;
	}

	return null;
}

function resolvedCargoPath() {
	if (hasCommand("cargo")) {
		return "cargo";
	}

	return cargoExecutablePath();
}

function hasCommand(command) {
	const result = spawnSync(command, ["--version"], {
		cwd: rootDir,
		stdio: "ignore",
		shell: process.platform === "win32",
	});

	return result.status === 0;
}

function childEnvWithCargoPath() {
	const cargoDir = cargoBinDir();
	if (!cargoDir || !existsSync(cargoDir)) {
		return process.env;
	}

	return {
		...process.env,
		PATH: `${cargoDir}${path.delimiter}${process.env.PATH ?? ""}`,
	};
}

function run(command, args, options = {}) {
	return new Promise((resolve, reject) => {
		const child = spawn(command, args, {
			cwd: rootDir,
			stdio: "inherit",
			shell: process.platform === "win32",
			env: process.platform === "win32" ? childEnvWithCargoPath() : process.env,
			...options,
		});

		child.on("error", reject);
		child.on("exit", (code, signal) => {
			if (signal) {
				reject(new Error(`Process terminated with signal ${signal}`));
				return;
			}
			if (code === 0) {
				resolve();
				return;
			}
			reject(new Error(`${command} exited with code ${code}`));
		});
	});
}

async function main() {
	const cargoPath = resolvedCargoPath();
	if (!cargoPath) {
		console.warn(
			"Cargo is not available; starting the renderer-only dev server instead.",
		);
		await run("pnpm", ["dev:react", ...passthroughArgs]);
		return;
	}

	if (process.platform === "win32") {
		console.warn(
			"Windows detected: running Tauri dev directly with the installed Cargo toolchain.",
		);
		await run("pnpm", ["tauri", "dev", ...passthroughArgs]);
		return;
	}

	await run("bash", [scriptPath, ...passthroughArgs]);
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
});
