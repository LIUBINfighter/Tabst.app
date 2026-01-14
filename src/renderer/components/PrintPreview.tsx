import * as alphaTab from "@coderline/alphatab";
import { ChevronLeft, ChevronRight, Loader2, Printer, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { getResourceUrls } from "../lib/resourceLoaderService";
import { Button } from "./ui/button";

export interface PrintPreviewProps {
	/** AlphaTex 内容 */
	content: string;
	/** 文件名（用于显示和 PDF 文件名） */
	fileName?: string;
	/** 关闭预览的回调 */
	onClose: () => void;
}

// 页面尺寸配置（毫米）
interface PageSize {
	name: string;
	width: number; // mm
	height: number; // mm
}

const PAGE_SIZES: PageSize[] = [
	{ name: "A4", width: 210, height: 297 },
	{ name: "Letter", width: 215.9, height: 279.4 },
	{ name: "A3", width: 297, height: 420 },
];

// 将毫米转换为像素（假设 96 DPI）
const mmToPx = (mm: number): number => Math.round((mm * 96) / 25.4);

/**
 * alphaTab 打印配置
 * 集中管理打印时的 alphaTab 设置，便于深度定制
 */
interface AlphaTabPrintConfig {
	/** 显示缩放，打印时固定为 1.0 */
	scale: number;
	/** 布局模式 */
	layoutMode: alphaTab.LayoutMode;
	/** 颜色配置（打印用黑白） */
	colors: {
		mainGlyphColor: string;
		secondaryGlyphColor: string;
		staffLineColor: string;
		barSeparatorColor: string;
		barNumberColor: string;
		scoreInfoColor: string;
	};
}

/** 默认打印配置 */
const DEFAULT_PRINT_CONFIG: AlphaTabPrintConfig = {
	scale: 1.0, // 打印时使用 1:1 缩放
	layoutMode: alphaTab.LayoutMode.Page,
	colors: {
		mainGlyphColor: "#000000",
		secondaryGlyphColor: "#333333",
		staffLineColor: "#666666",
		barSeparatorColor: "#666666",
		barNumberColor: "#444444",
		scoreInfoColor: "#000000",
	},
};

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
	const contentWidthMm = pageSize.width - marginMm * 2;
	const contentHeightMm = pageSize.height - marginMm * 2;
	const contentWidthPx = mmToPx(contentWidthMm);
	const contentHeightPx = mmToPx(contentHeightMm);

	/**
	 * 将 SVG 内容分割成多个页面
	 * alphaTab 使用绝对定位渲染，每个元素都有 top/left 样式
	 *
	 * 核心逻辑：
	 * - 每个元素（通常是一行乐谱 staff system）必须完整地放在某一页中
	 * - 如果元素无法完整放入当前页，则将其放到下一页
	 * - 这样可以避免元素被截断
	 */
	const paginateContent = useCallback(() => {
		if (!alphaTabContainerRef.current) return;

		console.log("[PrintPreview] Starting pagination...");

		// 获取 alphaTab 渲染的内容容器
		const svgWrapper = alphaTabContainerRef.current.querySelector(
			".at-surface",
		) as HTMLElement | null;

		if (!svgWrapper) {
			console.warn("[PrintPreview] No .at-surface found");
			setIsLoading(false);
			return;
		}

		// 获取所有子元素并解析它们的位置
		const children = Array.from(svgWrapper.children) as HTMLElement[];
		console.log("[PrintPreview] Total children:", children.length);

		if (children.length === 0) {
			setPages([svgWrapper.innerHTML]);
			setTotalPages(1);
			setCurrentPage(1);
			setIsLoading(false);
			return;
		}

		// 解析每个元素的位置信息
		interface ElementInfo {
			element: HTMLElement;
			top: number;
			height: number;
			bottom: number;
		}

		const elementsInfo: ElementInfo[] = children.map((child) => {
			const style = child.style;
			const top = Number.parseFloat(style.top) || 0;
			const rect = child.getBoundingClientRect();
			const height = rect.height;
			return {
				element: child,
				top,
				height,
				bottom: top + height,
			};
		});

		// 按 top 值排序
		elementsInfo.sort((a, b) => a.top - b.top);

		console.log(
			"[PrintPreview] Elements info (first 10):",
			elementsInfo.slice(0, 10).map((e) => ({
				tagName: e.element.tagName,
				className: e.element.className,
				top: e.top,
				height: e.height,
				bottom: e.bottom,
			})),
		);

		// 检查是否有负的 top 值
		const minTop = Math.min(...elementsInfo.map((e) => e.top));
		const maxBottom = Math.max(...elementsInfo.map((e) => e.bottom));
		console.log("[PrintPreview] Y-axis range:", {
			minTop,
			maxBottom,
			totalHeight: maxBottom - minTop,
		});

		// 计算页面高度（像素）
		const pageHeightPx = contentHeightPx;
		const pagesList: string[] = [];

		// 🔧 改进的分页逻辑：保持元素的绝对位置关系，从最小 top 值开始分页
		let currentPageElements: ElementInfo[] = [];
		let _currentPageStartY = minTop; // 从最小 top 值开始，包含所有装饰元素
		let currentPageEndY = minTop + pageHeightPx;

		for (let i = 0; i < elementsInfo.length; i++) {
			const info = elementsInfo[i];

			// 判断元素是否能完整放入当前页
			// 元素的底部必须在当前页的范围内
			const elementFitsInPage = info.bottom <= currentPageEndY;

			if (elementFitsInPage) {
				// 元素可以完整放入当前页
				currentPageElements.push(info);
			} else {
				// 元素无法放入当前页，先保存当前页，然后开始新页
				if (currentPageElements.length > 0) {
					// 🔧 计算当前页内所有元素的实际范围
					const pageActualMinTop = Math.min(
						...currentPageElements.map((e) => e.top),
					);

					// 创建当前页
					const pageDiv = document.createElement("div");
					pageDiv.className = "at-surface";
					pageDiv.style.position = "relative";
					pageDiv.style.width = `${contentWidthPx}px`;
					pageDiv.style.height = `${pageHeightPx}px`;

					for (const el of currentPageElements) {
						const clonedElement = el.element.cloneNode(true) as HTMLElement;
						// 🔧 相对于页面实际最小 top 值定位，保持元素间的相对位置
						const newTop = el.top - pageActualMinTop;
						clonedElement.style.top = `${newTop}px`;
						pageDiv.appendChild(clonedElement);
					}

					pagesList.push(pageDiv.outerHTML);
				}

				// 🔧 开始新页面：设置新的页面范围
				// 新页面从当前元素开始，但要考虑可能存在的装饰元素
				_currentPageStartY = info.top;
				currentPageEndY = info.top + pageHeightPx;
				currentPageElements = [info];
			}
		}

		// 保存最后一页
		if (currentPageElements.length > 0) {
			const pageActualMinTop = Math.min(
				...currentPageElements.map((e) => e.top),
			);

			const pageDiv = document.createElement("div");
			pageDiv.className = "at-surface";
			pageDiv.style.position = "relative";
			pageDiv.style.width = `${contentWidthPx}px`;
			pageDiv.style.height = `${pageHeightPx}px`;

			for (const el of currentPageElements) {
				const clonedElement = el.element.cloneNode(true) as HTMLElement;
				const newTop = el.top - pageActualMinTop;
				clonedElement.style.top = `${newTop}px`;
				pageDiv.appendChild(clonedElement);
			}

			pagesList.push(pageDiv.outerHTML);
		}

		// 如果分页失败，使用整个内容作为一页
		if (pagesList.length === 0) {
			const wrapper = document.createElement("div");
			wrapper.className = "at-surface";
			wrapper.style.position = "relative";
			wrapper.innerHTML = svgWrapper.innerHTML;
			pagesList.push(wrapper.outerHTML);
		}

		console.log(
			"[PrintPreview] Pagination complete:",
			pagesList.length,
			"pages",
		);

		setPages(pagesList);
		setTotalPages(pagesList.length);
		setCurrentPage(1);
		setIsLoading(false);
	}, [contentHeightPx, contentWidthPx]);

	/**
	 * 初始化 alphaTab 并渲染曲谱
	 */
	/**
	 * 创建 alphaTab 打印配置
	 * @param config 自定义配置，会与默认配置合并
	 */
	const createPrintSettings = useCallback(
		(
			urls: Awaited<ReturnType<typeof getResourceUrls>>,
			config: Partial<AlphaTabPrintConfig> = {},
		) => {
			const finalConfig = { ...DEFAULT_PRINT_CONFIG, ...config };

			// 使用 smuflFontSources 明确指定字体 URL（不再使用时间戳隔离）
			const printSmuflFontSources = new Map([
				[alphaTab.FontFileFormat.Woff2, urls.bravuraFontUrl],
			]);

			return {
				core: {
					tex: true,
					// 使用默认 worker URL（不再附加时间戳）
					scriptFile: urls.workerUrl,
					// 使用 smuflFontSources 明确控制字体 URL
					smuflFontSources: printSmuflFontSources,
					enableLazyLoading: false, // 禁用懒加载以确保完整渲染
				},
				display: {
					layoutMode: finalConfig.layoutMode,
					scale: finalConfig.scale, // 🔧 关键：打印时使用 1.0 scale
					resources: {
						mainGlyphColor: finalConfig.colors.mainGlyphColor,
						secondaryGlyphColor: finalConfig.colors.secondaryGlyphColor,
						staffLineColor: finalConfig.colors.staffLineColor,
						barSeparatorColor: finalConfig.colors.barSeparatorColor,
						barNumberColor: finalConfig.colors.barNumberColor,
						scoreInfoColor: finalConfig.colors.scoreInfoColor,
					},
				},
				player: {
					enablePlayer: false,
				},
			} as Record<string, unknown>;
		},
		[],
	);

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

			// 创建打印配置
			const settings = createPrintSettings(urls);

			console.log("[PrintPreview] Initialization params:", {
				containerWidth: contentWidthPx,
				pageSize: pageSize.name,
				pageSizeMm: `${pageSize.width}×${pageSize.height}`,
				contentSizeMm: `${contentWidthMm}×${contentHeightMm}`,
				contentSizePx: `${contentWidthPx}×${contentHeightPx}`,
				scale: (settings.display as { scale: number }).scale,
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
					paginateContent();
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
		paginateContent,
		createPrintSettings,
		contentWidthMm,
		contentHeightMm,
		contentHeightPx,
		pageSize,
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
			const newWidthPx = mmToPx(pageSize.width - 15 * 2);
			alphaTabContainerRef.current.style.width = `${newWidthPx}px`;

			setIsLoading(true);
			apiRef.current.render();
		}
	}, [pageSize]);

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
			{/* 工具栏 */}
			<div className="h-12 border-b border-border flex items-center justify-between px-4 bg-card shrink-0">
				<div className="flex items-center gap-4">
					<Button variant="ghost" size="icon" onClick={onClose} title="关闭">
						<X className="h-5 w-5" />
					</Button>
					<span className="text-sm font-medium">{fileName} - 打印预览</span>
				</div>

				<div className="flex items-center gap-4">
					{/* 页面尺寸选择 */}
					<select
						className="h-8 px-2 text-sm border border-border rounded bg-background"
						value={pageSize.name}
						onChange={(e) => {
							const size = PAGE_SIZES.find((s) => s.name === e.target.value);
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
								onClick={() => navigateToPage(currentPage + 1)}
								disabled={currentPage >= totalPages}
							>
								<ChevronRight className="h-4 w-4" />
							</Button>
						</div>
					)}

					{/* 打印按钮 */}
					<Button
						onClick={handlePrint}
						disabled={isLoading || !!error || pages.length === 0}
					>
						<Printer className="h-4 w-4 mr-2" />
						打印 / 导出 PDF
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
				</div>
			</div>

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

			{/* 底部快捷键提示 */}
			<div className="h-8 border-t border-border flex items-center justify-center px-4 bg-card text-xs text-muted-foreground shrink-0">
				<span>Esc 关闭 | ← → 翻页 | Ctrl+P 打印</span>
			</div>
		</div>
	);
}
