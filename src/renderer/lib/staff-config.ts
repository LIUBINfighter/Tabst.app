/**
 * Staff 配置管理工具
 *
 * 用于管理 alphaTab Staff 的显示选项（Tablature, StandardNotation, Slash, Numbered）
 */

import type * as alphaTab from "@coderline/alphatab";

/**
 * Staff 显示选项配置
 */
export interface StaffDisplayOptions {
	showTablature?: boolean;
	showStandardNotation?: boolean;
	showSlash?: boolean;
	showNumbered?: boolean;
}

/**
 * Staff 选项键类型
 */
export type StaffOptionKey =
	| "showTablature"
	| "showStandardNotation"
	| "showSlash"
	| "showNumbered";

/**
 * 默认 Staff 显示选项
 */
export const DEFAULT_STAFF_OPTIONS: StaffDisplayOptions = {
	// Keep empty by default to respect alphaTab's own adaptation
	// (e.g. non-guitar instruments may not support tablature).
};

/**
 * 带 staff 索引的谱表配置（用于多音轨/打印等场景，与 StaffDisplayOptions 对齐）
 */
export type StaffConfigWithIndex = {
	staffIndex: number;
} & Required<StaffDisplayOptions>;

/**
 * 获取第一个 Staff 的当前显示选项
 */
export function getFirstStaffOptions(
	api: alphaTab.AlphaTabApi,
): StaffDisplayOptions | null {
	if (!api.score?.tracks?.[0]) return null;

	const firstTrack = api.score.tracks[0];
	if (!firstTrack.staves || firstTrack.staves.length === 0) return null;

	const s0 = firstTrack.staves[0] as alphaTab.model.Staff;
	return {
		showTablature: !!s0.showTablature,
		showStandardNotation: !!s0.showStandardNotation,
		showSlash: !!s0.showSlash,
		showNumbered: !!s0.showNumbered,
	};
}

/**
 * 检查是否可以切换指定的 Staff 选项
 *
 * 如果切换后会导致所有选项都被禁用，则不允许切换
 */
export function canToggleStaffOption(
	api: alphaTab.AlphaTabApi,
	key: StaffOptionKey,
): boolean {
	if (!api.score?.tracks?.[0]) return false;

	const firstTrack = api.score.tracks[0];
	if (!firstTrack.staves || firstTrack.staves.length === 0) return false;

	const s0 = firstTrack.staves[0] as alphaTab.model.Staff;

	// 获取当前值
	let current = false;
	switch (key) {
		case "showTablature":
			current = !!s0.showTablature;
			break;
		case "showStandardNotation":
			current = !!s0.showStandardNotation;
			break;
		case "showSlash":
			current = !!s0.showSlash;
			break;
		case "showNumbered":
			current = !!s0.showNumbered;
			break;
	}

	// 计算当前启用的选项数量
	const totalSelected =
		Number(!!s0.showTablature) +
		Number(!!s0.showStandardNotation) +
		Number(!!s0.showSlash) +
		Number(!!s0.showNumbered);

	// 如果要关闭的是唯一启用的选项，则不允许
	return !(totalSelected === 1 && current);
}

/**
 * 切换第一个音轨的 Staff 显示选项
 *
 * @param api AlphaTab API 实例
 * @param key 要切换的选项键
 * @returns 新的选项值，如果切换失败则返回 null
 */
export function toggleFirstStaffOption(
	api: alphaTab.AlphaTabApi,
	key: StaffOptionKey,
): boolean | null {
	if (!api.score?.tracks?.[0]) return null;

	const firstTrack = api.score.tracks[0];
	if (!firstTrack.staves || firstTrack.staves.length === 0) return null;

	const s0 = firstTrack.staves[0] as alphaTab.model.Staff;

	// 获取当前值
	let current = false;
	switch (key) {
		case "showTablature":
			current = !!s0.showTablature;
			break;
		case "showStandardNotation":
			current = !!s0.showStandardNotation;
			break;
		case "showSlash":
			current = !!s0.showSlash;
			break;
		case "showNumbered":
			current = !!s0.showNumbered;
			break;
	}

	// 检查是否可以切换
	if (!canToggleStaffOption(api, key)) {
		return null;
	}

	const newValue = !current;

	// 应用新值到所有 staff
	firstTrack.staves.forEach((st: alphaTab.model.Staff) => {
		switch (key) {
			case "showTablature":
				st.showTablature = newValue;
				break;
			case "showStandardNotation":
				st.showStandardNotation = newValue;
				break;
			case "showSlash":
				st.showSlash = newValue;
				break;
			case "showNumbered":
				st.showNumbered = newValue;
				break;
		}
	});

	// 重新渲染第一个音轨
	api.renderTracks([firstTrack]);

	return newValue;
}

/**
 * 应用 Staff 显示配置到第一个音轨
 *
 * @param api AlphaTab API 实例
 * @param config 要应用的配置（如果不提供则使用默认值）
 */
export function applyStaffConfig(
	api: alphaTab.AlphaTabApi,
	config: StaffDisplayOptions = DEFAULT_STAFF_OPTIONS,
): StaffDisplayOptions | null {
	if (!api.score?.tracks?.[0]) return null;

	const firstTrack = api.score.tracks[0];
	if (!firstTrack.staves?.length) return null;

	let changed = false;
	// 应用配置到所有 staff：仅当调用方显式提供 boolean 值时才覆盖
	firstTrack.staves.forEach((st: alphaTab.model.Staff) => {
		if (typeof config.showTablature === "boolean") {
			if (st.showTablature !== config.showTablature) {
				changed = true;
			}
			st.showTablature = config.showTablature;
		}
		if (typeof config.showStandardNotation === "boolean") {
			if (st.showStandardNotation !== config.showStandardNotation) {
				changed = true;
			}
			st.showStandardNotation = config.showStandardNotation;
		}
		if (typeof config.showSlash === "boolean") {
			if (st.showSlash !== config.showSlash) {
				changed = true;
			}
			st.showSlash = config.showSlash;
		}
		if (typeof config.showNumbered === "boolean") {
			if (st.showNumbered !== config.showNumbered) {
				changed = true;
			}
			st.showNumbered = config.showNumbered;
		}
	});

	// 获取应用后的配置（从第一个 staff）
	const s0 = firstTrack.staves[0];
	const appliedConfig: StaffDisplayOptions = {
		showTablature: s0.showTablature,
		showStandardNotation: s0.showStandardNotation,
		showSlash: s0.showSlash,
		showNumbered: s0.showNumbered,
	};

	// 仅在确实发生变更时重新渲染（避免不必要的闪烁）
	if (changed) api.renderTracks([firstTrack]);

	return appliedConfig;
}
