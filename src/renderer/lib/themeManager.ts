/**
 * ThemeManager
 *
 * 管理应用主题和 alphaTab 曲谱着色的协调
 * 通过监听 document.documentElement 的 class 变化来实现主题切换
 */

import type * as alphaTab from "@coderline/alphatab";

export interface AlphaTabColors {
	mainGlyphColor: string;
	secondaryGlyphColor: string;
	staffLineColor: string;
	barSeparatorColor: string;
	barNumberColor: string;
	scoreInfoColor: string;
}

interface AlphaTabResources {
	mainGlyphColor?: string;
	secondaryGlyphColor?: string;
	staffLineColor?: string;
	barSeparatorColor?: string;
	barNumberColor?: string;
	scoreInfoColor?: string;
	smuflFont?: unknown;
	[key: string]: unknown;
}

/**
 * 获取当前主题的 alphaTab 颜色配置
 */
export function getAlphaTabColorsForTheme(): AlphaTabColors {
	const isDarkMode = document.documentElement.classList.contains("dark");

	if (isDarkMode) {
		// 暗色主题：使用浅色符号
		// 注：#RRGGBBAA 格式，AA 为透明度（00=完全透明，FF=完全不透明）
		return {
			mainGlyphColor: "#f1f5f9", // slate-100
			secondaryGlyphColor: "#f1f5f999", // slate-100，60% 不透明度 (99 ≈ 0.6)
			staffLineColor: "#475569", // slate-600
			barSeparatorColor: "#475569", // slate-600
			barNumberColor: "#94a3b8", // slate-400
			scoreInfoColor: "#cbd5e1", // slate-300
		};
	} else {
		// 亮色主题：使用深色符号
		return {
			mainGlyphColor: "#0f172a", // slate-900
			secondaryGlyphColor: "#0f172a99", // slate-900，60% 不透明度
			staffLineColor: "#cbd5e1", // slate-300
			barSeparatorColor: "#cbd5e1", // slate-300
			barNumberColor: "#475569", // slate-600
			scoreInfoColor: "#1e293b", // slate-800
		};
	}
}

/**
 * 应用颜色配置到 alphaTab API 设置对象
 */
export function applyColorsToApi(
	api: alphaTab.AlphaTabApi | null,
	colors: AlphaTabColors,
): void {
	if (!api || !api.settings.display) {
		console.warn("[ThemeManager] Cannot apply colors: API not ready");
		return;
	}

	// alphaTab 内部支持这些属性，但类型定义未完全暴露
	// 使用局部资源类型来避免 any
	const resources = api.settings.display
		.resources as unknown as AlphaTabResources;

	resources.mainGlyphColor = colors.mainGlyphColor;
	resources.secondaryGlyphColor = colors.secondaryGlyphColor;
	resources.staffLineColor = colors.staffLineColor;
	resources.barSeparatorColor = colors.barSeparatorColor;
	resources.barNumberColor = colors.barNumberColor;
	resources.scoreInfoColor = colors.scoreInfoColor;
}

/**
 * 更新 alphaTab 的颜色并重新渲染
 * 用于主题切换时调用
 */
export function updateAlphaTabColorsForTheme(
	api: alphaTab.AlphaTabApi | null,
): void {
	if (!api) {
		console.warn("[ThemeManager] Cannot update colors: API not initialized");
		return;
	}

	const colors = getAlphaTabColorsForTheme();

	// 直接修改 resources 对象
	applyColorsToApi(api, colors);

	// 只有在有乐谱加载时才重新渲染
	if (api.score) {
		// 调用 render() 以应用新的颜色设置
		// 在修改了 resources 后，render() 会使用新的颜色
		api.render();
	}
}

/**
 * 设置主题监听器
 * 返回一个清理函数，用于组件卸载时断开观察
 */
export function setupThemeObserver(onThemeChange: () => void): () => void {
	const observer = new MutationObserver(() => {
		onThemeChange();
	});

	observer.observe(document.documentElement, {
		attributes: true,
		attributeFilter: ["class"],
	});

	// 返回清理函数
	return () => {
		observer.disconnect();
	};
}
