export type AppZoomAction = "in" | "out" | "reset";
export const APP_UI_SCALE_CHANGED_EVENT = "tabst:ui-scale-changed";

const APP_ZOOM_STORAGE_KEY = "tabst:appZoomFactor";
const DEFAULT_APP_ZOOM = 1;
const MIN_APP_ZOOM = 0.5;
const MAX_APP_ZOOM = 3;
const APP_ZOOM_STEP = 0.1;
const UI_SCALE_CSS_VAR = "--tabst-ui-scale";

let currentAppZoomFactor = DEFAULT_APP_ZOOM;

function roundZoomFactor(value: number): number {
	return Math.round(value * 100) / 100;
}

export function clampAppZoomFactor(value: number): number {
	if (!Number.isFinite(value)) return DEFAULT_APP_ZOOM;
	return Math.min(MAX_APP_ZOOM, Math.max(MIN_APP_ZOOM, roundZoomFactor(value)));
}

export function getAppZoomAction(
	event: Pick<KeyboardEvent, "metaKey" | "ctrlKey" | "key">,
): AppZoomAction | null {
	if (!event.metaKey && !event.ctrlKey) return null;

	switch (event.key) {
		case "=":
		case "+":
		case "Add":
			return "in";
		case "-":
		case "_":
		case "Subtract":
			return "out";
		case "0":
			return "reset";
		default:
			return null;
	}
}

export function getNextAppZoomFactor(
	current: number,
	action: AppZoomAction,
): number {
	if (action === "reset") return DEFAULT_APP_ZOOM;
	if (action === "in") return clampAppZoomFactor(current + APP_ZOOM_STEP);
	return clampAppZoomFactor(current - APP_ZOOM_STEP);
}

function readPersistedZoomFactor(): number {
	try {
		return clampAppZoomFactor(
			Number.parseFloat(
				window.localStorage.getItem(APP_ZOOM_STORAGE_KEY) ?? "1",
			),
		);
	} catch {
		return DEFAULT_APP_ZOOM;
	}
}

function persistZoomFactor(value: number) {
	try {
		window.localStorage.setItem(APP_ZOOM_STORAGE_KEY, String(value));
	} catch {
		// ignore persistence failures
	}
}

function emitUiScaleChanged(value: number) {
	if (typeof window === "undefined") return;
	window.dispatchEvent(
		new CustomEvent<number>(APP_UI_SCALE_CHANGED_EVENT, { detail: value }),
	);
}

function applyZoomFactor(value: number): void {
	const next = clampAppZoomFactor(value);
	document.documentElement.style.setProperty(UI_SCALE_CSS_VAR, String(next));
	currentAppZoomFactor = next;
	persistZoomFactor(next);
	emitUiScaleChanged(next);
}

export async function restoreAppZoomFactor(): Promise<void> {
	applyZoomFactor(readPersistedZoomFactor());
}

export function getCurrentAppZoomFactor(): number {
	const cssScale = Number.parseFloat(
		document.documentElement.style.getPropertyValue(UI_SCALE_CSS_VAR),
	);
	if (Number.isFinite(cssScale)) return clampAppZoomFactor(cssScale);
	return readPersistedZoomFactor();
}

export function subscribeAppZoomFactor(
	listener: (value: number) => void,
): () => void {
	const handle = (event: Event) => {
		const custom = event as CustomEvent<number>;
		listener(clampAppZoomFactor(custom.detail));
	};

	window.addEventListener(APP_UI_SCALE_CHANGED_EVENT, handle);
	return () => window.removeEventListener(APP_UI_SCALE_CHANGED_EVENT, handle);
}

export function handleAppZoomShortcut(event: KeyboardEvent): boolean {
	const action = getAppZoomAction(event);
	if (!action) return false;

	event.preventDefault();
	applyZoomFactor(getNextAppZoomFactor(currentAppZoomFactor, action));
	return true;
}
