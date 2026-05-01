import * as alphaTab from "@coderline/alphatab";
import { useEffect, useRef, useState } from "react";
import { createPreviewSettings } from "@/renderer/lib/alphatab-config";
import { formatFullError } from "@/renderer/lib/alphatab-error";
import { parseAtDoc } from "@/renderer/lib/atdoc";
import { applyAtDocColoring } from "@/renderer/lib/atdoc-coloring";
import { getResourceUrls } from "@/renderer/lib/resourceLoaderService";
import {
	getAlphaTabColorsForTheme,
	updateAlphaTabColorsForTheme,
} from "@/renderer/lib/themeManager";
import { useAppStore } from "@/renderer/store/appStore";

export type TutorialPlaygroundRenderStatus =
	| { state: "empty" | "loading" | "success"; content: string }
	| { state: "error"; content: string; error: string };

interface TutorialPlaygroundPreviewProps {
	content: string;
	fileName?: string;
	className?: string;
	emptyMessage?: string;
	loadingMessage?: string;
	onApiChange?: (api: alphaTab.AlphaTabApi | null) => void;
	onRenderStatusChange?: (status: TutorialPlaygroundRenderStatus) => void;
}

export function TutorialPlaygroundPreview({
	content,
	fileName,
	className,
	emptyMessage = "Enter alphaTex to render a preview.",
	loadingMessage = "Loading score...",
	onApiChange,
	onRenderStatusChange,
}: TutorialPlaygroundPreviewProps) {
	const containerRef = useRef<HTMLDivElement | null>(null);
	const apiRef = useRef<alphaTab.AlphaTabApi | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const resourceAssetOverrides = useAppStore((s) => s.resourceAssetOverrides);

	useEffect(() => {
		let destroyed = false;
		let api: alphaTab.AlphaTabApi | null = null;
		let scoreLoaded = false;
		let renderFinished = false;
		let successEmitted = false;
		const hasContent = content.trim().length > 0;
		const emitSuccessIfReady = () => {
			if (destroyed || successEmitted || !scoreLoaded || !renderFinished)
				return;
			successEmitted = true;
			setLoading(false);
			onRenderStatusChange?.({ state: "success", content });
		};

		if (!hasContent) {
			setLoading(false);
			setError(null);
			onApiChange?.(null);
			onRenderStatusChange?.({ state: "empty", content });
			return () => {
				destroyed = true;
			};
		}

		const init = async () => {
			if (!containerRef.current) return;
			setLoading(true);
			setError(null);
			onRenderStatusChange?.({ state: "loading", content });

			const urls = await getResourceUrls(resourceAssetOverrides);
			if (destroyed || !containerRef.current) return;
			const colors = getAlphaTabColorsForTheme();
			const settings = createPreviewSettings(urls, {
				scale: 0.6,
				enablePlayer: true,
				colors,
			});

			try {
				api = new alphaTab.AlphaTabApi(containerRef.current, settings);
				apiRef.current = api;
				onApiChange?.(api);

				api.scoreLoaded.on(() => {
					if (destroyed) return;
					scoreLoaded = true;
					emitSuccessIfReady();
				});
				api.renderFinished.on(() => {
					if (destroyed) return;
					renderFinished = true;
					emitSuccessIfReady();
				});
				api.error.on((err) => {
					if (destroyed) return;
					const message = formatFullError(err);
					setError(message);
					setLoading(false);
					onRenderStatusChange?.({ state: "error", content, error: message });
				});

				const atDoc = parseAtDoc(content);
				applyAtDocColoring(api, atDoc.config, (message) => {
					console.warn(message);
				});

				api.tex(content);
			} catch (err) {
				if (destroyed) return;
				const message = formatFullError(err);
				setError(message);
				setLoading(false);
				onRenderStatusChange?.({ state: "error", content, error: message });
			}
		};

		init();

		return () => {
			destroyed = true;
			apiRef.current?.destroy();
			apiRef.current = null;
			onApiChange?.(null);
		};
	}, [content, onApiChange, onRenderStatusChange, resourceAssetOverrides]);

	useEffect(() => {
		const api = apiRef.current;
		if (!api) return;
		try {
			updateAlphaTabColorsForTheme(api);
		} catch (err) {
			console.warn("[TutorialPlaygroundPreview] theme sync failed", err);
		}
	});

	return (
		<div className={`relative h-full w-full bg-card ${className ?? ""}`}>
			<div
				ref={containerRef}
				className="h-full w-full overflow-auto"
				role="img"
				aria-label={fileName ?? "AlphaTex Preview"}
			/>
			{!content.trim() ? (
				<div className="absolute inset-0 flex items-center justify-center p-4 text-center text-xs text-muted-foreground">
					{emptyMessage}
				</div>
			) : null}
			{content.trim() && loading && !error ? (
				<div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
					{loadingMessage}
				</div>
			) : null}
			{error ? (
				<div className="absolute inset-0 p-3 text-xs text-destructive whitespace-pre-wrap bg-card/80">
					{error}
				</div>
			) : null}
		</div>
	);
}

export default TutorialPlaygroundPreview;
