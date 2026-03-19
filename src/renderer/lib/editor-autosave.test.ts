import { describe, expect, it } from "vitest";
import {
	createEditorAutosaveRequest,
	planEditorAutosaveTransition,
	rebindEditorAutosaveRequest,
} from "./editor-autosave";

describe("editor autosave", () => {
	it("captures the edited file path at change time", () => {
		const request = createEditorAutosaveRequest({
			activeFile: {
				id: "file-a",
				path: "/workspace/file-a.atex",
			},
			newContent: "edited-a",
			sandboxFile: null,
			sandboxMode: false,
		});

		expect(request).toEqual({
			fileId: "file-a",
			filePath: "/workspace/file-a.atex",
			content: "edited-a",
		});
	});

	it("flushes the previous pending save before scheduling a different file", () => {
		const pendingForA = createEditorAutosaveRequest({
			activeFile: {
				id: "file-a",
				path: "/workspace/file-a.atex",
			},
			newContent: "edited-a",
			sandboxFile: null,
			sandboxMode: false,
		});
		const pendingForB = createEditorAutosaveRequest({
			activeFile: {
				id: "file-b",
				path: "/workspace/file-b.atex",
			},
			newContent: "edited-b",
			sandboxFile: null,
			sandboxMode: false,
		});

		const transition = planEditorAutosaveTransition(pendingForA, pendingForB);

		expect(transition).toEqual({
			clearCurrentTimer: true,
			flushImmediately: pendingForA,
			nextPending: pendingForB,
		});
	});

	it("does not create a filesystem autosave request for sandbox edits", () => {
		const request = createEditorAutosaveRequest({
			activeFile: {
				id: "sandbox-file",
				path: "/workspace/file-a.atex",
			},
			newContent: "edited",
			sandboxFile: {
				id: "sandbox-file",
				path: "/workspace/file-a.atex",
			},
			sandboxMode: true,
		});

		expect(request).toBeNull();
	});

	it("rebinds a pending save to the latest path after a rename", () => {
		const request = createEditorAutosaveRequest({
			activeFile: {
				id: "file-a",
				path: "/workspace/file-a.atex",
			},
			newContent: "edited-a",
			sandboxFile: null,
			sandboxMode: false,
		});

		const rebound = rebindEditorAutosaveRequest(request, {
			id: "file-a",
			path: "/workspace/renamed.atex",
		});

		expect(rebound).toEqual({
			fileId: "file-a",
			filePath: "/workspace/renamed.atex",
			content: "edited-a",
		});
	});
});
