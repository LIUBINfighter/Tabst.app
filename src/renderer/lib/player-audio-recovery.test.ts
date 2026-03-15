import { describe, expect, it, vi } from "vitest";
import { prepareAlphaTabAudioForPlayback } from "./player-audio-recovery";

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
