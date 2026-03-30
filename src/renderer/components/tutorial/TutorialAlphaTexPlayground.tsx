import type * as alphaTab from "@coderline/alphatab";
import {
	Music2,
	Pause,
	Play,
	RefreshCw,
	Square,
	Volume2,
	VolumeX,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FileItem } from "../../store/appStore";
import IconButton from "../ui/icon-button";
import TutorialPlaygroundEditor from "./TutorialPlaygroundEditor";
import TutorialPlaygroundPreview from "./TutorialPlaygroundPreview";

interface TutorialAlphaTexPlaygroundProps {
	initialContent: string;
	fileName?: string;
	onChange?: (content: string) => void;
	readOnly?: boolean;
	className?: string;
	disablePlayer?: boolean;
	showDisablePlayerToggle?: boolean;
	showRefresh?: boolean;
	variant?: "default" | "embedded";
	embeddedHeightPx?: number;
}

const PLAYER_STATE_PLAYING = 1;
const TUTORIAL_METRONOME_ON_VOLUME = 0.6;

export function TutorialAlphaTexPlayground({
	initialContent,
	fileName = "tutorial.atex",
	onChange,
	readOnly,
	className,
	disablePlayer,
	showDisablePlayerToggle,
	showRefresh = true,
	variant = "default",
	embeddedHeightPx = 420,
}: TutorialAlphaTexPlaygroundProps) {
	const [content, setContent] = useState(initialContent);
	const [previewContent, setPreviewContent] = useState(initialContent);
	const forcedDisablePlayer = Boolean(disablePlayer);
	const [manualDisablePlayer, setManualDisablePlayer] = useState(false);
	const effectiveDisablePlayer = forcedDisablePlayer || manualDisablePlayer;
	const apiRef = useRef<alphaTab.AlphaTabApi | null>(null);
	const playerStateHandlerRef = useRef<
		((ev: { state: number; stopped?: boolean }) => void) | null
	>(null);
	const isPlayerStartedRef = useRef(false);
	const [isPlaying, setIsPlaying] = useState(false);
	const [metronomeVolume, setMetronomeVolume] = useState(0);

	useEffect(() => {
		if (!effectiveDisablePlayer) return;
		// Ensure player/cursor related UI state is reset.
		apiRef.current?.stop?.();
		isPlayerStartedRef.current = false;
		setIsPlaying(false);
		setMetronomeVolume(0);
	}, [effectiveDisablePlayer]);

	const handleEditorChange = useCallback(
		(next: string) => {
			setContent(next);
			onChange?.(next);
		},
		[onChange],
	);

	const handleRefresh = useCallback(() => {
		// Stop playback cursor updates and re-render score with the latest editor content.
		apiRef.current?.stop?.();
		setIsPlaying(false);
		isPlayerStartedRef.current = false;
		setPreviewContent(content);
	}, [content]);

	useEffect(() => {
		setContent(initialContent);
		setPreviewContent(initialContent);
	}, [initialContent]);

	const _sandboxFile = useMemo<FileItem>(
		() => ({
			id: `tutorial-playground-${fileName}`,
			name: fileName,
			path: `/tutorials/${fileName}`,
			content,
			contentLoaded: true,
		}),
		[fileName, content],
	);

	const handleApiChange = useCallback(
		(api: alphaTab.AlphaTabApi | null) => {
			const previousApi = apiRef.current;
			if (previousApi && playerStateHandlerRef.current) {
				previousApi.playerStateChanged?.off(playerStateHandlerRef.current);
				playerStateHandlerRef.current = null;
			}

			apiRef.current = api;
			setIsPlaying(false);
			isPlayerStartedRef.current = false;

			if (api && !effectiveDisablePlayer) {
				api.metronomeVolume = metronomeVolume;
				const handler = (ev: { state: number; stopped?: boolean }) => {
					if (ev?.state === PLAYER_STATE_PLAYING) {
						isPlayerStartedRef.current = true;
						setIsPlaying(true);
						return;
					}

					setIsPlaying(false);
					if (ev?.stopped) {
						isPlayerStartedRef.current = false;
					}
				};
				playerStateHandlerRef.current = handler;
				api.playerStateChanged?.on(handler);
			}
		},
		[metronomeVolume, effectiveDisablePlayer],
	);

	useEffect(() => {
		if (!apiRef.current || effectiveDisablePlayer) return;
		apiRef.current.metronomeVolume = metronomeVolume;
	}, [effectiveDisablePlayer, metronomeVolume]);

	const wrapperClassName =
		variant === "embedded"
			? `not-prose w-full overflow-hidden bg-card ${className ?? ""}`
			: `not-prose my-4 mx-auto w-full max-w-[820px] rounded-lg border border-border overflow-hidden bg-card ${
					className ?? ""
				}`;

	return (
		<div className={wrapperClassName}>
			<div
				className={`flex items-center justify-between border-b border-border text-xs text-muted-foreground ${
					variant === "embedded" ? "px-2 py-1.5" : "px-3 py-2"
				}`}
			>
				<span>
					{variant === "embedded"
						? "AlphaTex"
						: "Interactive AlphaTex Playground"}
				</span>
				<div className="flex items-center gap-2">
					<IconButton
						compact
						active={metronomeVolume > 0}
						aria-label={
							metronomeVolume > 0 ? "Disable metronome" : "Enable metronome"
						}
						title={
							metronomeVolume > 0 ? "Disable metronome" : "Enable metronome"
						}
						disabled={effectiveDisablePlayer}
						onClick={() => {
							setMetronomeVolume((prev) =>
								prev > 0 ? 0 : TUTORIAL_METRONOME_ON_VOLUME,
							);
						}}
					>
						<Music2 className="h-4 w-4" />
					</IconButton>
					<IconButton
						compact
						aria-label={isPlaying ? "Pause" : "Play"}
						title={isPlaying ? "Pause" : "Play"}
						disabled={effectiveDisablePlayer}
						onClick={() => {
							apiRef.current?.playPause();
						}}
					>
						{isPlaying ? (
							<Pause className="h-4 w-4" />
						) : (
							<Play className="h-4 w-4" />
						)}
					</IconButton>
					<IconButton
						compact
						aria-label="Stop"
						title="Stop"
						disabled={effectiveDisablePlayer}
						onClick={() => {
							if (isPlayerStartedRef.current) {
								apiRef.current?.stop();
							}
							isPlayerStartedRef.current = false;
							setIsPlaying(false);
						}}
					>
						<Square className="h-4 w-4" />
					</IconButton>

					{showDisablePlayerToggle ? (
						<IconButton
							compact
							aria-label={
								effectiveDisablePlayer ? "Enable player" : "Disable player"
							}
							title={
								effectiveDisablePlayer ? "Enable player" : "Disable player"
							}
							disabled={Boolean(disablePlayer) || readOnly}
							onClick={() => {
								setManualDisablePlayer((v) => !v);
							}}
						>
							{effectiveDisablePlayer ? (
								<Volume2 className="h-4 w-4" />
							) : (
								<VolumeX className="h-4 w-4" />
							)}
						</IconButton>
					) : null}

					{showRefresh ? (
						<IconButton
							compact
							title="Refresh preview"
							aria-label="Refresh preview"
							disabled={readOnly}
							onClick={() => handleRefresh()}
						>
							<RefreshCw className="h-4 w-4" />
						</IconButton>
					) : null}
				</div>
			</div>
			<div
				className={`grid grid-cols-2 min-h-[420px] max-h-[70vh] ${
					variant === "embedded" ? "min-h-0 max-h-none" : ""
				}`}
				style={
					variant === "embedded" ? { height: embeddedHeightPx } : undefined
				}
			>
				<div
					className={`border-r border-border ${
						variant === "embedded" ? "overflow-auto" : "overflow-hidden"
					}`}
					data-tutorial-playground-editor="true"
				>
					<TutorialPlaygroundEditor
						initialContent={content}
						onChange={handleEditorChange}
						readOnly={readOnly}
					/>
				</div>
				<div
					className={`relative ${
						variant === "embedded" ? "overflow-auto" : "overflow-hidden"
					}`}
				>
					<TutorialPlaygroundPreview
						fileName={fileName}
						content={previewContent}
						onApiChange={handleApiChange}
						className="h-full"
						disablePlayer={effectiveDisablePlayer}
					/>
				</div>
			</div>
		</div>
	);
}
