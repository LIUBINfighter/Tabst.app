/**
 * 打印分页工具
 *
 * 用于将 alphaTab 渲染的内容分割成多个页面
 */

/**
 * 元素位置信息
 */
export interface ElementInfo {
	element: HTMLElement;
	top: number;
	height: number;
	bottom: number;
}

/**
 * 分页结果
 */
export interface PaginationResult {
	pages: string[];
	totalPages: number;
}

/**
 * 将 SVG 内容分割成多个页面
 *
 * alphaTab 使用绝对定位渲染，每个元素都有 top/left 样式
 *
 * 核心逻辑：
 * - 每个元素（通常是一行乐谱 staff system）必须完整地放在某一页中
 * - 如果元素无法完整放入当前页，则将其放到下一页
 * - 这样可以避免元素被截断
 *
 * @param container 包含 alphaTab 渲染内容的容器
 * @param pageHeightPx 每页的高度（像素）
 * @param contentWidthPx 内容宽度（像素）
 * @returns 分页结果
 */
export function paginateContent(
	container: HTMLElement,
	pageHeightPx: number,
	contentWidthPx: number,
): PaginationResult {
	// 获取 alphaTab 渲染的内容容器
	const svgWrapper = container.querySelector(
		".at-surface",
	) as HTMLElement | null;

	if (!svgWrapper) {
		console.warn("[Pagination] No .at-surface found");
		return { pages: [], totalPages: 0 };
	}

	// 获取所有子元素并解析它们的位置
	const children = Array.from(svgWrapper.children) as HTMLElement[];

	if (children.length === 0) {
		return { pages: [svgWrapper.innerHTML], totalPages: 1 };
	}

	// 解析每个元素的位置信息
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

	// 检查是否有负的 top 值
	const minTop = Math.min(...elementsInfo.map((e) => e.top));

	// 计算页面高度（像素）
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
		const pageActualMinTop = Math.min(...currentPageElements.map((e) => e.top));

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

	return {
		pages: pagesList,
		totalPages: pagesList.length,
	};
}
