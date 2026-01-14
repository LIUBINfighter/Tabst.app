import * as alphaTab from "@coderline/alphatab";
import { ChevronLeft, ChevronRight, Loader2, Printer, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { loadBravuraFont } from "../lib/assets";
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
	const [fontLoaded, setFontLoaded] = useState(false);
	const [fontError, setFontError] = useState(false);

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
			"[PrintPreview] Elements info (first 5):",
			elementsInfo
				.slice(0, 5)
				.map((e) => ({ top: e.top, height: e.height, bottom: e.bottom })),
		);

		// 计算页面高度（像素）
		const pageHeightPx = contentHeightPx;
		const pagesList: string[] = [];

		// 分页逻辑：逐个处理元素，确保每个元素完整地放在某一页中
		let currentPageElements: ElementInfo[] = [];
		let currentPageStartY = 0;
		let currentPageUsedHeight = 0;

		for (let i = 0; i < elementsInfo.length; i++) {
			const info = elementsInfo[i];

			// 计算元素相对于当前页面起始位置的位置
			const relativeTop = info.top - currentPageStartY;
			const elementFitsInPage = relativeTop + info.height <= pageHeightPx;

			if (elementFitsInPage) {
				// 元素可以完整放入当前页
				currentPageElements.push(info);
				currentPageUsedHeight = Math.max(
					currentPageUsedHeight,
					relativeTop + info.height,
				);
			} else {
				// 元素无法放入当前页，先保存当前页，然后开始新页
				if (currentPageElements.length > 0) {
					// 创建当前页
					const pageDiv = document.createElement("div");
					pageDiv.className = "at-surface";
					pageDiv.style.position = "relative";
					pageDiv.style.width = `${contentWidthPx}px`;
					pageDiv.style.height = `${pageHeightPx}px`;

					for (const el of currentPageElements) {
						const clonedElement = el.element.cloneNode(true) as HTMLElement;
						const newTop = el.top - currentPageStartY;
						clonedElement.style.top = `${newTop}px`;
						pageDiv.appendChild(clonedElement);
					}

					pagesList.push(pageDiv.outerHTML);
				}

				// 开始新页面，新页面从当前元素的 top 位置开始
				currentPageStartY = info.top;
				currentPageElements = [info];
				currentPageUsedHeight = info.height;
			}
		}

		// 保存最后一页
		if (currentPageElements.length > 0) {
			const pageDiv = document.createElement("div");
			pageDiv.className = "at-surface";
			pageDiv.style.position = "relative";
			pageDiv.style.width = `${contentWidthPx}px`;
			pageDiv.style.height = `${pageHeightPx}px`;

			for (const el of currentPageElements) {
				const clonedElement = el.element.cloneNode(true) as HTMLElement;
				const newTop = el.top - currentPageStartY;
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
	const initAlphaTab = useCallback(async () => {
		if (!alphaTabContainerRef.current) return;

		try {
			setIsLoading(true);
			setError(null);

			// 获取资源 URL
			const urls = await getResourceUrls();

			// 保存字体 URL 以便打印时使用
			setBravuraFontUrl(urls.bravuraFontUrl);

			// 加载字体
			try {
				await loadBravuraFont(urls.bravuraFontUrl);
			} catch (e) {
				console.warn("[PrintPreview] Bravura font load failed:", e);
			}

			// 设置容器宽度
			alphaTabContainerRef.current.style.width = `${contentWidthPx}px`;

			// 打印时使用黑白色配置
			const colors = {
				mainGlyphColor: "#000000",
				secondaryGlyphColor: "#333333",
				staffLineColor: "#666666",
				barSeparatorColor: "#666666",
				barNumberColor: "#444444",
				scoreInfoColor: "#000000",
			};

			// 创建 alphaTab 设置
			// 注意：必须禁用懒加载，否则只有可见区域的内容会被渲染
			const settings: Record<string, unknown> = {
				core: {
					tex: true,
					scriptFile: urls.workerUrl,
					fontDirectory: urls.bravuraFontDirectory,
					enableLazyLoading: false, // 禁用懒加载，确保所有内容都被渲染
				},
				display: {
					layoutMode: alphaTab.LayoutMode.Page,
					scale: 1.0,
					resources: {
						mainGlyphColor: colors.mainGlyphColor,
						secondaryGlyphColor: colors.secondaryGlyphColor,
						staffLineColor: colors.staffLineColor,
						barSeparatorColor: colors.barSeparatorColor,
						barNumberColor: colors.barNumberColor,
						scoreInfoColor: colors.scoreInfoColor,
					},
				},
				player: {
					enablePlayer: false,
				},
			};

			// 销毁旧的 API
			if (apiRef.current) {
				apiRef.current.destroy();
			}

			// 创建 API
			apiRef.current = new alphaTab.AlphaTabApi(
				alphaTabContainerRef.current,
				settings,
			);

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
	}, [content, contentWidthPx, paginateContent]);

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
					/* 加载 Bravura 音乐字体 */
					@font-face {
						font-family: 'Bravura';
						src: url('${bravuraFontUrl}') format('woff2');
						font-weight: normal;
						font-style: normal;
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
						font-family: 'Bravura', system-ui, -apple-system, sans-serif;
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

		// 等待内容加载后打印
		printWindow.onload = () => {
			printWindow.focus();
			printWindow.print();
			printWindow.onafterprint = () => {
				printWindow.close();
			};
		};
	}, [
		pages,
		fileName,
		pageSize,
		contentWidthPx,
		contentHeightPx,
		bravuraFontUrl,
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

	// 初始化
	useEffect(() => {
		initAlphaTab();

		return () => {
			if (apiRef.current) {
				apiRef.current.destroy();
				apiRef.current = null;
			}
		};
	}, [initAlphaTab]);

	// 字体加载监测和回退机制
	useEffect(() => {
		if (!bravuraFontUrl) return;

		const loadFont = async () => {
			try {
				console.log("[PrintPreview] Loading Bravura font:", bravuraFontUrl);

				// 使用 FontFace API 加载字体
				const font = new FontFace(
					"Bravura",
					`url(${bravuraFontUrl}) format('woff2')`,
				);

				// 设置超时
				const timeoutPromise = new Promise((_, reject) =>
					setTimeout(() => reject(new Error("Font loading timeout")), 5000),
				);

				// 尝试加载字体
				await Promise.race([font.load(), timeoutPromise]);
				document.fonts.add(font);

				setFontLoaded(true);
				console.log("[PrintPreview] Bravura font loaded successfully");
			} catch (err) {
				console.warn("[PrintPreview] Failed to load Bravura font:", err);
				setFontError(true);
				// 即使字体加载失败，也继续显示（使用回退字体）
			}
		};

		loadFont();
	}, [bravuraFontUrl]);

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

	// 当前页面的 HTML
	const currentPageHtml = pages[currentPage - 1] || "";

	return (
		<div
			ref={containerRef}
			className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-sm"
		>
			{/* 动态加载 Bravura 字体，带回退机制 */}
			{bravuraFontUrl && (
				<style>
					{`
						@font-face {
							font-family: 'Bravura';
							src: url('${bravuraFontUrl}') format('woff2');
							font-weight: normal;
							font-style: normal;
							font-display: swap;
						}
						
						/* 为 alphaTab 渲染的元素设置字体栈 */
						.at-surface,
						.at-surface * {
							font-family: 'Bravura', 'Arial Unicode MS', sans-serif !important;
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

				{/* 隐藏的 alphaTab 渲染容器 - 需要在 DOM 中可见才能获取正确尺寸 */}
				<div
					ref={alphaTabContainerRef}
					className="fixed bg-white"
					style={{
						left: "-9999px",
						top: "0",
						width: `${contentWidthPx}px`,
						opacity: 0,
						pointerEvents: "none",
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
