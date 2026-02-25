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

interface TutorialPlaygroundPreviewProps {
	content: string;
	fileName?: string;
	className?: string;
	onApiChange?: (api: alphaTab.AlphaTabApi | null) => void;
}

export function TutorialPlaygroundPreview({
	content,
	fileName,
	className,
	onApiChange,
}: TutorialPlaygroundPreviewProps) {
	const containerRef = useRef<HTMLDivElement | null>(null);
	const apiRef = useRef<alphaTab.AlphaTabApi | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		let destroyed = false;
		let api: alphaTab.AlphaTabApi | null = null;

		const init = async () => {
			if (!containerRef.current) return;
			setLoading(true);
			setError(null);

			const urls = await getResourceUrls();
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

				api.scoreLoaded.on(() => setLoading(false));
				api.error.on((err) => {
					if (destroyed) return;
					setError(formatFullError(err));
				});

				const atDoc = parseAtDoc(content);
				applyAtDocColoring(api, atDoc.config, (message) => {
					console.warn(message);
				});

				api.tex(content);
			} catch (err) {
				if (destroyed) return;
				setError(formatFullError(err));
				setLoading(false);
			}
		};

		init();

		return () => {
			destroyed = true;
			apiRef.current?.destroy();
			apiRef.current = null;
			onApiChange?.(null);
		};
	}, [content, onApiChange]);

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
			{loading && !error ? (
				<div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
					Loading score...
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
