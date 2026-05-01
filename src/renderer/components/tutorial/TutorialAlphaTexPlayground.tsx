import type * as alphaTab from "@coderline/alphatab";
import { Music2, Pause, Play, Square } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FileItem } from "../../store/appStore";
import IconButton from "../ui/icon-button";
import TutorialPlaygroundEditor from "./TutorialPlaygroundEditor";
import TutorialPlaygroundPreview, {
	type TutorialPlaygroundRenderStatus,
} from "./TutorialPlaygroundPreview";

interface TutorialAlphaTexPlaygroundLabels {
	enableMetronome: string;
	disableMetronome: string;
	play: string;
	pause: string;
	stop: string;
	emptyPreview: string;
	loadingPreview: string;
}

interface TutorialAlphaTexPlaygroundProps {
	initialContent: string;
	fileName?: string;
	title?: string;
	className?: string;
	labels?: Partial<TutorialAlphaTexPlaygroundLabels>;
	onChange?: (content: string) => void;
	onRenderStatusChange?: (status: TutorialPlaygroundRenderStatus) => void;
}

const PLAYER_STATE_PLAYING = 1;
const TUTORIAL_METRONOME_ON_VOLUME = 0.6;
const PREVIEW_DEBOUNCE_MS = 300;
const DEFAULT_LABELS: TutorialAlphaTexPlaygroundLabels = {
	enableMetronome: "Enable metronome",
	disableMetronome: "Disable metronome",
	play: "Play",
	pause: "Pause",
	stop: "Stop",
	emptyPreview: "Enter alphaTex to render a preview.",
	loadingPreview: "Loading score...",
};

export function TutorialAlphaTexPlayground({
	initialContent,
	fileName = "tutorial.atex",
	title = "Interactive AlphaTex Playground",
	className,
	labels,
	onChange,
	onRenderStatusChange,
}: TutorialAlphaTexPlaygroundProps) {
	const [content, setContent] = useState(initialContent);
	const [previewContent, setPreviewContent] = useState(initialContent);
	const apiRef = useRef<alphaTab.AlphaTabApi | null>(null);
	const metronomeVolumeRef = useRef(0);
	const playerStateHandlerRef = useRef<
		((ev: { state: number; stopped?: boolean }) => void) | null
	>(null);
	const isPlayerStartedRef = useRef(false);
	const [isPlaying, setIsPlaying] = useState(false);
	const [metronomeVolume, setMetronomeVolume] = useState(0);

	useEffect(() => {
		setContent(initialContent);
		setPreviewContent(initialContent);
	}, [initialContent]);

	useEffect(() => {
		const timer = window.setTimeout(() => {
			setPreviewContent(content);
		}, PREVIEW_DEBOUNCE_MS);
		return () => window.clearTimeout(timer);
	}, [content]);

	useEffect(() => {
		metronomeVolumeRef.current = metronomeVolume;
	}, [metronomeVolume]);

	const resolvedLabels = useMemo<TutorialAlphaTexPlaygroundLabels>(
		() => ({ ...DEFAULT_LABELS, ...labels }),
		[labels],
	);

	const handleContentChange = useCallback(
		(nextContent: string) => {
			setContent(nextContent);
			onChange?.(nextContent);
		},
		[onChange],
	);

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

	const handleApiChange = useCallback((api: alphaTab.AlphaTabApi | null) => {
		const previousApi = apiRef.current;
		if (previousApi && playerStateHandlerRef.current) {
			previousApi.playerStateChanged?.off(playerStateHandlerRef.current);
			playerStateHandlerRef.current = null;
		}

		apiRef.current = api;
		setIsPlaying(false);
		isPlayerStartedRef.current = false;

		if (api) {
			api.metronomeVolume = metronomeVolumeRef.current;
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
	}, []);

	useEffect(() => {
		if (!apiRef.current) return;
		apiRef.current.metronomeVolume = metronomeVolume;
	}, [metronomeVolume]);

	return (
		<div
			className={`not-prose my-4 mx-auto w-full max-w-[820px] rounded-lg border border-border overflow-hidden bg-card ${className ?? ""}`}
		>
			<div className="flex items-center justify-between px-3 py-2 border-b border-border text-xs text-muted-foreground">
				<span>{title}</span>
				<div className="flex items-center gap-2">
					<IconButton
						compact
						active={metronomeVolume > 0}
						aria-label={
							metronomeVolume > 0
								? resolvedLabels.disableMetronome
								: resolvedLabels.enableMetronome
						}
						title={
							metronomeVolume > 0
								? resolvedLabels.disableMetronome
								: resolvedLabels.enableMetronome
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
						aria-label={isPlaying ? resolvedLabels.pause : resolvedLabels.play}
						title={isPlaying ? resolvedLabels.pause : resolvedLabels.play}
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
						aria-label={resolvedLabels.stop}
						title={resolvedLabels.stop}
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
				<div
					className="border-r border-border overflow-hidden"
					data-tutorial-playground-editor="true"
				>
					<TutorialPlaygroundEditor
						initialContent={content}
						onChange={handleContentChange}
					/>
				</div>
				<div className="overflow-hidden relative">
					<TutorialPlaygroundPreview
						fileName={fileName}
						content={previewContent}
						emptyMessage={resolvedLabels.emptyPreview}
						loadingMessage={resolvedLabels.loadingPreview}
						onApiChange={handleApiChange}
						onRenderStatusChange={onRenderStatusChange}
						className="h-full"
					/>
				</div>
			</div>
		</div>
	);
}
