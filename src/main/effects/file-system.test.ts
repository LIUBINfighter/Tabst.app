import * as fs from "node:fs";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { Effect, Exit } from "effect";
import { describe, expect, it, vi } from "vitest";

// Mock electron before importing file-system
vi.mock("electron", () => ({
	app: {
		getPath: (name: string) => {
			if (name === "documents") return tmpdir();
			if (name === "userData") return tmpdir();
			return tmpdir();
		},
	},
	dialog: {
		showOpenDialog: vi.fn(),
	},
}));

import type { FileSystemError } from "./file-system";
import {
	copyFile,
	fileExists,
	mkdir,
	readFile,
	readFileAsUint8Array,
	readJsonFile,
	renamePath,
	unlinkFile,
	writeFile,
	writeJsonFile,
} from "./file-system";

describe("file-system effects", () => {
	let testDir: string;

	it("creates temp dir", () => {
		testDir = mkdtempSync(path.join(tmpdir(), "tabst-test-"));
	});

	it("writeFile and readFile", async () => {
		const filePath = path.join(testDir, "test.txt");
		const content = "hello effect";

		const writeResult = await Effect.runPromiseExit(
			writeFile(filePath, content),
		);
		expect(Exit.isSuccess(writeResult)).toBe(true);

		const readResult = await Effect.runPromiseExit(readFile(filePath));
		expect(Exit.isSuccess(readResult)).toBe(true);
		if (Exit.isSuccess(readResult)) {
			expect(readResult.value).toBe(content);
		}
	});

	it("readFile fails for non-existent file", async () => {
		const result = await Effect.runPromiseExit(
			readFile(path.join(testDir, "nonexistent.txt")),
		);
		expect(Exit.isFailure(result)).toBe(true);
		if (Exit.isFailure(result)) {
			expect(result.cause._tag).toBe("Fail");
			const err = result.cause as { _tag: "Fail"; error: FileSystemError };
			expect(err.error._tag).toBe("FileSystemError");
			expect(err.error.message).toContain("Failed to read file");
		}
	});

	it("readFileAsUint8Array", async () => {
		const filePath = path.join(testDir, "binary.bin");
		const data = new Uint8Array([1, 2, 3, 255]);

		fs.writeFileSync(filePath, data);

		const result = await Effect.runPromiseExit(readFileAsUint8Array(filePath));
		expect(Exit.isSuccess(result)).toBe(true);
		if (Exit.isSuccess(result)) {
			expect(result.value).toEqual(data);
		}
	});

	it("fileExists", async () => {
		const existing = path.join(testDir, "test.txt");
		const missing = path.join(testDir, "missing.txt");

		const existsResult = await Effect.runPromiseExit(fileExists(existing));
		expect(Exit.isSuccess(existsResult)).toBe(true);
		if (Exit.isSuccess(existsResult)) expect(existsResult.value).toBe(true);

		const missingResult = await Effect.runPromiseExit(fileExists(missing));
		expect(Exit.isSuccess(missingResult)).toBe(true);
		if (Exit.isSuccess(missingResult)) expect(missingResult.value).toBe(false);
	});

	it("copyFile and unlinkFile", async () => {
		const src = path.join(testDir, "test.txt");
		const dest = path.join(testDir, "copy.txt");

		const copyResult = await Effect.runPromiseExit(copyFile(src, dest));
		expect(Exit.isSuccess(copyResult)).toBe(true);

		const readDest = await Effect.runPromiseExit(readFile(dest));
		expect(Exit.isSuccess(readDest)).toBe(true);
		if (Exit.isSuccess(readDest)) expect(readDest.value).toBe("hello effect");

		const unlinkResult = await Effect.runPromiseExit(unlinkFile(dest));
		expect(Exit.isSuccess(unlinkResult)).toBe(true);

		const existsAfter = await Effect.runPromiseExit(fileExists(dest));
		expect(Exit.isSuccess(existsAfter)).toBe(true);
		if (Exit.isSuccess(existsAfter)) expect(existsAfter.value).toBe(false);
	});

	it("renamePath (file)", async () => {
		const src = path.join(testDir, "rename-src.txt");
		const dest = path.join(testDir, "rename-dest.txt");
		fs.writeFileSync(src, "rename me", "utf-8");

		const result = await Effect.runPromiseExit(renamePath(src, dest));
		expect(Exit.isSuccess(result)).toBe(true);
		expect(fs.existsSync(src)).toBe(false);
		expect(fs.existsSync(dest)).toBe(true);
		expect(fs.readFileSync(dest, "utf-8")).toBe("rename me");
	});

	it("renamePath (folder)", async () => {
		const srcDir = path.join(testDir, "folder-src");
		const destDir = path.join(testDir, "folder-dest");
		fs.mkdirSync(srcDir);
		fs.writeFileSync(path.join(srcDir, "a.txt"), "a", "utf-8");

		const result = await Effect.runPromiseExit(renamePath(srcDir, destDir));
		expect(Exit.isSuccess(result)).toBe(true);
		expect(fs.existsSync(srcDir)).toBe(false);
		expect(fs.existsSync(destDir)).toBe(true);
		expect(fs.readFileSync(path.join(destDir, "a.txt"), "utf-8")).toBe("a");
	});

	it("mkdir", async () => {
		const newDir = path.join(testDir, "nested", "dir");
		const result = await Effect.runPromiseExit(mkdir(newDir));
		expect(Exit.isSuccess(result)).toBe(true);
		expect(fs.existsSync(newDir)).toBe(true);
	});

	it("readJsonFile and writeJsonFile", async () => {
		const jsonPath = path.join(testDir, "data.json");
		const obj = { foo: 42, bar: "baz" };

		const writeResult = await Effect.runPromiseExit(
			writeJsonFile(jsonPath, obj),
		);
		expect(Exit.isSuccess(writeResult)).toBe(true);

		const readResult = await Effect.runPromiseExit(
			readJsonFile<typeof obj>(jsonPath),
		);
		expect(Exit.isSuccess(readResult)).toBe(true);
		if (Exit.isSuccess(readResult)) {
			expect(readResult.value).toEqual(obj);
		}
	});

	it("readJsonFile returns null for non-existent", async () => {
		const result = await Effect.runPromiseExit(
			readJsonFile(path.join(testDir, "no.json")),
		);
		expect(Exit.isSuccess(result)).toBe(true);
		if (Exit.isSuccess(result)) expect(result.value).toBeNull();
	});

	it("cleans up temp dir", () => {
		rmSync(testDir, { recursive: true });
	});
});
