export interface TutorialMetadata {
	id: string;
	title: string;
	description?: string;
	order: number;
	category?: string;
	icon?: string;
}

export const tutorialsRegistry: TutorialMetadata[] = [
	{
		id: "getting-started",
		title: "快速开始",
		description: "从零开始了解基础使用",
		order: 1,
	},
	{
		id: "editor-basics",
		title: "编辑器基础",
		description: "编辑器中常见操作",
		order: 2,
	},
	{
		id: "alphaTex-guide",
		title: "AlphaTeX 教程",
		description: "AlphaTeX 专用语法介绍",
		order: 3,
	},
];
