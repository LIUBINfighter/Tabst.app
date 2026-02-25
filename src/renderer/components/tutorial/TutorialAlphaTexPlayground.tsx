import type * as alphaTab from "@coderline/alphatab";
import { Music2, Pause, Play, Square } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FileItem } from "../../store/appStore";
import IconButton from "../ui/icon-button";
import TutorialPlaygroundEditor from "./TutorialPlaygroundEditor";
import TutorialPlaygroundPreview from "./TutorialPlaygroundPreview";

interface TutorialAlphaTexPlaygroundProps {
	initialContent: string;
	fileName?: string;
}

const PLAYER_STATE_PLAYING = 1;
const TUTORIAL_METRONOME_ON_VOLUME = 0.6;

export function TutorialAlphaTexPlayground({
	initialContent,
	fileName = "tutorial.atex",
}: TutorialAlphaTexPlaygroundProps) {
	const [content, setContent] = useState(initialContent);
	const apiRef = useRef<alphaTab.AlphaTabApi | null>(null);
	const playerStateHandlerRef = useRef<
		((ev: { state: number; stopped?: boolean }) => void) | null
	>(null);
	const isPlayerStartedRef = useRef(false);
	const [isPlaying, setIsPlaying] = useState(false);
	const [metronomeVolume, setMetronomeVolume] = useState(0);

	useEffect(() => {
		setContent(initialContent);
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

			if (api) {
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
		[metronomeVolume],
	);

	useEffect(() => {
		if (!apiRef.current) return;
		apiRef.current.metronomeVolume = metronomeVolume;
	}, [metronomeVolume]);

	return (
		<div className="not-prose my-4 rounded-lg border border-border overflow-hidden bg-card">
			<div className="flex items-center justify-between px-3 py-2 border-b border-border text-xs text-muted-foreground">
				<span>Interactive AlphaTex Playground</span>
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
				</div>
			</div>
			<div className="grid grid-cols-2 min-h-[420px] max-h-[70vh]">
				<div className="border-r border-border overflow-hidden">
					<TutorialPlaygroundEditor
						initialContent={content}
						onChange={setContent}
					/>
				</div>
				<div className="overflow-hidden relative">
					<TutorialPlaygroundPreview
						fileName={fileName}
						content={content}
						onApiChange={handleApiChange}
						className="h-full"
					/>
				</div>
			</div>
		</div>
	);
}
