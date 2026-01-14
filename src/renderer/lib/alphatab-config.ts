/**
 * AlphaTab 配置创建工具
 *
 * 用于创建预览和打印场景下的 AlphaTab API 配置
 */

import * as alphaTab from "@coderline/alphatab";
import type { ResourceUrls } from "./resourceLoaderService";
import type { AlphaTabColors } from "./themeManager";

/**
 * 预览配置选项
 */
export interface PreviewConfigOptions {
	scale?: number;
	scrollElement?: HTMLElement;
	enablePlayer?: boolean;
	colors?: AlphaTabColors;
}

/**
 * 打印配置选项
 */
export interface PrintConfigOptions {
	scale?: number;
	colors?: AlphaTabColors;
	zoom?: number;
	barsPerRow?: number;
	stretchForce?: number;
}

/**
 * 打印颜色配置
 */
export interface PrintColors {
	mainGlyphColor: string;
	secondaryGlyphColor: string;
	staffLineColor: string;
	barSeparatorColor: string;
	barNumberColor: string;
	scoreInfoColor: string;
}

/**
 * 默认打印颜色（黑白）
 */
export const DEFAULT_PRINT_COLORS: PrintColors = {
	mainGlyphColor: "#000000",
	secondaryGlyphColor: "#333333",
	staffLineColor: "#666666",
	barSeparatorColor: "#666666",
	barNumberColor: "#444444",
	scoreInfoColor: "#000000",
};

/**
 * 创建预览场景的 AlphaTab 配置
 *
 * @param urls 资源 URL 配置
 * @param options 预览配置选项
 * @returns AlphaTab 设置对象
 */
export function createPreviewSettings(
	urls: ResourceUrls,
	options: PreviewConfigOptions = {},
): Record<string, unknown> {
	const { scale = 0.6, scrollElement, enablePlayer = true, colors } = options;

	return {
		core: {
			tex: true,
			scriptFile: urls.workerUrl,
			fontDirectory: urls.bravuraFontDirectory,
		},
		display: {
			layoutMode: alphaTab.LayoutMode.Page,
			scale,
			...(colors && {
				resources: {
					mainGlyphColor: colors.mainGlyphColor,
					secondaryGlyphColor: colors.secondaryGlyphColor,
					staffLineColor: colors.staffLineColor,
					barSeparatorColor: colors.barSeparatorColor,
					barNumberColor: colors.barNumberColor,
					scoreInfoColor: colors.scoreInfoColor,
				},
			}),
		},
		player: {
			playerMode: alphaTab.PlayerMode.EnabledAutomatic,
			enablePlayer,
			soundFont: urls.soundFontUrl,
			...(scrollElement && {
				scrollMode: alphaTab.ScrollMode.OffScreen,
				scrollElement,
				scrollSpeed: 300,
			}),
		},
	} as Record<string, unknown>;
}

/**
 * 创建打印场景的 AlphaTab 配置
 *
 * @param urls 资源 URL 配置
 * @param options 打印配置选项
 * @returns AlphaTab 设置对象
 */
export function createPrintSettings(
	urls: ResourceUrls,
	options: PrintConfigOptions = {},
): Record<string, unknown> {
	const {
		scale = 1.0,
		colors = DEFAULT_PRINT_COLORS,
		zoom = 1.0,
		barsPerRow = -1,
		stretchForce = 1.0,
	} = options;

	// 使用 smuflFontSources 明确指定字体 URL
	const printSmuflFontSources = new Map([
		[alphaTab.FontFileFormat.Woff2, urls.bravuraFontUrl],
	]);

	return {
		core: {
			tex: true,
			scriptFile: urls.workerUrl,
			smuflFontSources: printSmuflFontSources,
			enableLazyLoading: false, // 禁用懒加载以确保完整渲染
		},
		display: {
			layoutMode: alphaTab.LayoutMode.Page,
			scale: scale * zoom,
			barsPerRow,
			stretchForce,
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
	} as Record<string, unknown>;
}
