import {
	ChevronLeft,
	ChevronRight,
	Minus,
	Music2,
	Pause,
	Play,
	Plus,
	RotateCw,
	Square,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { getNextTutorial, getPrevTutorial } from "../lib/tutorial-loader";
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

export default function GlobalBottomBar() {
	const { t } = useTranslation(["toolbar", "settings", "common"]);
	const activeFile = useAppStore((state) => state.getActiveFile());
	const firstStaffOptions = useAppStore((state) => state.firstStaffOptions);
	const requestStaffToggle = useAppStore((state) => state.requestStaffToggle);
	const isAtexFile = activeFile?.path.endsWith(".atex") ?? false;

	// Playback / zoom state & controls from store
	const playerIsPlaying = useAppStore((s) => s.playerIsPlaying);
	const playerControls = useAppStore((s) => s.playerControls);
	const zoomPercent = useAppStore((s) => s.zoomPercent);
	const setZoomPercent = useAppStore((s) => s.setZoomPercent);
	const playbackSpeed = useAppStore((s) => s.playbackSpeed);
	const setPlaybackSpeed = useAppStore((s) => s.setPlaybackSpeed);
	const playbackBpmMode = useAppStore((s) => s.playbackBpmMode);
	const metronomeVolume = useAppStore((s) => s.metronomeVolume);
	const setMetronomeVolume = useAppStore((s) => s.setMetronomeVolume);

	// Workspace mode
	const workspaceMode = useAppStore((s) => s.workspaceMode);
	const activeTutorialId = useAppStore((s) => s.activeTutorialId);
	const setActiveTutorialId = useAppStore((s) => s.setActiveTutorialId);
	const activeSettingsPageId = useAppStore((s) => s.activeSettingsPageId);
	const isTutorialMode = workspaceMode === "tutorial";
	const isSettingsMode = workspaceMode === "settings";

	// Calculate previous and next tutorial
	const prevTutorial = activeTutorialId
		? getPrevTutorial(activeTutorialId)
		: null;
	const nextTutorial = activeTutorialId
		? getNextTutorial(activeTutorialId)
		: null;

	// Playback speed control element (BPM mode vs Ratio mode)
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

	return (
		<TooltipProvider delayDuration={200}>
			<footer className="h-9 border-t border-border bg-card flex items-center justify-between px-4 text-xs text-muted-foreground flex-shrink-0 w-full">
				<div className="flex items-center gap-3">
					<span className="font-medium">Tabst@JayBridge</span>
				</div>

				<div className="flex items-center gap-2">
					{isTutorialMode && (prevTutorial || nextTutorial) && (
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
												onClick={() => setActiveTutorialId(prevTutorial.id)}
												className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-accent hover:text-accent-foreground transition-colors text-xs"
												aria-label={t("toolbar:tutorial.prevWithTitle", {
													title: prevTutorial.title,
												})}
											>
												<ChevronLeft className="h-3.5 w-3.5" />
												<span className="text-xs">
													{t("toolbar:tutorial.prevWithTitle", {
														title: prevTutorial.title,
													})}
												</span>
											</button>
										</TooltipTrigger>
										<TooltipContent side="top">
											<p>
												{t("toolbar:tutorial.prevTooltip", {
													title: prevTutorial.title,
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
												onClick={() => setActiveTutorialId(nextTutorial.id)}
												className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-accent hover:text-accent-foreground transition-colors text-xs"
												aria-label={t("toolbar:tutorial.nextWithTitle", {
													title: nextTutorial.title,
												})}
											>
												<span className="text-xs">
													{t("toolbar:tutorial.nextWithTitle", {
														title: nextTutorial.title,
													})}
												</span>
												<ChevronRight className="h-3.5 w-3.5" />
											</button>
										</TooltipTrigger>
										<TooltipContent side="top">
											<p>
												{t("toolbar:tutorial.nextTooltip", {
													title: nextTutorial.title,
												})}
											</p>
										</TooltipContent>
									</Tooltip>
								)}
							</div>
						</div>
					)}

					{isSettingsMode && activeSettingsPageId && (
						<div className="flex items-center gap-2 text-xs text-muted-foreground">
							{(() => {
								const currentPage = defaultSettingsPages.find(
									(p) => p.id === activeSettingsPageId,
								);
								return currentPage ? (
									<span>{t(`settings:${currentPage.id}`)}</span>
								) : (
									<span>{t("common:settings")}</span>
								);
							})()}
						</div>
					)}

					{isAtexFile && !isTutorialMode && !isSettingsMode && (
						<div className="flex items-center gap-2">
							<StaffControls
								firstStaffOptions={firstStaffOptions}
								toggleFirstStaffOpt={requestStaffToggle}
							/>

							<div className="ml-2 flex items-center gap-1">
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

							<div className="ml-3 flex items-center gap-1 text-xs">
								{playbackSpeedControl}
							</div>
							<div className="ml-2 flex items-center">
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
									<p>
										{playerIsPlaying ? t("toolbar:pause") : t("toolbar:play")}
									</p>
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
						</div>
					)}
				</div>
			</footer>
		</TooltipProvider>
	);
}
