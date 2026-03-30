export const WEBSITE_MOBILE_BREAKPOINT = 768;

export type WorkspaceMode =
	| "editor"
	| "enjoy"
	| "tutorial"
	| "settings"
	| "git"
	| "dataset";

interface WebsiteMobileLayoutOptions {
	isWebRuntime: boolean;
	viewportWidth: number;
}

interface WebsiteMobilePreviewStackOptions extends WebsiteMobileLayoutOptions {
	enjoyMode: boolean;
}

interface WebsiteMobileTransportOnlyOptions extends WebsiteMobileLayoutOptions {
	workspaceMode: WorkspaceMode;
	activeSettingsPageId: string | null;
	isAtexFile: boolean;
}

export function isWebsiteMobileLayout({
	isWebRuntime,
	viewportWidth,
}: WebsiteMobileLayoutOptions): boolean {
	return isWebRuntime && viewportWidth < WEBSITE_MOBILE_BREAKPOINT;
}

export function isWebsiteMobilePreviewStack({
	isWebRuntime,
	viewportWidth,
	enjoyMode,
}: WebsiteMobilePreviewStackOptions): boolean {
	return isWebsiteMobileLayout({ isWebRuntime, viewportWidth }) && !enjoyMode;
}

export function shouldUseWebsiteMobileTransportOnly({
	isWebRuntime,
	viewportWidth,
	workspaceMode,
	activeSettingsPageId,
	isAtexFile,
}: WebsiteMobileTransportOnlyOptions): boolean {
	if (!isWebsiteMobileLayout({ isWebRuntime, viewportWidth })) return false;

	if (workspaceMode === "settings") {
		return activeSettingsPageId === "playback";
	}

	if (workspaceMode === "editor" || workspaceMode === "enjoy") {
		return isAtexFile;
	}

	return false;
}
