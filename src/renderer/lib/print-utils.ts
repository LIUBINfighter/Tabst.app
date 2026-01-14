/**
 * 打印相关工具函数
 *
 * 包含页面尺寸定义、单位转换等打印相关的工具函数
 */

/**
 * 页面尺寸配置（毫米）
 */
export interface PageSize {
	name: string;
	width: number; // mm
	height: number; // mm
}

/**
 * 预定义的页面尺寸
 */
export const PAGE_SIZES: PageSize[] = [
	{ name: "A4", width: 210, height: 297 },
	{ name: "Letter", width: 215.9, height: 279.4 },
	{ name: "A3", width: 297, height: 420 },
];

/**
 * 将毫米转换为像素（假设 96 DPI）
 */
export function mmToPx(mm: number): number {
	return Math.round((mm * 96) / 25.4);
}

/**
 * 计算打印内容区域尺寸
 */
export interface ContentDimensions {
	contentWidthMm: number;
	contentHeightMm: number;
	contentWidthPx: number;
	contentHeightPx: number;
	marginMm: number;
}

/**
 * 根据页面尺寸和边距计算内容区域尺寸
 */
export function calculateContentDimensions(
	pageSize: PageSize,
	marginMm = 15,
): ContentDimensions {
	const contentWidthMm = pageSize.width - marginMm * 2;
	const contentHeightMm = pageSize.height - marginMm * 2;
	const contentWidthPx = mmToPx(contentWidthMm);
	const contentHeightPx = mmToPx(contentHeightMm);

	return {
		contentWidthMm,
		contentHeightMm,
		contentWidthPx,
		contentHeightPx,
		marginMm,
	};
}
