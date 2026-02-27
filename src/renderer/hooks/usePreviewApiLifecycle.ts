import type * as alphaTab from "@coderline/alphatab";
import { type MutableRefObject, useEffect } from "react";
import { useAppStore } from "../store/appStore";

type ApiWithThemeCleanup = alphaTab.AlphaTabApi & {
	__unsubscribeTheme?: (() => void) | unknown;
};

function getThemeUnsubscribe(api: alphaTab.AlphaTabApi): (() => void) | null {
	const maybe = (api as ApiWithThemeCleanup).__unsubscribeTheme;
	return typeof maybe === "function" ? (maybe as () => void) : null;
}

export function destroyPreviewApi(
	apiRef: MutableRefObject<alphaTab.AlphaTabApi | null>,
	emitApiChange: (api: alphaTab.AlphaTabApi | null) => void,
) {
	const api = apiRef.current;
	if (!api) return;

	try {
		getThemeUnsubscribe(api)?.();
	} catch {}

	try {
		useAppStore.getState().unregisterPlayerControls();
	} catch {}

	api.destroy();
	apiRef.current = null;
	emitApiChange(null);
	useAppStore.getState().clearScoreSelection();
}

interface UsePrintPreviewApiLifecycleParams {
	showPrintPreview: boolean;
	apiRef: MutableRefObject<alphaTab.AlphaTabApi | null>;
	emitApiChange: (api: alphaTab.AlphaTabApi | null) => void;
	setReinitTrigger: React.Dispatch<React.SetStateAction<number>>;
}

export function usePrintPreviewApiLifecycle({
	showPrintPreview,
	apiRef,
	emitApiChange,
	setReinitTrigger,
}: UsePrintPreviewApiLifecycleParams) {
	useEffect(() => {
		if (showPrintPreview) {
			destroyPreviewApi(apiRef, emitApiChange);
			return;
		}

		if (!apiRef.current) {
			const timer = setTimeout(() => {
				setReinitTrigger((prev) => prev + 1);
			}, 150);
			return () => clearTimeout(timer);
		}
	}, [showPrintPreview, apiRef, emitApiChange, setReinitTrigger]);
}
