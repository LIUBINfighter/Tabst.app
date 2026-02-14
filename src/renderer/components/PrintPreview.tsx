import * as alphaTab from "@coderline/alphatab";
import {
	ChevronLeft,
	ChevronRight,
	Layers,
	Loader2,
	Printer,
	X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { createPrintSettings } from "../lib/alphatab-config";
import { paginateContent } from "../lib/pagination";
import {
	calculateContentDimensions,
	PAGE_SIZES,
	type PageSize,
} from "../lib/print-utils";
import type { ResourceUrls } from "../lib/resourceLoaderService";
import { getResourceUrls } from "../lib/resourceLoaderService";
import { PrintTracksPanel } from "./PrintTracksPanel";
import TopBar from "./TopBar";
import { Button } from "./ui/button";
import IconButton from "./ui/icon-button";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "./ui/tooltip";

export interface PrintPreviewProps {
	/** AlphaTex content */
	content: string;
	/** File name (for display and PDF file name) */
	fileName?: string;
	/** Callback to close preview */
	onClose: () => void;
}

// Page size and related constants are defined in print-utils.ts

/**
 * PrintPreview Component
 *
 * Renders alphaTab score in a modal window and provides print preview and PDF export functionality.
 * Uses fixed width to ensure alphaTab wraps correctly, then uses CSS @page rules for print pagination.
 */
export default function PrintPreview({
	content,
	fileName: fileNameProp,
	onClose,
}: PrintPreviewProps) {
	const { t } = useTranslation("print");
	const fileName = fileNameProp ?? t("defaultFileName");

	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [currentPage, setCurrentPage] = useState(1);
	const [totalPages, setTotalPages] = useState(0);
	const [pageSize, setPageSize] = useState<PageSize>(PAGE_SIZES[0]);
	const [pages, setPages] = useState<string[]>([]);
	const [bravuraFontUrl, setBravuraFontUrl] = useState<string>("");
	const [_fontLoaded, setFontLoaded] = useState(false);
	const [fontError, setFontError] = useState(false);

	// Dedicated font name and URL for printing (dynamic, with timestamp)
	const [printFontName, setPrintFontName] = useState<string>("");
	const [printFontUrl, setPrintFontUrl] = useState<string>("");

	// Track selection sidebar state
	const [isTracksPanelOpen, setIsTracksPanelOpen] = useState(true);

	// Zoom scale state
	const [zoom, setZoom] = useState(1.0);
	const [previewFitScale, setPreviewFitScale] = useState(1);
	const zoomRef = useRef(zoom);

	// Layout configuration state
	const [barsPerRow, setBarsPerRow] = useState(-1); // -1 means auto mode
	const [stretchForce, setStretchForce] = useState(1.0); // Note spacing stretch force
	const barsPerRowRef = useRef(barsPerRow);
	const stretchForceRef = useRef(stretchForce);

	// Store applyStaffOptions reference and selected tracks for parameter-driven re-render
	const applyStaffOptionsRef = useRef<(() => alphaTab.model.Track[]) | null>(
		null,
	);

	const printStyleRef = useRef<HTMLStyleElement | null>(null);
	const printFontFaceRef = useRef<FontFace | null>(null);

	// Refs
	const containerRef = useRef<HTMLDivElement>(null);
	const alphaTabContainerRef = useRef<HTMLDivElement>(null);
	const previewViewportRef = useRef<HTMLDivElement>(null);
	const previewContainerRef = useRef<HTMLDivElement>(null);
	const apiRef = useRef<alphaTab.AlphaTabApi | null>(null);
	const [printApi, setPrintApi] = useState<alphaTab.AlphaTabApi | null>(null);
	const pageSizeRef = useRef(pageSize);
	pageSizeRef.current = pageSize;

	useEffect(() => {
		zoomRef.current = zoom;
	}, [zoom]);

	useEffect(() => {
		barsPerRowRef.current = barsPerRow;
	}, [barsPerRow]);

	useEffect(() => {
		stretchForceRef.current = stretchForce;
	}, [stretchForce]);

	// Calculate print area dimensions
	const marginMm = 15;
	const { contentWidthPx, contentHeightPx } = calculateContentDimensions(
		pageSize,
		marginMm,
	);

	/**
	 * Split SVG content into multiple pages
	 */
	const handlePaginate = useCallback(() => {
		if (!alphaTabContainerRef.current) {
			setIsLoading(false);
			return;
		}

		// Use utility function for pagination
		const result = paginateContent(
			alphaTabContainerRef.current,
			contentHeightPx,
			contentWidthPx,
		);

		setPages(result.pages);
		setTotalPages(result.totalPages);
		setCurrentPage(1);
		setIsLoading(false);
	}, [contentHeightPx, contentWidthPx]);

	/**
	 * Initialize alphaTab and render score
	 */

	const initAlphaTab = useCallback(async () => {
		if (!alphaTabContainerRef.current) return;

		try {
			setIsLoading(true);
			setError(null);

			const urls = await getResourceUrls();

			// Use stable font URL (no longer using timestamp) and concise print font name
			const fontUrl = urls.bravuraFontUrl;
			const fontName = `Bravura-Print`;
			setBravuraFontUrl(fontUrl);
			setPrintFontName(fontName);
			setPrintFontUrl(fontUrl);

			// Set container width
			alphaTabContainerRef.current.style.width = `${contentWidthPx}px`;

			// Inject print-specific @font-face and font overrides to ensure AlphaTab uses this font name when measuring
			try {
				if (printStyleRef.current?.parentElement) {
					printStyleRef.current.parentElement.removeChild(
						printStyleRef.current,
					);
					printStyleRef.current = null;
				}
				const styleEl = document.createElement("style");
				// Must set .at font-size: 34px, this is alphaTab's MusicFontSize constant
				styleEl.textContent = `
					@font-face {
						font-family: '${fontName}';
						src: url('${fontUrl}') format('woff2');
						font-weight: normal;
						font-style: normal;
						font-display: block;
					}
					.at-surface, .at-surface text, .at-surface tspan {
						font-family: '${fontName}', 'Bravura', sans-serif !important;
					}
					.at-surface .at, .at-surface-svg .at {
						font-family: '${fontName}', 'Bravura', sans-serif !important;
						font-size: 34px; /* alphaTab MusicFontSize */
						font-style: normal;
						font-weight: normal;
					}
				`;
				document.head.appendChild(styleEl);
				printStyleRef.current = styleEl;
			} catch (e) {
				console.warn("[PrintPreview] Failed to inject print font style:", e);
			}

			// Use utility function to create print configuration
			const settings = createPrintSettings(urls as ResourceUrls, {
				scale: 1.0,
				zoom: zoomRef.current,
				barsPerRow: barsPerRowRef.current,
				stretchForce: stretchForceRef.current,
			});

			// Destroy old API
			if (apiRef.current) {
				apiRef.current.destroy();
				apiRef.current = null;
				setPrintApi(null);
			}

			// Create new AlphaTab API (using isolated settings)
			apiRef.current = new alphaTab.AlphaTabApi(
				alphaTabContainerRef.current,
				settings,
			);
			setPrintApi(apiRef.current);

			// Listen to render finished event
			apiRef.current.renderFinished.on(() => {
				// Paginate after rendering completes
				setTimeout(() => {
					handlePaginate();
				}, 200);
			});

			// Listen to error event
			apiRef.current.error.on((err: unknown) => {
				console.error("[PrintPreview] AlphaTab error:", err);
				setError(
					typeof err === "object" && err !== null && "message" in err
						? String((err as { message: unknown }).message)
						: "AlphaTex 解析错误",
				);
				setIsLoading(false);
			});

			// Load content
			apiRef.current.tex(content);
		} catch (err) {
			console.error("[PrintPreview] Failed to initialize:", err);
			setError(err instanceof Error ? err.message : "Initialization failed");
			setIsLoading(false);
		}
	}, [content, contentWidthPx, handlePaginate]);

	/**
	 * Handle print/export PDF
	 */
	const handlePrint = useCallback(() => {
		if (pages.length === 0) return;

		// Create print-specific window
		const printWindow = window.open("", "_blank");
		if (!printWindow) {
			alert(t("unableToOpenPrintWindow"));
			return;
		}

		// Ensure font URL is absolute path (important for new window)
		const fontUrl = printFontUrl || bravuraFontUrl;
		const absoluteFontUrl =
			fontUrl.startsWith("http") || fontUrl.startsWith("file:")
				? fontUrl
				: new URL(fontUrl, window.location.href).toString();

		// Generate HTML for all pages - pages already contain complete outerHTML
		const pagesHtml = pages
			.map(
				(pageContent, index) => `
				<div class="print-page" ${index < pages.length - 1 ? 'style="page-break-after: always;"' : ""}>
					${pageContent}
				</div>
			`,
			)
			.join("");

		// Write print document
		printWindow.document.write(`
			<!DOCTYPE html>
			<html>
			<head>
				<meta charset="utf-8">
				<title>${fileName} - ${t("print")}</title>
				<style>
					/* 加载打印专用 Bravura 音乐字体 */
					@font-face {
						font-family: '${printFontName || "Bravura"}';
						src: url('${absoluteFontUrl}') format('woff2');
						font-weight: normal;
						font-style: normal;
						font-display: block;
					}
					
					@page {
						size: ${pageSize.width}mm ${pageSize.height}mm;
						margin: ${marginMm}mm;
					}
					
					* {
						margin: 0;
						padding: 0;
						box-sizing: border-box;
					}
					
					body {
						font-family: '${printFontName || "Bravura"}', system-ui, -apple-system, sans-serif;
						background: white;
						color: black;
					}
					
					.print-page {
						width: ${contentWidthPx}px;
						height: ${contentHeightPx}px;
						overflow: hidden;
						position: relative;
					}
					
					.at-surface {
						position: relative;
						width: 100%;
						height: 100%;
					}
					
					.at-surface > div {
						position: absolute;
					}
					
					.at-surface svg {
						display: block;
					}
					
					/* Music symbol font style - alphaTab needs this to correctly render Bravura font */
					.at-surface .at,
					.at-surface-svg .at {
						font-family: '${printFontName || "Bravura"}', 'Bravura', 'alphaTab', sans-serif !important;
						font-size: 34px; /* Fc.MusicFontSize = 34 */
						font-style: normal;
						font-weight: normal;
						speak: none;
						-webkit-font-smoothing: antialiased;
						-moz-osx-font-smoothing: grayscale;
					}
					
					@media print {
						body {
							-webkit-print-color-adjust: exact;
							print-color-adjust: exact;
						}
						
						.print-page {
							page-break-inside: avoid;
						}
					}
				</style>
			</head>
			<body>
				${pagesHtml}
			</body>
			</html>
		`);
		printWindow.document.close();

		// Wait for font and content to load before printing
		printWindow.onload = () => {
			// Check if font is loaded
			const fontName = printFontName || "Bravura";

			// Use document.fonts API to check font loading status
			if (printWindow.document.fonts?.check) {
				const checkFontAndPrint = () => {
					const fontLoaded = printWindow.document.fonts.check(
						`34px "${fontName}"`,
					);

					if (fontLoaded) {
						// Font loaded, delay slightly to ensure rendering completes
						setTimeout(() => {
							printWindow.focus();
							printWindow.print();
							printWindow.onafterprint = () => {
								printWindow.close();
							};
						}, 100);
					} else {
						// Wait for font to load
						printWindow.document.fonts.ready
							.then(() => {
								setTimeout(() => {
									printWindow.focus();
									printWindow.print();
									printWindow.onafterprint = () => {
										printWindow.close();
									};
								}, 100);
							})
							.catch((err: unknown) => {
								console.warn("[PrintPreview] Font loading failed:", err);
								// Try printing even if font loading fails
								printWindow.focus();
								printWindow.print();
								printWindow.onafterprint = () => {
									printWindow.close();
								};
							});
					}
				};

				// Check immediately, wait if not loaded
				checkFontAndPrint();
			} else {
				// document.fonts API not supported, use simple delay
				console.warn(
					"[PrintPreview] document.fonts API not available, using delay",
				);
				setTimeout(() => {
					printWindow.focus();
					printWindow.print();
					printWindow.onafterprint = () => {
						printWindow.close();
					};
				}, 500);
			}
		};
	}, [
		pages,
		fileName,
		pageSize,
		contentWidthPx,
		contentHeightPx,
		bravuraFontUrl,
		printFontName,
		printFontUrl,
		t,
	]);

	/**
	 * Navigate to specified page
	 */
	const navigateToPage = useCallback(
		(page: number) => {
			if (page < 1 || page > totalPages) return;
			setCurrentPage(page);
		},
		[totalPages],
	);

	// Delayed initialization: ensure Preview's API is fully destroyed and resources released
	useEffect(() => {
		const delayedInit = setTimeout(() => {
			initAlphaTab();
		}, 200); // Delay 200ms to ensure Preview API is fully destroyed

		return () => {
			clearTimeout(delayedInit);
			if (apiRef.current) {
				apiRef.current.destroy();
				apiRef.current = null;
				setPrintApi(null);
			}
		};
	}, [initAlphaTab]);

	// Font loading monitoring and fallback mechanism (using print-specific font name)
	useEffect(() => {
		if (!printFontUrl || !printFontName) return;

		let cancelled = false;

		const loadFont = async () => {
			try {
				// Use FontFace API to load print font
				const font = new FontFace(
					printFontName,
					`url(${printFontUrl}) format('woff2')`,
				);

				// Set timeout
				const timeoutPromise = new Promise((_, reject) =>
					setTimeout(() => reject(new Error("Font loading timeout")), 5000),
				);

				await Promise.race([font.load(), timeoutPromise]);
				document.fonts.add(font);
				printFontFaceRef.current = font;
				if (!cancelled) {
					setFontLoaded(true);
				}
			} catch (err) {
				console.warn("[PrintPreview] Failed to load print Bravura font:", err);
				if (!cancelled) setFontError(true);
			}
		};

		loadFont();

		return () => {
			cancelled = true;
			// Don't immediately delete font as it may be reused by other pages, but manually delete if we really need to remove it
		};
	}, [printFontUrl, printFontName]);

	// Use ref to track isLoading state
	const isLoadingRef = useRef(isLoading);
	isLoadingRef.current = isLoading;

	const renderWithCurrentTrackConfig = useCallback(() => {
		const api = apiRef.current;
		if (!api) return;

		const selectedTracks = applyStaffOptionsRef.current?.() ?? [];
		setIsLoading(true);

		if (selectedTracks.length > 0) {
			api.renderTracks(selectedTracks);
			return;
		}

		api.render();
	}, []);

	// Re-render when page size changes
	useEffect(() => {
		if (
			apiRef.current &&
			!isLoadingRef.current &&
			alphaTabContainerRef.current
		) {
			// Recalculate width and render
			const { contentWidthPx: newWidthPx } = calculateContentDimensions(
				pageSize,
				15,
			);
			alphaTabContainerRef.current.style.width = `${newWidthPx}px`;

			renderWithCurrentTrackConfig();
		}
	}, [pageSize, renderWithCurrentTrackConfig]);

	// Update settings and re-render when zoom changes
	useEffect(() => {
		if (apiRef.current && !isLoadingRef.current) {
			// Update scale settings
			if (apiRef.current.settings.display) {
				(apiRef.current.settings.display as { scale: number }).scale = zoom;
				apiRef.current.updateSettings();
				renderWithCurrentTrackConfig();
			}
		}
	}, [zoom, renderWithCurrentTrackConfig]);

	// Update settings and re-render when barsPerRow and stretchForce change
	useEffect(() => {
		if (apiRef.current && !isLoadingRef.current) {
			// Update layout settings
			if (apiRef.current.settings.display) {
				(apiRef.current.settings.display as { barsPerRow: number }).barsPerRow =
					barsPerRow;
				(
					apiRef.current.settings.display as { stretchForce: number }
				).stretchForce = stretchForce;
				apiRef.current.updateSettings();
				renderWithCurrentTrackConfig();
			}
		}
	}, [barsPerRow, stretchForce, renderWithCurrentTrackConfig]);

	// Keyboard shortcuts
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				onClose();
			} else if (e.key === "ArrowLeft") {
				navigateToPage(currentPage - 1);
			} else if (e.key === "ArrowRight") {
				navigateToPage(currentPage + 1);
			} else if (e.key === "p" && (e.ctrlKey || e.metaKey)) {
				e.preventDefault();
				handlePrint();
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [onClose, currentPage, navigateToPage, handlePrint]);

	// Cleanup injected style/FontFace and API on component unmount
	useEffect(() => {
		return () => {
			try {
				if (apiRef.current) {
					apiRef.current.destroy();
					apiRef.current = null;
					setPrintApi(null);
				}
				if (printStyleRef.current?.parentElement) {
					printStyleRef.current.parentElement.removeChild(
						printStyleRef.current,
					);
					printStyleRef.current = null;
				}
				if (printFontFaceRef.current && document.fonts) {
					try {
						document.fonts.delete(printFontFaceRef.current);
					} catch {}
					printFontFaceRef.current = null;
				}
			} catch (e) {
				console.warn("[PrintPreview] Unmount cleanup failed:", e);
			}
		};
	}, []);

	// On-screen preview adaptive fit (does not affect print output)
	useEffect(() => {
		const viewport = previewViewportRef.current;
		if (!viewport) return;

		const updateFitScale = () => {
			const rect = viewport.getBoundingClientRect();
			const availableWidth = Math.max(0, rect.width - 8);
			const availableHeight = Math.max(0, rect.height - 8);

			if (contentWidthPx <= 0 || contentHeightPx <= 0) {
				setPreviewFitScale(1);
				return;
			}

			const scaleByWidth = availableWidth / contentWidthPx;
			const scaleByHeight = availableHeight / contentHeightPx;
			const nextScale = Math.min(1, scaleByWidth, scaleByHeight);

			setPreviewFitScale(
				Number.isFinite(nextScale) && nextScale > 0 ? nextScale : 1,
			);
		};

		updateFitScale();
		const observer = new ResizeObserver(() => updateFitScale());
		observer.observe(viewport);

		return () => observer.disconnect();
	}, [contentWidthPx, contentHeightPx]);

	// Current page HTML
	const currentPageHtml = pages[currentPage - 1] || "";

	return (
		<div
			ref={containerRef}
			className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-sm"
		>
			{/* 注入打印专用字体样式（备份） */}
			{printFontUrl && printFontName && (
				<style>
					{`
						@font-face {
							font-family: '${printFontName}';
							src: url('${printFontUrl}') format('woff2');
							font-weight: normal;
							font-style: normal;
							font-display: block;
						}
						.at-surface, .at-surface text, .at-surface tspan {
							font-family: '${printFontName}', 'Bravura', sans-serif !important;
						}
					`}
				</style>
			)}
			{/* 工具栏（复用 TopBar 以统一样式） */}
			{/* Using IconButton component for consistent active styling (no extra CSS needed) */}
			{/* Print button specific styling */}
			<style>{`
				.print-btn {
					/* smaller to fit top bar */
					padding-left: 0.5rem;
					padding-right: 0.5rem;
					height: 2rem; /* 32px to match icon buttons */
					font-weight: 600;
					font-size: 0.75rem; /* smaller text */
					line-height: 1;
				}
				.print-btn svg {
					width: 0.75rem;
					height: 0.75rem;
					margin-right: 0.25rem;
				}
				.print-btn:disabled { opacity: 0.6; }
			`}</style>
			<TooltipProvider delayDuration={200}>
				<TopBar
					className="px-4"
					title={
						<span className="text-sm font-medium">
							{fileName} - {t("printPreview")}
						</span>
					}
					trailing={
						<div className="flex items-center gap-4">
							{/* 页面尺寸选择 */}
							<select
								className="h-8 px-2 text-sm border border-border rounded bg-background"
								value={pageSize.name}
								onChange={(e) => {
									const size = PAGE_SIZES.find(
										(s) => s.name === e.target.value,
									);
									if (size) setPageSize(size);
								}}
							>
								{PAGE_SIZES.map((size) => (
									<option key={size.name} value={size.name}>
										{size.name} ({size.width}×{size.height}mm)
									</option>
								))}
							</select>

							{/* 页码导航 */}
							{totalPages > 0 && (
								<div className="flex items-center gap-2">
									<Button
										variant="ghost"
										size="icon"
										className="h-8 w-8"
										onClick={() => navigateToPage(currentPage - 1)}
										disabled={currentPage <= 1}
									>
										<ChevronLeft className="h-4 w-4" />
									</Button>
									<span className="text-sm min-w-[80px] text-center">
										{currentPage} / {totalPages}
									</span>
									<Button
										variant="ghost"
										size="icon"
										className="h-8 w-8"
										onClick={() => navigateToPage(currentPage + 1)}
										disabled={currentPage >= totalPages}
									>
										<ChevronRight className="h-4 w-4" />
									</Button>
								</div>
							)}

							<Button
								size="sm"
								className="px-2 print-btn h-8 text-xs"
								variant="default"
								onClick={handlePrint}
								disabled={isLoading || !!error || pages.length === 0}
							>
								<Printer className="h-3 w-3 mr-1" /> {t("printExport")}
							</Button>
							{fontError && (
								<span
									className="text-xs text-amber-600"
									title={t("fontLoadFailed")}
								>
									⚠️ 字体
								</span>
							)}
							{/* 音轨选择按钮（使用 IconButton 与主预览一致） */}
							<Tooltip>
								<TooltipTrigger asChild>
									<IconButton
										active={isTracksPanelOpen}
										onClick={() => setIsTracksPanelOpen(!isTracksPanelOpen)}
										disabled={isLoading || !printApi?.score}
									>
										<Layers className="h-5 w-5" />
									</IconButton>
								</TooltipTrigger>
								<TooltipContent side="bottom">
									<p>
										{isTracksPanelOpen
											? t("closeTracksPanel")
											: t("openTracksPanel")}
									</p>
								</TooltipContent>
							</Tooltip>
							<Tooltip>
								<TooltipTrigger asChild>
									<IconButton
										className="hover:bg-red-500/20 hover:text-red-600"
										onClick={onClose}
										aria-label={t("close")}
									>
										<X className="h-4 w-4" />
									</IconButton>
								</TooltipTrigger>
								<TooltipContent side="bottom">
									<p>{t("close")}</p>
								</TooltipContent>
							</Tooltip>
						</div>
					}
				/>
			</TooltipProvider>

			{/* 主内容区域（包含侧边栏和预览） */}
			<div className="flex-1 flex overflow-hidden">
				<div className="flex-1 min-w-0 flex flex-col overflow-hidden">
					{/* 内容区域 */}
					<div
						ref={previewViewportRef}
						className="flex-1 overflow-auto bg-muted/30 p-6"
					>
						{/* 加载状态 */}
						{isLoading && (
							<div className="flex items-center justify-center h-full">
								<div className="flex flex-col items-center gap-4">
									<Loader2 className="h-8 w-8 animate-spin text-primary" />
									<span className="text-sm text-muted-foreground">
										{t("generating")}
									</span>
								</div>
							</div>
						)}

						{/* 错误状态 */}
						{error && (
							<div className="flex items-center justify-center h-full">
								<div className="bg-destructive/10 text-destructive p-6 rounded-lg max-w-md">
									<h3 className="font-medium mb-2">{t("generateFailed")}</h3>
									<p className="text-sm">{error}</p>
								</div>
							</div>
						)}

						{/* 隐藏的 alphaTab 渲染容器 - 保持在可视区域内以获取正确的字体度量 */}
						<div
							ref={alphaTabContainerRef}
							className="fixed bg-white"
							style={{
								position: "fixed",
								top: 0,
								left: 0,
								width: `${contentWidthPx}px`,
								zIndex: -100, // Place at bottom layer
								opacity: 0, // Fully transparent
								pointerEvents: "none", // Don't respond to mouse events
								fontSize: "16px", // Force set base font size
								lineHeight: "normal", // Prevent inheriting abnormal line height
							}}
						/>

						{/* 页面预览 */}
						{!isLoading && !error && pages.length > 0 && (
							<div className="flex justify-center">
								<div
									className="relative"
									style={{
										width: `${Math.round(contentWidthPx * previewFitScale)}px`,
										height: `${Math.round(contentHeightPx * previewFitScale)}px`,
									}}
								>
									<div
										ref={previewContainerRef}
										className="bg-white shadow-lg rounded-sm overflow-hidden relative"
										style={{
											width: `${contentWidthPx}px`,
											height: `${contentHeightPx}px`,
											transform: `scale(${previewFitScale})`,
											transformOrigin: "top left",
										}}
									>
										{/* 渲染当前页面的 SVG 内容 - pages 已经包含完整的 at-surface div */}
										<div
											// biome-ignore lint/security/noDangerouslySetInnerHtml: alphaTab SVG content from internal rendering
											dangerouslySetInnerHTML={{ __html: currentPageHtml }}
											style={{ width: "100%", height: "100%" }}
										/>
									</div>
								</div>
							</div>
						)}
					</div>

					{/* 底部快捷键提示 */}
					<div className="h-8 border-t border-border flex items-center justify-between px-3 bg-card text-xs text-muted-foreground shrink-0">
						<span>{t("shortcuts")}</span>
						{!isTracksPanelOpen && (
							<Button
								variant="ghost"
								size="sm"
								className="h-6 px-2 text-xs"
								onClick={() => setIsTracksPanelOpen(true)}
								disabled={isLoading || !printApi?.score}
							>
								<Layers className="mr-1 h-3.5 w-3.5" />
								{t("openTracksPanel")}
							</Button>
						)}
					</div>
				</div>

				{/* 音轨选择侧边栏 */}
				<PrintTracksPanel
					api={printApi}
					isOpen={isTracksPanelOpen}
					onClose={() => setIsTracksPanelOpen(false)}
					zoom={zoom}
					onZoomChange={setZoom}
					barsPerRow={barsPerRow}
					onBarsPerRowChange={setBarsPerRow}
					stretchForce={stretchForce}
					onStretchForceChange={setStretchForce}
					onTracksChange={() => {
						// After track changes, wait for re-render, then re-paginate
						// renderFinished event will automatically trigger paginateContent
					}}
					onApplyStaffOptionsReady={(applyFn) => {
						applyStaffOptionsRef.current = applyFn;
					}}
				/>
			</div>
		</div>
	);
}
