export interface TutorialMetadata {
	id: string;
	title: string;
	description?: string;
	order: number;
	category?: string;
	icon?: string;
	/**
	 * 状态：'release' | 'draft'
	 * - 'release'：公开显示（需要显式标注）
	 * - 'draft'：草稿（默认），不在教程列表中显示
	 */
	status?: "release" | "draft";
}

export const tutorialsRegistry: TutorialMetadata[] = [
	{
		id: "getting-started",
		title: "快速开始",
		description: "从零开始了解基础使用",
		order: 1,
		status: "draft",
	},
	{
		id: "editor-basics",
		title: "编辑器基础",
		description: "编辑器中常见操作",
		order: 2,
		status: "draft",
	},
	{
		id: "alphaTex-guide",
		title: "AlphaTeX 教程",
		description: "AlphaTeX 专用语法介绍",
		order: 3,
		status: "draft",
	},
	// Vendor: alphaTab AlphaTeX reference (sourced from alphaTab docs)
	// NOTE: vendor AlphaTeX MDX files are stored under `en/` and `zh-cn/` subfolders.
	// The loader prefers `en/` then `zh-cn/` and falls back to the root `tutorials/` folder for compatibility.
	{
		id: "vendor-alphatex-introduction",
		title: "Introduction",
		order: 10,
		category: "AlphaTeX (Reference)",
		status: "release",
	},
	{
		id: "vendor-alphatex-syntax",
		title: "Language Syntax",
		order: 11,
		category: "AlphaTeX (Reference)",
		status: "release",
	},
	{
		id: "vendor-alphatex-document-structure",
		title: "Document Structure",
		order: 12,
		category: "AlphaTeX (Reference)",
		status: "release",
	},
	{
		id: "vendor-alphatex-structural-metadata",
		title: "Structural Metadata",
		order: 13,
		category: "AlphaTeX (Reference)",
		status: "release",
	},
	{
		id: "vendor-alphatex-score-metadata",
		title: "Score Metadata",
		order: 14,
		category: "AlphaTeX (Reference)",
		status: "release",
	},
	{
		id: "vendor-alphatex-staff-metadata",
		title: "Staff Metadata",
		order: 15,
		category: "AlphaTeX (Reference)",
		status: "release",
	},
	{
		id: "vendor-alphatex-bar-metadata",
		title: "Bar Metadata",
		order: 16,
		category: "AlphaTeX (Reference)",
		status: "release",
	},
	{
		id: "vendor-alphatex-beat-properties",
		title: "Beat Properties",
		order: 17,
		category: "AlphaTeX (Reference)",
		status: "release",
	},
	{
		id: "vendor-alphatex-note-properties",
		title: "Note Properties",
		order: 18,
		category: "AlphaTeX (Reference)",
		status: "release",
	},
	{
		id: "vendor-alphatex-importer",
		title: "Importer",
		order: 19,
		category: "AlphaTeX (Reference)",
		status: "release",
	},
	{
		id: "vendor-alphatex-lsp",
		title: "Diagnostics",
		order: 20,
		category: "AlphaTeX (Reference)",
		status: "release",
	},
	{
		id: "vendor-alphatex-monaco",
		title: "TextMate grammar",
		order: 21,
		category: "AlphaTeX (Reference)",
		status: "release",
	},
];
