/**
 * Preview bar highlight: applies editor cursor bar number color and theme restoration.
 */

import type * as alphaTab from "@coderline/alphatab";
import { useEffect } from "react";
import type { EditorCursorInfo } from "../store/appStore";
import { useAppStore } from "../store/appStore";

type ApplyThemeColorsToPreviousBars = (api: alphaTab.AlphaTabApi) => void;
type ApplyEditorBarNumberColor = (
	api: alphaTab.AlphaTabApi,
	barIndex: number,
) => boolean;

export function usePreviewBarHighlight(
	apiRef: React.RefObject<alphaTab.AlphaTabApi | null>,
	editorCursor: EditorCursorInfo | null,
	applyThemeColorsToPreviousBars: ApplyThemeColorsToPreviousBars,
	applyEditorBarNumberColor: ApplyEditorBarNumberColor,
	pendingBarColorRef: React.MutableRefObject<number | null>,
): void {
	useEffect(() => {
		const api = apiRef.current;
		if (api) {
			applyThemeColorsToPreviousBars(api);
		}
		pendingBarColorRef.current = null;
		if (!api || !editorCursor || editorCursor.barIndex < 0) return;

		// 检查是否启用了光标广播功能
		if (!useAppStore.getState().enableCursorBroadcast) return;

		if (!applyEditorBarNumberColor(api, editorCursor.barIndex)) {
			pendingBarColorRef.current = editorCursor.barIndex;
		}
	}, [
		apiRef,
		editorCursor,
		applyEditorBarNumberColor,
		applyThemeColorsToPreviousBars,
		pendingBarColorRef,
	]);
}
