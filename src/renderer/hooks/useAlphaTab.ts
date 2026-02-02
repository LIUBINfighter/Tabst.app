import * as alphaTab from "@coderline/alphatab";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPreviewSettings } from "@/renderer/lib/alphatab-config";
import { formatFullError } from "@/renderer/lib/alphatab-error";
import { loadBravuraFont, loadSoundFontFromUrl } from "@/renderer/lib/assets";
import type { ResourceUrls } from "@/renderer/lib/resourceLoaderService";
import { getResourceUrls } from "@/renderer/lib/resourceLoaderService";
import {
	applyStaffConfig,
	type StaffDisplayOptions,
} from "@/renderer/lib/staff-config";
import {
	getAlphaTabColorsForTheme,
	setupThemeObserver,
} from "@/renderer/lib/themeManager";
import { useAppStore } from "@/renderer/store/appStore";

interface UseAlphaTabOptions {
	content?: string;
	onScoreLoaded?: (score: alphaTab.model.Score) => void;
	onError?: (error: string) => void;
}

interface UseAlphaTabReturn {
	api: alphaTab.AlphaTabApi | null;
	containerRef: React.RefObject<HTMLDivElement | null>;
	scrollHostRef: React.RefObject<HTMLDivElement | null>;
	isLoading: boolean;
	error: string | null;
	zoom: number;
	setZoom: (zoom: number) => void;
	applyTracksConfig: () => void;
}

export function useAlphaTab(options: UseAlphaTabOptions): UseAlphaTabReturn {
	const { content, onScoreLoaded, onError } = options;
	const containerRef = useRef<HTMLDivElement>(null);
	const scrollHostRef = useRef<HTMLDivElement>(null);
	const apiRef = useRef<alphaTab.AlphaTabApi | null>(null);

	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [zoom, setZoomState] = useState(60);

	const zoomRef = useRef(zoom);
	const trackConfigRef = useRef<StaffDisplayOptions | null>(null);
	const lastValidScoreRef = useRef<{
		score: alphaTab.model.Score;
		content: string;
	} | null>(null);
	const pendingTexRef = useRef<{ id: number; content: string } | null>(null);
	const texSeqRef = useRef(0);
	const latestContentRef = useRef(content ?? "");

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

		const config: StaffDisplayOptions = trackConfigRef.current || {
			showTablature: true,
			showStandardNotation: false,
			showSlash: false,
			showNumbered: false,
		};

		const appliedConfig = applyStaffConfig(api, config);
		if (appliedConfig) {
			setFirstStaffOptions(appliedConfig);
		}
	}, [setFirstStaffOptions]);

	useEffect(() => {
		if (!containerRef.current) return;

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

				if (!apiRef.current) {
					const colors = getAlphaTabColorsForTheme();
					const settings = createPreviewSettings(urls as ResourceUrls, {
						scale: zoomRef.current / 100,
						scrollElement: scrollEl,
						colors,
					});

					apiRef.current = new alphaTab.AlphaTabApi(el, settings);

					try {
						await loadSoundFontFromUrl(apiRef.current, urls.soundFontUrl);
						apiRef.current.soundFontLoaded?.on(() => {
							try {
								if (apiRef.current) apiRef.current.masterVolume = 1.0;
							} catch {}
						});
					} catch (e) {
						console.warn("[useAlphaTab] SoundFont load failed:", e);
					}

					apiRef.current.renderFinished.on(() => {
						setIsLoading(false);
					});

					apiRef.current.error.on((err: unknown) => {
						const fullError = formatFullError(err);
						setError(fullError);
						setIsLoading(false);
						if (lastValidScoreRef.current?.score && apiRef.current) {
							try {
								apiRef.current.renderScore(
									lastValidScoreRef.current.score,
									[0],
								);
							} catch {}
						}
						if (onError) onError(fullError);
					});

					apiRef.current.scoreLoaded.on((score) => {
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
							if (onScoreLoaded) onScoreLoaded(score);
						}
					});
				}

				if (content) {
					const seq = ++texSeqRef.current;
					pendingTexRef.current = { id: seq, content };
					apiRef.current.tex(content);
				}
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
	}, [applyTracksConfig, bumpScoreVersion, content, onError, onScoreLoaded]);

	useEffect(() => {
		const unsubscribe = setupThemeObserver(() => {
			const api = apiRef.current;
			if (!api) return;

			const notation = api.settings.notation as
				| {
						numberedNotationActive?: boolean;
						slashNotationActive?: boolean;
						tablatureNotationActive?: boolean;
						standardNotationActive?: boolean;
				  }
				| undefined;

			trackConfigRef.current = {
				showNumbered: notation?.numberedNotationActive ?? false,
				showSlash: notation?.slashNotationActive ?? false,
				showTablature: notation?.tablatureNotationActive ?? true,
				showStandardNotation: notation?.standardNotationActive ?? false,
			};

			api.destroy();
			apiRef.current = null;
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
		api: apiRef.current,
		containerRef,
		scrollHostRef,
		isLoading,
		error,
		zoom,
		setZoom,
		applyTracksConfig,
	};
}
