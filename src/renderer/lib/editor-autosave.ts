export interface EditorAutosaveFileRef {
	id: string;
	path: string;
}

export interface EditorAutosaveRequest {
	fileId: string;
	filePath: string;
	content: string;
}

export interface EditorAutosaveTransition {
	clearCurrentTimer: boolean;
	flushImmediately: EditorAutosaveRequest | null;
	nextPending: EditorAutosaveRequest | null;
}

interface CreateEditorAutosaveRequestInput {
	activeFile: EditorAutosaveFileRef | null;
	newContent: string;
	sandboxFile: EditorAutosaveFileRef | null;
	sandboxMode: boolean;
}

export function createEditorAutosaveRequest(
	input: CreateEditorAutosaveRequestInput,
): EditorAutosaveRequest | null {
	if (input.sandboxMode || input.sandboxFile || !input.activeFile) {
		return null;
	}

	return {
		fileId: input.activeFile.id,
		filePath: input.activeFile.path,
		content: input.newContent,
	};
}

export function rebindEditorAutosaveRequest(
	request: EditorAutosaveRequest | null,
	file: EditorAutosaveFileRef | null,
): EditorAutosaveRequest | null {
	if (!request || !file || file.id !== request.fileId) {
		return request;
	}

	if (file.path === request.filePath) {
		return request;
	}

	return {
		...request,
		filePath: file.path,
	};
}

export function planEditorAutosaveTransition(
	currentPending: EditorAutosaveRequest | null,
	nextPending: EditorAutosaveRequest | null,
): EditorAutosaveTransition {
	if (!nextPending) {
		return {
			clearCurrentTimer: false,
			flushImmediately: null,
			nextPending: null,
		};
	}

	if (!currentPending) {
		return {
			clearCurrentTimer: false,
			flushImmediately: null,
			nextPending,
		};
	}

	if (currentPending.fileId === nextPending.fileId) {
		return {
			clearCurrentTimer: true,
			flushImmediately: null,
			nextPending,
		};
	}

	return {
		clearCurrentTimer: true,
		flushImmediately: currentPending,
		nextPending,
	};
}
