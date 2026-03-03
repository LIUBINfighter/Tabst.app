import { describe, expect, it } from "vitest";
import { isDevelopmentRuntime } from "./runtime-mode";

describe("isDevelopmentRuntime", () => {
	it("returns false when production window mode is forced", () => {
		expect(
			isDevelopmentRuntime({
				nodeEnv: "development",
				isPackaged: false,
				forceProductionWindow: "1",
			}),
		).toBe(false);
	});

	it("returns true in development env when not forced", () => {
		expect(
			isDevelopmentRuntime({
				nodeEnv: "development",
				isPackaged: true,
			}),
		).toBe(true);
	});

	it("returns true for unpackaged app in non-development env", () => {
		expect(
			isDevelopmentRuntime({
				nodeEnv: "production",
				isPackaged: false,
			}),
		).toBe(true);
	});

	it("returns false for packaged production app", () => {
		expect(
			isDevelopmentRuntime({
				nodeEnv: "production",
				isPackaged: true,
			}),
		).toBe(false);
	});
});
