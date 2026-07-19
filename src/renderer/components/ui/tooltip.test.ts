import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const tooltipState = vi.hoisted(() => ({
	showButtonTooltips: true,
	contentRender: vi.fn(),
}));

vi.mock("@/renderer/store/appStore", () => ({
	useAppStore: (
		selector: (state: { showButtonTooltips: boolean }) => unknown,
	) => selector(tooltipState),
}));

vi.mock("@radix-ui/react-tooltip", async () => {
	const ReactModule = await import("react");
	const Passthrough = ({ children }: { children?: React.ReactNode }) =>
		ReactModule.createElement(ReactModule.Fragment, null, children);
	const Content = ReactModule.forwardRef<
		HTMLDivElement,
		{ children?: React.ReactNode }
	>(({ children }, ref) => {
		tooltipState.contentRender();
		return ReactModule.createElement("div", { ref }, children);
	});

	return {
		Provider: Passthrough,
		Root: Passthrough,
		Trigger: Passthrough,
		Content,
	};
});

import { TooltipContent } from "./tooltip";

describe("TooltipContent visibility", () => {
	beforeEach(() => {
		tooltipState.showButtonTooltips = true;
		tooltipState.contentRender.mockClear();
	});

	it("renders tooltip content when button hints are enabled", () => {
		const markup = renderToStaticMarkup(
			React.createElement(TooltipContent, null, "Visible hint"),
		);

		expect(markup).toContain("Visible hint");
		expect(tooltipState.contentRender).toHaveBeenCalledTimes(1);
	});

	it("suppresses tooltip content when button hints are disabled", () => {
		tooltipState.showButtonTooltips = false;

		const markup = renderToStaticMarkup(
			React.createElement(TooltipContent, null, "Hidden hint"),
		);

		expect(markup).toBe("");
		expect(tooltipState.contentRender).not.toHaveBeenCalled();
	});
});
