import { EditorState } from "@codemirror/state";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EditorCursorInfo } from "../store/appStore";
import { createCursorTrackingExtension } from "./alphatex-cursor-tracking";

const DOC = '\\title "Test"\n2.2 3.4 4.5|2.2 3.4';

interface FakeUpdate {
	selectionSet: boolean;
	docChanged: boolean;
	state: EditorState;
}

let rafQueue: Array<() => void>;

function flushRaf(): void {
	while (rafQueue.length > 0) {
		rafQueue.shift()?.();
	}
}

function createTrackedView(
	onCursorChange: (cursor: EditorCursorInfo | null) => void,
): (anchor: number) => void {
	const extension = createCursorTrackingExtension(
		onCursorChange,
	) as unknown as {
		value: (update: FakeUpdate) => void;
	};
	let state = EditorState.create({ doc: DOC });
	return (anchor: number) => {
		state = state.update({ selection: { anchor } }).state;
		extension.value({
			selectionSet: true,
			docChanged: false,
			state,
		});
		flushRaf();
	};
}

describe("createCursorTrackingExtension beat broadcast", () => {
	afterEach(() => {
		rafQueue = [];
		vi.unstubAllGlobals();
	});

	beforeEach(() => {
		rafQueue = [];
		vi.stubGlobal("window", {
			requestAnimationFrame: (cb: () => void) => {
				rafQueue.push(cb);
				return rafQueue.length;
			},
		});
	});

	it("broadcasts when the cursor moves to a different beat within the same bar", () => {
		const emitted: Array<EditorCursorInfo | null> = [];
		const moveCursor = createTrackedView((cursor) => emitted.push(cursor));

		moveCursor(15);
		moveCursor(19);

		expect(
			emitted.map((e) => ({ bar: e?.barIndex, beat: e?.beatIndex })),
		).toEqual([
			{ bar: 0, beat: 0 },
			{ bar: 0, beat: 1 },
		]);
	});

	it("does not re-broadcast when the cursor stays on the same bar and beat", () => {
		const emitted: Array<EditorCursorInfo | null> = [];
		const moveCursor = createTrackedView((cursor) => emitted.push(cursor));

		moveCursor(19);
		moveCursor(20);

		expect(emitted).toHaveLength(1);
		expect(emitted[0]).toMatchObject({ barIndex: 0, beatIndex: 1 });
	});

	it("broadcasts a null cursor when leaving the content area", () => {
		const emitted: Array<EditorCursorInfo | null> = [];
		const moveCursor = createTrackedView((cursor) => emitted.push(cursor));

		moveCursor(15);
		moveCursor(3);

		expect(emitted).toHaveLength(2);
		expect(emitted[1]).toMatchObject({ barIndex: -1, beatIndex: -1 });
	});

	it("broadcasts across bars and back to the first beat of a new bar", () => {
		const emitted: Array<EditorCursorInfo | null> = [];
		const moveCursor = createTrackedView((cursor) => emitted.push(cursor));

		moveCursor(15);
		moveCursor(26);

		expect(
			emitted.map((e) => ({ bar: e?.barIndex, beat: e?.beatIndex })),
		).toEqual([
			{ bar: 0, beat: 0 },
			{ bar: 1, beat: 0 },
		]);
	});
});
