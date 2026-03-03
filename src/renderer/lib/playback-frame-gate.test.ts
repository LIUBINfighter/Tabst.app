import { describe, expect, it } from "vitest";
import {
	createPlaybackFrameGate,
	type FrameGateScheduler,
} from "./playback-frame-gate";

function createManualScheduler(): FrameGateScheduler & {
	step(ms?: number): void;
	queueSize(): number;
} {
	let now = 0;
	let seq = 0;
	const queue = new Map<number, () => void>();

	return {
		request(callback) {
			seq += 1;
			queue.set(seq, callback);
			return seq;
		},
		cancel(id) {
			queue.delete(id);
		},
		now() {
			return now;
		},
		step(ms = 16) {
			now += ms;
			const tasks = [...queue.values()];
			queue.clear();
			for (const task of tasks) {
				task();
			}
		},
		queueSize() {
			return queue.size;
		},
	};
}

describe("createPlaybackFrameGate", () => {
	it("coalesces multiple pushes in one frame to latest value", () => {
		const scheduler = createManualScheduler();
		const flushed: number[] = [];

		const gate = createPlaybackFrameGate(
			(value: number) => {
				flushed.push(value);
			},
			{ scheduler },
		);

		gate.push(1);
		gate.push(2);
		gate.push(3);

		expect(gate.hasPending()).toBe(true);
		expect(scheduler.queueSize()).toBe(1);

		scheduler.step();

		expect(flushed).toEqual([3]);
		expect(gate.hasPending()).toBe(false);
	});

	it("honors minIntervalMs by delaying flush to later frame", () => {
		const scheduler = createManualScheduler();
		const flushed: number[] = [];

		const gate = createPlaybackFrameGate(
			(value: number) => {
				flushed.push(value);
			},
			{ scheduler, minIntervalMs: 30 },
		);

		gate.push(10);
		scheduler.step(16);
		expect(flushed).toEqual([10]);

		gate.push(11);
		scheduler.step(8);
		expect(flushed).toEqual([10]);

		scheduler.step(16);
		expect(flushed).toEqual([10]);

		scheduler.step(16);
		expect(flushed).toEqual([10, 11]);
	});

	it("cancels pending work on dispose", () => {
		const scheduler = createManualScheduler();
		const flushed: number[] = [];

		const gate = createPlaybackFrameGate(
			(value: number) => {
				flushed.push(value);
			},
			{ scheduler },
		);

		gate.push(99);
		expect(scheduler.queueSize()).toBe(1);

		gate.dispose();
		expect(gate.hasPending()).toBe(false);
		expect(scheduler.queueSize()).toBe(0);

		scheduler.step();
		expect(flushed).toEqual([]);
	});
});
