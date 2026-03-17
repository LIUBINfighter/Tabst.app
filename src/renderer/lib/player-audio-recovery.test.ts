import { describe, expect, it, vi } from "vitest";
import {
	prepareAlphaTabAudioForPlayback,
	primeAlphaTabAudioOnUserGesture,
} from "./player-audio-recovery";

describe("primeAlphaTabAudioOnUserGesture", () => {
	it("attempts immediate activation and context resume", async () => {
		const activate = vi.fn();
		const resume = vi.fn(async () => {});

		const didAttempt = primeAlphaTabAudioOnUserGesture({
			player: {
				output: {
					context: {
						state: "suspended",
						resume,
					},
					activate,
				},
			},
		});

		expect(didAttempt).toBe(true);
		expect(activate).toHaveBeenCalledTimes(1);
		expect(activate).toHaveBeenCalledWith(expect.any(Function));
		expect(resume).toHaveBeenCalledTimes(1);
	});

	it("safely handles activation throw and resume rejection", async () => {
		const activate = vi.fn(() => {
			throw new Error("activation-failed");
		});
		const resume = vi.fn(async () => {
			throw new Error("resume-rejected");
		});

		expect(() =>
			primeAlphaTabAudioOnUserGesture({
				player: {
					output: {
						context: {
							state: "suspended",
							resume,
						},
						activate,
					},
				},
			}),
		).not.toThrow();

		expect(activate).toHaveBeenCalledTimes(1);
		expect(activate).toHaveBeenCalledWith(expect.any(Function));
		expect(resume).toHaveBeenCalledTimes(1);

		await Promise.resolve();
	});

	it("no-ops when no output exists", () => {
		const didAttempt = primeAlphaTabAudioOnUserGesture({});

		expect(didAttempt).toBe(false);
	});
});

describe("prepareAlphaTabAudioForPlayback", () => {
	it("resumes suspended audio output before playback", async () => {
		const activate = vi.fn((resumedCallback?: () => void) => {
			output.context.state = "running";
			resumedCallback?.();
		});
		const output = {
			context: {
				state: "suspended",
				resume: vi.fn(async () => {
					output.context.state = "running";
				}),
			},
			activate,
		};

		const result = await prepareAlphaTabAudioForPlayback({
			player: { output },
		});

		expect(activate).toHaveBeenCalledTimes(1);
		expect(result.didAttemptActivation).toBe(true);
		expect(result.finalState).toBe("running");
	});

	it("still activates running audio output to refresh playback path", async () => {
		const activate = vi.fn();
		const result = await prepareAlphaTabAudioForPlayback({
			player: {
				output: {
					context: {
						state: "running",
					},
					activate,
				},
			},
		});

		expect(activate).toHaveBeenCalledTimes(1);
		expect(result.finalState).toBe("running");
	});

	it("safely no-ops when no player output is available", async () => {
		const result = await prepareAlphaTabAudioForPlayback({});

		expect(result.didAttemptActivation).toBe(false);
		expect(result.finalState).toBeNull();
	});

	it("resumes suspended audio context even without activate support", async () => {
		const resume = vi.fn(async () => {
			context.state = "running";
		});
		const context = {
			state: "suspended",
			resume,
		};

		const result = await prepareAlphaTabAudioForPlayback({
			player: {
				output: {
					context,
				},
			},
		});

		expect(resume).toHaveBeenCalledTimes(1);
		expect(result.didAttemptActivation).toBe(true);
		expect(result.finalState).toBe("running");
	});
});
