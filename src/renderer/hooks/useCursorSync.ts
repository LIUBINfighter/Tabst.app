import { useCallback, useEffect, useRef } from "react";
import type { EditorCursorInfo } from "@/renderer/store/appStore";
import { useAppStore } from "@/renderer/store/appStore";

interface UseCursorSyncOptions {
	onCursorChange?: (cursor: EditorCursorInfo | null) => void;
}

export function useCursorSync(options: UseCursorSyncOptions = {}) {
	const { onCursorChange } = options;
	const editorCursor = useAppStore((s) => s.editorCursor);
	const lastCursorRef = useRef<EditorCursorInfo | null>(null);

	useEffect(() => {
		if (!editorCursor) return;

		if (
			lastCursorRef.current?.barIndex === editorCursor.barIndex &&
			lastCursorRef.current?.beatIndex === editorCursor.beatIndex
		) {
			return;
		}

		lastCursorRef.current = editorCursor;

		if (onCursorChange) {
			onCursorChange(editorCursor);
		}
	}, [editorCursor, onCursorChange]);

	const clearCursor = useCallback(() => {
		lastCursorRef.current = null;
		if (onCursorChange) {
			onCursorChange(null);
		}
	}, [onCursorChange]);

	return {
		cursor: editorCursor,
		clearCursor,
	};
}
