import type {
	ElectronAPI,
	FileResult,
	SaveResult,
	ScanDirectoryResult,
} from "../types/electron";
import type { FileNode, Repo, RepoMetadata } from "../types/repo";

interface BrowserStoredFile {
	path: string;
	name: string;
	content: string;
	repoPath: string;
	updatedAt: number;
}

const STORAGE_KEYS = {
	repos: "tabst:web:repos",
	workspaceMetadata: "tabst:web:workspace-metadata",
	files: "tabst:web:files",
	appState: "tabst:web:app-state",
	globalSettings: "tabst:web:global-settings",
};

function safeReadJson<T>(key: string, fallback: T): T {
	try {
		const raw = window.localStorage.getItem(key);
		if (!raw) return fallback;
		return JSON.parse(raw) as T;
	} catch {
		return fallback;
	}
}

function safeWriteJson<T>(key: string, value: T): void {
	try {
		window.localStorage.setItem(key, JSON.stringify(value));
	} catch (error) {
		console.error("[web-electron-api] persist failed", error);
	}
}

function getAllFiles(): Record<string, BrowserStoredFile> {
	return safeReadJson<Record<string, BrowserStoredFile>>(
		STORAGE_KEYS.files,
		{},
	);
}

function saveAllFiles(files: Record<string, BrowserStoredFile>) {
	safeWriteJson(STORAGE_KEYS.files, files);
}

function makeRepoPath(): string {
	return `web://repo/${crypto.randomUUID()}`;
}

function makeFilePath(repoPath: string, fileName: string): string {
	return `${repoPath}/${fileName}`;
}

function toFileNodeTree(repoPath: string): FileNode[] {
	const allFiles = Object.values(getAllFiles()).filter((f) =>
		f.path.startsWith(`${repoPath}/`),
	);

	const roots: FileNode[] = [];
	const folderMap = new Map<string, FileNode>();

	for (const file of allFiles) {
		const relativePath = file.path.slice(`${repoPath}/`.length);
		if (!relativePath) continue;
		const segments = relativePath.split("/").filter(Boolean);
		let parentPath = repoPath;
		let currentChildren = roots;

		for (let index = 0; index < segments.length; index += 1) {
			const segment = segments[index];
			const isLast = index === segments.length - 1;
			const currentPath = `${parentPath}/${segment}`;

			if (isLast) {
				currentChildren.push({
					id: currentPath,
					name: segment,
					path: currentPath,
					type: "file",
					content: file.content,
				});
				continue;
			}

			let folder = folderMap.get(currentPath);
			if (!folder) {
				folder = {
					id: currentPath,
					name: segment,
					path: currentPath,
					type: "folder",
					children: [],
					isExpanded: true,
				};
				folderMap.set(currentPath, folder);
				currentChildren.push(folder);
			}

			parentPath = currentPath;
			currentChildren = folder.children ?? [];
			folder.children = currentChildren;
		}
	}

	const sortNodes = (nodes: FileNode[]) => {
		nodes.sort((a, b) => {
			if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
			return a.name.localeCompare(b.name, "en");
		});
		for (const node of nodes) {
			if (node.children) sortNodes(node.children);
		}
	};

	sortNodes(roots);
	return roots;
}

async function pickTextFiles(opts: {
	accept?: string;
	multiple?: boolean;
	directory?: boolean;
}): Promise<File[]> {
	return new Promise((resolve) => {
		const input = document.createElement("input");
		input.type = "file";
		if (opts.accept) input.accept = opts.accept;
		if (opts.multiple) input.multiple = true;
		if (opts.directory) {
			(
				input as HTMLInputElement & { webkitdirectory?: boolean }
			).webkitdirectory = true;
		}

		input.onchange = () => {
			const files = input.files ? Array.from(input.files) : [];
			resolve(files);
		};

		input.click();
	});
}

function fileNameFromPath(path: string): string {
	const normalized = path.replace(/\\/g, "/");
	const segments = normalized.split("/");
	return segments[segments.length - 1] || path;
}

export function createWebElectronAPI(): ElectronAPI {
	const api: ElectronAPI = {
		openFile: async (extensions: string[]): Promise<FileResult | null> => {
			const accept = extensions.join(",");
			const files = await pickTextFiles({ accept, multiple: false });
			if (!files.length) return null;

			const pickedFile = files[0];
			const content = await pickedFile.text();
			const repoPath = "web://scratch";
			const path = makeFilePath(
				repoPath,
				`${crypto.randomUUID()}-${pickedFile.name}`,
			);
			const nextFile: BrowserStoredFile = {
				path,
				name: pickedFile.name,
				content,
				repoPath,
				updatedAt: Date.now(),
			};
			const allFiles = getAllFiles();
			allFiles[path] = nextFile;
			saveAllFiles(allFiles);

			return {
				path,
				name: pickedFile.name,
				content,
			};
		},

		createFile: async (
			ext?: string,
			preferredDir?: string,
		): Promise<FileResult | null> => {
			const sanitizedExt = (ext ?? ".md").startsWith(".")
				? (ext ?? ".md")
				: `.${ext}`;
			const defaultName = `untitled${sanitizedExt}`;
			const repoPath = preferredDir?.startsWith("web://")
				? preferredDir
				: "web://scratch";
			const path = makeFilePath(
				repoPath,
				`${crypto.randomUUID()}-${defaultName}`,
			);
			const nextFile: BrowserStoredFile = {
				path,
				name: defaultName,
				content: "",
				repoPath,
				updatedAt: Date.now(),
			};
			const allFiles = getAllFiles();
			allFiles[path] = nextFile;
			saveAllFiles(allFiles);

			return {
				path,
				name: defaultName,
				content: "",
			};
		},

		createFolder: async (
			folderName?: string,
			preferredDir?: string,
		): Promise<{ path: string; name: string } | null> => {
			const safeName = (folderName?.trim() || "New Folder").replace(
				/[\\/:*?"<>|]/g,
				"-",
			);
			const basePath = preferredDir?.startsWith("web://")
				? preferredDir
				: "web://scratch";
			return {
				path: `${basePath}/${safeName}`,
				name: safeName,
			};
		},

		saveFile: async (
			filePath: string,
			content: string,
		): Promise<SaveResult> => {
			const allFiles = getAllFiles();
			const existing = allFiles[filePath];
			allFiles[filePath] = {
				path: filePath,
				name: existing?.name ?? fileNameFromPath(filePath),
				content,
				repoPath: existing?.repoPath ?? "web://scratch",
				updatedAt: Date.now(),
			};
			saveAllFiles(allFiles);
			return { success: true };
		},

		loadAppState: async () => {
			return safeReadJson(STORAGE_KEYS.appState, null);
		},

		saveAppState: async (state) => {
			safeWriteJson(STORAGE_KEYS.appState, state);
			return { success: true };
		},

		renameFile: async (oldPath: string, newName: string) => {
			const allFiles = getAllFiles();
			const entries = Object.entries(allFiles).filter(
				([path]) => path === oldPath || path.startsWith(`${oldPath}/`),
			);

			if (!entries.length) {
				return { success: false, error: "File not found" };
			}

			const oldSegments = oldPath.split("/");
			oldSegments[oldSegments.length - 1] = newName;
			const newPath = oldSegments.join("/");

			for (const [path, file] of entries) {
				delete allFiles[path];
				const targetPath =
					path === oldPath ? newPath : path.replace(oldPath, newPath);
				allFiles[targetPath] = {
					...file,
					path: targetPath,
					name: targetPath === newPath ? newName : file.name,
					updatedAt: Date.now(),
				};
			}

			saveAllFiles(allFiles);
			return { success: true, newPath, newName };
		},

		movePath: async (sourcePath: string, targetFolderPath: string) => {
			const allFiles = getAllFiles();
			const entries = Object.entries(allFiles).filter(
				([path]) => path === sourcePath || path.startsWith(`${sourcePath}/`),
			);

			if (!entries.length) {
				return { success: false, error: "Path not found" };
			}

			const sourceName = fileNameFromPath(sourcePath);
			const newPath = `${targetFolderPath.replace(/\/$/, "")}/${sourceName}`;

			for (const [path, file] of entries) {
				delete allFiles[path];
				const targetPath =
					path === sourcePath ? newPath : path.replace(sourcePath, newPath);
				allFiles[targetPath] = {
					...file,
					path: targetPath,
					name: fileNameFromPath(targetPath),
					updatedAt: Date.now(),
				};
			}

			saveAllFiles(allFiles);
			return { success: true, newPath, newName: sourceName };
		},

		revealInFolder: async () => ({
			success: false,
			error: "Unsupported in web runtime",
		}),

		readAsset: async (relPath: string) => {
			const normalized = relPath.replace(/^\/+/, "");
			const response = await fetch(`./${normalized}`);
			if (!response.ok) {
				throw new Error(`Failed to fetch asset: ${relPath}`);
			}
			return new Uint8Array(await response.arrayBuffer());
		},

		selectFolder: async (): Promise<string | null> => {
			const files = await pickTextFiles({ multiple: true, directory: true });
			if (!files.length) return null;

			const repoPath = makeRepoPath();
			for (const file of files) {
				const withPath = file as File & { webkitRelativePath?: string };
				const relativePath = (withPath.webkitRelativePath || file.name)
					.split("/")
					.slice(1)
					.join("/");
				if (!relativePath) continue;
				const content = await file.text();
				const fullPath = makeFilePath(repoPath, relativePath);
				const allFiles = getAllFiles();
				allFiles[fullPath] = {
					path: fullPath,
					name: file.name,
					content,
					repoPath,
					updatedAt: Date.now(),
				};
				saveAllFiles(allFiles);
			}

			return repoPath;
		},

		readFile: async (filePath: string) => {
			const allFiles = getAllFiles();
			const file = allFiles[filePath];
			if (!file) {
				return { content: "", error: "File not found" };
			}
			return { content: file.content };
		},

		scanDirectory: async (
			path: string,
		): Promise<ScanDirectoryResult | null> => {
			const nodes = toFileNodeTree(path);
			return { nodes, expandedFolders: [] };
		},

		loadRepos: async (): Promise<Repo[]> => {
			return safeReadJson<Repo[]>(STORAGE_KEYS.repos, []);
		},

		saveRepos: async (repos: Repo[]) => {
			safeWriteJson(STORAGE_KEYS.repos, repos);
		},

		loadWorkspaceMetadata: async (
			repoPath: string,
		): Promise<RepoMetadata | null> => {
			const allMetadata = safeReadJson<Record<string, RepoMetadata>>(
				STORAGE_KEYS.workspaceMetadata,
				{},
			);
			return allMetadata[repoPath] ?? null;
		},

		saveWorkspaceMetadata: async (repoPath: string, metadata: RepoMetadata) => {
			const allMetadata = safeReadJson<Record<string, RepoMetadata>>(
				STORAGE_KEYS.workspaceMetadata,
				{},
			);
			allMetadata[repoPath] = metadata;
			safeWriteJson(STORAGE_KEYS.workspaceMetadata, allMetadata);
		},

		deleteFile: async (filePath: string) => {
			const allFiles = getAllFiles();
			if (!allFiles[filePath]) {
				return { success: false, error: "File not found" };
			}
			delete allFiles[filePath];
			saveAllFiles(allFiles);
			return { success: true };
		},

		startRepoWatch: async () => ({ success: true }),

		stopRepoWatch: async () => ({ success: true }),

		onRepoFsChanged: () => () => {},

		checkForUpdates: async () => ({
			supported: false,
			message: "Unsupported in web runtime",
		}),

		installUpdate: async () => ({
			ok: false,
			message: "Unsupported in web runtime",
		}),

		getAppVersion: async () => "web",

		fetchReleasesFeed: async () => ({
			success: false,
			error: "Unsupported in web runtime",
		}),

		onUpdateEvent: () => () => {},

		loadGlobalSettings: async () => {
			const data = safeReadJson<unknown>(STORAGE_KEYS.globalSettings, null);
			return { success: true, data: data ?? {} };
		},

		saveGlobalSettings: async (settings: unknown) => {
			safeWriteJson(STORAGE_KEYS.globalSettings, settings);
			return { success: true };
		},
	};

	return api;
}

export function ensureElectronApiInWebRuntime() {
	const maybeWindow = window as Window & {
		electronAPI?: ElectronAPI;
	};

	if (maybeWindow.electronAPI) return;

	maybeWindow.electronAPI = createWebElectronAPI();
}
