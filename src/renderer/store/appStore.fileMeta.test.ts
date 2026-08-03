import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => {
	const desktopApi = {
		loadGlobalSettings: vi.fn(async () => ({ success: true, data: {} })),
		saveGlobalSettings: vi.fn(async () => ({ success: true })),
		saveFile: vi.fn(async () => ({ success: true })),
		readFile: vi.fn(async () => ({ content: "", error: null })),
		renameFile: vi.fn(),
		loadExternalSoundFontSettings: vi.fn(async () => ({
			success: true,
			configured: false,
			valid: false,
		})),
	};
	return { desktopApi };
});

const { useAppStore } = await import("./appStore");

const BASE_CONTENT = `at.meta.title="Test"`;

describe("fileMetaByPath", () => {
	beforeEach(() => {
		vi.stubGlobal("window", {
			desktopAPI: hoisted.desktopApi,
			setTimeout: (callback: () => void) => setTimeout(callback, 0),
			clearTimeout,
		});
		useAppStore.setState({
			files: [],
			fileMetaByPath: {},
			activeFileId: null,
			repos: [],
			activeRepoId: null,
			fileTree: [],
		});
		vi.clearAllMocks();
	});

	it("parses ATDOC meta from addFile content into fileMetaByPath", () => {
		const content = `${BASE_CONTENT}\nat.meta.class="lesson"\nat.meta.tag="guitar"`;
		const store = useAppStore.getState();
		store.addFile({
			id: "/repo/song.atex",
			name: "song.atex",
			path: "/repo/song.atex",
			content,
			contentLoaded: true,
		});

		const meta = useAppStore.getState().fileMetaByPath["/repo/song.atex"];
		expect(meta.metaClass).toEqual(["lesson"]);
		expect(meta.metaTags).toEqual(["guitar"]);
		expect(meta.metaTitle).toBe("Test");
	});

	it("updates fileMetaByPath when content changes", () => {
		const store = useAppStore.getState();
		store.addFile({
			id: "/repo/song.atex",
			name: "song.atex",
			path: "/repo/song.atex",
			content: BASE_CONTENT,
			contentLoaded: true,
		});
		store.updateFileContent(
			"/repo/song.atex",
			`${BASE_CONTENT}\nat.meta.tag="arrangement"`,
		);

		const meta = useAppStore.getState().fileMetaByPath["/repo/song.atex"];
		expect(meta.metaTags).toEqual(["arrangement"]);
		expect(meta.metaClass).toBeUndefined();
	});

	it("merges partial meta from setFileMetaByPath", () => {
		const store = useAppStore.getState();
		store.setFileMetaByPath("/repo/song.atex", {
			metaTags: ["guitar"],
			metaStatus: "active",
		});
		store.setFileMetaByPath("/repo/song.atex", {
			metaTitle: "My Title",
		});

		const meta = useAppStore.getState().fileMetaByPath["/repo/song.atex"];
		expect(meta.metaTags).toEqual(["guitar"]);
		expect(meta.metaStatus).toBe("active");
		expect(meta.metaTitle).toBe("My Title");
	});

	it("removes fileMetaByPath when the opened file is removed", () => {
		const store = useAppStore.getState();
		store.addFile({
			id: "/repo/song.atex",
			name: "song.atex",
			path: "/repo/song.atex",
			content: BASE_CONTENT,
			contentLoaded: true,
		});
		expect(
			useAppStore.getState().fileMetaByPath["/repo/song.atex"],
		).toBeDefined();

		store.removeFile("/repo/song.atex");
		expect(
			useAppStore.getState().fileMetaByPath["/repo/song.atex"],
		).toBeUndefined();
	});

	it("keeps opened files independent of a tree refresh", async () => {
		hoisted.desktopApi.scanDirectory = vi.fn(async () => ({
			nodes: [
				{
					id: "/repo/other.atex",
					name: "other.atex",
					path: "/repo/other.atex",
					type: "file",
				},
			],
			expandedFolders: [],
		}));
		const store = useAppStore.getState();
		store.addFile({
			id: "/repo/song.atex",
			name: "song.atex",
			path: "/repo/song.atex",
			content: BASE_CONTENT,
			contentLoaded: true,
		});
		useAppStore.setState({
			activeRepoId: "repo-1",
			repos: [{ id: "repo-1", path: "/repo", name: "repo" }],
		});

		await store.refreshFileTree();

		const state = useAppStore.getState();
		expect(state.files).toHaveLength(0);
		expect(state.fileTree).toHaveLength(1);
	});

	it("migrates fileMetaByPath keys on rename", async () => {
		hoisted.desktopApi.renameFile = vi.fn(async () => ({
			success: true,
			newPath: "/repo/renamed.atex",
			newName: "renamed.atex",
		}));
		const store = useAppStore.getState();
		store.addFile({
			id: "/repo/song.atex",
			name: "song.atex",
			path: "/repo/song.atex",
			content: `${BASE_CONTENT}\nat.meta.tag="guitar"`,
			contentLoaded: true,
		});
		useAppStore.setState({
			activeRepoId: "repo-1",
			repos: [{ id: "repo-1", path: "/repo", name: "repo" }],
		});

		const renamed = await store.renameFile("/repo/song.atex", "renamed");
		expect(renamed).toBe(true);

		const state = useAppStore.getState();
		expect(state.fileMetaByPath["/repo/song.atex"]).toBeUndefined();
		expect(state.fileMetaByPath["/repo/renamed.atex"]?.metaTags).toEqual([
			"guitar",
		]);
	});

	it("keeps the fileMetaByPath reference stable when values do not change", () => {
		const store = useAppStore.getState();
		store.setFileMetaByPath("/repo/song.atex", {
			metaTags: ["guitar"],
			metaStatus: "active",
		});
		const before = useAppStore.getState().fileMetaByPath;

		store.setFileMetaByPath("/repo/song.atex", {
			metaTags: ["guitar"],
			metaStatus: "active",
		});
		store.setFileMetaByPath("/repo/song.atex", {
			metaTags: ["guitar"],
		});

		expect(useAppStore.getState().fileMetaByPath).toBe(before);
	});

	it("records an empty meta entry for content without ATDOC meta", () => {
		const store = useAppStore.getState();
		store.setFileMetaByPath("/repo/plain.atex", {});

		expect(
			useAppStore.getState().fileMetaByPath["/repo/plain.atex"],
		).toBeDefined();
	});

	it("keeps cached meta when addFile has no parsed meta fields", () => {
		const store = useAppStore.getState();
		store.setFileMetaByPath("/repo/song.atex", {
			metaTags: ["guitar"],
			metaStatus: "active",
		});
		store.addFile({
			id: "/repo/song.atex",
			name: "song.atex",
			path: "/repo/song.atex",
			content: "",
			contentLoaded: true,
		});

		const meta = useAppStore.getState().fileMetaByPath["/repo/song.atex"];
		expect(meta.metaTags).toEqual(["guitar"]);
		expect(meta.metaStatus).toBe("active");
	});

	it("keeps the fileMetaByPath reference stable when updateFileContent meta is unchanged", () => {
		const store = useAppStore.getState();
		store.addFile({
			id: "/repo/song.atex",
			name: "song.atex",
			path: "/repo/song.atex",
			content: `${BASE_CONTENT}\nat.meta.tag="guitar"`,
			contentLoaded: true,
		});
		const before = useAppStore.getState().fileMetaByPath;

		store.updateFileContent(
			"/repo/song.atex",
			`${BASE_CONTENT}\nat.meta.tag="guitar"\n\ntabstime`,
		);

		expect(useAppStore.getState().fileMetaByPath).toBe(before);
	});

	it("clears cached meta when updateFileContent drops the ATDOC block", () => {
		const store = useAppStore.getState();
		store.addFile({
			id: "/repo/song.atex",
			name: "song.atex",
			path: "/repo/song.atex",
			content: `${BASE_CONTENT}\nat.meta.tag="guitar"`,
			contentLoaded: true,
		});

		store.updateFileContent("/repo/song.atex", "\n\njust music");

		const meta = useAppStore.getState().fileMetaByPath["/repo/song.atex"];
		expect(meta.metaTags).toBeUndefined();
		expect(meta.metaTitle).toBeUndefined();
	});
});
