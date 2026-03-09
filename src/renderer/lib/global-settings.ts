import type { RepoMetadata, RepoPreferences } from "../types/repo";
import type { GlobalSettings } from "../types/settings";
import { getActiveRepoContext } from "./active-repo-context";
import {
	loadWorkspaceMetadata,
	updateWorkspaceMetadata,
} from "./workspace-metadata-store";

const DEFAULT_SETTINGS: GlobalSettings = {
	locale: "zh-cn",
	deleteBehavior: "ask-every-time",
	theme: {
		uiThemeId: "github",
		editorThemeId: "github",
		mode: "system",
	},
};

function toSettingsFromPreferences(
	preferences?: RepoPreferences,
): GlobalSettings {
	return {
		locale: preferences?.locale ?? DEFAULT_SETTINGS.locale,
		deleteBehavior:
			preferences?.deleteBehavior ?? DEFAULT_SETTINGS.deleteBehavior,
		theme: {
			uiThemeId:
				preferences?.theme?.uiThemeId ??
				DEFAULT_SETTINGS.theme?.uiThemeId ??
				"github",
			editorThemeId:
				preferences?.theme?.editorThemeId ??
				DEFAULT_SETTINGS.theme?.editorThemeId ??
				"github",
			mode:
				preferences?.theme?.mode ?? DEFAULT_SETTINGS.theme?.mode ?? "system",
		},
	};
}

function mergeSettingsIntoPreferences(
	existing: RepoPreferences | undefined,
	partial: Partial<GlobalSettings>,
): RepoPreferences {
	const current = toSettingsFromPreferences(existing);
	return {
		...(existing ?? {}),
		locale: partial.locale ?? current.locale,
		deleteBehavior: partial.deleteBehavior ?? current.deleteBehavior,
		theme: partial.theme ?? current.theme,
	};
}

async function loadLegacyGlobalSettings(): Promise<GlobalSettings | null> {
	if (!window.desktopAPI?.loadGlobalSettings) return null;

	try {
		const response = await window.desktopAPI.loadGlobalSettings();
		if (
			!response?.success ||
			!response.data ||
			typeof response.data !== "object"
		) {
			return null;
		}

		return {
			locale:
				(response.data as GlobalSettings).locale ?? DEFAULT_SETTINGS.locale,
			deleteBehavior:
				(response.data as GlobalSettings).deleteBehavior ??
				DEFAULT_SETTINGS.deleteBehavior,
			theme: (response.data as GlobalSettings).theme ?? DEFAULT_SETTINGS.theme,
		};
	} catch (error) {
		console.error("Failed to load legacy global settings:", error);
		return null;
	}
}

export async function loadGlobalSettings(): Promise<GlobalSettings> {
	const activeRepo = getActiveRepoContext();
	if (!activeRepo) {
		return (await loadLegacyGlobalSettings()) ?? DEFAULT_SETTINGS;
	}

	if (!window.desktopAPI?.loadWorkspaceMetadata) {
		return DEFAULT_SETTINGS;
	}

	try {
		const metadata = await loadWorkspaceMetadata(activeRepo.path);
		if (!metadata) {
			return (await loadLegacyGlobalSettings()) ?? DEFAULT_SETTINGS;
		}
		const legacy = await loadLegacyGlobalSettings();
		const workspaceSettings = toSettingsFromPreferences(metadata.preferences);

		return {
			locale:
				metadata.preferences?.locale ??
				legacy?.locale ??
				workspaceSettings.locale,
			deleteBehavior:
				metadata.preferences?.deleteBehavior ??
				legacy?.deleteBehavior ??
				workspaceSettings.deleteBehavior,
			theme:
				metadata.preferences?.theme ?? legacy?.theme ?? workspaceSettings.theme,
		};
	} catch (error) {
		console.error("Failed to load workspace settings:", error);
		return (await loadLegacyGlobalSettings()) ?? DEFAULT_SETTINGS;
	}
}

export async function saveGlobalSettings(
	partial: Partial<GlobalSettings>,
): Promise<boolean> {
	const activeRepo = getActiveRepoContext();
	if (!activeRepo) {
		return false;
	}

	if (
		!window.desktopAPI?.loadWorkspaceMetadata ||
		!window.desktopAPI?.saveWorkspaceMetadata
	) {
		return false;
	}

	try {
		await updateWorkspaceMetadata(activeRepo, (existingMetadata) => {
			const nextMetadata: RepoMetadata = {
				id: existingMetadata?.id ?? activeRepo.id,
				name: existingMetadata?.name ?? activeRepo.name,
				openedAt: Date.now(),
				expandedFolders: existingMetadata?.expandedFolders ?? [],
				preferences: mergeSettingsIntoPreferences(
					existingMetadata?.preferences,
					partial,
				),
				activeFilePath: existingMetadata?.activeFilePath ?? null,
				workspaceMode: existingMetadata?.workspaceMode,
				activeSettingsPageId: existingMetadata?.activeSettingsPageId ?? null,
				activeTutorialId: existingMetadata?.activeTutorialId ?? null,
				tutorialAudience: existingMetadata?.tutorialAudience,
			};

			return nextMetadata;
		});
		return true;
	} catch (error) {
		console.error("Failed to save workspace settings:", error);
		return false;
	}
}
