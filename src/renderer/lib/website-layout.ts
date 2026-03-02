export const WEBSITE_MOBILE_BREAKPOINT = 768;

interface WebsiteMobileLayoutOptions {
	isWebRuntime: boolean;
	viewportWidth: number;
}

interface WebsiteMobilePreviewStackOptions extends WebsiteMobileLayoutOptions {
	enjoyMode: boolean;
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
