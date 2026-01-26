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
	// Vendor: alphaTab AlphaTeX reference (sourced from alphaTab docs)
	{
		id: "vendor-alphatex-introduction",
		title: "Introduction",
		order: 10,
		category: "AlphaTeX (Reference)",
	},
	{
		id: "vendor-alphatex-syntax",
		title: "Language Syntax",
		order: 11,
		category: "AlphaTeX (Reference)",
	},
	{
		id: "vendor-alphatex-document-structure",
		title: "Document Structure",
		order: 12,
		category: "AlphaTeX (Reference)",
	},
	{
		id: "vendor-alphatex-structural-metadata",
		title: "Structural Metadata",
		order: 13,
		category: "AlphaTeX (Reference)",
	},
	{
		id: "vendor-alphatex-score-metadata",
		title: "Score Metadata",
		order: 14,
		category: "AlphaTeX (Reference)",
	},
	{
		id: "vendor-alphatex-staff-metadata",
		title: "Staff Metadata",
		order: 15,
		category: "AlphaTeX (Reference)",
	},
	{
		id: "vendor-alphatex-bar-metadata",
		title: "Bar Metadata",
		order: 16,
		category: "AlphaTeX (Reference)",
	},
	{
		id: "vendor-alphatex-beat-properties",
		title: "Beat Properties",
		order: 17,
		category: "AlphaTeX (Reference)",
	},
	{
		id: "vendor-alphatex-note-properties",
		title: "Note Properties",
		order: 18,
		category: "AlphaTeX (Reference)",
	},
	{
		id: "vendor-alphatex-importer",
		title: "Importer",
		order: 19,
		category: "AlphaTeX (Reference)",
	},
	{
		id: "vendor-alphatex-lsp",
		title: "Diagnostics",
		order: 20,
		category: "AlphaTeX (Reference)",
	},
	{
		id: "vendor-alphatex-monaco",
		title: "TextMate grammar",
		order: 21,
		category: "AlphaTeX (Reference)",
	},
];
