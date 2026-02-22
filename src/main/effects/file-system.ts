import * as fs from "node:fs";
import * as path from "node:path";
import { Effect } from "effect";
import { app, dialog, shell } from "electron";
import type {
	FileNode,
	Repo,
	RepoMetadata,
	ScanDirectoryResult,
} from "../../renderer/types/repo";

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

export const renamePath = (
	src: string,
	dest: string,
): Effect.Effect<void, FileSystemError> =>
	Effect.tryPromise({
		try: async () => {
			try {
				await fs.promises.rename(src, dest);
			} catch (error) {
				const err = error as NodeJS.ErrnoException;
				// Cross-device rename isn't supported; fallback to copy+unlink for files.
				if (err?.code === "EXDEV") {
					const stat = await fs.promises.stat(src);
					if (stat.isFile()) {
						await fs.promises.copyFile(src, dest);
						await fs.promises.unlink(src);
						return;
					}
				}
				throw error;
			}
		},
		catch: (error) =>
			new FileSystemError(
				`Failed to rename path from ${src} to ${dest}`,
				error,
			),
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

const SUPPORTED_EXTENSIONS = [
	".md",
	".atex",
	".gp",
	".gp3",
	".gp4",
	".gp5",
	".gpx",
];

export const getGlobalMetadataDir = (): Effect.Effect<
	string,
	FileSystemError
> =>
	Effect.gen(function* () {
		const homeDir = app.getPath("home");
		const metadataDir = path.join(homeDir, ".tabst");
		yield* mkdir(metadataDir);
		return metadataDir;
	});

// ===== Global Settings (.tabst/settings.json) =====
export interface GlobalSettings {
	locale?: "en" | "zh-cn";
	deleteBehavior?: "system-trash" | "repo-trash" | "ask-every-time";
	theme?: {
		uiThemeId?: string;
		editorThemeId?: string;
		mode?: "light" | "dark" | "system";
	};
}

export const readGlobalSettings = (): Effect.Effect<
	GlobalSettings | null,
	FileSystemError
> =>
	Effect.gen(function* () {
		const metadataDir = yield* getGlobalMetadataDir();
		const settingsFile = path.join(metadataDir, "settings.json");
		const settings = yield* readJsonFile<GlobalSettings>(settingsFile);
		return settings ?? null;
	});

export const writeGlobalSettings = (
	settings: GlobalSettings,
): Effect.Effect<void, FileSystemError> =>
	Effect.gen(function* () {
		const metadataDir = yield* getGlobalMetadataDir();
		const settingsFile = path.join(metadataDir, "settings.json");
		yield* writeJsonFile(settingsFile, settings);
	});

export const readRepos = (): Effect.Effect<Repo[], FileSystemError> =>
	Effect.gen(function* () {
		const metadataDir = yield* getGlobalMetadataDir();
		const reposFile = path.join(metadataDir, "repos.json");
		const repos = yield* readJsonFile<Repo[]>(reposFile);
		return repos || [];
	});

export const writeRepos = (
	repos: Repo[],
): Effect.Effect<void, FileSystemError> =>
	Effect.gen(function* () {
		const metadataDir = yield* getGlobalMetadataDir();
		const reposFile = path.join(metadataDir, "repos.json");
		yield* writeJsonFile(reposFile, repos);
	});

export const readWorkspaceMetadata = (
	repoPath: string,
): Effect.Effect<RepoMetadata | null, FileSystemError> =>
	Effect.gen(function* () {
		const workspaceFile = path.join(repoPath, ".tabst", "workspace.json");
		const metadata = yield* readJsonFile<RepoMetadata>(workspaceFile);
		return metadata;
	});

export const writeWorkspaceMetadata = (
	repoPath: string,
	metadata: RepoMetadata,
): Effect.Effect<void, FileSystemError> =>
	Effect.gen(function* () {
		const workspaceDir = path.join(repoPath, ".tabst");
		yield* mkdir(workspaceDir);
		const workspaceFile = path.join(workspaceDir, "workspace.json");
		yield* writeJsonFile(workspaceFile, metadata);
	});

const hasSupportedExtension = (fileName: string): boolean => {
	const ext = path.extname(fileName).toLowerCase();
	return SUPPORTED_EXTENSIONS.includes(ext);
};

const scanDirectoryRecursive = (
	dirPath: string,
	expandedFolders: string[],
): Effect.Effect<FileNode[], FileSystemError> =>
	Effect.gen(function* () {
		const entries = yield* Effect.try({
			try: () => fs.readdirSync(dirPath, { withFileTypes: true }),
			catch: (error) =>
				new FileSystemError(`Failed to read directory: ${dirPath}`, error),
		});

		const nodes: FileNode[] = [];

		for (const entry of entries) {
			if (entry.name.startsWith(".")) continue;

			const fullPath = path.join(dirPath, entry.name);
			const id = fullPath;

			if (entry.isDirectory()) {
				const children = yield* scanDirectoryRecursive(
					fullPath,
					expandedFolders,
				);
				if (children.length > 0) {
					nodes.push({
						id,
						name: entry.name,
						path: fullPath,
						type: "folder",
						children,
						isExpanded: false,
					});
				}
			} else if (entry.isFile() && hasSupportedExtension(entry.name)) {
				nodes.push({
					id,
					name: entry.name,
					path: fullPath,
					type: "file",
				});
			}
		}

		nodes.sort((a, b) => {
			if (a.type === "folder" && b.type !== "folder") return -1;
			if (a.type !== "folder" && b.type === "folder") return 1;
			return a.name.localeCompare(b.name);
		});

		return nodes;
	});

export const scanDirectory = (
	dirPath: string,
): Effect.Effect<ScanDirectoryResult, FileSystemError> =>
	Effect.gen(function* () {
		const expandedFolders: string[] = [];
		const nodes = yield* scanDirectoryRecursive(dirPath, expandedFolders);

		return {
			nodes,
			expandedFolders,
		};
	});

export const moveToSystemTrash = (
	filePath: string,
): Effect.Effect<void, FileSystemError> =>
	Effect.tryPromise({
		try: async () => {
			await shell.trashItem(filePath);
		},
		catch: (error) =>
			new FileSystemError(`Failed to move to system trash: ${filePath}`, error),
	});

export const moveToRepoTrash = (
	filePath: string,
	repoPath: string,
): Effect.Effect<void, FileSystemError> =>
	Effect.gen(function* () {
		const metadataDir = yield* getGlobalMetadataDir();
		const repoName = path.basename(repoPath);
		const trashDir = path.join(metadataDir, ".trash", repoName);
		yield* mkdir(trashDir);

		const fileName = path.basename(filePath);
		const timestamp = Date.now();
		const uniqueName = `${timestamp}_${fileName}`;
		const destPath = path.join(trashDir, uniqueName);

		yield* Effect.tryPromise({
			try: async () => {
				try {
					await fs.promises.rename(filePath, destPath);
				} catch {
					await fs.promises.copyFile(filePath, destPath);
					await fs.promises.unlink(filePath);
				}
			},
			catch: (error) =>
				new FileSystemError(`Failed to move to repo trash: ${filePath}`, error),
		});
	});
