import {
	ChevronLeft,
	ChevronRight,
	Hourglass,
	ListMusic,
	Lock,
	Minus,
	Music2,
	Pause,
	Play,
	Plus,
	RotateCw,
	Settings,
	Square,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TutorialMetadata } from "../data/tutorials";
import {
	getNextTutorial,
	getPrevTutorial,
	getTutorialDisplayTitle,
} from "../lib/tutorial-loader";
import { useAppStore } from "../store/appStore";
import BpmStepper from "./BpmStepper";
import StaffControls from "./StaffControls";
import { defaultSettingsPages } from "./settings-pages";
import IconButton from "./ui/icon-button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "./ui/select";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "./ui/tooltip";

function TutorialBottomBar({
	prevTutorial,
	nextTutorial,
	onSelectTutorial,
	t,
}: {
	prevTutorial: TutorialMetadata | null;
	nextTutorial: TutorialMetadata | null;
	onSelectTutorial: (id: string) => void;
	t: (key: string, opts?: Record<string, string>) => string;
}) {
	if (!prevTutorial && !nextTutorial) return null;
	const prevTitle = prevTutorial ? getTutorialDisplayTitle(prevTutorial) : "";
	const nextTitle = nextTutorial ? getTutorialDisplayTitle(nextTutorial) : "";
	return (
		<div className="flex items-center gap-3">
			<span className="text-xs text-muted-foreground/70 hidden sm:inline">
				{t("toolbar:tutorial.keyboardHint")}
			</span>
			<div className="flex items-center gap-2">
				{prevTutorial && (
					<Tooltip>
						<TooltipTrigger asChild>
							<button
								type="button"
								onClick={() => onSelectTutorial(prevTutorial.id)}
								className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-accent hover:text-accent-foreground transition-colors text-xs"
								aria-label={t("toolbar:tutorial.prevWithTitle", {
									title: prevTitle,
								})}
							>
								<ChevronLeft className="h-3.5 w-3.5" />
								<span className="text-xs">
									{t("toolbar:tutorial.prevWithTitle", {
										title: prevTitle,
									})}
								</span>
							</button>
						</TooltipTrigger>
						<TooltipContent side="top">
							<p>
								{t("toolbar:tutorial.prevTooltip", {
									title: prevTitle,
								})}
							</p>
						</TooltipContent>
					</Tooltip>
				)}
				{nextTutorial && (
					<Tooltip>
						<TooltipTrigger asChild>
							<button
								type="button"
								onClick={() => onSelectTutorial(nextTutorial.id)}
								className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-accent hover:text-accent-foreground transition-colors text-xs"
								aria-label={t("toolbar:tutorial.nextWithTitle", {
									title: nextTitle,
								})}
							>
								<span className="text-xs">
									{t("toolbar:tutorial.nextWithTitle", {
										title: nextTitle,
									})}
								</span>
								<ChevronRight className="h-3.5 w-3.5" />
							</button>
						</TooltipTrigger>
						<TooltipContent side="top">
							<p>
								{t("toolbar:tutorial.nextTooltip", {
									title: nextTitle,
								})}
							</p>
						</TooltipContent>
					</Tooltip>
				)}
			</div>
		</div>
	);
}

function SettingsBottomBar({
	activeSettingsPageId,
	t,
}: {
	activeSettingsPageId: string | null;
	t: (key: string) => string;
}) {
	if (!activeSettingsPageId) return null;
	const currentPage = defaultSettingsPages.find(
		(p) => p.id === activeSettingsPageId,
	);
	return (
		<div className="flex items-center gap-2 text-xs text-muted-foreground">
			{currentPage ? (
				<span>{t(`settings:${currentPage.id}`)}</span>
			) : (
				<span>{t("common:settings")}</span>
			)}
		</div>
	);
}

function formatPlaybackTime(ms: number): string {
	if (!Number.isFinite(ms) || ms <= 0) return "00:00";
	const totalSeconds = Math.floor(ms / 1000);
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function EditorBottomBar({
	firstStaffOptions,
	requestStaffToggle,
	zoomPercent,
	setZoomPercent,
	playerControls,
	playbackSpeed,
	setPlaybackSpeed,
	playbackBpmMode,
	metronomeVolume,
	setMetronomeVolume,
	countInEnabled,
	setCountInEnabled,
	enablePlaybackProgressBar,
	enablePlaybackProgressSeek,
	playbackPositionTick,
	playbackEndTick,
	playbackPositionMs,
	playbackEndMs,
	playerIsPlaying,
	isTracksPanelOpen,
	toggleTracksPanel,
	setWorkspaceMode,
	setActiveSettingsPageId,
	workspaceMode,
	activeSettingsPageId,
	t,
}: {
	firstStaffOptions: ReturnType<
		typeof useAppStore.getState
	>["firstStaffOptions"];
	requestStaffToggle: ReturnType<
		typeof useAppStore.getState
	>["requestStaffToggle"];
	zoomPercent: number;
	setZoomPercent: (p: number) => void;
	playerControls: ReturnType<typeof useAppStore.getState>["playerControls"];
	playbackSpeed: number;
	setPlaybackSpeed: (s: number) => void;
	playbackBpmMode: boolean;
	metronomeVolume: number;
	setMetronomeVolume: (v: number) => void;
	countInEnabled: boolean;
	setCountInEnabled: (v: boolean) => void;
	enablePlaybackProgressBar: boolean;
	enablePlaybackProgressSeek: boolean;
	playbackPositionTick: number;
	playbackEndTick: number;
	playbackPositionMs: number;
	playbackEndMs: number;
	playerIsPlaying: boolean;
	isTracksPanelOpen: boolean;
	toggleTracksPanel: () => void;
	setWorkspaceMode: (
		mode: "editor" | "enjoy" | "tutorial" | "settings",
	) => void;
	setActiveSettingsPageId: (id: string | null) => void;
	workspaceMode: "editor" | "enjoy" | "tutorial" | "settings";
	activeSettingsPageId: string | null;
	t: (key: string) => string;
}) {
	// 获取自定义播放器配置
	const customPlayerConfig = useAppStore((s) => s.customPlayerConfig);

	// 预定义组件
	const playbackSpeedControl = playbackBpmMode ? (
		<BpmStepper />
	) : (
		<Select
			value={String(playbackSpeed)}
			onValueChange={(value) => {
				const v = Number.parseFloat(value);
				if (Number.isNaN(v)) return;
				setPlaybackSpeed(v);
				playerControls?.applyPlaybackSpeed?.(v);
			}}
		>
			<SelectTrigger aria-label={t("toolbar:playbackSpeed")}>
				<SelectValue />
			</SelectTrigger>
			<SelectContent side="top" align="end">
				{[0.5, 0.75, 1, 1.25, 1.5, 2].map((v) => (
					<SelectItem key={v} value={String(v)}>
						{v}x
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);

	const zoomControls = (
		<div className="flex items-center gap-1">
			<Tooltip>
				<TooltipTrigger asChild>
					<IconButton
						compact
						onClick={() => {
							const pct = Math.max(10, zoomPercent - 10);
							setZoomPercent(pct);
							playerControls?.applyZoom?.(pct);
						}}
						aria-label={t("toolbar:zoomOut")}
					>
						<Minus className="h-4 w-4" />
					</IconButton>
				</TooltipTrigger>
				<TooltipContent side="top">
					<p>{t("toolbar:zoomOut")}</p>
				</TooltipContent>
			</Tooltip>
			<input
				aria-label={t("toolbar:zoomPercent")}
				value={zoomPercent}
				onChange={(e) => {
					const v = parseInt(e.target.value ?? "60", 10);
					if (Number.isNaN(v)) return;
					setZoomPercent(v);
				}}
				onBlur={(e) => {
					const v = parseInt(e.target.value ?? "60", 10);
					if (Number.isNaN(v)) return;
					const pct = Math.max(10, Math.min(400, v));
					setZoomPercent(pct);
					playerControls?.applyZoom?.(pct);
				}}
				className="w-8 h-6 text-xs text-center rounded bg-transparent border border-border px-1 input-no-spinner"
				step={1}
				min={10}
				max={400}
			/>
			<span className="text-xs text-muted-foreground ml-0.5">%</span>
			<Tooltip>
				<TooltipTrigger asChild>
					<IconButton
						compact
						onClick={() => {
							const pct = Math.min(400, zoomPercent + 10);
							setZoomPercent(pct);
							playerControls?.applyZoom?.(pct);
						}}
						aria-label={t("toolbar:zoomIn")}
					>
						<Plus className="h-4 w-4" />
					</IconButton>
				</TooltipTrigger>
				<TooltipContent side="top">
					<p>{t("toolbar:zoomIn")}</p>
				</TooltipContent>
			</Tooltip>
		</div>
	);

	const metronomeControls = (
		<div className="flex items-center">
			<Tooltip>
				<TooltipTrigger asChild>
					<IconButton
						active={metronomeVolume > 0}
						onClick={() => {
							const nextVolume = metronomeVolume > 0 ? 0 : 0.6;
							setMetronomeVolume(nextVolume);
							playerControls?.setMetronomeVolume?.(nextVolume);
						}}
						aria-label={t("toolbar:metronome.label")}
					>
						<Music2 className="h-4 w-4" />
					</IconButton>
				</TooltipTrigger>
				<TooltipContent side="top">
					<p>
						{metronomeVolume > 0
							? t("toolbar:metronome.disable")
							: t("toolbar:metronome.enable")}
					</p>
				</TooltipContent>
			</Tooltip>
		</div>
	);

	const countInControls = (
		<div className="flex items-center">
			<Tooltip>
				<TooltipTrigger asChild>
					<IconButton
						active={countInEnabled}
						onClick={() => {
							const nextEnabled = !countInEnabled;
							setCountInEnabled(nextEnabled);
							playerControls?.setCountInEnabled?.(nextEnabled);
						}}
						aria-label={t("toolbar:countIn.label")}
					>
						<Hourglass className="h-4 w-4" />
					</IconButton>
				</TooltipTrigger>
				<TooltipContent side="top">
					<p>
						{countInEnabled
							? t("toolbar:countIn.disable")
							: t("toolbar:countIn.enable")}
					</p>
				</TooltipContent>
			</Tooltip>
		</div>
	);

	const playbackSpeedControls = (
		<div className="flex items-center gap-1 text-xs">
			{playbackSpeedControl}
			{metronomeControls}
			{countInControls}
		</div>
	);

	const progressMaxTick = Math.max(0, Math.floor(playbackEndTick));
	const progressCurrentTick = Math.max(
		0,
		Math.min(progressMaxTick, Math.floor(playbackPositionTick)),
	);
	const progressCurrentTime = formatPlaybackTime(playbackPositionMs);
	const progressEndTime = formatPlaybackTime(
		playbackEndMs > 0 ? playbackEndMs : playbackPositionMs,
	);
	const progressDisabled =
		!enablePlaybackProgressSeek || progressMaxTick <= 0 || !playerControls;

	const playbackProgressControls = enablePlaybackProgressBar ? (
		<div className="flex items-center gap-2 min-w-0 w-full max-w-[460px] flex-[1.25]">
			<div className="hidden md:block text-[10px] tabular-nums text-muted-foreground/80 w-10 text-right shrink-0">
				{progressCurrentTime}
			</div>
			<input
				type="range"
				min={0}
				max={progressMaxTick <= 0 ? 1 : progressMaxTick}
				step={1}
				value={progressCurrentTick}
				disabled={progressDisabled}
				onChange={(event) => {
					if (!enablePlaybackProgressSeek) return;
					const nextTick = Number.parseInt(event.currentTarget.value, 10);
					if (Number.isNaN(nextTick)) return;
					playerControls?.seekPlaybackPosition?.(nextTick);
				}}
				aria-label={t("toolbar:playbackProgress")}
				className="h-1.5 w-full min-w-[160px] cursor-pointer accent-primary disabled:cursor-not-allowed"
			/>
			<div className="hidden md:block text-[10px] tabular-nums text-muted-foreground/80 w-10 shrink-0">
				{progressEndTime}
			</div>
			{!enablePlaybackProgressSeek && (
				<Tooltip>
					<TooltipTrigger asChild>
						<span className="text-muted-foreground/60" aria-hidden="true">
							<Lock className="h-3 w-3" />
						</span>
					</TooltipTrigger>
					<TooltipContent side="top">
						<p>{t("toolbar:playbackSeekDisabled")}</p>
					</TooltipContent>
				</Tooltip>
			)}
		</div>
	) : null;

	const transportControls = (
		<>
			<Tooltip>
				<TooltipTrigger asChild>
					<IconButton
						active={playerIsPlaying}
						onClick={() => {
							if (!playerControls) return;
							try {
								if (!playerIsPlaying) playerControls.play?.();
								else playerControls.pause?.();
							} catch (e) {
								console.error("GlobalBottomBar play/pause failed:", e);
							}
						}}
						aria-label={`${t("toolbar:play")}/${t("toolbar:pause")}`}
					>
						{playerIsPlaying ? (
							<Pause className="h-4 w-4" />
						) : (
							<Play className="h-4 w-4" />
						)}
					</IconButton>
				</TooltipTrigger>
				<TooltipContent side="top">
					<p>{playerIsPlaying ? t("toolbar:pause") : t("toolbar:play")}</p>
				</TooltipContent>
			</Tooltip>
			<Tooltip>
				<TooltipTrigger asChild>
					<IconButton
						onClick={() => {
							if (!playerControls) return;
							try {
								playerControls.stop?.();
							} catch (e) {
								console.error("GlobalBottomBar stop failed:", e);
							}
						}}
						aria-label={t("toolbar:stop")}
					>
						<Square className="h-4 w-4" />
					</IconButton>
				</TooltipTrigger>
				<TooltipContent side="top">
					<p>{t("toolbar:stop")}</p>
				</TooltipContent>
			</Tooltip>
			<Tooltip>
				<TooltipTrigger asChild>
					<IconButton
						onClick={() => {
							if (!playerControls) return;
							try {
								playerControls.refresh?.();
							} catch (e) {
								console.error("GlobalBottomBar refresh failed:", e);
							}
						}}
						aria-label={t("toolbar:refresh")}
					>
						<RotateCw className="h-4 w-4" />
					</IconButton>
				</TooltipTrigger>
				<TooltipContent side="top">
					<p>{t("toolbar:refresh")}</p>
				</TooltipContent>
			</Tooltip>
			<Tooltip>
				<TooltipTrigger asChild>
					<IconButton
						active={
							workspaceMode === "settings" &&
							activeSettingsPageId === "playback"
						}
						onClick={() => {
							if (
								workspaceMode === "settings" &&
								activeSettingsPageId === "playback"
							) {
								setWorkspaceMode("editor");
								return;
							}
							setActiveSettingsPageId("playback");
							setWorkspaceMode("settings");
						}}
						aria-label={t("common:settings")}
					>
						<Settings className="h-4 w-4" />
					</IconButton>
				</TooltipTrigger>
				<TooltipContent side="top">
					<p>{t("common:settings")}</p>
				</TooltipContent>
			</Tooltip>
		</>
	);

	// 组件映射
	const componentMap = {
		staffControls: (
			<StaffControls
				firstStaffOptions={firstStaffOptions}
				toggleFirstStaffOpt={requestStaffToggle}
			/>
		),
		tracksControls: (
			<div className="flex items-center">
				<Tooltip>
					<TooltipTrigger asChild>
						<IconButton
							active={isTracksPanelOpen}
							onClick={toggleTracksPanel}
							aria-label={t("toolbar:tracks")}
						>
							<ListMusic className="h-4 w-4" />
						</IconButton>
					</TooltipTrigger>
					<TooltipContent side="top">
						<p>{t("toolbar:tracks")}</p>
					</TooltipContent>
				</Tooltip>
			</div>
		),
		zoomControls,
		playbackSpeedControls,
		playbackProgress: playbackProgressControls,
		playbackTransport: transportControls,
	};

	// 根据配置渲染组件
	const renderedComponents = customPlayerConfig.components
		.filter((component) => component.enabled)
		.map((component, _index) => {
			const element = componentMap[component.type];
			if (!element) return null;

			// 为不同组件添加合适的间距
			let className = "";
			if (component.type === "zoomControls") {
				className = "ml-2";
			} else if (component.type === "playbackSpeedControls") {
				className = "ml-3";
			} else if (component.type === "playbackProgress") {
				className = "ml-2 min-w-0 flex-1";
			} else if (component.type === "playbackTransport") {
				className = "ml-2";
			}

			return (
				<div key={component.type} className={className}>
					{element}
				</div>
			);
		})
		.filter(Boolean); // 移除null值

	return (
		<div className="flex items-center gap-2 min-w-0">{renderedComponents}</div>
	);
}

export default function GlobalBottomBar() {
	const { t } = useTranslation(["toolbar", "settings", "common"]);
	const activeFile = useAppStore((state) => state.getActiveFile());
	const firstStaffOptions = useAppStore((state) => state.firstStaffOptions);
	const requestStaffToggle = useAppStore((state) => state.requestStaffToggle);
	const isAtexFile = activeFile?.path.endsWith(".atex") ?? false;

	const playerIsPlaying = useAppStore((s) => s.playerIsPlaying);
	const playerControls = useAppStore((s) => s.playerControls);
	const zoomPercent = useAppStore((s) => s.zoomPercent);
	const setZoomPercent = useAppStore((s) => s.setZoomPercent);
	const playbackSpeed = useAppStore((s) => s.playbackSpeed);
	const setPlaybackSpeed = useAppStore((s) => s.setPlaybackSpeed);
	const playbackBpmMode = useAppStore((s) => s.playbackBpmMode);
	const metronomeVolume = useAppStore((s) => s.metronomeVolume);
	const setMetronomeVolume = useAppStore((s) => s.setMetronomeVolume);
	const countInEnabled = useAppStore((s) => s.countInEnabled);
	const setCountInEnabled = useAppStore((s) => s.setCountInEnabled);
	const enablePlaybackProgressBar = useAppStore(
		(s) => s.enablePlaybackProgressBar,
	);
	const enablePlaybackProgressSeek = useAppStore(
		(s) => s.enablePlaybackProgressSeek,
	);
	const playbackPositionTick = useAppStore((s) => s.playbackPositionTick);
	const playbackEndTick = useAppStore((s) => s.playbackEndTick);
	const playbackPositionMs = useAppStore((s) => s.playbackPositionMs);
	const playbackEndMs = useAppStore((s) => s.playbackEndMs);

	const isTracksPanelOpen = useAppStore((s) => s.isTracksPanelOpen);
	const toggleTracksPanel = useAppStore((s) => s.toggleTracksPanel);

	const workspaceMode = useAppStore((s) => s.workspaceMode);
	const activeTutorialId = useAppStore((s) => s.activeTutorialId);
	const setActiveTutorialId = useAppStore((s) => s.setActiveTutorialId);
	const tutorialAudience = useAppStore((s) => s.tutorialAudience);
	const activeSettingsPageId = useAppStore((s) => s.activeSettingsPageId);
	const setActiveSettingsPageId = useAppStore((s) => s.setActiveSettingsPageId);
	const setWorkspaceMode = useAppStore((s) => s.setWorkspaceMode);
	const isTutorialMode = workspaceMode === "tutorial";
	const isSettingsMode = workspaceMode === "settings";

	const prevTutorial = activeTutorialId
		? getPrevTutorial(activeTutorialId, tutorialAudience)
		: null;
	const nextTutorial = activeTutorialId
		? getNextTutorial(activeTutorialId, tutorialAudience)
		: null;

	const bottomBarContent =
		isTutorialMode && (prevTutorial || nextTutorial) ? (
			<TutorialBottomBar
				prevTutorial={prevTutorial}
				nextTutorial={nextTutorial}
				onSelectTutorial={setActiveTutorialId}
				t={t}
			/>
		) : isSettingsMode && activeSettingsPageId === "playback" ? (
			// 当在设置页面的playback页签时，显示播放控件以便实时预览配置效果
			<EditorBottomBar
				firstStaffOptions={firstStaffOptions}
				requestStaffToggle={requestStaffToggle}
				zoomPercent={zoomPercent}
				setZoomPercent={setZoomPercent}
				playerControls={playerControls}
				playbackSpeed={playbackSpeed}
				setPlaybackSpeed={setPlaybackSpeed}
				playbackBpmMode={playbackBpmMode}
				metronomeVolume={metronomeVolume}
				setMetronomeVolume={setMetronomeVolume}
				countInEnabled={countInEnabled}
				setCountInEnabled={setCountInEnabled}
				enablePlaybackProgressBar={enablePlaybackProgressBar}
				enablePlaybackProgressSeek={enablePlaybackProgressSeek}
				playbackPositionTick={playbackPositionTick}
				playbackEndTick={playbackEndTick}
				playbackPositionMs={playbackPositionMs}
				playbackEndMs={playbackEndMs}
				playerIsPlaying={playerIsPlaying}
				isTracksPanelOpen={isTracksPanelOpen}
				toggleTracksPanel={toggleTracksPanel}
				setWorkspaceMode={setWorkspaceMode}
				setActiveSettingsPageId={setActiveSettingsPageId}
				workspaceMode={workspaceMode}
				activeSettingsPageId={activeSettingsPageId}
				t={t}
			/>
		) : isSettingsMode ? (
			<SettingsBottomBar activeSettingsPageId={activeSettingsPageId} t={t} />
		) : isAtexFile ? (
			<EditorBottomBar
				firstStaffOptions={firstStaffOptions}
				requestStaffToggle={requestStaffToggle}
				zoomPercent={zoomPercent}
				setZoomPercent={setZoomPercent}
				playerControls={playerControls}
				playbackSpeed={playbackSpeed}
				setPlaybackSpeed={setPlaybackSpeed}
				playbackBpmMode={playbackBpmMode}
				metronomeVolume={metronomeVolume}
				setMetronomeVolume={setMetronomeVolume}
				countInEnabled={countInEnabled}
				setCountInEnabled={setCountInEnabled}
				enablePlaybackProgressBar={enablePlaybackProgressBar}
				enablePlaybackProgressSeek={enablePlaybackProgressSeek}
				playbackPositionTick={playbackPositionTick}
				playbackEndTick={playbackEndTick}
				playbackPositionMs={playbackPositionMs}
				playbackEndMs={playbackEndMs}
				playerIsPlaying={playerIsPlaying}
				isTracksPanelOpen={isTracksPanelOpen}
				toggleTracksPanel={toggleTracksPanel}
				setWorkspaceMode={setWorkspaceMode}
				setActiveSettingsPageId={setActiveSettingsPageId}
				workspaceMode={workspaceMode}
				activeSettingsPageId={activeSettingsPageId}
				t={t}
			/>
		) : null;

	return (
		<TooltipProvider delayDuration={200}>
			<footer className="h-9 border-t border-border bg-card flex items-center justify-between px-4 text-xs text-muted-foreground flex-shrink-0 w-full">
				<div className="flex items-center gap-3">
					<span className="font-medium">Tabst@JayBridge</span>
				</div>
				<div className="flex items-center gap-2 min-w-0 flex-1 justify-end">
					{bottomBarContent}
				</div>
			</footer>
		</TooltipProvider>
	);
}
