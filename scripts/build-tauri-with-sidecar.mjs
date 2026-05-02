import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const scriptPath = path.join(scriptDir, "build-tauri-with-sidecar.sh");
const passthroughArgs = process.argv.slice(2);

function run(command, args, options = {}) {
	return new Promise((resolve, reject) => {
		const child = spawn(command, args, {
			cwd: rootDir,
			stdio: "inherit",
			shell: process.platform === "win32",
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
	if (process.platform === "win32") {
		console.warn(
			"Windows detected: running Tauri build directly without macOS sidecar staging.",
		);
		await run("pnpm", ["tauri", "build", ...passthroughArgs]);
		return;
	}

	await run("bash", [scriptPath, ...passthroughArgs]);
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
});