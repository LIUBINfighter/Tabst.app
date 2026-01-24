export interface SettingsPage {
	id: string;
	title: string;
	description?: string;
}

export const defaultSettingsPages: SettingsPage[] = [
	{
		id: "appearance",
		title: "外观",
		description: "主题与界面显示相关设置",
	},
	{
		id: "playback",
		title: "播放",
		description: "播放速度与模式相关设置",
	},
	{
		id: "updates",
		title: "更新",
		description: "版本检查与更新相关功能",
	},
	{
		id: "about",
		title: "关于",
		description: "应用信息与相关链接",
	},
];
