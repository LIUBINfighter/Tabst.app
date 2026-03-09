import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RepoMetadata } from "../types/repo";
import { updateWorkspaceMetadata } from "./workspace-metadata-store";

describe("workspace metadata store queue", () => {
	beforeEach(() => {
		Object.defineProperty(globalThis, "window", {
			value: {
				desktopAPI: {
					loadWorkspaceMetadata: vi.fn(),
					saveWorkspaceMetadata: vi.fn(),
				},
			},
			configurable: true,
		});
	});

	it("serializes updates for same repo path to avoid lost fields", async () => {
		const baseMetadata: RepoMetadata = {
			id: "repo-1",
			name: "Workspace",
			openedAt: 1,
			expandedFolders: [],
			preferences: {},
			activeFilePath: null,
			workspaceMode: "editor",
			activeSettingsPageId: null,
			activeTutorialId: "user-readme",
			tutorialAudience: "user",
		};
		let persisted: RepoMetadata | null = baseMetadata;

		window.desktopAPI.loadWorkspaceMetadata = vi
			.fn()
			.mockImplementation(async () => persisted);
		window.desktopAPI.saveWorkspaceMetadata = vi
			.fn()
			.mockImplementation(async (_repoPath: string, next: RepoMetadata) => {
				persisted = next;
			});

		await Promise.all([
			updateWorkspaceMetadata(
				{ id: "repo-1", name: "Workspace", path: "/tmp/workspace" },
				(existing) => ({
					...(existing ?? persisted ?? baseMetadata),
					preferences: {
						...(existing?.preferences ?? {}),
						a: 1,
					},
				}),
			),
			updateWorkspaceMetadata(
				{ id: "repo-1", name: "Workspace", path: "/tmp/workspace" },
				(existing) => ({
					...(existing ?? persisted ?? baseMetadata),
					preferences: {
						...(existing?.preferences ?? {}),
						b: 2,
					},
				}),
			),
		]);

		expect(persisted?.preferences).toEqual({ a: 1, b: 2 });
	});
});
