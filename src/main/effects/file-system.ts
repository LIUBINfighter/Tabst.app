import * as fs from "node:fs";
import * as path from "node:path";
import { Effect } from "effect";
import { app, dialog } from "electron";

export class FileSystemError {
	readonly _tag = "FileSystemError";
	constructor(
		readonly message: string,
		readonly cause?: unknown,
	) {}
}

export class DialogError {
	readonly _tag = "DialogError";
	constructor(
		readonly message: string,
		readonly cause?: unknown,
	) {}
}

export const readFile = (
	filePath: string,
): Effect.Effect<string, FileSystemError> =>
	Effect.try({
		try: () => fs.readFileSync(filePath, "utf-8"),
		catch: (error) =>
			new FileSystemError(`Failed to read file: ${filePath}`, error),
	});

export const readFileAsUint8Array = (
	filePath: string,
): Effect.Effect<Uint8Array, FileSystemError> =>
	Effect.tryPromise({
		try: async () => {
			const data = await fs.promises.readFile(filePath);
			return new Uint8Array(data);
		},
		catch: (error) =>
			new FileSystemError(`Failed to read file: ${filePath}`, error),
	});

export const writeFile = (
	filePath: string,
	content: string,
): Effect.Effect<void, FileSystemError> =>
	Effect.try({
		try: () => fs.writeFileSync(filePath, content, "utf-8"),
		catch: (error) =>
			new FileSystemError(`Failed to write file: ${filePath}`, error),
	});

export const copyFile = (
	src: string,
	dest: string,
): Effect.Effect<void, FileSystemError> =>
	Effect.tryPromise({
		try: () => fs.promises.copyFile(src, dest),
		catch: (error) =>
			new FileSystemError(`Failed to copy file from ${src} to ${dest}`, error),
	});

export const unlinkFile = (
	filePath: string,
): Effect.Effect<void, FileSystemError> =>
	Effect.tryPromise({
		try: () => fs.promises.unlink(filePath),
		catch: (error) =>
			new FileSystemError(`Failed to delete file: ${filePath}`, error),
	});

export const fileExists = (
	filePath: string,
): Effect.Effect<boolean, FileSystemError> =>
	Effect.try({
		try: () => fs.existsSync(filePath),
		catch: (error) =>
			new FileSystemError(`Failed to check file existence: ${filePath}`, error),
	});

export const mkdir = (dirPath: string): Effect.Effect<void, FileSystemError> =>
	Effect.try({
		try: () => {
			if (!fs.existsSync(dirPath)) {
				fs.mkdirSync(dirPath, { recursive: true });
			}
		},
		catch: (error) =>
			new FileSystemError(`Failed to create directory: ${dirPath}`, error),
	});

export const showOpenDialog = (
	extensions: string[],
): Effect.Effect<
	{ path: string; name: string; content: string } | null,
	DialogError | FileSystemError
> =>
	Effect.gen(function* () {
		const result = yield* Effect.tryPromise({
			try: () =>
				dialog.showOpenDialog({
					properties: ["openFile"],
					filters: [
						{
							name: "支持的文件",
							extensions: extensions.map((ext) => ext.replace(".", "")),
						},
					],
				}),
			catch: (error) => new DialogError("Failed to show open dialog", error),
		});

		if (result.canceled || result.filePaths.length === 0) {
			return null;
		}

		const filePath = result.filePaths[0];
		const content = yield* readFile(filePath);
		const name = path.basename(filePath);

		return { path: filePath, name, content };
	});

export const getDefaultSaveDir = (): Effect.Effect<string, FileSystemError> =>
	Effect.gen(function* (_) {
		const documentsDir = app.getPath("documents");
		const tabstDir = path.join(documentsDir, "tabst");
		yield* mkdir(tabstDir);
		return tabstDir;
	});

export const getAppStatePath = (): string => {
	const dataDir = app.getPath("userData");
	return path.join(dataDir, "app-state.json");
};

export const readJsonFile = <T>(
	filePath: string,
): Effect.Effect<T | null, FileSystemError> =>
	Effect.gen(function* () {
		const exists = yield* fileExists(filePath);
		if (!exists) {
			return null;
		}

		const content = yield* readFile(filePath);
		return yield* Effect.try({
			try: () => JSON.parse(content) as T,
			catch: (error) =>
				new FileSystemError(`Failed to parse JSON: ${filePath}`, error),
		});
	});

export const writeJsonFile = <T>(
	filePath: string,
	data: T,
): Effect.Effect<void, FileSystemError> =>
	Effect.gen(function* () {
		const content = JSON.stringify(data, null, 2);
		yield* writeFile(filePath, content);
	});
