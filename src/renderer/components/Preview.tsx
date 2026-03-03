import * as alphaTab from "@coderline/alphatab";
import { FileText } from "lucide-react";
import {
	lazy,
	Suspense,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import { useTranslation } from "react-i18next";
import {
	destroyPreviewApi,
	usePrintPreviewApiLifecycle,
} from "../hooks/usePreviewApiLifecycle";
import { usePreviewBarHighlight } from "../hooks/usePreviewBarHighlight";
import { usePreviewErrorRecovery } from "../hooks/usePreviewErrorRecovery";
import { usePreviewEventBindings } from "../hooks/usePreviewEventBindings";
import {
	type PreviewLifecycleReason,
	type PreviewLifecycleState,
	usePreviewLifecycleTelemetry,
} from "../hooks/usePreviewLifecycleTelemetry";
import { usePreviewSelectionSync } from "../hooks/usePreviewSelectionSync";
import {
	applyEditorBarNumberColor as applyEditorBarNumberColorLib,
	applyThemeColorsToPreviousBars as applyThemeColorsToPreviousBarsLib,
	type LastColoredBars,
	sanitizeAllBarStyles as sanitizeAllBarStylesLib,
} from "../lib/alphatab-bar-highlight";
import { createPreviewSettings } from "../lib/alphatab-config";
import { formatFullError } from "../lib/alphatab-error";
import {
	exportToGp7,
	exportToMidi,
	exportToWav,
	getDefaultExportFilename,
} from "../lib/alphatab-export";
import { mapSelectionToCodeRange } from "../lib/alphatex-selection-sync";
import { loadBravuraFont, loadSoundFontFromUrl } from "../lib/assets";
import { type AtDocConfig, parseAtDoc } from "../lib/atdoc";
import { applyAtDocColoring } from "../lib/atdoc-coloring";
import {
	disableNumberedNotationAcrossScore,
	isNumberedNotationBeatError,
} from "../lib/numbered-notation-guard";
import {
	createPlaybackFrameGate,
	type PlaybackFrameGate,
} from "../lib/playback-frame-gate";
import {
	PREVIEW_COMMAND_EVENT,
	type PreviewCommandId,
} from "../lib/preview-command-events";
import type { ResourceUrls } from "../lib/resourceLoaderService";
import { getResourceUrls } from "../lib/resourceLoaderService";
import {
	applyStaffConfig,
	getFirstStaffOptions,
	toggleFirstStaffOption,
} from "../lib/staff-config";
import {
	getAlphaTabColorsForTheme,
	setupThemeObserver,
} from "../lib/themeManager";
import { useAppStore } from "../store/appStore";
import PreviewToolbar from "./PreviewToolbar";
import TopBar from "./TopBar";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "./ui/tooltip";

export interface PreviewProps {
	fileName?: string;
	content?: string;
	className?: string;
	onApiChange?: (api: alphaTab.AlphaTabApi | null) => void;
	onEnjoyToggle?: () => void;
	isEnjoyMode?: boolean;
	mobileScoreFit?: boolean;
}

type PlaybackProgressSnapshot = {
	positionTick: number;
	endTick: number;
	positionMs: number;
	endMs: number;
};

type PlaybackCursorSnapshot = {
	barIndex: number;
	beatIndex: number;
};

const PrintPreview = lazy(() => import("./PrintPreview"));

export default function Preview({
	fileName,
	content,
	className,
	onApiChange,
	onEnjoyToggle,
	isEnjoyMode = false,
	mobileScoreFit = false,
}: PreviewProps) {
	const { t } = useTranslation(["common", "errors", "print", "toolbar"]);
	const containerRef = useRef<HTMLDivElement | null>(null);
	const scrollHostRef = useRef<HTMLDivElement | null>(null);
	const apiRef = useRef<alphaTab.AlphaTabApi | null>(null);
	const _cursorRef = useRef<HTMLDivElement | null>(null);
	// Zoom state (percentage)

	const zoomRef = useRef<number>(60);
	// Store tracks configuration for restoration during theme switching
	const trackConfigRef = useRef<{
		showNumbered?: boolean;
		showSlash?: boolean;
		showTablature?: boolean;
		showStandardNotation?: boolean;
	} | null>(null);
	// On first load, try to prefer TAB silently. If alphaTab errors, rollback and keep default.
	const tabProbeRef = useRef<{
		active: boolean;
		prev: ReturnType<typeof getFirstStaffOptions>;
		timeoutId: number | null;
		lastProbeAt: number;
	}>({ active: false, prev: null, timeoutId: null, lastProbeAt: 0 });
	// Error recovery: parse timeout + last valid score restore
	const errorRecovery = usePreviewErrorRecovery({
		onTimeoutTriggered: () => increment("timeoutTriggered"),
		onRecoveryTriggered: () => increment("recoveryTriggered"),
	});
	const {
		parseError,
		setParseError,
		restorePerformed,
		lastValidScoreRef,
		scheduleTexTimeout,
		clearTexTimeout,
		onError: onErrorRecovery,
		onScoreLoadedMatch,
		markLoadAsUserContent,
	} = errorRecovery;
	// Store latest content for async callbacks and theme rebuild
	const latestContentRef = useRef<string>(content ?? "");
	// Queue for content updates when API is not ready yet
	const pendingContentRef = useRef<string | null>(null);
	// Print preview state and reinitialization trigger
	const [showPrintPreview, setShowPrintPreview] = useState(false);
	const [reinitTrigger, setReinitTrigger] = useState(0);

	// Subscribe to editor cursor position for reverse sync (editor → score)
	const editorCursor = useAppStore((s) => s.editorCursor);
	const setFirstStaffOptions = useAppStore((s) => s.setFirstStaffOptions);
	const pendingStaffToggle = useAppStore((s) => s.pendingStaffToggle);
	const toggleFirstStaffOptionStore = useAppStore(
		(s) => s.toggleFirstStaffOption,
	);
	const playbackSpeed = useAppStore((s) => s.playbackSpeed);
	const masterVolume = useAppStore((s) => s.masterVolume);
	const metronomeOnlyMode = useAppStore((s) => s.metronomeOnlyMode);
	const metronomeVolume = useAppStore((s) => s.metronomeVolume);
	const countInEnabled = useAppStore((s) => s.countInEnabled);
	const editorHasFocus = useAppStore((s) => s.editorHasFocus);
	const _scoreVersion = useAppStore((s) => s.scoreVersion);
	const bumpApiInstanceId = useAppStore((s) => s.bumpApiInstanceId);
	const bumpScoreVersion = useAppStore((s) => s.bumpScoreVersion);
	const bumpEditorRefreshVersion = useAppStore(
		(s) => s.bumpEditorRefreshVersion,
	);
	const bumpBottomBarRefreshVersion = useAppStore(
		(s) => s.bumpBottomBarRefreshVersion,
	);
	const playbackSpeedRef = useRef(playbackSpeed);
	const masterVolumeRef = useRef(masterVolume);
	const metronomeOnlyModeRef = useRef(metronomeOnlyMode);
	const metronomeVolumeRef = useRef(metronomeVolume);
	const countInEnabledRef = useRef(countInEnabled);
	const editorHasFocusRef = useRef(editorHasFocus);
	const atDocConfigRef = useRef<AtDocConfig>({});
	const _savedPlayerScrollRef = useRef<{
		scrollElement?: HTMLElement | null;
		scrollMode?: alphaTab.ScrollMode | undefined;
	} | null>(null);
	const lastColoredBarsRef = useRef<{
		barIndex: number;
		bars: alphaTab.model.Bar[];
		score: alphaTab.model.Score | null;
	} | null>(null);
	const pendingBarColorRef = useRef<number | null>(null);
	const lifecycleStateRef = useRef<PreviewLifecycleState>("idle");
	const listenerTeardownsRef = useRef<Array<() => void>>([]);
	const lastRebuildAtRef = useRef(0);
	const lastAppliedPlaybackSpeedRef = useRef<number | null>(null);
	const lastAppliedMasterVolumeRef = useRef<number | null>(null);
	const lastAppliedMetronomeVolumeRef = useRef<number | null>(null);
	const lastAppliedCountInRef = useRef<number | null>(null);
	const lastAppliedTexContentRef = useRef<string | null>(null);
	const lastPlaybackProgressRef = useRef<{
		positionTick: number;
		endTick: number;
		positionMs: number;
		endMs: number;
	} | null>(null);
	const lastPlayerIsPlayingRef = useRef<boolean | null>(null);
	const lastPlayerCursorRef = useRef<{
		barIndex: number;
		beatIndex: number;
	} | null>(null);
	const playbackProgressGateRef =
		useRef<PlaybackFrameGate<PlaybackProgressSnapshot> | null>(null);
	const playbackCursorGateRef =
		useRef<PlaybackFrameGate<PlaybackCursorSnapshot> | null>(null);

	useEffect(() => {
		playbackProgressGateRef.current = createPlaybackFrameGate(
			(next) => {
				useAppStore.getState().setPlaybackProgress(next);
			},
			{ minIntervalMs: 16 },
		);
		playbackCursorGateRef.current = createPlaybackFrameGate(
			(next) => {
				useAppStore.getState().setPlayerCursorPosition(next);
			},
			{ minIntervalMs: 16 },
		);

		return () => {
			playbackProgressGateRef.current?.dispose();
			playbackCursorGateRef.current?.dispose();
			playbackProgressGateRef.current = null;
			playbackCursorGateRef.current = null;
		};
	}, []);

	const emitApiChange = useCallback(
		(api: alphaTab.AlphaTabApi | null) => {
			onApiChange?.(api);
		},
		[onApiChange],
	);

	const { transition, increment, dumpCounters } =
		usePreviewLifecycleTelemetry();
	const { bind: bindPreviewEvents, unbindCurrent: unbindPreviewEvents } =
		usePreviewEventBindings();

	const transitionLifecycle = useCallback(
		(next: PreviewLifecycleState, reason: PreviewLifecycleReason) => {
			lifecycleStateRef.current = next;
			transition(next, reason);
		},
		[transition],
	);

	const runListenerTeardowns = useCallback(() => {
		while (listenerTeardownsRef.current.length > 0) {
			const teardown = listenerTeardownsRef.current.pop();
			teardown?.();
		}
		unbindPreviewEvents(increment, dumpCounters);
	}, [unbindPreviewEvents, increment, dumpCounters]);

	const destroyCurrentApi = useCallback(() => {
		runListenerTeardowns();
		increment("apiDestroyed");
		destroyPreviewApi(apiRef, emitApiChange);
		lastAppliedPlaybackSpeedRef.current = null;
		lastAppliedMetronomeVolumeRef.current = null;
		lastAppliedCountInRef.current = null;
		lastAppliedTexContentRef.current = null;
		lastPlaybackProgressRef.current = null;
		lastPlayerIsPlayingRef.current = null;
		lastPlayerCursorRef.current = null;
	}, [runListenerTeardowns, increment, emitApiChange]);

	const setPlayerIsPlayingIfChanged = useCallback((next: boolean) => {
		if (lastPlayerIsPlayingRef.current === next) return;
		lastPlayerIsPlayingRef.current = next;
		useAppStore.getState().setPlayerIsPlaying(next);
	}, []);

	const setPlayerCursorIfChanged = useCallback(
		(next: { barIndex: number; beatIndex: number }) => {
			const prev = lastPlayerCursorRef.current;
			if (
				prev &&
				prev.barIndex === next.barIndex &&
				prev.beatIndex === next.beatIndex
			) {
				return;
			}
			lastPlayerCursorRef.current = next;
			const gate = playbackCursorGateRef.current;
			if (gate) {
				gate.push(next);
				return;
			}
			useAppStore.getState().setPlayerCursorPosition(next);
		},
		[],
	);

	const setPlaybackProgressIfChanged = useCallback(
		(next: PlaybackProgressSnapshot) => {
			const prev = lastPlaybackProgressRef.current;
			if (
				prev &&
				prev.positionTick === next.positionTick &&
				prev.endTick === next.endTick &&
				prev.positionMs === next.positionMs &&
				prev.endMs === next.endMs
			) {
				return;
			}
			lastPlaybackProgressRef.current = next;
			const gate = playbackProgressGateRef.current;
			if (gate) {
				gate.push(next);
				return;
			}
			useAppStore.getState().setPlaybackProgress(next);
		},
		[],
	);
	// Prevent loop from cursor updates triggered by score selection
	const isEditorCursorFromScoreRef = useRef(false);
	// Track whether current highlight is triggered by editor cursor (to distinguish from manual selection)
	const isHighlightFromEditorCursorRef = useRef(false);
	// Store last selection info triggered by editor cursor for event handling identification
	const lastEditorCursorSelectionRef = useRef<{
		startBarIndex: number;
		endBarIndex: number;
	} | null>(null);

	// Editor and player cursors can now work simultaneously and sync
	useEffect(() => {
		const handler = (event: Event) => {
			const customEvent = event as CustomEvent<PreviewCommandId>;
			const commandId = customEvent.detail;
			if (!commandId) return;

			if (commandId === "preview.print-preview.open") {
				setShowPrintPreview(true);
				return;
			}

			const api = apiRef.current;
			if (!api?.score) return;

			if (commandId === "preview.export.midi") {
				exportToMidi(api);
				return;
			}

			if (commandId === "preview.export.wav") {
				const filename = getDefaultExportFilename(fileName, "wav");
				void exportToWav(api, filename);
				return;
			}

			if (commandId === "preview.export.gp7") {
				const filename = getDefaultExportFilename(fileName, "gp");
				exportToGp7(api, filename);
			}
		};

		window.addEventListener(PREVIEW_COMMAND_EVENT, handler);
		return () => window.removeEventListener(PREVIEW_COMMAND_EVENT, handler);
	}, [fileName]);

	useEffect(() => {
		const isTypingTarget = (target: EventTarget | null): boolean => {
			if (!(target instanceof HTMLElement)) return false;
			const tagName = target.tagName.toLowerCase();
			return (
				tagName === "input" ||
				tagName === "textarea" ||
				tagName === "select" ||
				target.isContentEditable
			);
		};

		const handleDeleteKey = (event: KeyboardEvent) => {
			if (event.key !== "Delete") return;
			if (event.metaKey || event.ctrlKey || event.altKey) return;
			if (editorHasFocusRef.current) return;
			if (isTypingTarget(event.target)) return;

			const selection = useAppStore.getState().scoreSelection;
			if (!selection) return;

			const activeFile = useAppStore.getState().getActiveFile();
			if (!activeFile || !activeFile.path.endsWith(".atex")) return;

			const source = latestContentRef.current ?? activeFile.content ?? "";
			const range = mapSelectionToCodeRange(source, selection);
			if (!range) return;

			event.preventDefault();
			event.stopPropagation();

			const nextContent = source.slice(0, range.from) + source.slice(range.to);
			latestContentRef.current = nextContent;
			useAppStore.getState().updateFileContent(activeFile.id, nextContent);
			useAppStore.getState().clearScoreSelection();
			void window.electronAPI.saveFile(activeFile.path, nextContent);
		};

		window.addEventListener("keydown", handleDeleteKey);
		return () => window.removeEventListener("keydown", handleDeleteKey);
	}, []);

	useEffect(() => {
		editorHasFocusRef.current = editorHasFocus;
	}, [editorHasFocus]);

	useEffect(() => {
		latestContentRef.current = content ?? "";
	}, [content]);

	// Sync global state to initialized alphaTab (without rebuilding score)
	useEffect(() => {
		playbackSpeedRef.current = playbackSpeed;
		const api = apiRef.current;
		if (!api) return;
		if (lastAppliedPlaybackSpeedRef.current === playbackSpeed) return;
		try {
			api.playbackSpeed = playbackSpeed;
			lastAppliedPlaybackSpeedRef.current = playbackSpeed;
		} catch {
			// Failed to apply playback speed
		}
	}, [playbackSpeed]);

	useEffect(() => {
		masterVolumeRef.current = masterVolume;
		const api = apiRef.current;
		if (!api) return;
		if (lastAppliedMasterVolumeRef.current === masterVolume) return;
		try {
			api.masterVolume = masterVolume;
			lastAppliedMasterVolumeRef.current = masterVolume;
		} catch {
			// Failed to apply master volume
		}
	}, [masterVolume]);

	useEffect(() => {
		metronomeVolumeRef.current = metronomeVolume;
		const api = apiRef.current;
		if (!api) return;
		if (lastAppliedMetronomeVolumeRef.current === metronomeVolume) return;
		try {
			api.metronomeVolume = metronomeVolume;
			lastAppliedMetronomeVolumeRef.current = metronomeVolume;
		} catch {
			// Failed to apply metronome volume
		}
	}, [metronomeVolume]);

	useEffect(() => {
		countInEnabledRef.current = countInEnabled;
		const api = apiRef.current;
		if (!api) return;
		const next = countInEnabled ? 1 : 0;
		if (lastAppliedCountInRef.current === next) return;
		try {
			api.countInVolume = next;
			lastAppliedCountInRef.current = next;
		} catch {}
	}, [countInEnabled]);

	// Unified scroll buffer: calculate bottom padding as 60% of preview scroll container height (px)
	useEffect(() => {
		const host = scrollHostRef.current;
		if (!host) return;
		const apply = () => {
			const h = host.getBoundingClientRect().height;
			const px = Math.max(0, Math.floor(h * 0.6));
			host.style.setProperty("--scroll-buffer", `${px}px`);
		};

		apply();

		const ro = new ResizeObserver(() => apply());
		ro.observe(host);
		return () => ro.disconnect();
	}, []);

	// Apply zoom to alphaTab API
	const applyZoom = useCallback((newPercent: number) => {
		const pct = Math.max(10, Math.min(400, Math.round(newPercent)));
		// Keep store in sync
		useAppStore.getState().setZoomPercent(pct);
		zoomRef.current = pct;
		const api = apiRef.current;
		if (!api || !api.settings) return;
		try {
			const disp = api.settings.display as unknown as { scale?: number };
			disp.scale = pct / 100;
			api.updateSettings?.();
			// Prefer partial re-render if available
			if (api.render) api.render();
		} catch (e) {
			console.error("[Preview] Failed to apply zoom:", e);
		}
	}, []);

	const applyScoreTracksMuted = useCallback(
		(api: alphaTab.AlphaTabApi, muted: boolean): boolean => {
			const scoreTracks = api.score?.tracks ?? [];
			if (scoreTracks.length === 0) return false;

			const currentAllMuted = scoreTracks.every(
				(track) => track.playbackInfo?.isMute === true,
			);

			try {
				api.changeTrackMute(scoreTracks, muted);

				if (!muted) {
					api.changeTrackSolo(scoreTracks, false);
				}

				return muted;
			} catch (err) {
				console.error("[Preview] Failed to apply score track mute state:", err);
				return currentAllMuted;
			}
		},
		[],
	);

	useEffect(() => {
		metronomeOnlyModeRef.current = metronomeOnlyMode;
	}, [metronomeOnlyMode]);

	// Bar highlight: use lib and keep lastColoredBars in ref for callbacks
	const sanitizeAllBarStyles = useCallback(
		(api: alphaTab.AlphaTabApi) => sanitizeAllBarStylesLib(api),
		[],
	);

	const applyThemeColorsToPreviousBars = useCallback(
		(_api: alphaTab.AlphaTabApi) => {
			applyThemeColorsToPreviousBarsLib(_api, lastColoredBarsRef.current);
			lastColoredBarsRef.current = null;
		},
		[],
	);

	const applyEditorBarNumberColor = useCallback(
		(api: alphaTab.AlphaTabApi, barIndex: number): boolean => {
			const result = applyEditorBarNumberColorLib(
				api,
				barIndex,
				lastColoredBarsRef.current as LastColoredBars,
			);
			lastColoredBarsRef.current = result.newLastColored;
			return result.applied;
		},
		[],
	);

	const applyAtDocHotSettings = useCallback((api: alphaTab.AlphaTabApi) => {
		const atCfg = atDocConfigRef.current;
		if (!atCfg.player) return;

		if (typeof atCfg.player.playbackSpeed === "number") {
			try {
				api.playbackSpeed = atCfg.player.playbackSpeed;
			} catch (err) {
				console.warn("[ATDOC] Failed to apply playbackSpeed", err);
			}
		}

		if (typeof atCfg.player.volume === "number") {
			try {
				api.masterVolume = atCfg.player.volume;
			} catch (err) {
				console.warn("[ATDOC] Failed to apply volume", err);
			}
		}

		if (typeof atCfg.player.metronomeVolume === "number") {
			try {
				api.metronomeVolume = atCfg.player.metronomeVolume;
			} catch (err) {
				console.warn("[ATDOC] Failed to apply metronomeVolume", err);
			}
		}

		if (typeof atCfg.player.countInEnabled === "boolean") {
			try {
				api.countInVolume = atCfg.player.countInEnabled ? 1 : 0;
			} catch (err) {
				console.warn("[ATDOC] Failed to apply countInEnabled", err);
			}
		}
	}, []);

	const applyAtDocTrackMixSettings = useCallback(
		(api: alphaTab.AlphaTabApi) => {
			const playerCfg = atDocConfigRef.current.player;
			if (!playerCfg) return;
			const hasMuteConfig = Array.isArray(playerCfg.muteTracks);
			const hasSoloConfig = Array.isArray(playerCfg.soloTracks);
			if (!hasMuteConfig && !hasSoloConfig) return;

			const allTracks = api.score?.tracks ?? [];
			if (allTracks.length === 0) return;

			const trackByIndex = new Map(
				allTracks.map((track) => [track.index, track]),
			);
			const muteTracks = (playerCfg.muteTracks ?? [])
				.map((index) => trackByIndex.get(index))
				.filter((track): track is alphaTab.model.Track => Boolean(track));
			const soloTracks = (playerCfg.soloTracks ?? [])
				.map((index) => trackByIndex.get(index))
				.filter((track): track is alphaTab.model.Track => Boolean(track));

			try {
				api.changeTrackSolo(allTracks, false);
				api.changeTrackMute(allTracks, false);
				if (muteTracks.length > 0) {
					api.changeTrackMute(muteTracks, true);
				}
				if (soloTracks.length > 0) {
					api.changeTrackSolo(soloTracks, true);
				}
			} catch (err) {
				console.warn("[ATDOC] Failed to apply track mute/solo directives", err);
			}
		},
		[],
	);

	const syncStoreFromAtDoc = useCallback((cfg: AtDocConfig) => {
		const store = useAppStore.getState();
		if (typeof cfg.display?.scale === "number") {
			const pct = Math.max(
				10,
				Math.min(400, Math.round(cfg.display.scale * 100)),
			);
			zoomRef.current = pct;
			store.setZoomPercent(pct);
		}
		if (typeof cfg.player?.playbackSpeed === "number") {
			store.setPlaybackSpeed(cfg.player.playbackSpeed);
		}
		if (typeof cfg.player?.volume === "number") {
			store.setMasterVolume(cfg.player.volume);
		}
		if (typeof cfg.player?.metronomeVolume === "number") {
			store.setMetronomeVolume(cfg.player.metronomeVolume);
		}
		if (typeof cfg.player?.countInEnabled === "boolean") {
			store.setCountInEnabled(cfg.player.countInEnabled);
		}
	}, []);

	const applyAtDocWarmSettings = useCallback((api: alphaTab.AlphaTabApi) => {
		const atCfg = atDocConfigRef.current;
		if (!api.settings) return;

		let changed = false;
		const settings = api.settings as unknown as {
			display?: { scale?: number; layoutMode?: alphaTab.LayoutMode };
			player?: {
				scrollMode?: alphaTab.ScrollMode;
				scrollSpeed?: number;
				enableCursor?: boolean;
				enableElementHighlighting?: boolean;
				enableUserInteraction?: boolean;
			};
		};

		if (atCfg.display && settings.display) {
			if (typeof atCfg.display.scale === "number") {
				settings.display.scale = atCfg.display.scale;
				changed = true;
			}
			if (typeof atCfg.display.layoutMode === "number") {
				settings.display.layoutMode = atCfg.display.layoutMode;
				changed = true;
			}
		}

		if (atCfg.player && settings.player) {
			if (typeof atCfg.player.scrollMode === "number") {
				settings.player.scrollMode = atCfg.player.scrollMode;
				changed = true;
			}
			if (typeof atCfg.player.scrollSpeed === "number") {
				settings.player.scrollSpeed = atCfg.player.scrollSpeed;
				changed = true;
			}
			if (typeof atCfg.player.enableCursor === "boolean") {
				settings.player.enableCursor = atCfg.player.enableCursor;
				changed = true;
			}
			if (typeof atCfg.player.enableElementHighlighting === "boolean") {
				settings.player.enableElementHighlighting =
					atCfg.player.enableElementHighlighting;
				changed = true;
			}
			if (typeof atCfg.player.enableUserInteraction === "boolean") {
				settings.player.enableUserInteraction =
					atCfg.player.enableUserInteraction;
				changed = true;
			}
		}

		if (changed) {
			try {
				api.updateSettings?.();
				api.render?.();
			} catch (err) {
				console.warn("[ATDOC] Failed to apply warm settings", err);
			}
		}
	}, []);

	usePreviewBarHighlight(
		apiRef,
		editorCursor,
		applyThemeColorsToPreviousBars,
		applyEditorBarNumberColor,
		pendingBarColorRef,
	);

	usePreviewSelectionSync({
		apiRef,
		containerRef,
		scrollHostRef,
		editorCursor,
		applyEditorBarNumberColor,
		pendingBarColorRef,
		isEditorCursorFromScoreRef,
		isHighlightFromEditorCursorRef,
		lastEditorCursorSelectionRef,
	});

	/**
	 * Apply tracks display configuration to the first track
	 * Read saved configuration from trackConfigRef, use defaults if not available
	 */
	const applyTracksConfig = useCallback(
		(api: alphaTab.AlphaTabApi) => {
			if (atDocConfigRef.current.staff) {
				const appliedFromAtDoc = applyStaffConfig(
					api,
					atDocConfigRef.current.staff,
				);
				if (appliedFromAtDoc) {
					trackConfigRef.current = appliedFromAtDoc;
					setFirstStaffOptions(appliedFromAtDoc);
					return;
				}
			}

			// First load: try to prefer TAB (silent dry-run). If it errors, keep alphaTab default.
			if (!trackConfigRef.current) {
				if (tabProbeRef.current.active) return;
				const current = getFirstStaffOptions(api);
				if (!current) return;

				const preferTab = {
					...current,
					showTablature: true,
					showStandardNotation: false,
				};

				tabProbeRef.current.active = true;
				tabProbeRef.current.prev = current;
				tabProbeRef.current.lastProbeAt = Date.now();
				if (tabProbeRef.current.timeoutId != null) {
					clearTimeout(tabProbeRef.current.timeoutId);
				}
				// Failsafe: finalize even if renderFinished never arrives.
				tabProbeRef.current.timeoutId = window.setTimeout(() => {
					if (!tabProbeRef.current.active) return;
					tabProbeRef.current.active = false;
					const applied = getFirstStaffOptions(api) ?? tabProbeRef.current.prev;
					if (applied) {
						trackConfigRef.current = applied;
						setFirstStaffOptions(applied);
					}
				}, 1200);

				try {
					// This may trigger async worker errors; those are handled in api.error while probe is active.
					applyStaffConfig(api, preferTab);
				} catch (e) {
					// Sync failure: rollback immediately, without surfacing to UI.
					tabProbeRef.current.active = false;
					if (tabProbeRef.current.timeoutId != null) {
						clearTimeout(tabProbeRef.current.timeoutId);
						tabProbeRef.current.timeoutId = null;
					}
					try {
						applyStaffConfig(api, current);
					} catch {}
					trackConfigRef.current = current;
					setFirstStaffOptions(current);
					console.warn("[Preview] TAB probe sync-failed; kept default.", e);
				}
				return;
			}

			// Subsequent loads / rebuild: apply saved config (e.g. user toggled)
			const appliedConfig = applyStaffConfig(api, trackConfigRef.current);
			if (appliedConfig) setFirstStaffOptions(appliedConfig);
		},
		[setFirstStaffOptions],
	);

	const getBeatStartTick = useCallback(
		(beat: alphaTab.model.Beat): number | null => {
			const api = apiRef.current;
			if (api?.tickCache && typeof api.tickCache.getBeatStart === "function") {
				const startTick = api.tickCache.getBeatStart(beat);
				if (typeof startTick === "number" && startTick >= 0) return startTick;
			}

			const beatCandidate = beat as unknown as {
				playbackStart?: unknown;
				displayStart?: unknown;
			};

			if (
				typeof beatCandidate.playbackStart === "number" &&
				beatCandidate.playbackStart >= 0
			) {
				return beatCandidate.playbackStart;
			}

			if (
				typeof beatCandidate.displayStart === "number" &&
				beatCandidate.displayStart >= 0
			) {
				return beatCandidate.displayStart;
			}

			return null;
		},
		[],
	);

	// Handle staff toggle requests from GlobalBottomBar
	useEffect(() => {
		if (pendingStaffToggle) {
			const api = apiRef.current;
			if (!api) return;

			const newValue = toggleFirstStaffOption(api, pendingStaffToggle);
			if (newValue !== null) {
				// Update state in store
				toggleFirstStaffOptionStore(pendingStaffToggle);
			}

			// Clear pending toggle
			setTimeout(() => useAppStore.setState({ pendingStaffToggle: null }), 0);
		}
	}, [pendingStaffToggle, toggleFirstStaffOptionStore]);

	useEffect(() => {
		if (!containerRef.current) return;

		// 使用 reinitTrigger 触发重新初始化（例如从打印预览返回时）
		if (reinitTrigger > 0) {
			// Reinitializing alphaTab API
		}

		/**
		 * 🆕 统一附加所有 alphaTab 事件监听器
		 * 确保在初始化和主题重建时都能正确绑定所有功能
		 */
		const attachApiListeners = (api: alphaTab.AlphaTabApi) => {
			const eventTeardowns: Array<() => void> = [];
			const subscribe = <TArgs extends unknown[]>(
				emitter:
					| {
							on: (...args: TArgs) => unknown;
					  }
					| undefined,
				...args: TArgs
			) => {
				if (!emitter) return;
				try {
					const off = emitter.on(...args);
					if (typeof off === "function") {
						eventTeardowns.push(() => {
							off();
						});
					}
				} catch {}
			};
			// 1. 音频加载
			try {
				subscribe(api.soundFontLoaded, () => {
					console.info("[Preview] alphaTab soundfont loaded");
					try {
						if (api) api.masterVolume = masterVolumeRef.current;
					} catch (_) {
						// ignore if property not available
					}
				});
			} catch {
				// Soundfont event binding failed
			}

			// 2. 渲染完成（处理光标，注意：不要修改播放状态）
			subscribe(api.renderFinished, (r) => {
				console.info("[Preview] alphaTab render complete:", r);
				// If we are probing TAB on first load, wait a short grace period before finalizing.
				// Some worker errors can arrive slightly after renderFinished.
				if (tabProbeRef.current.active) {
					if (tabProbeRef.current.timeoutId != null) {
						clearTimeout(tabProbeRef.current.timeoutId);
					}
					tabProbeRef.current.timeoutId = window.setTimeout(() => {
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
				// 暂时关闭自定义播放器光标隐藏
				// const cursor = _cursorRef.current;
				// if (cursor) cursor.classList.add("hidden");
				// 渲染完成时回到无高亮状态（避免保留旧的黄色小节高亮导致滚动锁定）
				useAppStore.getState().clearPlaybackHighlights();
				setPlaybackProgressIfChanged({
					positionTick: 0,
					endTick:
						typeof api.endTick === "number" ? Math.max(0, api.endTick) : 0,
					positionMs: 0,
					endMs: typeof api.endTime === "number" ? Math.max(0, api.endTime) : 0,
				});

				// 🆕 尝试提取乐谱的初始 BPM（以便 BPM 模式使用）
				try {
					const score = api?.score;
					let initialBpm: number | null = null;
					if (score) {
						if (score.masterBars?.length) {
							const mb0 = score.masterBars[0] as unknown as {
								tempoChanges?: Array<{ value?: number }>;
							};
							if (mb0?.tempoChanges?.length) {
								const mc = mb0.tempoChanges[0];
								if (mc && typeof mc.value === "number") initialBpm = mc.value;
							} else if (
								typeof (score as unknown as { tempo?: number }).tempo ===
								"number"
							) {
								initialBpm =
									(score as unknown as { tempo?: number }).tempo ?? null;
							}
						}
					}
					useAppStore.getState().setSongInitialBpm(initialBpm);
				} catch {
					// setSongInitialBpm failed
				}
			});

			// 3. 播放进度（更新光标位置）
			subscribe(api.playedBeatChanged, (beat: alphaTab.model.Beat | null) => {
				if (!beat) {
					// 播放停止/结束时回到无高亮状态（同时清除黄色小节高亮的来源）
					useAppStore.getState().clearPlaybackHighlights();
					setPlayerIsPlayingIfChanged(false);
					setPlaybackProgressIfChanged({
						positionTick: 0,
						endTick:
							typeof api.endTick === "number" ? Math.max(0, api.endTick) : 0,
						positionMs: 0,
						endMs:
							typeof api.endTime === "number" ? Math.max(0, api.endTime) : 0,
					});
					return;
				}
				const barIndex = beat.voice?.bar?.index ?? 0;
				const beatIndex = beat.index ?? 0;
				useAppStore.getState().setPlaybackBeat({ barIndex, beatIndex });
				// 🆕 同时更新播放器光标位置（暂停后保留）
				setPlayerCursorIfChanged({ barIndex, beatIndex });

				// 暂时关闭自定义播放器光标更新
				/*
				const cursor = _cursorRef.current;
				if (!cursor) return;
				const bb = api.boundsLookup?.findBeat?.(beat);
				if (!bb) {
					cursor.classList.add("hidden");
					return;
				}
				cursor.classList.remove("hidden");
				const visual = bb.visualBounds;
				cursor.style.left = `${visual.x}px`;
				cursor.style.top = `${visual.y}px`;
				cursor.style.width = `${visual.w}px`;
				cursor.style.height = `${visual.h}px`;
				*/
			});

			subscribe(
				api.playerPositionChanged,
				(args: {
					currentTick?: number;
					endTick?: number;
					currentTime?: number;
					endTime?: number;
				}) => {
					const positionTick =
						typeof args?.currentTick === "number"
							? args.currentTick
							: typeof api.tickPosition === "number"
								? api.tickPosition
								: 0;
					const endTick =
						typeof args?.endTick === "number"
							? args.endTick
							: typeof api.endTick === "number"
								? api.endTick
								: 0;
					const positionMs =
						typeof args?.currentTime === "number"
							? args.currentTime
							: typeof api.timePosition === "number"
								? api.timePosition
								: 0;
					const endMs =
						typeof args?.endTime === "number"
							? args.endTime
							: typeof api.endTime === "number"
								? api.endTime
								: 0;

					setPlaybackProgressIfChanged({
						positionTick: Math.max(0, positionTick),
						endTick: Math.max(0, endTick),
						positionMs: Math.max(0, positionMs),
						endMs: Math.max(0, endMs),
					});
				},
			);

			// 4. 播放器完成/状态变化事件：确保 UI 与播放器同步
			subscribe(api.playerFinished, () => {
				console.info("[Preview] alphaTab player finished");
				// 播放结束后播放器光标可能回到默认位置，但 store 仍可能停留在末尾
				// 这里强制回到无高亮状态，避免编辑器高亮/滚动锁死在末尾
				useAppStore.getState().clearPlaybackHighlights();
				setPlayerIsPlayingIfChanged(false);
				setPlaybackProgressIfChanged({
					positionTick: 0,
					endTick: typeof api.endTick === "number" ? api.endTick : 0,
					positionMs: 0,
					endMs: typeof api.endTime === "number" ? api.endTime : 0,
				});
			});

			subscribe(
				api.playerStateChanged,
				(e: { state: number; stopped?: boolean }) => {
					console.info("[Preview] alphaTab player state changed:", e);
					if (e?.stopped) {
						// stopped 明确表示停止（而不是暂停），停止时清除播放相关高亮
						useAppStore.getState().clearPlaybackHighlights();
						setPlayerIsPlayingIfChanged(false);
						setPlaybackProgressIfChanged({
							positionTick: 0,
							endTick: typeof api.endTick === "number" ? api.endTick : 0,
							positionMs: 0,
							endMs: typeof api.endTime === "number" ? api.endTime : 0,
						});
					} else if (e?.state === 1 /* Playing */) {
						setPlayerIsPlayingIfChanged(true);
					} else {
						setPlayerIsPlayingIfChanged(false);
					}
				},
			);

			// 🆕 Register playback controls to store so controls can live outside of Preview
			try {
				useAppStore.getState().registerPlayerControls({
					play: () => {
						// 🆕 播放开始时，清除用户手动选择的选区高亮（但保留编辑器光标触发的播放范围）
						// 这样可以避免播放时编辑器中的蓝色选区高亮干扰视觉
						useAppStore.getState().clearScoreSelection();

						// 如果有高亮的小节，从该小节的第一个 beat 开始播放
						const highlightedBar = lastColoredBarsRef.current;
						if (
							highlightedBar &&
							highlightedBar.bars?.length > 0 &&
							api.score
						) {
							const bar = highlightedBar.bars[0];
							// 获取该小节的第一个 beat
							if (bar.voices?.[0]?.beats?.length > 0) {
								const firstBeat = bar.voices[0].beats[0];
								const barIndex = bar.index;
								const beatIndex = firstBeat.index;

								console.info(
									"[Preview] Starting playback from highlighted bar",
									barIndex,
									"beat",
									beatIndex,
								);

								// 先停止当前播放（如果有）
								api.stop?.();

								// 先设置播放器光标位置
								setPlayerCursorIfChanged({
									barIndex,
									beatIndex,
								});

								// 尝试设置播放位置
								let positionSet = false;
								try {
									const startTick = getBeatStartTick(firstBeat);
									if (typeof startTick === "number") {
										api.tickPosition = startTick;
										positionSet = true;
									}
								} catch (err) {
									console.warn(
										"[Preview] Failed to set playback position:",
										err,
									);
								}

								// 如果成功设置了位置，等待一小段时间让位置设置生效，然后播放
								if (positionSet) {
									// 使用 setTimeout 确保位置设置生效后再播放
									setTimeout(() => {
										api.play?.();
									}, 50); // 50ms 延迟，确保位置设置生效
								} else {
									// 如果无法设置位置，尝试使用 highlightPlaybackRange
									// 然后正常播放（可能不会从该位置开始，但至少会高亮）
									if (typeof api.highlightPlaybackRange === "function") {
										api.highlightPlaybackRange(firstBeat, firstBeat);
									}
									api.play?.();
								}
								return;
							}
						}
						// 如果没有高亮小节，正常从头播放
						api.play?.();
					},
					pause: () => api.pause?.(),
					stop: () => {
						// 1. 停止播放器
						api.stop?.();

						// 2. 清除选区高亮
						useAppStore.getState().clearScoreSelection();

						// 3. 清除播放相关高亮（绿色当前 beat 高亮 + 黄色小节高亮）
						useAppStore.getState().clearPlaybackHighlights();

						// 4. 重置播放器状态
						setPlayerIsPlayingIfChanged(false);

						// 5. 清除编辑器光标相关的 refs（避免残留状态）
						isHighlightFromEditorCursorRef.current = false;
						lastEditorCursorSelectionRef.current = null;

						// 6. 🆕 清除小节号红色高亮（Editor -> Preview 的高亮）
						// 恢复之前高亮的小节到默认主题颜色
						try {
							const bars = lastColoredBarsRef.current?.bars;
							if (Array.isArray(bars) && bars.length > 0) {
								applyThemeColorsToPreviousBars(api);
								// 清除 refs
								lastColoredBarsRef.current = null;
								pendingBarColorRef.current = null;
								// 重新渲染以应用颜色更改
								if (api.render) {
									api.render();
								}
							}
						} catch {
							// Failed to clear bar number highlight
						}

						// 7. 清除播放范围和高亮范围
						try {
							api.playbackRange = null;
						} catch {
							// Failed to clear playback range
						}
					},
					refresh: () => {
						bumpEditorRefreshVersion();
						bumpBottomBarRefreshVersion();
						// 1. 先停止播放并清除所有状态
						api.stop?.();
						useAppStore.getState().clearScoreSelection();
						useAppStore.getState().clearPlaybackHighlights();
						useAppStore.getState().setPlayerIsPlaying(false);
						useAppStore.getState().setPlaybackProgress({
							positionTick: 0,
							endTick: typeof api.endTick === "number" ? api.endTick : 0,
							positionMs: 0,
							endMs: typeof api.endTime === "number" ? api.endTime : 0,
						});

						// 2. 清除编辑器光标相关的 refs
						isHighlightFromEditorCursorRef.current = false;
						lastEditorCursorSelectionRef.current = null;

						// 3. 销毁当前 API
						destroyPreviewApi(apiRef, emitApiChange);

						// 4. 清除 pending tex 相关计时器
						clearTexTimeout();

						// 5. 触发重新初始化（通过增加 reinitTrigger）
						setReinitTrigger((prev) => prev + 1);
					},
					applyPlaybackSpeed: (speed: number) => {
						try {
							api.playbackSpeed = speed;
						} catch (err) {
							console.error("Failed to set playback speed:", err);
						}
					},
					setMasterVolume: (volume: number) => {
						const clamped = Math.max(0, Math.min(1, volume));
						try {
							api.masterVolume = clamped;
							lastAppliedMasterVolumeRef.current = clamped;
						} catch (err) {
							console.error("Failed to set master volume:", err);
						}
					},
					setMetronomeVolume: (volume: number) => {
						try {
							api.metronomeVolume = volume;
						} catch (err) {
							console.error("Failed to set metronome volume:", err);
						}
					},
					setCountInEnabled: (enabled: boolean) => {
						try {
							api.countInVolume = enabled ? 1 : 0;
						} catch (err) {
							console.error("Failed to set count-in:", err);
						}
					},
					setScoreTracksMuted: (muted: boolean) => {
						const effectiveMuted = applyScoreTracksMuted(api, muted);
						useAppStore.getState().setMetronomeOnlyMode(effectiveMuted);
					},
					seekPlaybackPosition: (tick: number) => {
						if (!Number.isFinite(tick)) return;
						const maxTick =
							typeof api.endTick === "number" && api.endTick > 0
								? api.endTick
								: tick;
						const targetTick = Math.max(0, Math.min(maxTick, tick));
						try {
							api.tickPosition = targetTick;
							const endTick =
								typeof api.endTick === "number" ? Math.max(0, api.endTick) : 0;
							const endMs =
								typeof api.endTime === "number" ? Math.max(0, api.endTime) : 0;
							const ratio = endTick > 0 ? targetTick / endTick : 0;
							const fallbackPositionMs = endMs > 0 ? ratio * endMs : 0;
							const positionMs =
								typeof api.timePosition === "number"
									? Math.max(0, api.timePosition)
									: fallbackPositionMs;
							setPlaybackProgressIfChanged({
								positionTick: targetTick,
								endTick,
								positionMs,
								endMs,
							});
						} catch (err) {
							console.error("Failed to seek playback position:", err);
						}
					},
					applyZoom: (pct: number) => applyZoom(pct),
				});
			} catch {
				// Failed to register player controls
			}

			// 3.6. 点击曲谱时更新播放器光标位置（不播放也能设置）
			subscribe(api.beatMouseDown, (beat: alphaTab.model.Beat) => {
				if (!beat) return;
				const barIndex = beat.voice?.bar?.index ?? 0;
				const beatIndex = beat.index ?? 0;
				console.info("[Preview] Beat clicked:", `Bar ${barIndex}:${beatIndex}`);
				// 🆕 清除播放高亮（绿色），让黄色小节高亮能够显示
				useAppStore.getState().clearPlaybackBeat();
				// 🆕 清除用户手动选择的选区高亮（点击乐谱时，应该清除之前的选区）
				useAppStore.getState().clearScoreSelection();
				// 更新播放器光标位置，触发编辑器黄色高亮
				setPlayerCursorIfChanged({ barIndex, beatIndex });
			});

			// 🆕 3.5. Selection API (alphaTab 1.8.0+): 监听选区变化，同步到编辑器
			try {
				subscribe(api.playbackRangeHighlightChanged, (e) => {
					const { setScoreSelection, clearScoreSelection } =
						useAppStore.getState();

					// 如果没有选区，清除编辑器高亮
					if (!e.startBeat || !e.endBeat) {
						clearScoreSelection();
						return;
					}

					// 🆕 检查 beat 是否属于当前有效的 score（避免旧曲谱的 beat 触发事件）
					const currentScore = api.score;
					const startBeatScore = e.startBeat.voice?.bar?.staff?.track?.score;
					const endBeatScore = e.endBeat.voice?.bar?.staff?.track?.score;

					if (
						!currentScore ||
						startBeatScore !== currentScore ||
						endBeatScore !== currentScore
					) {
						clearScoreSelection();
						return;
					}

					// 获取选区的小节索引
					const startBarIndex = e.startBeat.voice?.bar?.index ?? 0;
					const endBarIndex = e.endBeat.voice?.bar?.index ?? startBarIndex;

					// 🆕 如果这是由编辑器光标触发的，不设置 scoreSelection，并确保清除选区
					// 避免编辑器中的蓝色选区高亮持续存在
					// 检查方式：1. 标志位 2. 选区是否匹配最后一次编辑器光标选区
					const isFromEditorCursor =
						isHighlightFromEditorCursorRef.current ||
						(lastEditorCursorSelectionRef.current &&
							startBarIndex ===
								lastEditorCursorSelectionRef.current.startBarIndex &&
							endBarIndex === lastEditorCursorSelectionRef.current.endBarIndex);

					if (isFromEditorCursor) {
						// 确保清除选区，防止残留
						clearScoreSelection();
						return;
					}

					// 标记：这次编辑器光标更新是由乐谱选择触发的，防止循环
					isEditorCursorFromScoreRef.current = true;

					// 从 Beat 对象中提取小节和 Beat 索引
					const startBeat = e.startBeat;
					const endBeat = e.endBeat;

					// 获取 Beat 在小节内的索引
					const startBeatIndex = startBeat.index ?? 0;
					const endBeatIndex = endBeat.index ?? 0;

					console.info(
						"[Preview] Selection changed (user selection):",
						`Bar ${startBarIndex}:${startBeatIndex} -> Bar ${endBarIndex}:${endBeatIndex}`,
					);

					// 更新 store，触发 Editor 高亮（只有用户手动选择时才设置）
					setScoreSelection({
						startBarIndex,
						startBeatIndex,
						endBarIndex,
						endBeatIndex,
					});
				});
			} catch {
				// playbackRangeHighlightChanged not available (requires alphaTab 1.8.0+)
			}

			// 4. 改进的错误处理：保留上一次成功的渲染
			subscribe(api.error, (err: unknown) => {
				const fullError = formatFullError(err);
				const now = Date.now();
				const recentlyProbed =
					(tabProbeRef.current.lastProbeAt ?? 0) > 0 &&
					now - (tabProbeRef.current.lastProbeAt ?? 0) < 2000;
				// Keep this intentionally narrow: we only want to rollback for the known
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
						"[Preview] TAB probe internal error; rollback to default.",
						fullError,
					);
					tabProbeRef.current.active = false;
					if (tabProbeRef.current.timeoutId != null) {
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
					// Ensure user does not see an error banner from internal probe failure.
					setParseError(null);
					return;
				}

				if (isNumberedNotationBeatError(fullError)) {
					const rollbackApplied = disableNumberedNotationAcrossScore(api.score);
					if (rollbackApplied) {
						console.warn(
							"[Preview] Numbered notation render failed; rolling back to safe staff options.",
							fullError,
						);
						const restoredFirstStaff = getFirstStaffOptions(api);
						if (restoredFirstStaff) {
							trackConfigRef.current = restoredFirstStaff;
							setFirstStaffOptions(restoredFirstStaff);
						}
						try {
							api.render();
						} catch (rollbackErr) {
							console.warn(
								"[Preview] Failed to re-render after numbered rollback:",
								rollbackErr,
							);
						}
						setParseError(null);
						return;
					}
				}

				console.error("[Preview] alphaTab error:", err);
				console.error("[Preview] Setting error state:", fullError);
				onErrorRecovery(apiRef.current, fullError);
			});

			// 5. 处理 scoreLoaded 事件：保存成功的乐谱并清除错误
			subscribe(api.scoreLoaded, (score) => {
				try {
					if (score?.tracks && score.tracks.length > 0) {
						bumpScoreVersion();

						// 🆕 新乐谱加载时，清除选区高亮和相关的 refs（避免旧乐谱的选区残留）
						useAppStore.getState().clearScoreSelection();
						isHighlightFromEditorCursorRef.current = false;
						lastEditorCursorSelectionRef.current = null;

						// Sanitize any invalid BarStyle.color entries to avoid serializer crashes
						try {
							sanitizeAllBarStyles(api);
						} catch (err) {
							console.error(
								"[BarColor] sanitizeAllBarStyles failed during scoreLoaded:",
								err,
							);
						}
						const currentContent = parseAtDoc(
							latestContentRef.current ?? "",
						).cleanContent;
						onScoreLoadedMatch(score, currentContent);
						if (apiRef.current) {
							applyAtDocWarmSettings(apiRef.current);
							applyAtDocHotSettings(apiRef.current);
							applyAtDocTrackMixSettings(apiRef.current);
							applyAtDocColoring(
								apiRef.current,
								atDocConfigRef.current,
								(message) => console.warn(message),
							);
						}
						// 🆕 统一调用 applyTracksConfig，无论是首次还是重建
						if (apiRef.current) applyTracksConfig(apiRef.current);
						if (apiRef.current && metronomeOnlyModeRef.current) {
							applyScoreTracksMuted(apiRef.current, true);
						}
						// 🆕 如果有挂起的小节号高亮请求，scoreLoaded 后执行
						if (apiRef.current && pendingBarColorRef.current !== null) {
							applyEditorBarNumberColor(
								apiRef.current,
								pendingBarColorRef.current,
							);
							pendingBarColorRef.current = null;
						}
					}
				} catch (e) {
					console.error("[Preview] Failed to apply tracks config", e);
				}
			});
			return () => {
				for (let i = eventTeardowns.length - 1; i >= 0; i -= 1) {
					try {
						eventTeardowns[i]?.();
					} catch {}
				}
			};
		};

		const bindListenersForApi = (api: alphaTab.AlphaTabApi) => {
			const teardown = bindPreviewEvents({
				api,
				attachApiListeners,
				incrementCounter: increment,
				dumpCounters,
			});
			if (typeof teardown === "function") {
				listenerTeardownsRef.current.push(teardown);
			}
		};

		const initAlphaTab = async () => {
			try {
				transitionLifecycle("initializing", "initAlphaTab-start");
				dumpCounters("initAlphaTab-start");
				const parsedAtDoc = parseAtDoc(latestContentRef.current ?? "");
				atDocConfigRef.current = parsedAtDoc.config;
				syncStoreFromAtDoc(parsedAtDoc.config);
				for (const warning of parsedAtDoc.warnings) {
					console.warn(`[ATDOC:${warning.line}] ${warning.message}`);
				}

				// 1. 获取所有资源 URL（自动适配 dev 和打包环境）
				const urls = await getResourceUrls();
				const el = containerRef.current as HTMLElement;
				// 实际滚动容器：优先使用 scrollHostRef（overflow-auto），
				// 退回到原来的父元素以保持兼容性。
				const fallbackScrollEl = (el.parentElement ?? el) as HTMLElement;
				const scrollEl =
					(scrollHostRef.current as HTMLElement | null) ?? fallbackScrollEl;

				// 2. 加载 Bravura 字体
				try {
					await loadBravuraFont(urls.bravuraFontUrl);
				} catch (e) {
					console.warn("[Preview] Bravura font load failed:", e);
				}

				// 3. 如果 API 尚未初始化，创建它
				if (!apiRef.current) {
					// 获取当前主题的颜色
					const colors = getAlphaTabColorsForTheme();

					// 使用工具函数创建预览配置
					const settings = createPreviewSettings(urls as ResourceUrls, {
						scale: zoomRef.current / 100,
						scrollElement: scrollEl,
						enablePlayer: !editorHasFocusRef.current,
						colors,
					});

					apiRef.current = new alphaTab.AlphaTabApi(el, settings);
					increment("apiCreated");
					emitApiChange(apiRef.current);
					bumpApiInstanceId();

					// 🆕 新建 API 时清除选区高亮（避免旧 API 的选区残留）
					useAppStore.getState().clearScoreSelection();

					// 初始应用全局状态的播放速度与节拍器音量
					try {
						apiRef.current.playbackSpeed = playbackSpeedRef.current;
						apiRef.current.masterVolume = masterVolumeRef.current;
						apiRef.current.metronomeVolume = metronomeVolumeRef.current;
						apiRef.current.countInVolume = countInEnabledRef.current ? 1 : 0;
					} catch {
						// Failed to apply initial speed/metronome
					}

					// 4. 附加监听器
					bindListenersForApi(apiRef.current);

					// 5. 设置主题监听器（监听暗色模式变化）
					const unsubscribeTheme = setupThemeObserver(() => {
						// 当主题变化时，重建 API 以应用新的颜色配置

						if (apiRef.current && latestContentRef.current) {
							const now = Date.now();
							if (now - lastRebuildAtRef.current < 250) return;
							lastRebuildAtRef.current = now;
							increment("rebuildRequested");
							transitionLifecycle("rebuilding", "theme-observer");
							// 使用 void 操作符确保异步操作在后台执行（不阻塞回调）
							void (async () => {
								try {
									// 保存当前的 tracks 配置
									if (apiRef.current?.score?.tracks?.[0]) {
										const st = apiRef.current.score.tracks[0].staves?.[0];
										if (st) {
											trackConfigRef.current = {
												showTablature: st.showTablature,
												showStandardNotation: st.showStandardNotation,
												showSlash: st.showSlash,
												showNumbered: st.showNumbered,
											};
											// Saved tracks config before rebuild
										}
									}

									// 保存当前的乐谱内容（使用最新值，避免闭包过期）
									const currentContent = parseAtDoc(
										latestContentRef.current,
									).cleanContent;

									destroyCurrentApi();

									// 获取新的颜色配置
									const newColors = getAlphaTabColorsForTheme();

									// 使用工具函数重新创建 API 配置
									const newSettings = createPreviewSettings(
										urls as ResourceUrls,
										{
											scale: zoomRef.current / 100,
											scrollElement:
												(scrollHostRef.current as HTMLElement | null) ??
												scrollEl,
											enablePlayer: !editorHasFocusRef.current,
											colors: newColors,
										},
									);

									// 创建新的 API
									apiRef.current = new alphaTab.AlphaTabApi(el, newSettings);
									increment("apiCreated");
									emitApiChange(apiRef.current);
									bumpApiInstanceId();

									// 🆕 新建 API 时清除选区高亮（避免旧 API 的选区残留）
									useAppStore.getState().clearScoreSelection();

									// 重新应用全局状态的播放速度与节拍器音量
									try {
										apiRef.current.playbackSpeed = playbackSpeedRef.current;
										apiRef.current.masterVolume = masterVolumeRef.current;
										apiRef.current.metronomeVolume = metronomeVolumeRef.current;
										apiRef.current.countInVolume = countInEnabledRef.current
											? 1
											: 0;
									} catch {
										// Failed to reapply speed/metronome after rebuild
									}

									// 🆕 附加所有监听器（包括 scoreLoaded, error, playback 等）
									bindListenersForApi(apiRef.current);

									// 重新加载音频
									await loadSoundFontFromUrl(apiRef.current, urls.soundFontUrl);

									// 重新设置乐谱内容
									try {
										scheduleTexTimeout(currentContent, {
											setErrorOnTimeout: false,
										});
										markLoadAsUserContent(true);
										apiRef.current.tex(currentContent);
										increment("rebuildCompleted");
										transitionLifecycle("ready", "theme-rebuild-complete");
										dumpCounters("theme-rebuild-complete");
									} catch (syncError) {
										console.error(
											"[Preview] Synchronous error in theme rebuild tex():",
											syncError,
										);
									}
								} catch (e) {
									console.error(
										"[Preview] Failed to rebuild alphaTab after theme change:",
										e,
									);
								}
							})();
						}
					});

					// 保存清理函数供后续使用
					(
						apiRef.current as unknown as Record<string, unknown>
					).__unsubscribeTheme = unsubscribeTheme;

					// 6. 加载音频字体
					try {
						await loadSoundFontFromUrl(apiRef.current, urls.soundFontUrl);
					} catch {
						// Could not load soundfont (this is optional)
					}
				}
				const initialContentRaw =
					pendingContentRef.current ?? latestContentRef.current;
				const initialContent = parseAtDoc(initialContentRaw).cleanContent;
				pendingContentRef.current = null;

				if (apiRef.current && initialContent) {
					if (lastAppliedTexContentRef.current === initialContent) {
						transitionLifecycle("ready", "initAlphaTab-done-noop");
						dumpCounters("init-done-noop-tex");
						return;
					}
					try {
						scheduleTexTimeout(initialContent);
						markLoadAsUserContent(true);
						apiRef.current.tex(initialContent);
						lastAppliedTexContentRef.current = initialContent;
					} catch (syncError) {
						console.error("[Preview] Synchronous error in tex():", syncError);
						const errorMsg =
							syncError instanceof Error
								? syncError.message
								: String(syncError);
						console.warn(
							"[Preview] sync tex() call failed; not showing parse error UI:",
							errorMsg,
						);
					}
				} else if (apiRef.current && !initialContent) {
					if (lastAppliedTexContentRef.current === "") {
						transitionLifecycle("ready", "initAlphaTab-done-empty-noop");
						dumpCounters("init-done-empty-noop");
						return;
					}
					clearTexTimeout();
					setParseError(null);
					markLoadAsUserContent(true);
					apiRef.current.tex("");
					lastAppliedTexContentRef.current = "";
				}
				transitionLifecycle("ready", "initAlphaTab-done");
				dumpCounters("init-done");
			} catch (err) {
				transitionLifecycle("error", "initAlphaTab-error");
				console.error("[Preview] Failed to initialize alphaTab:", err);
			}
		};

		initAlphaTab();

		// Cleanup on unmount
		return () => {
			destroyCurrentApi();
			transitionLifecycle("destroyed", "preview-unmount");
			dumpCounters("preview-unmount");
			clearTexTimeout();
		};
	}, [
		destroyCurrentApi,
		bindPreviewEvents,
		applyTracksConfig,
		reinitTrigger,
		applyZoom,
		applyScoreTracksMuted,
		applyEditorBarNumberColor,
		bumpScoreVersion,
		bumpApiInstanceId,
		bumpEditorRefreshVersion,
		bumpBottomBarRefreshVersion,
		emitApiChange,
		sanitizeAllBarStyles,
		applyThemeColorsToPreviousBars,
		scheduleTexTimeout,
		markLoadAsUserContent,
		clearTexTimeout,
		applyAtDocHotSettings,
		applyAtDocTrackMixSettings,
		applyAtDocWarmSettings,
		syncStoreFromAtDoc,
		onErrorRecovery,
		onScoreLoadedMatch,
		setParseError,
		setFirstStaffOptions,
		getBeatStartTick,
		increment,
		dumpCounters,
		transitionLifecycle,
		setPlaybackProgressIfChanged,
		setPlayerCursorIfChanged,
		setPlayerIsPlayingIfChanged,
	]);

	// 内容更新：仅调用 tex，不销毁 API，避免闪烁
	useEffect(() => {
		const api = apiRef.current;

		// Queue content update if API is not ready yet
		if (!api) {
			pendingContentRef.current = content ?? "";
			return;
		}

		// Apply any pending content first
		const contentToApplyRaw = pendingContentRef.current ?? content ?? "";
		const parsedAtDoc = parseAtDoc(contentToApplyRaw);
		atDocConfigRef.current = parsedAtDoc.config;
		syncStoreFromAtDoc(parsedAtDoc.config);
		applyAtDocTrackMixSettings(api);
		for (const warning of parsedAtDoc.warnings) {
			console.warn(`[ATDOC:${warning.line}] ${warning.message}`);
		}
		const contentToApply = parsedAtDoc.cleanContent;
		pendingContentRef.current = null;

		useAppStore.getState().clearScoreSelection();

		if (contentToApply) {
			if (lastAppliedTexContentRef.current === contentToApply) {
				return;
			}
			try {
				scheduleTexTimeout(contentToApply);
				markLoadAsUserContent(true);
				api.tex(contentToApply);
				lastAppliedTexContentRef.current = contentToApply;
			} catch (syncError) {
				console.error("[Preview] Synchronous error in tex():", syncError);
				const errorMsg =
					syncError instanceof Error ? syncError.message : String(syncError);
				console.warn(
					"[Preview] sync tex() call failed; not showing parse error UI:",
					errorMsg,
				);
			}
		} else {
			if (lastAppliedTexContentRef.current === "") {
				return;
			}
			clearTexTimeout();
			setParseError(null);
			markLoadAsUserContent(true);
			try {
				api.tex("");
				lastAppliedTexContentRef.current = "";
			} catch (emptyErr) {
				console.error("[Preview] Failed to clear score:", emptyErr);
			}
		}
	}, [
		content,
		scheduleTexTimeout,
		markLoadAsUserContent,
		clearTexTimeout,
		syncStoreFromAtDoc,
		applyAtDocTrackMixSettings,
		setParseError,
	]);

	usePrintPreviewApiLifecycle({
		showPrintPreview,
		apiRef,
		emitApiChange,
		setReinitTrigger,
		onBeforeDestroy: destroyCurrentApi,
	});

	return (
		<TooltipProvider delayDuration={200}>
			<div
				className={`flex-1 flex flex-col h-full overflow-hidden ${className ?? ""}`}
			>
				{/* 当打印预览显示时，隐藏主预览区域以避免资源冲突 */}
				{!showPrintPreview && (
					<>
						{/* 错误提示已移到底部 */}
						<TopBar
							icon={
								<FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
							}
							title={
								<span className="sr-only">
									{fileName ?? t("common:preview")}
								</span>
							}
							trailing={
								<PreviewToolbar
									apiRef={apiRef}
									fileName={fileName}
									content={content}
									onPrintClick={() => setShowPrintPreview(true)}
									onEnjoyToggle={onEnjoyToggle}
									isEnjoyMode={isEnjoyMode}
									t={t}
								/>
							}
						/>
						<div className="flex-1 relative overflow-hidden">
							<div
								ref={scrollHostRef}
								className="absolute inset-0 overflow-auto"
							>
								<div
									className={`w-full min-h-full pb-[var(--scroll-buffer)] ${mobileScoreFit ? "preview-mobile-fit overflow-x-auto" : "overflow-x-hidden"}`}
								>
									<div ref={containerRef} className="w-full h-full" />
								</div>
								{/* 暂时关闭自定义播放器光标功能
								<div
									ref={_cursorRef}
									className="pointer-events-none absolute z-20 rounded-sm hidden"
									style={{
										backgroundColor: "var(--player-cursor-bg)",
										border: "2px solid var(--player-cursor-border)",
									}}
								/>
								*/}
							</div>
						</div>
						{parseError && (
							<div className="bg-destructive/10 text-destructive px-3 py-2 text-xs border-t border-destructive/20 flex items-start gap-2">
								<span className="font-semibold shrink-0"></span>
								<div className="flex-1 min-w-0">
									<div className="font-medium">{t("errors:parseError")}</div>
									<div className="mt-0.5 text-destructive/80 break-words">
										{parseError}
									</div>
									{restorePerformed && lastValidScoreRef.current && (
										<div className="mt-1 text-destructive/60 text-[11px]">
											{t("errors:restored")}
										</div>
									)}
								</div>
								<Tooltip>
									<TooltipTrigger asChild>
										<button
											type="button"
											onClick={() => setParseError(null)}
											className="shrink-0 text-destructive/60 hover:text-destructive text-lg leading-none"
										>
											×
										</button>
									</TooltipTrigger>
									<TooltipContent side="left">
										<p>{t("errors:dismissTooltip")}</p>
									</TooltipContent>
								</Tooltip>
							</div>
						)}
					</>
				)}

				{/* 打印预览模态窗口 */}
				{showPrintPreview && content && (
					<Suspense
						fallback={<div className="flex-1 bg-background" aria-busy="true" />}
					>
						<PrintPreview
							content={content}
							fileName={fileName}
							onClose={() => setShowPrintPreview(false)}
						/>
					</Suspense>
				)}
			</div>
		</TooltipProvider>
	);
}
