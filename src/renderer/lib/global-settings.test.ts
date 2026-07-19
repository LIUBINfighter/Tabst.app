import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RepoMetadata } from "../types/repo";
import { setActiveRepoContext } from "./active-repo-context";
import { loadGlobalSettings, saveGlobalSettings } from "./global-settings";

interface TestDesktopApi {
	loadWorkspaceMetadata: ReturnType<typeof vi.fn>;
	saveWorkspaceMetadata: ReturnType<typeof vi.fn>;
	loadGlobalSettings: ReturnType<typeof vi.fn>;
	saveGlobalSettings: ReturnType<typeof vi.fn>;
}

function installDesktopApi(api: TestDesktopApi) {
	Object.defineProperty(globalThis, "window", {
		value: {
			desktopAPI: api,
		},
		configurable: true,
	});
}

describe("workspace-backed global settings", () => {
	let desktopApi: TestDesktopApi;

	beforeEach(() => {
		desktopApi = {
			loadWorkspaceMetadata: vi.fn(),
			saveWorkspaceMetadata: vi.fn(),
			loadGlobalSettings: vi.fn(),
			saveGlobalSettings: vi.fn(),
		};
		installDesktopApi(desktopApi);
		setActiveRepoContext(null);
	});

	it("loads settings from active repo workspace metadata", async () => {
		setActiveRepoContext({
			id: "repo-1",
			name: "Demo",
			path: "/tmp/demo",
		});

		desktopApi.loadWorkspaceMetadata.mockResolvedValue({
			id: "repo-1",
			name: "Demo",
			openedAt: 1,
			expandedFolders: [],
			preferences: {
				locale: "en",
				deleteBehavior: "repo-trash",
				theme: {
					uiThemeId: "catppuccin",
					editorThemeId: "catppuccin",
					mode: "dark",
				},
			},
		} satisfies RepoMetadata);

		const result = await loadGlobalSettings();

		expect(result).toEqual({
			locale: "en",
			deleteBehavior: "repo-trash",
			showButtonTooltips: true,
			theme: {
				uiThemeId: "catppuccin",
				editorThemeId: "catppuccin",
				mode: "dark",
			},
		});
		expect(desktopApi.loadGlobalSettings).toHaveBeenCalledTimes(1);
	});

	it("falls back to legacy settings when no active repo exists", async () => {
		desktopApi.loadGlobalSettings.mockResolvedValue({
			success: true,
			data: {
				locale: "en",
				deleteBehavior: "system-trash",
				theme: {
					uiThemeId: "github",
					editorThemeId: "github",
					mode: "light",
				},
			},
		});

		const result = await loadGlobalSettings();

		expect(result.locale).toBe("en");
		expect(result.deleteBehavior).toBe("system-trash");
		expect(result.showButtonTooltips).toBe(true);
		expect(desktopApi.loadGlobalSettings).toHaveBeenCalledTimes(1);
	});

	it("loads the tooltip preference from global settings", async () => {
		desktopApi.loadGlobalSettings.mockResolvedValue({
			success: true,
			data: {
				showButtonTooltips: false,
			},
		});

		const result = await loadGlobalSettings();

		expect(result.showButtonTooltips).toBe(false);
	});

	it("saves the tooltip preference globally without dropping other fields", async () => {
		desktopApi.loadGlobalSettings.mockResolvedValue({
			success: true,
			data: {
				locale: "en",
				futureSetting: "preserved",
			},
		});
		desktopApi.saveGlobalSettings.mockResolvedValue({ success: true });

		const ok = await saveGlobalSettings({ showButtonTooltips: false });

		expect(ok).toBe(true);
		expect(desktopApi.saveGlobalSettings).toHaveBeenCalledWith({
			locale: "en",
			futureSetting: "preserved",
			showButtonTooltips: false,
		});
		expect(desktopApi.saveWorkspaceMetadata).not.toHaveBeenCalled();
	});

	it("saves merged settings into workspace metadata", async () => {
		setActiveRepoContext({
			id: "repo-2",
			name: "Workspace",
			path: "/tmp/workspace",
		});

		desktopApi.loadWorkspaceMetadata.mockResolvedValue({
			id: "repo-2",
			name: "Workspace",
			openedAt: 1,
			expandedFolders: ["/tmp/workspace/docs"],
			preferences: {
				deleteBehavior: "ask-every-time",
				theme: {
					uiThemeId: "github",
					editorThemeId: "github",
					mode: "system",
				},
				commandShortcuts: {
					"file.save": ["mod+s"],
				},
			},
			activeFilePath: "/tmp/workspace/a.atex",
			workspaceMode: "editor",
			activeSettingsPageId: null,
			activeTutorialId: "user-readme",
			tutorialAudience: "user",
		} satisfies RepoMetadata);
		desktopApi.saveWorkspaceMetadata.mockResolvedValue(undefined);

		const ok = await saveGlobalSettings({ locale: "en" });

		expect(ok).toBe(true);
		expect(desktopApi.saveWorkspaceMetadata).toHaveBeenCalledTimes(1);
		const [, savedMetadata] = desktopApi.saveWorkspaceMetadata.mock.calls[0];
		expect(savedMetadata.preferences.locale).toBe("en");
		expect(savedMetadata.preferences.commandShortcuts).toEqual({
			"file.save": ["mod+s"],
		});
		expect(savedMetadata.activeFilePath).toBe("/tmp/workspace/a.atex");
	});
});
