import * as alphaTab from "@coderline/alphatab";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPreviewSettings } from "@/renderer/lib/alphatab-config";
import { formatFullError } from "@/renderer/lib/alphatab-error";
import { loadBravuraFont, loadSoundFontFromUrl } from "@/renderer/lib/assets";
import type { ResourceUrls } from "@/renderer/lib/resourceLoaderService";
import { getResourceUrls } from "@/renderer/lib/resourceLoaderService";
import {
	applyStaffConfig,
	getFirstStaffOptions,
	type StaffDisplayOptions,
} from "@/renderer/lib/staff-config";
import {
	getAlphaTabColorsForTheme,
	setupThemeObserver,
} from "@/renderer/lib/themeManager";
import { useAppStore } from "@/renderer/store/appStore";

export interface UseAlphaTabOptions {
	content?: string;
	onScoreLoaded?: (score: alphaTab.model.Score) => void;
	onError?: (error: string) => void;
	/** Called once when API is created; use to attach Preview-specific listeners */
	onApiReady?: (api: alphaTab.AlphaTabApi) => void;
	/** When changed (e.g. incremented), API is destroyed and re-created (e.g. after print) */
	reinitTrigger?: number;
	/** When true, API is destroyed (e.g. when PrintPreview is open); re-init when false + reinitTrigger bump */
	suspended?: boolean;
}

export interface UseAlphaTabReturn {
	/** Live ref to the alphaTab API instance (use .current in effects/callbacks) */
	apiRef: React.RefObject<alphaTab.AlphaTabApi | null>;
	containerRef: React.RefObject<HTMLDivElement | null>;
	scrollHostRef: React.RefObject<HTMLDivElement | null>;
	isLoading: boolean;
	error: string | null;
	zoom: number;
	setZoom: (zoom: number) => void;
	applyTracksConfig: () => void;
}

export function useAlphaTab(options: UseAlphaTabOptions): UseAlphaTabReturn {
	const {
		content,
		onScoreLoaded,
		onError,
		onApiReady,
		reinitTrigger = 0,
		suspended = false,
	} = options;
	const containerRef = useRef<HTMLDivElement>(null);
	const scrollHostRef = useRef<HTMLDivElement>(null);
	const apiRef = useRef<alphaTab.AlphaTabApi | null>(null);

	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [zoom, setZoomState] = useState(60);
	/** Incremented by theme observer to force re-init after destroy (new colors) */
	const [themeReinitKey, setThemeReinitKey] = useState(0);

	const zoomRef = useRef(zoom);
	const trackConfigRef = useRef<StaffDisplayOptions | null>(null);
	const tabProbeRef = useRef<{
		active: boolean;
		prev: StaffDisplayOptions | null;
		timeoutId: ReturnType<typeof setTimeout> | null;
		lastProbeAt: number;
	}>({ active: false, prev: null, timeoutId: null, lastProbeAt: 0 });
	const lastValidScoreRef = useRef<{
		score: alphaTab.model.Score;
		content: string;
	} | null>(null);
	const pendingTexRef = useRef<{ id: number; content: string } | null>(null);
	const texSeqRef = useRef(0);
	const latestContentRef = useRef(content ?? "");

	const onScoreLoadedRef = useRef(onScoreLoaded);
	const onErrorRef = useRef(onError);
	const onApiReadyRef = useRef(onApiReady);
	onScoreLoadedRef.current = onScoreLoaded;
	onErrorRef.current = onError;
	onApiReadyRef.current = onApiReady;

	const setFirstStaffOptions = useAppStore((s) => s.setFirstStaffOptions);
	const bumpScoreVersion = useAppStore((s) => s.bumpScoreVersion);

	useEffect(() => {
		latestContentRef.current = content ?? "";
	}, [content]);

	const applyZoom = useCallback((newPercent: number) => {
		const pct = Math.max(10, Math.min(400, Math.round(newPercent)));
		useAppStore.getState().setZoomPercent(pct);
		zoomRef.current = pct;
		setZoomState(pct);

		const api = apiRef.current;
		if (!api || !api.settings) return;

		try {
			const disp = api.settings.display as unknown as { scale?: number };
			disp.scale = pct / 100;
			api.updateSettings?.();
			if (api.render) api.render();
		} catch (e) {
			console.error("[useAlphaTab] Failed to apply zoom:", e);
		}
	}, []);

	const applyTracksConfig = useCallback(() => {
		const api = apiRef.current;
		if (!api) return;
		// First load: try to prefer TAB (silent dry-run). If it errors, keep alphaTab default.
		if (!trackConfigRef.current) {
			if (tabProbeRef.current.active) return;
			const current = getFirstStaffOptions(api);
			if (!current) return;

			const preferTab: StaffDisplayOptions = {
				...current,
				showTablature: true,
				showStandardNotation: false,
			};

			tabProbeRef.current.active = true;
			tabProbeRef.current.prev = current;
			tabProbeRef.current.lastProbeAt = Date.now();
			if (tabProbeRef.current.timeoutId) {
				clearTimeout(tabProbeRef.current.timeoutId);
			}
			// Failsafe: finalize even if renderFinished never arrives.
			tabProbeRef.current.timeoutId = setTimeout(() => {
				if (!tabProbeRef.current.active) return;
				tabProbeRef.current.active = false;
				const applied = getFirstStaffOptions(api) ?? tabProbeRef.current.prev;
				if (applied) {
					trackConfigRef.current = applied;
					setFirstStaffOptions(applied);
				}
			}, 1200);

			try {
				applyStaffConfig(api, preferTab);
			} catch (e) {
				tabProbeRef.current.active = false;
				if (tabProbeRef.current.timeoutId) {
					clearTimeout(tabProbeRef.current.timeoutId);
					tabProbeRef.current.timeoutId = null;
				}
				try {
					applyStaffConfig(api, current);
				} catch {}
				trackConfigRef.current = current;
				setFirstStaffOptions(current);
				console.warn("[useAlphaTab] TAB probe sync-failed; kept default.", e);
			}
			return;
		}

		// Subsequent loads / rebuild: apply saved config (e.g. user toggled)
		const appliedConfig = applyStaffConfig(api, trackConfigRef.current);
		if (appliedConfig) setFirstStaffOptions(appliedConfig);
	}, [setFirstStaffOptions]);

	// When suspended (e.g. PrintPreview open), destroy API
	useEffect(() => {
		if (suspended && apiRef.current) {
			apiRef.current.destroy();
			apiRef.current = null;
		}
	}, [suspended]);

	// Init API once per container mount (or when reinitTrigger / themeReinitKey changes); skip when suspended
	// biome-ignore lint/correctness/useExhaustiveDependencies: reinitTrigger and themeReinitKey are intentional deps to force API re-init
	useEffect(() => {
		if (!containerRef.current || suspended) return;

		const initAlphaTab = async () => {
			try {
				setIsLoading(true);
				setError(null);

				const urls = await getResourceUrls();
				const el = containerRef.current as HTMLElement;
				const fallbackScrollEl = (el.parentElement ?? el) as HTMLElement;
				const scrollEl =
					(scrollHostRef.current as HTMLElement | null) ?? fallbackScrollEl;

				try {
					await loadBravuraFont(urls.bravuraFontUrl);
				} catch (e) {
					console.warn("[useAlphaTab] Bravura font load failed:", e);
				}

				const colors = getAlphaTabColorsForTheme();
				const settings = createPreviewSettings(urls as ResourceUrls, {
					scale: zoomRef.current / 100,
					scrollElement: scrollEl,
					colors,
				});

				const api = new alphaTab.AlphaTabApi(el, settings);
				apiRef.current = api;

				try {
					await loadSoundFontFromUrl(api, urls.soundFontUrl);
					api.soundFontLoaded?.on(() => {
						try {
							if (apiRef.current) apiRef.current.masterVolume = 1.0;
						} catch {}
					});
				} catch (e) {
					console.warn("[useAlphaTab] SoundFont load failed:", e);
				}

				api.renderFinished.on(() => {
					// If we are probing TAB on first load, wait a short grace period before finalizing.
					if (tabProbeRef.current.active) {
						if (tabProbeRef.current.timeoutId) {
							clearTimeout(tabProbeRef.current.timeoutId);
						}
						tabProbeRef.current.timeoutId = setTimeout(() => {
							if (!tabProbeRef.current.active) return;
							tabProbeRef.current.active = false;
							const applied =
								getFirstStaffOptions(api) ?? tabProbeRef.current.prev;
							if (applied) {
								trackConfigRef.current = applied;
								setFirstStaffOptions(applied);
							}
						}, 250);
					}
					setIsLoading(false);
				});

				api.error.on((err: unknown) => {
					const fullError = formatFullError(err);
					const now = Date.now();
					const recentlyProbed =
						(tabProbeRef.current.lastProbeAt ?? 0) > 0 &&
						now - (tabProbeRef.current.lastProbeAt ?? 0) < 2000;
					// Keep this intentionally narrow: rollback only for the known
					// non-guitar TAB crash (undefined staves). Don't swallow other errors.
					const looksLikeProbeStavesError =
						fullError.includes("(reading 'staves')") ||
						(fullError.includes("Cannot read properties of undefined") &&
							fullError.includes("staves"));

					// During TAB probe (or immediately after), swallow internal TypeErrors and rollback.
					if (
						(tabProbeRef.current.active || recentlyProbed) &&
						looksLikeProbeStavesError
					) {
						console.warn(
							"[useAlphaTab] TAB probe internal error; rollback to default.",
							fullError,
						);
						tabProbeRef.current.active = false;
						if (tabProbeRef.current.timeoutId) {
							clearTimeout(tabProbeRef.current.timeoutId);
							tabProbeRef.current.timeoutId = null;
						}
						const prev = tabProbeRef.current.prev;
						if (prev) {
							try {
								applyStaffConfig(api, prev);
							} catch {}
							trackConfigRef.current = prev;
							setFirstStaffOptions(prev);
						}
						setIsLoading(false);
						return;
					}
					setError(fullError);
					setIsLoading(false);
					if (lastValidScoreRef.current?.score && apiRef.current) {
						try {
							apiRef.current.renderScore(lastValidScoreRef.current.score, [0]);
						} catch {}
					}
					onErrorRef.current?.(fullError);
				});

				api.scoreLoaded.on((score) => {
					if (score?.tracks && score.tracks.length > 0) {
						bumpScoreVersion();
						const currentContent = latestContentRef.current ?? "";
						if (
							pendingTexRef.current &&
							pendingTexRef.current.content === currentContent
						) {
							lastValidScoreRef.current = {
								score,
								content: currentContent,
							};
							setError(null);
						}
						if (apiRef.current) applyTracksConfig();
						onScoreLoadedRef.current?.(score);
					}
				});

				// Defer so consumer can set onApiReady ref after same render
				const apiInstance = api;
				setTimeout(() => {
					if (apiRef.current === apiInstance)
						onApiReadyRef.current?.(apiInstance);
				}, 0);
			} catch (err) {
				console.error("[useAlphaTab] Failed to initialize:", err);
				setError(err instanceof Error ? err.message : "Initialization failed");
				setIsLoading(false);
			}
		};

		initAlphaTab();

		return () => {
			if (apiRef.current) {
				apiRef.current.destroy();
				apiRef.current = null;
			}
		};
	}, [
		applyTracksConfig,
		bumpScoreVersion,
		reinitTrigger,
		suspended,
		themeReinitKey,
	]);

	// When content changes, update score via tex() without re-creating API
	useEffect(() => {
		if (suspended) return;
		const api = apiRef.current;
		if (!api || content == null) return;
		const seq = ++texSeqRef.current;
		pendingTexRef.current = { id: seq, content };
		api.tex(content);
	}, [content, suspended]);

	useEffect(() => {
		const unsubscribe = setupThemeObserver(() => {
			const api = apiRef.current;
			if (!api) return;
			// Preserve current first-staff options before rebuilding API.
			// Using staff options is safer than global notation flags for non-guitar tracks.
			const current = getFirstStaffOptions(api);
			if (current) trackConfigRef.current = current;

			api.destroy();
			apiRef.current = null;
			setThemeReinitKey((k) => k + 1);
		});

		return () => unsubscribe();
	}, []);

	const setZoom = useCallback(
		(newZoom: number) => {
			applyZoom(newZoom);
		},
		[applyZoom],
	);

	return {
		apiRef,
		containerRef,
		scrollHostRef,
		isLoading,
		error,
		zoom,
		setZoom,
		applyTracksConfig,
	};
}
