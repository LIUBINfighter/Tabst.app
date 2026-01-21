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
	/** AlphaTex 内容 */
	content: string;
	/** 文件名（用于显示和 PDF 文件名） */
	fileName?: string;
	/** 关闭预览的回调 */
	onClose: () => void;
}

// 页面尺寸和相关常量已在 print-utils.ts 中定义

/**
 * PrintPreview 组件
 *
 * 在一个模态窗口中渲染 alphaTab 曲谱，并提供打印预览和 PDF 导出功能。
 * 使用固定宽度确保 alphaTab 正确换行，然后通过 CSS @page 规则进行打印分页。
 */
export default function PrintPreview({
	content,
	fileName = "曲谱",
	onClose,
}: PrintPreviewProps) {
	// 状态
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [currentPage, setCurrentPage] = useState(1);
	const [totalPages, setTotalPages] = useState(0);
	const [pageSize, setPageSize] = useState<PageSize>(PAGE_SIZES[0]);
	const [pages, setPages] = useState<string[]>([]);
	const [bravuraFontUrl, setBravuraFontUrl] = useState<string>("");
	const [_fontLoaded, setFontLoaded] = useState(false);
	const [fontError, setFontError] = useState(false);

	// 打印时使用的专用字体名与 URL（动态，带时间戳）
	const [printFontName, setPrintFontName] = useState<string>("");
	const [printFontUrl, setPrintFontUrl] = useState<string>("");

	// 音轨选择侧边栏状态
	const [isTracksPanelOpen, setIsTracksPanelOpen] = useState(true);

	// 缩放比例状态
	const [zoom, setZoom] = useState(1.0);

	// 布局配置状态
	const [barsPerRow, setBarsPerRow] = useState(-1); // -1 表示自动模式
	const [stretchForce, setStretchForce] = useState(1.0); // 音符间距拉伸力度

	// 保存 applyStaffOptions 的引用，供 zoom 变化时使用
	const applyStaffOptionsRef = useRef<(() => void) | null>(null);

	const printStyleRef = useRef<HTMLStyleElement | null>(null);
	const printFontFaceRef = useRef<FontFace | null>(null);

	// Refs
	const containerRef = useRef<HTMLDivElement>(null);
	const alphaTabContainerRef = useRef<HTMLDivElement>(null);
	const previewContainerRef = useRef<HTMLDivElement>(null);
	const apiRef = useRef<alphaTab.AlphaTabApi | null>(null);
	const pageSizeRef = useRef(pageSize);
	pageSizeRef.current = pageSize;

	// 计算打印区域尺寸
	const marginMm = 15;
	const { contentWidthMm, contentHeightMm, contentWidthPx, contentHeightPx } =
		calculateContentDimensions(pageSize, marginMm);

	/**
	 * 将 SVG 内容分割成多个页面
	 */
	const handlePaginate = useCallback(() => {
		if (!alphaTabContainerRef.current) {
			setIsLoading(false);
			return;
		}

		// 使用工具函数进行分页
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
	 * 初始化 alphaTab 并渲染曲谱
	 */

	const initAlphaTab = useCallback(async () => {
		if (!alphaTabContainerRef.current) return;

		try {
			setIsLoading(true);
			setError(null);

			const urls = await getResourceUrls();

			// 使用稳定的字体 URL（不再使用时间戳），并使用简洁的打印字体名
			const fontUrl = urls.bravuraFontUrl;
			const fontName = `Bravura-Print`;
			setBravuraFontUrl(fontUrl);
			setPrintFontName(fontName);
			setPrintFontUrl(fontUrl);

			// 设置容器宽度
			alphaTabContainerRef.current.style.width = `${contentWidthPx}px`;

			// 注入打印专用 @font-face 及字体覆盖，确保 AlphaTab 在测量时使用该字体名
			try {
				if (printStyleRef.current?.parentElement) {
					printStyleRef.current.parentElement.removeChild(
						printStyleRef.current,
					);
					printStyleRef.current = null;
				}
				const styleEl = document.createElement("style");
				// 必须设置 .at 的 font-size: 34px，这是 alphaTab 的 MusicFontSize 常量
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

			// 使用工具函数创建打印配置
			const settings = createPrintSettings(urls as ResourceUrls, {
				scale: 1.0,
				zoom,
				barsPerRow,
				stretchForce,
			});

			console.log("[PrintPreview] Initialization params:", {
				containerWidth: contentWidthPx,
				pageSize: pageSize.name,
				pageSizeMm: `${pageSize.width}×${pageSize.height}`,
				contentSizeMm: `${contentWidthMm}×${contentHeightMm}`,
				contentSizePx: `${contentWidthPx}×${contentHeightPx}`,
				scale: (settings.display as { scale: number }).scale,
				barsPerRow,
				stretchForce,
				layoutMode:
					alphaTab.LayoutMode[
						(settings.display as { layoutMode: alphaTab.LayoutMode }).layoutMode
					],
			});

			console.log("[PrintPreview] AlphaTab settings:", {
				scale: (settings.display as { scale: number }).scale,
				layoutMode: (settings.display as { layoutMode: alphaTab.LayoutMode })
					.layoutMode,
			});

			// 销毁旧的 API
			if (apiRef.current) {
				apiRef.current.destroy();
				apiRef.current = null;
			}

			// 创建新的 AlphaTab API（使用隔离的设置）
			apiRef.current = new alphaTab.AlphaTabApi(
				alphaTabContainerRef.current,
				settings,
			);
			console.log("[PrintPreview] AlphaTab API created");

			// 监听渲染完成事件
			apiRef.current.renderFinished.on(() => {
				console.log("[PrintPreview] AlphaTab render finished");

				// 渲染完成后进行分页
				setTimeout(() => {
					handlePaginate();
				}, 200);
			});

			// 监听错误事件
			apiRef.current.error.on((err: unknown) => {
				console.error("[PrintPreview] AlphaTab error:", err);
				setError(
					typeof err === "object" && err !== null && "message" in err
						? String((err as { message: unknown }).message)
						: "AlphaTex 解析错误",
				);
				setIsLoading(false);
			});

			// 加载内容
			apiRef.current.tex(content);
		} catch (err) {
			console.error("[PrintPreview] Failed to initialize:", err);
			setError(err instanceof Error ? err.message : "初始化失败");
			setIsLoading(false);
		}
	}, [
		content,
		contentWidthPx,
		handlePaginate,
		contentWidthMm,
		contentHeightMm,
		contentHeightPx,
		pageSize,
		zoom,
		barsPerRow,
		stretchForce,
	]);

	/**
	 * 处理打印/导出 PDF
	 */
	const handlePrint = useCallback(() => {
		if (pages.length === 0) return;

		// 创建打印专用窗口
		const printWindow = window.open("", "_blank");
		if (!printWindow) {
			alert("无法打开打印窗口，请检查浏览器设置");
			return;
		}

		// 🔧 确保字体 URL 是绝对路径（对于新窗口很重要）
		const fontUrl = printFontUrl || bravuraFontUrl;
		const absoluteFontUrl =
			fontUrl.startsWith("http") || fontUrl.startsWith("file:")
				? fontUrl
				: new URL(fontUrl, window.location.href).toString();

		console.log("[PrintPreview] Print window font URL:", absoluteFontUrl);

		// 生成所有页面的 HTML - pages 已经是完整的 outerHTML
		const pagesHtml = pages
			.map(
				(pageContent, index) => `
				<div class="print-page" ${index < pages.length - 1 ? 'style="page-break-after: always;"' : ""}>
					${pageContent}
				</div>
			`,
			)
			.join("");

		// 写入打印文档
		printWindow.document.write(`
			<!DOCTYPE html>
			<html>
			<head>
				<meta charset="utf-8">
				<title>${fileName} - 打印</title>
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
					
					/* 🔧 音乐符号字体样式 - alphaTab 需要这个来正确渲染 Bravura 字体 */
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

		// 🔧 等待字体和内容加载完成后再打印
		printWindow.onload = () => {
			// 检查字体是否已加载
			const fontName = printFontName || "Bravura";
			console.log("[PrintPreview] Checking font load status:", fontName);

			// 使用 document.fonts API 检查字体加载状态
			if (printWindow.document.fonts?.check) {
				const checkFontAndPrint = () => {
					const fontLoaded = printWindow.document.fonts.check(
						`34px "${fontName}"`,
					);
					console.log("[PrintPreview] Font loaded:", fontLoaded);

					if (fontLoaded) {
						// 字体已加载，延迟一点以确保渲染完成
						setTimeout(() => {
							printWindow.focus();
							printWindow.print();
							printWindow.onafterprint = () => {
								printWindow.close();
							};
						}, 100);
					} else {
						// 等待字体加载
						printWindow.document.fonts.ready
							.then(() => {
								console.log("[PrintPreview] All fonts ready");
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
								// 即使字体加载失败也尝试打印
								printWindow.focus();
								printWindow.print();
								printWindow.onafterprint = () => {
									printWindow.close();
								};
							});
					}
				};

				// 立即检查，如果未加载则等待
				checkFontAndPrint();
			} else {
				// 不支持 document.fonts API，使用简单延迟
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
	]);

	/**
	 * 导航到指定页面
	 */
	const navigateToPage = useCallback(
		(page: number) => {
			if (page < 1 || page > totalPages) return;
			setCurrentPage(page);
		},
		[totalPages],
	);

	// 延迟初始化：确保 Preview 的 API 已完全销毁和资源释放
	useEffect(() => {
		console.log("[PrintPreview] Scheduling delayed initialization");
		const delayedInit = setTimeout(() => {
			console.log("[PrintPreview] Starting delayed initialization");
			initAlphaTab();
		}, 200); // 延迟 200ms 确保 Preview API 完全销毁

		return () => {
			clearTimeout(delayedInit);
			if (apiRef.current) {
				console.log("[PrintPreview] Cleanup: destroying API");
				apiRef.current.destroy();
				apiRef.current = null;
			}
		};
	}, [initAlphaTab]);

	// 字体加载监测和回退机制（使用打印专用字体名）
	useEffect(() => {
		if (!printFontUrl || !printFontName) return;

		let cancelled = false;

		const loadFont = async () => {
			try {
				console.log(
					"[PrintPreview] Loading print font:",
					printFontUrl,
					printFontName,
				);

				// 使用 FontFace API 加载打印字体
				const font = new FontFace(
					printFontName,
					`url(${printFontUrl}) format('woff2')`,
				);

				// 设置超时
				const timeoutPromise = new Promise((_, reject) =>
					setTimeout(() => reject(new Error("Font loading timeout")), 5000),
				);

				await Promise.race([font.load(), timeoutPromise]);
				document.fonts.add(font);
				printFontFaceRef.current = font;
				if (!cancelled) {
					setFontLoaded(true);
					console.log("[PrintPreview] Print Bravura font loaded successfully");
				}
			} catch (err) {
				console.warn("[PrintPreview] Failed to load print Bravura font:", err);
				if (!cancelled) setFontError(true);
			}
		};

		loadFont();

		return () => {
			cancelled = true;
			// 不立即删除 font，因为可能会被其他页面重用，但如果我们确实要移除，请手动删除
		};
	}, [printFontUrl, printFontName]);

	// 使用 ref 追踪 isLoading 状态
	const isLoadingRef = useRef(isLoading);
	isLoadingRef.current = isLoading;

	// 页面尺寸变化时重新渲染
	useEffect(() => {
		if (
			apiRef.current &&
			!isLoadingRef.current &&
			alphaTabContainerRef.current
		) {
			// 重新计算宽度并渲染
			const { contentWidthPx: newWidthPx } = calculateContentDimensions(
				pageSize,
				15,
			);
			alphaTabContainerRef.current.style.width = `${newWidthPx}px`;

			setIsLoading(true);
			apiRef.current.render();
		}
	}, [pageSize]);

	// zoom 缩放变化时更新设置并重新渲染
	useEffect(() => {
		if (apiRef.current && !isLoadingRef.current) {
			console.log("[PrintPreview] Zoom changed to:", zoom);

			// 更新 scale 设置
			if (apiRef.current.settings.display) {
				(apiRef.current.settings.display as { scale: number }).scale = zoom;
				apiRef.current.updateSettings();

				// 在渲染之前应用 staff 显示选项
				if (applyStaffOptionsRef.current) {
					applyStaffOptionsRef.current();
				}

				setIsLoading(true);
				apiRef.current.render();
			}
		}
	}, [zoom]);

	// barsPerRow 和 stretchForce 变化时更新设置并重新渲染
	useEffect(() => {
		if (apiRef.current && !isLoadingRef.current) {
			console.log("[PrintPreview] Layout settings changed:", {
				barsPerRow,
				stretchForce,
			});

			// 更新布局设置
			if (apiRef.current.settings.display) {
				(apiRef.current.settings.display as { barsPerRow: number }).barsPerRow =
					barsPerRow;
				(
					apiRef.current.settings.display as { stretchForce: number }
				).stretchForce = stretchForce;
				apiRef.current.updateSettings();

				// 在渲染之前应用 staff 显示选项
				if (applyStaffOptionsRef.current) {
					applyStaffOptionsRef.current();
				}

				setIsLoading(true);
				apiRef.current.render();
			}
		}
	}, [barsPerRow, stretchForce]);

	// 键盘快捷键
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

	// 组件卸载时清理 injected style/FontFace 以及 API
	useEffect(() => {
		return () => {
			console.log("[PrintPreview] Unmount cleanup");
			try {
				if (apiRef.current) {
					apiRef.current.destroy();
					apiRef.current = null;
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

	// 当前页面的 HTML
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
						<span className="text-sm font-medium">{fileName} - 打印预览</span>
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
							{/* 音轨选择按钮（使用 IconButton 与主预览一致） */}
							<IconButton
								active={isTracksPanelOpen}
								title={isTracksPanelOpen ? "关闭音轨选择" : "打开音轨选择"}
								onClick={() => setIsTracksPanelOpen(!isTracksPanelOpen)}
								disabled={isLoading || !apiRef.current?.score}
							>
								<Layers className="h-5 w-5" />
							</IconButton>
							<Button
								size="sm"
								className="px-2 print-btn h-8 text-xs"
								variant="default"
								onClick={handlePrint}
								disabled={isLoading || !!error || pages.length === 0}
							>
								<Printer className="h-3 w-3 mr-1" /> 打印 / 导出 PDF
							</Button>
							{/* 字体加载状态提示 */}
							{fontError && (
								<span
									className="text-xs text-amber-600"
									title="字体加载失败，使用回退字体"
								>
									⚠️ 字体
								</span>
							)}
							{/* 关闭按钮 - 放在最右侧，红色高亮样式 */}
							<Tooltip>
								<TooltipTrigger asChild>
									<IconButton
										className="hover:bg-red-500/20 hover:text-red-600"
										onClick={onClose}
										aria-label="关闭"
									>
										<X className="h-4 w-4" />
									</IconButton>
								</TooltipTrigger>
								<TooltipContent side="bottom">
									<p>关闭</p>
								</TooltipContent>
							</Tooltip>
						</div>
					}
				/>
			</TooltipProvider>

			{/* 主内容区域（包含侧边栏和预览） */}
			<div className="flex-1 flex overflow-hidden">
				{/* 内容区域 */}
				<div className="flex-1 overflow-auto bg-muted/30 p-6">
					{/* 加载状态 */}
					{isLoading && (
						<div className="flex items-center justify-center h-full">
							<div className="flex flex-col items-center gap-4">
								<Loader2 className="h-8 w-8 animate-spin text-primary" />
								<span className="text-sm text-muted-foreground">
									正在生成打印预览...
								</span>
							</div>
						</div>
					)}

					{/* 错误状态 */}
					{error && (
						<div className="flex items-center justify-center h-full">
							<div className="bg-destructive/10 text-destructive p-6 rounded-lg max-w-md">
								<h3 className="font-medium mb-2">生成预览失败</h3>
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
							zIndex: -100, // 放在最底层
							opacity: 0, // 完全透明
							pointerEvents: "none", // 不响应鼠标事件
							fontSize: "16px", // 强制设置基础字号
							lineHeight: "normal", // 防止继承异常行高
						}}
					/>

					{/* 页面预览 */}
					{!isLoading && !error && pages.length > 0 && (
						<div className="flex justify-center">
							<div
								ref={previewContainerRef}
								className="bg-white shadow-lg rounded-sm overflow-hidden relative"
								style={{
									width: `${contentWidthPx}px`,
									height: `${contentHeightPx}px`,
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
					)}
				</div>

				{/* 音轨选择侧边栏 */}
				<PrintTracksPanel
					api={apiRef.current}
					isOpen={isTracksPanelOpen}
					onClose={() => setIsTracksPanelOpen(false)}
					zoom={zoom}
					onZoomChange={setZoom}
					barsPerRow={barsPerRow}
					onBarsPerRowChange={setBarsPerRow}
					stretchForce={stretchForce}
					onStretchForceChange={setStretchForce}
					onTracksChange={() => {
						// 音轨变化后需要等待重新渲染，然后重新分页
						// renderFinished 事件会自动触发 paginateContent
					}}
					onApplyStaffOptionsReady={(applyFn) => {
						applyStaffOptionsRef.current = applyFn;
					}}
				/>
			</div>

			{/* 底部快捷键提示 */}
			<div className="h-8 border-t border-border flex items-center justify-center px-4 bg-card text-xs text-muted-foreground shrink-0">
				<span>Esc 关闭 | ← → 翻页 | Ctrl+P 打印</span>
			</div>
		</div>
	);
}
