import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type {
	GitChangeEntry,
	GitChangeGroup,
	GitDiffResult,
	GitStatusSummary,
} from "../../renderer/types/git";

type GitResponse<T> =
	| {
			success: true;
			data: T;
	  }
	| {
			success: false;
			error: string;
	  };

type GitActionResponse =
	| {
			success: true;
	  }
	| {
			success: false;
			error: string;
	  };

interface GitCommandOutput {
	stdout: string;
	stderr: string;
	code: number;
}

class GitCommandError extends Error {
	code: number;
	stdout: string;
	stderr: string;

	constructor(message: string, output: GitCommandOutput) {
		super(message);
		this.name = "GitCommandError";
		this.code = output.code;
		this.stdout = output.stdout;
		this.stderr = output.stderr;
	}
}

function normalizeRepoPath(repoPath: string): string | null {
	const trimmed = repoPath?.trim();
	if (!trimmed) return null;
	return path.resolve(trimmed);
}

function decodePath(pathValue: string): string {
	const trimmed = pathValue.trim();
	if (!(trimmed.startsWith('"') && trimmed.endsWith('"'))) {
		return trimmed;
	}

	const source = trimmed.slice(1, -1);
	const bytes: number[] = [];

	for (let i = 0; i < source.length; i += 1) {
		const ch = source[i];
		if (ch !== "\\") {
			const code = source.charCodeAt(i);
			if (code <= 0x7f) {
				bytes.push(code);
			} else {
				const encoded = Buffer.from(ch, "utf8");
				for (const byte of encoded) {
					bytes.push(byte);
				}
			}
			continue;
		}

		const next = source[i + 1];
		if (!next) {
			bytes.push("\\".charCodeAt(0));
			continue;
		}

		if (next >= "0" && next <= "7") {
			let octal = next;
			let cursor = i + 2;
			while (
				cursor < source.length &&
				octal.length < 3 &&
				source[cursor] >= "0" &&
				source[cursor] <= "7"
			) {
				octal += source[cursor];
				cursor += 1;
			}

			bytes.push(Number.parseInt(octal, 8));
			i += octal.length;
			continue;
		}

		if (next === "x") {
			const hex = source.slice(i + 2, i + 4);
			if (/^[0-9a-fA-F]{2}$/.test(hex)) {
				bytes.push(Number.parseInt(hex, 16));
				i += 3;
				continue;
			}
		}

		switch (next) {
			case "a":
				bytes.push(0x07);
				i += 1;
				break;
			case "b":
				bytes.push(0x08);
				i += 1;
				break;
			case "f":
				bytes.push(0x0c);
				i += 1;
				break;
			case "n":
				bytes.push(0x0a);
				i += 1;
				break;
			case "r":
				bytes.push(0x0d);
				i += 1;
				break;
			case "t":
				bytes.push(0x09);
				i += 1;
				break;
			case "v":
				bytes.push(0x0b);
				i += 1;
				break;
			case "\\":
				bytes.push(0x5c);
				i += 1;
				break;
			case '"':
				bytes.push(0x22);
				i += 1;
				break;
			default:
				bytes.push(next.charCodeAt(0));
				i += 1;
				break;
		}
	}

	return Buffer.from(bytes).toString("utf8");
}

function isConflictCode(x: string, y: string): boolean {
	const conflictPairs = new Set(["DD", "AU", "UD", "UA", "DU", "AA", "UU"]);
	if (conflictPairs.has(`${x}${y}`)) return true;
	return x === "U" || y === "U";
}

function parseBranchHeader(line: string): {
	branch: string | null;
	tracking: string | null;
	ahead: number;
	behind: number;
	detached: boolean;
} {
	const header = line.replace(/^##\s*/, "").trim();
	let branch: string | null = null;
	let tracking: string | null = null;
	let ahead = 0;
	let behind = 0;
	let detached = false;

	const noCommitsMatch = header.match(/^No commits yet on\s+(.+)$/);
	if (noCommitsMatch) {
		branch = noCommitsMatch[1]?.trim() || null;
		return { branch, tracking, ahead, behind, detached };
	}

	const initialCommitMatch = header.match(/^Initial commit on\s+(.+)$/);
	if (initialCommitMatch) {
		branch = initialCommitMatch[1]?.trim() || null;
		return { branch, tracking, ahead, behind, detached };
	}

	if (header.startsWith("HEAD")) {
		detached = true;
		return { branch, tracking, ahead, behind, detached };
	}

	const aheadBehindMatch = header.match(/\s\[(.+)\]$/);
	let relation = header;
	if (aheadBehindMatch) {
		relation = header.slice(0, -aheadBehindMatch[0].length);
		for (const item of aheadBehindMatch[1].split(",")) {
			const piece = item.trim();
			const aheadMatch = piece.match(/^ahead\s+(\d+)$/);
			if (aheadMatch) {
				ahead = Number.parseInt(aheadMatch[1], 10);
				continue;
			}
			const behindMatch = piece.match(/^behind\s+(\d+)$/);
			if (behindMatch) {
				behind = Number.parseInt(behindMatch[1], 10);
			}
		}
	}

	const [localBranch, remoteBranch] = relation.split("...");
	branch = localBranch?.trim() || null;
	tracking = remoteBranch?.trim() || null;

	return { branch, tracking, ahead, behind, detached };
}

function parseStatusLine(line: string, order: number): GitChangeEntry | null {
	if (line.length < 3) return null;
	const xy = line.slice(0, 2);
	if (xy === "!!") return null;

	const x = xy[0] ?? " ";
	const y = xy[1] ?? " ";
	const remainder = line.slice(3).trim();
	if (!remainder) return null;

	const renameMarker = remainder.indexOf(" -> ");
	if (renameMarker >= 0) {
		const fromPathRaw = remainder.slice(0, renameMarker);
		const toPathRaw = remainder.slice(renameMarker + 4);
		if (!toPathRaw) return null;
		return {
			x,
			y,
			order,
			path: decodePath(toPathRaw),
			fromPath: fromPathRaw ? decodePath(fromPathRaw) : undefined,
		};
	}

	return {
		x,
		y,
		order,
		path: decodePath(remainder),
	};
}

function parseStatusOutput(stdout: string): GitStatusSummary {
	const lines = stdout.replace(/\r\n/g, "\n").split("\n").filter(Boolean);
	const stagedMap = new Map<string, GitChangeEntry>();
	const unstagedMap = new Map<string, GitChangeEntry>();
	const untrackedMap = new Map<string, GitChangeEntry>();
	const conflictedMap = new Map<string, GitChangeEntry>();

	let branch: string | null = null;
	let tracking: string | null = null;
	let ahead = 0;
	let behind = 0;
	let detached = false;
	let entryOrder = 0;

	for (const line of lines) {
		if (line.startsWith("## ")) {
			const branchInfo = parseBranchHeader(line);
			branch = branchInfo.branch;
			tracking = branchInfo.tracking;
			ahead = branchInfo.ahead;
			behind = branchInfo.behind;
			detached = branchInfo.detached;
			continue;
		}

		const entry = parseStatusLine(line, entryOrder);
		if (!entry) continue;
		entryOrder += 1;

		const key = `${entry.path}::${entry.fromPath ?? ""}`;
		if (entry.x === "?" && entry.y === "?") {
			untrackedMap.set(key, entry);
			continue;
		}

		if (isConflictCode(entry.x, entry.y)) {
			conflictedMap.set(key, entry);
		}

		if (entry.x !== " " && entry.x !== "?") {
			stagedMap.set(key, entry);
		}

		if (entry.y !== " " && entry.y !== "?") {
			unstagedMap.set(key, entry);
		}
	}

	const staged = [...stagedMap.values()];
	const unstaged = [...unstagedMap.values()];
	const untracked = [...untrackedMap.values()];
	const conflicted = [...conflictedMap.values()];

	const clean =
		staged.length === 0 &&
		unstaged.length === 0 &&
		untracked.length === 0 &&
		conflicted.length === 0;

	return {
		branch,
		tracking,
		ahead,
		behind,
		detached,
		staged,
		unstaged,
		untracked,
		conflicted,
		clean,
		generatedAt: Date.now(),
	};
}

function isProbablyBinary(buffer: Buffer): boolean {
	const maxInspect = Math.min(buffer.length, 4096);
	for (let i = 0; i < maxInspect; i += 1) {
		if (buffer[i] === 0) return true;
	}
	return false;
}

function buildUntrackedPatch(
	repoPath: string,
	relativePath: string,
): {
	mode: "patch" | "binary";
	binary: boolean;
	content: string;
	notice?: string;
} {
	const absolutePath = path.join(repoPath, relativePath);
	const fileBuffer = fs.readFileSync(absolutePath);
	if (isProbablyBinary(fileBuffer)) {
		return {
			mode: "binary",
			binary: true,
			content: "",
			notice: "Binary file changed. Text diff is unavailable.",
		};
	}

	const normalizedPath = relativePath.replace(/\\/g, "/");
	const text = fileBuffer.toString("utf-8").replace(/\r\n/g, "\n");
	const lines = text.length > 0 ? text.split("\n") : [];
	const hasTrailingNewline = text.endsWith("\n");
	const lineCount =
		text.length === 0
			? 0
			: hasTrailingNewline
				? Math.max(lines.length - 1, 0)
				: lines.length;

	const hunkHeader =
		lineCount > 0 ? `@@ -0,0 +1,${lineCount} @@` : "@@ -0,0 +0,0 @@";
	const body =
		lines.length > 0 ? lines.map((line) => `+${line}`).join("\n") : "+";

	const patch = [
		`diff --git a/${normalizedPath} b/${normalizedPath}`,
		"new file mode 100644",
		"--- /dev/null",
		`+++ b/${normalizedPath}`,
		hunkHeader,
		body,
	].join("\n");

	return {
		mode: "patch",
		binary: false,
		content: patch,
	};
}

async function runGit(
	repoPath: string,
	args: string[],
): Promise<GitCommandOutput> {
	return new Promise((resolve, reject) => {
		const child = spawn("git", args, {
			cwd: repoPath,
			windowsHide: true,
			env: process.env,
		});

		let stdout = "";
		let stderr = "";

		child.stdout.on("data", (chunk: Buffer | string) => {
			stdout += chunk.toString();
		});

		child.stderr.on("data", (chunk: Buffer | string) => {
			stderr += chunk.toString();
		});

		child.on("error", (error) => {
			reject(error);
		});

		child.on("close", (code) => {
			const result = {
				stdout,
				stderr,
				code: code ?? -1,
			};
			if (result.code === 0) {
				resolve(result);
				return;
			}
			reject(new GitCommandError(`git ${args.join(" ")} failed`, result));
		});
		child.stdin.end();
	});
}

function formatGitError(error: unknown): string {
	if (error instanceof GitCommandError) {
		const stderr = error.stderr.trim();
		const stdout = error.stdout.trim();
		return stderr || stdout || error.message;
	}
	if (error instanceof Error) return error.message;
	return String(error);
}

function isHeadResolveError(error: unknown): boolean {
	if (!(error instanceof GitCommandError)) return false;
	const combined = `${error.stderr}\n${error.stdout}`;
	return /could not resolve ['"]HEAD['"]/i.test(combined);
}

async function assertGitRepository(repoPath: string): Promise<void> {
	const result = await runGit(repoPath, ["rev-parse", "--is-inside-work-tree"]);
	if (result.stdout.trim() !== "true") {
		throw new Error("not-a-git-repository");
	}
}

async function hasHeadCommit(repoPath: string): Promise<boolean> {
	try {
		await runGit(repoPath, ["rev-parse", "--verify", "HEAD"]);
		return true;
	} catch {
		return false;
	}
}

export async function handleGetGitStatus(
	_event: Electron.IpcMainInvokeEvent,
	repoPath: string,
): Promise<GitResponse<GitStatusSummary>> {
	const normalizedRepoPath = normalizeRepoPath(repoPath);
	if (!normalizedRepoPath) {
		return { success: false, error: "invalid-repo-path" };
	}

	if (!fs.existsSync(normalizedRepoPath)) {
		return { success: false, error: "repo-path-not-found" };
	}

	try {
		await assertGitRepository(normalizedRepoPath);
		const statusOutput = await runGit(normalizedRepoPath, [
			"-c",
			"core.quotepath=false",
			"status",
			"--porcelain=v1",
			"--branch",
		]);
		const data = parseStatusOutput(statusOutput.stdout);
		return { success: true, data };
	} catch (error) {
		return { success: false, error: formatGitError(error) };
	}
}

export async function handleGetGitDiff(
	_event: Electron.IpcMainInvokeEvent,
	repoPath: string,
	filePath: string,
	group: GitChangeGroup,
): Promise<GitResponse<GitDiffResult>> {
	const normalizedRepoPath = normalizeRepoPath(repoPath);
	if (!normalizedRepoPath) {
		return { success: false, error: "invalid-repo-path" };
	}

	const normalizedPath = filePath?.trim();
	if (!normalizedPath) {
		return { success: false, error: "invalid-file-path" };
	}

	try {
		await assertGitRepository(normalizedRepoPath);

		if (group === "untracked") {
			const untrackedPatch = buildUntrackedPatch(
				normalizedRepoPath,
				normalizedPath,
			);
			return {
				success: true,
				data: {
					path: normalizedPath,
					group,
					mode: untrackedPatch.mode,
					binary: untrackedPatch.binary,
					content: untrackedPatch.content,
					notice: untrackedPatch.notice,
				},
			};
		}

		const args =
			group === "staged"
				? [
						"-c",
						"core.quotepath=false",
						"diff",
						"--staged",
						"--binary",
						"--",
						normalizedPath,
					]
				: [
						"-c",
						"core.quotepath=false",
						"diff",
						"--binary",
						"--",
						normalizedPath,
					];
		const diffOutput = await runGit(normalizedRepoPath, args);
		const patch = diffOutput.stdout;
		const binary =
			patch.includes("GIT binary patch") ||
			/(^|\n)Binary files .* differ(\n|$)/.test(patch);
		const hasPatch = patch.trim().length > 0;

		return {
			success: true,
			data: {
				path: normalizedPath,
				group,
				mode: binary ? "binary" : hasPatch ? "patch" : "text",
				binary,
				content: patch,
				notice: hasPatch
					? undefined
					: "No diff output for this change. The file may have changed mode only.",
			},
		};
	} catch (error) {
		return { success: false, error: formatGitError(error) };
	}
}

export async function handleStageGitFile(
	_event: Electron.IpcMainInvokeEvent,
	repoPath: string,
	filePath: string,
): Promise<GitActionResponse> {
	const normalizedRepoPath = normalizeRepoPath(repoPath);
	if (!normalizedRepoPath) {
		return { success: false, error: "invalid-repo-path" };
	}

	const normalizedPath = filePath?.trim();
	if (!normalizedPath) {
		return { success: false, error: "invalid-file-path" };
	}

	try {
		await assertGitRepository(normalizedRepoPath);
		await runGit(normalizedRepoPath, ["add", "--", normalizedPath]);
		return { success: true };
	} catch (error) {
		return { success: false, error: formatGitError(error) };
	}
}

export async function handleUnstageGitFile(
	_event: Electron.IpcMainInvokeEvent,
	repoPath: string,
	filePath: string,
): Promise<GitActionResponse> {
	const normalizedRepoPath = normalizeRepoPath(repoPath);
	if (!normalizedRepoPath) {
		return { success: false, error: "invalid-repo-path" };
	}

	const normalizedPath = filePath?.trim();
	if (!normalizedPath) {
		return { success: false, error: "invalid-file-path" };
	}

	try {
		await assertGitRepository(normalizedRepoPath);
		const headExists = await hasHeadCommit(normalizedRepoPath);
		if (!headExists) {
			await runGit(normalizedRepoPath, [
				"rm",
				"--cached",
				"--",
				normalizedPath,
			]);
			return { success: true };
		}

		try {
			await runGit(normalizedRepoPath, [
				"restore",
				"--staged",
				"--",
				normalizedPath,
			]);
		} catch (error) {
			if (isHeadResolveError(error)) {
				await runGit(normalizedRepoPath, [
					"rm",
					"--cached",
					"--",
					normalizedPath,
				]);
			} else {
				throw error;
			}
		}
		return { success: true };
	} catch (error) {
		return { success: false, error: formatGitError(error) };
	}
}

export async function handleStageAllGitChanges(
	_event: Electron.IpcMainInvokeEvent,
	repoPath: string,
): Promise<GitActionResponse> {
	const normalizedRepoPath = normalizeRepoPath(repoPath);
	if (!normalizedRepoPath) {
		return { success: false, error: "invalid-repo-path" };
	}

	try {
		await assertGitRepository(normalizedRepoPath);
		await runGit(normalizedRepoPath, ["add", "."]);
		return { success: true };
	} catch (error) {
		return { success: false, error: formatGitError(error) };
	}
}

export async function handleSyncGitPull(
	_event: Electron.IpcMainInvokeEvent,
	repoPath: string,
	remoteName?: string,
): Promise<GitActionResponse> {
	const normalizedRepoPath = normalizeRepoPath(repoPath);
	if (!normalizedRepoPath) {
		return { success: false, error: "invalid-repo-path" };
	}

	try {
		await assertGitRepository(normalizedRepoPath);
		const normalizedRemoteName = remoteName?.trim();
		const pullArgs = normalizedRemoteName
			? ["pull", "--ff-only", normalizedRemoteName]
			: ["pull", "--ff-only"];
		await runGit(normalizedRepoPath, pullArgs);
		return { success: true };
	} catch (error) {
		return { success: false, error: formatGitError(error) };
	}
}

export async function handleCommitGitChanges(
	_event: Electron.IpcMainInvokeEvent,
	repoPath: string,
	message: string,
): Promise<GitActionResponse> {
	const normalizedRepoPath = normalizeRepoPath(repoPath);
	if (!normalizedRepoPath) {
		return { success: false, error: "invalid-repo-path" };
	}

	const normalizedMessage = message?.trim();
	if (!normalizedMessage) {
		return { success: false, error: "empty-commit-message" };
	}

	try {
		await assertGitRepository(normalizedRepoPath);
		await runGit(normalizedRepoPath, ["commit", "-m", normalizedMessage]);
		return { success: true };
	} catch (error) {
		return { success: false, error: formatGitError(error) };
	}
}
