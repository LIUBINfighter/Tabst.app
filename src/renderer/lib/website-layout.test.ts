import { describe, expect, it } from "vitest";
import {
	isWebsiteMobileLayout,
	isWebsiteMobilePreviewStack,
	WEBSITE_MOBILE_BREAKPOINT,
} from "./website-layout";

describe("website mobile layout", () => {
	it("enables mobile layout for web runtime under breakpoint", () => {
		expect(
			isWebsiteMobileLayout({
				isWebRuntime: true,
				viewportWidth: WEBSITE_MOBILE_BREAKPOINT - 1,
			}),
		).toBe(true);
	});

	it("disables mobile layout at or above breakpoint", () => {
		expect(
			isWebsiteMobileLayout({
				isWebRuntime: true,
				viewportWidth: WEBSITE_MOBILE_BREAKPOINT,
			}),
		).toBe(false);
	});

	it("disables mobile layout when not running on website", () => {
		expect(
			isWebsiteMobileLayout({
				isWebRuntime: false,
				viewportWidth: 390,
			}),
		).toBe(false);
	});
});

describe("website mobile preview stack", () => {
	it("stacks preview only when website mobile layout is enabled and not enjoy mode", () => {
		expect(
			isWebsiteMobilePreviewStack({
				isWebRuntime: true,
				viewportWidth: 390,
				enjoyMode: false,
			}),
		).toBe(true);

		expect(
			isWebsiteMobilePreviewStack({
				isWebRuntime: true,
				viewportWidth: 390,
				enjoyMode: true,
			}),
		).toBe(false);
	});
});
