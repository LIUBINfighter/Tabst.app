import { describe, expect, it } from "vitest";
import {
	clampAppZoomFactor,
	getAppZoomAction,
	getNextAppZoomFactor,
} from "./app-zoom";

describe("app zoom helpers", () => {
	it("detects browser-style zoom shortcuts", () => {
		expect(getAppZoomAction({ metaKey: true, ctrlKey: false, key: "+" })).toBe(
			"in",
		);
		expect(getAppZoomAction({ metaKey: false, ctrlKey: true, key: "=" })).toBe(
			"in",
		);
		expect(getAppZoomAction({ metaKey: true, ctrlKey: false, key: "-" })).toBe(
			"out",
		);
		expect(getAppZoomAction({ metaKey: false, ctrlKey: true, key: "0" })).toBe(
			"reset",
		);
		expect(
			getAppZoomAction({ metaKey: false, ctrlKey: false, key: "+" }),
		).toBeNull();
	});

	it("clamps and steps zoom factor predictably", () => {
		expect(clampAppZoomFactor(5)).toBe(3);
		expect(clampAppZoomFactor(0.1)).toBe(0.5);
		expect(getNextAppZoomFactor(1, "in")).toBe(1.1);
		expect(getNextAppZoomFactor(1, "out")).toBe(0.9);
		expect(getNextAppZoomFactor(2.4, "reset")).toBe(1);
	});
});
