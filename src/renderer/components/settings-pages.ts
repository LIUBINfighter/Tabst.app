export interface SettingsPage {
	id: string;
	title: string; // 仅作为后备值，实际渲染使用 i18n 翻译 (t(p.id))
	description?: string; // 仅作为后备值，实际渲染使用 i18n 翻译
}

/**
 * 设置页面配置
 * 注意：title 和 description 仅作为后备值，实际渲染时使用 i18n 翻译
 * 在 SettingsSidebar 和 GlobalBottomBar 中使用 t(p.id) 来获取翻译
 */
export const defaultSettingsPages: SettingsPage[] = [
	{
		id: "appearance",
		title: "外观", // 后备值，实际使用 t("settings:appearance")
		description: "主题与界面显示相关设置",
	},
	{
		id: "playback",
		title: "播放", // 后备值，实际使用 t("settings:playback")
		description: "播放速度与模式相关设置",
	},
	{
		id: "updates",
		title: "更新", // 后备值，实际使用 t("settings:updates")
		description: "版本检查与更新相关功能",
	},
	{
		id: "roadmap",
		title: "路线图", // 后备值，实际使用 t("settings:roadmap")
		description: "功能规划与开发计划",
	},
	{
		id: "about",
		title: "关于", // 后备值，实际使用 t("settings:about")
		description: "应用信息与相关链接",
	},
];
