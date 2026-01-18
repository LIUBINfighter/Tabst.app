import { Minus, Pause, Play, Plus, Square, Waves } from "lucide-react";
import { useAppStore } from "../store/appStore";
import StaffControls from "./StaffControls";
import IconButton from "./ui/icon-button";

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
	const scrollMode = useAppStore((s) => s.scrollMode);

	return (
		<footer className="h-9 border-t border-border bg-card flex items-center justify-between px-4 text-xs text-muted-foreground flex-shrink-0 w-full">
			{/* Left: app status */}
			<div className="flex items-center gap-3">
				<span className="font-medium">Tabst</span>
			</div>

			{/* Center/Right: moved controls (only for .atex files) */}
			{isAtexFile && (
				<div className="flex items-center gap-2">
					{/* Existing staff controls (leftmost) */}
					<StaffControls
						firstStaffOptions={firstStaffOptions}
						toggleFirstStaffOpt={requestStaffToggle}
					/>

					{/* Zoom controls (display size): shrink / input / enlarge */}
					<div className="ml-2 flex items-center gap-1">
						<IconButton
							compact
							title="缩小"
							onClick={() => {
								const pct = Math.max(10, zoomPercent - 10);
								setZoomPercent(pct);
								playerControls?.applyZoom?.(pct);
							}}
							aria-label="缩小"
						>
							<Minus className="h-4 w-4" />
						</IconButton>

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
							style={{ textAlign: "center" }}
						/>

						<IconButton
							compact
							title="放大"
							onClick={() => {
								const pct = Math.min(400, zoomPercent + 10);
								setZoomPercent(pct);
								playerControls?.applyZoom?.(pct);
							}}
							aria-label="放大"
						>
							<Plus className="h-4 w-4" />
						</IconButton>
					</div>

					{/* Display mode: scroll */}
					<IconButton
						active={scrollMode === 1}
						title={`滚动模式：${scrollMode === 1 ? "连续滚动" : "超出页面后滚动"}`}
						onClick={() => playerControls?.toggleScrollMode?.()}
						aria-label="切换滚动模式"
					>
						<Waves className="h-4 w-4" />
					</IconButton>

					{/* Playback controls (play/pause, stop) - right side */}
					<IconButton
						active={playerIsPlaying}
						title={playerIsPlaying ? "暂停" : "播放"}
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

					<IconButton
						title="停止"
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
				</div>
			)}
		</footer>
	);
}
