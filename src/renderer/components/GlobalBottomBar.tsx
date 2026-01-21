import {
	ChevronLeft,
	ChevronRight,
	Minus,
	Music2,
	Pause,
	Play,
	Plus,
	Square,
} from "lucide-react";
import { useAppStore } from "../store/appStore";
import StaffControls from "./StaffControls";
import { defaultTutorials } from "./TutorialView";
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
	const metronomeVolume = useAppStore((s) => s.metronomeVolume);
	const setMetronomeVolume = useAppStore((s) => s.setMetronomeVolume);

	// Tutorial navigation
	const workspaceMode = useAppStore((s) => s.workspaceMode);
	const activeTutorialId = useAppStore((s) => s.activeTutorialId);
	const setActiveTutorialId = useAppStore((s) => s.setActiveTutorialId);
	const isTutorialMode = workspaceMode === "tutorial";

	// Calculate previous and next tutorial
	const currentIndex = defaultTutorials.findIndex(
		(t) => t.id === activeTutorialId,
	);
	const prevTutorial =
		currentIndex > 0 ? defaultTutorials[currentIndex - 1] : null;
	const nextTutorial =
		currentIndex >= 0 && currentIndex < defaultTutorials.length - 1
			? defaultTutorials[currentIndex + 1]
			: null;

	return (
		<TooltipProvider delayDuration={200}>
			<footer className="h-9 border-t border-border bg-card flex items-center justify-between px-4 text-xs text-muted-foreground flex-shrink-0 w-full">
				{/* Left: app status */}
				<div className="flex items-center gap-3">
					<span className="font-medium">Tabst</span>
				</div>

				{/* Right: Controls area */}
				<div className="flex items-center gap-2">
					{/* Tutorial navigation buttons (only in tutorial mode) */}
					{isTutorialMode && (prevTutorial || nextTutorial) && (
						<div className="flex items-center gap-3">
							{/* Keyboard hint */}
							<span className="text-xs text-muted-foreground/70 hidden sm:inline">
								使用 ← → 键翻页
							</span>
							<div className="flex items-center gap-2">
								{prevTutorial && (
									<Tooltip>
										<TooltipTrigger asChild>
											<button
												type="button"
												onClick={() => setActiveTutorialId(prevTutorial.id)}
												className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-accent hover:text-accent-foreground transition-colors text-xs"
												aria-label={`前一页：${prevTutorial.title}`}
											>
												<ChevronLeft className="h-3.5 w-3.5" />
												<span className="text-xs">
													前一页：{prevTutorial.title}
												</span>
											</button>
										</TooltipTrigger>
										<TooltipContent side="top">
											<p>前一页：{prevTutorial.title} (← 键)</p>
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
												aria-label={`后一页：${nextTutorial.title}`}
											>
												<span className="text-xs">
													后一页：{nextTutorial.title}
												</span>
												<ChevronRight className="h-3.5 w-3.5" />
											</button>
										</TooltipTrigger>
										<TooltipContent side="top">
											<p>后一页：{nextTutorial.title} (→ 键)</p>
										</TooltipContent>
									</Tooltip>
								)}
							</div>
						</div>
					)}

					{/* Center/Right: moved controls (only for .atex files, not in tutorial mode) */}
					{isAtexFile && !isTutorialMode && (
						<div className="flex items-center gap-2">
							{/* Existing staff controls (leftmost) */}
							<StaffControls
								firstStaffOptions={firstStaffOptions}
								toggleFirstStaffOpt={requestStaffToggle}
							/>

							{/* Zoom controls (display size): shrink / input / enlarge */}
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
											aria-label="缩小"
										>
											<Minus className="h-4 w-4" />
										</IconButton>
									</TooltipTrigger>
									<TooltipContent side="top">
										<p>缩小</p>
									</TooltipContent>
								</Tooltip>

								<input
									aria-label="缩放百分比"
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
									className="w-10 h-6 text-xs text-center rounded bg-transparent border border-border px-1 input-no-spinner"
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
											aria-label="放大"
										>
											<Plus className="h-4 w-4" />
										</IconButton>
									</TooltipTrigger>
									<TooltipContent side="top">
										<p>放大</p>
									</TooltipContent>
								</Tooltip>
							</div>

							{/* Playback speed */}
							<div className="ml-3 flex items-center gap-1 text-xs">
								<Select
									value={String(playbackSpeed)}
									onValueChange={(value) => {
										const v = Number.parseFloat(value);
										if (Number.isNaN(v)) return;
										setPlaybackSpeed(v);
										playerControls?.applyPlaybackSpeed?.(v);
									}}
								>
									<SelectTrigger aria-label="播放速度">
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
							</div>

							{/* Metronome toggle */}
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
											aria-label="节拍器"
										>
											<Music2 className="h-4 w-4" />
										</IconButton>
									</TooltipTrigger>
									<TooltipContent side="top">
										<p>{metronomeVolume > 0 ? "关闭节拍器" : "开启节拍器"}</p>
									</TooltipContent>
								</Tooltip>
							</div>

							{/* Playback controls (play/pause, stop) - right side */}
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
										aria-label="播放/暂停"
									>
										{playerIsPlaying ? (
											<Pause className="h-4 w-4" />
										) : (
											<Play className="h-4 w-4" />
										)}
									</IconButton>
								</TooltipTrigger>
								<TooltipContent side="top">
									<p>{playerIsPlaying ? "暂停" : "播放"}</p>
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
										aria-label="停止"
									>
										<Square className="h-4 w-4" />
									</IconButton>
								</TooltipTrigger>
								<TooltipContent side="top">
									<p>停止</p>
								</TooltipContent>
							</Tooltip>
						</div>
					)}
				</div>
			</footer>
		</TooltipProvider>
	);
}
