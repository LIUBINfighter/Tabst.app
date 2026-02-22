/**
 * Theme Registry
 *
 * 主题注册中心 - 管理所有可用的UI主题和编辑器主题
 */

import type { EditorTheme, ThemeRegistry, UITheme } from "./types";

// ===== UI 主题预设 =====

const github: UITheme = {
	id: "github",
	name: "GitHub",
	description: "经典的 GitHub 主题",
	light: {
		semantic: {
			background: "0 0% 100%",
			foreground: "210 13% 16%",
			card: "0 0% 100%",
			cardForeground: "210 13% 16%",
			popover: "0 0% 100%",
			popoverForeground: "210 13% 16%",
			primary: "212 92% 45%",
			primaryForeground: "0 0% 100%",
			secondary: "210 29% 97%",
			secondaryForeground: "210 13% 16%",
			muted: "210 29% 97%",
			mutedForeground: "210 9% 41%",
			accent: "210 29% 97%",
			accentForeground: "210 13% 16%",
			destructive: "356 71% 53%",
			destructiveForeground: "0 0% 100%",
			border: "213 27% 84%",
			input: "213 27% 84%",
			ring: "212 92% 45%",
		},
		selectionOverlay: "rgba(0, 0, 0, 0.08)",
		scrollbar: "hsl(213 27% 84% / 0.9)",
		focusRing: "rgb(59 130 246)",
		highlight: {
			background: "rgba(59, 130, 246, 0.2)",
			foreground: "rgb(37, 99, 235)",
		},
		hover: {
			background: "rgba(59, 130, 246, 0.1)",
			foreground: "rgb(37, 99, 235)",
		},
		score: {
			mainGlyph: "#0f172a",
			secondaryGlyph: "rgba(15, 23, 42, 0.6)",
			staffLine: "#cbd5e1",
			barSeparator: "#cbd5e1",
			barNumber: "#475569",
			scoreInfo: "#1e293b",
		},
		playerCursor: {
			background: "rgba(59, 130, 246, 0.4)",
			border: "rgb(37, 99, 235)",
			barHighlight: "rgba(59, 130, 246, 0.15)",
		},
	},
	dark: {
		semantic: {
			background: "216 28% 7%",
			foreground: "212 12% 82%",
			card: "216 28% 7%",
			cardForeground: "212 12% 82%",
			popover: "215 28% 10%",
			popoverForeground: "212 12% 82%",
			primary: "212 92% 58%",
			primaryForeground: "0 0% 100%",
			secondary: "215 28% 10%",
			secondaryForeground: "212 12% 82%",
			muted: "215 28% 10%",
			mutedForeground: "212 10% 56%",
			accent: "215 28% 10%",
			accentForeground: "212 12% 82%",
			destructive: "356 60% 45%",
			destructiveForeground: "0 0% 100%",
			border: "215 14% 21%",
			input: "215 14% 21%",
			ring: "212 92% 58%",
		},
		selectionOverlay: "rgba(255, 255, 255, 0.03)",
		scrollbar: "hsl(215 14% 21% / 0.9)",
		focusRing: "rgb(96 165 250)",
		highlight: {
			background: "rgba(96, 165, 250, 0.2)",
			foreground: "rgb(96, 165, 250)",
		},
		hover: {
			background: "rgba(96, 165, 250, 0.1)",
			foreground: "rgb(96, 165, 250)",
		},
		score: {
			mainGlyph: "#f1f5f9",
			secondaryGlyph: "rgba(241, 245, 249, 0.6)",
			staffLine: "#475569",
			barSeparator: "#475569",
			barNumber: "#94a3b8",
			scoreInfo: "#cbd5e1",
		},
	},
};

const vscode: UITheme = {
	id: "vscode",
	name: "VS Code",
	description: "Visual Studio Code 默认主题",
	light: {
		semantic: {
			background: "0 0% 100%",
			foreground: "0 0% 15%",
			card: "0 0% 100%",
			cardForeground: "0 0% 15%",
			popover: "0 0% 100%",
			popoverForeground: "0 0% 15%",
			primary: "207 82% 48%",
			primaryForeground: "0 0% 100%",
			secondary: "220 13% 91%",
			secondaryForeground: "0 0% 15%",
			muted: "220 13% 91%",
			mutedForeground: "0 0% 45%",
			accent: "220 13% 91%",
			accentForeground: "0 0% 15%",
			destructive: "0 84% 60%",
			destructiveForeground: "0 0% 100%",
			border: "220 13% 85%",
			input: "220 13% 85%",
			ring: "207 82% 48%",
		},
		selectionOverlay: "rgba(0, 0, 0, 0.08)",
		scrollbar: "hsl(220 13% 75% / 0.9)",
		focusRing: "rgb(0 122 204)",
		highlight: {
			background: "rgba(0, 122, 204, 0.2)",
			foreground: "rgb(0, 122, 204)",
		},
		hover: {
			background: "rgba(0, 122, 204, 0.1)",
			foreground: "rgb(0, 122, 204)",
		},
		score: {
			mainGlyph: "#1a1a1a",
			secondaryGlyph: "rgba(26, 26, 26, 0.6)",
			staffLine: "#d4d4d4",
			barSeparator: "#d4d4d4",
			barNumber: "#616161",
			scoreInfo: "#333333",
		},
		playerCursor: {
			background: "rgba(0, 122, 204, 0.4)",
			border: "rgb(0, 122, 204)",
			barHighlight: "rgba(0, 122, 204, 0.15)",
		},
	},
	dark: {
		semantic: {
			background: "220 13% 8%",
			foreground: "220 10% 85%",
			card: "220 13% 11%",
			cardForeground: "220 10% 85%",
			popover: "220 13% 8%",
			popoverForeground: "220 10% 85%",
			primary: "207 82% 52%",
			primaryForeground: "0 0% 100%",
			secondary: "220 13% 18%",
			secondaryForeground: "220 10% 85%",
			muted: "220 13% 18%",
			mutedForeground: "220 10% 55%",
			accent: "220 13% 22%",
			accentForeground: "220 10% 85%",
			destructive: "0 84% 60%",
			destructiveForeground: "0 0% 100%",
			border: "220 13% 20%",
			input: "220 13% 20%",
			ring: "207 82% 52%",
		},
		selectionOverlay: "rgba(255, 255, 255, 0.04)",
		scrollbar: "hsl(220 13% 25% / 0.9)",
		focusRing: "rgb(0 122 204)",
		highlight: {
			background: "rgba(0, 122, 204, 0.2)",
			foreground: "rgb(0, 127, 212)",
		},
		hover: {
			background: "rgba(0, 122, 204, 0.1)",
			foreground: "rgb(0, 127, 212)",
		},
		score: {
			mainGlyph: "#e0e0e0",
			secondaryGlyph: "rgba(224, 224, 224, 0.6)",
			staffLine: "#4a4a4a",
			barSeparator: "#4a4a4a",
			barNumber: "#858585",
			scoreInfo: "#cccccc",
		},
		playerCursor: {
			background: "rgba(0, 122, 204, 0.4)",
			border: "rgb(0, 127, 212)",
			barHighlight: "rgba(0, 122, 204, 0.15)",
		},
	},
};

const obsidian: UITheme = {
	id: "obsidian",
	name: "Obsidian",
	description: "Obsidian 笔记的紫色调主题",
	light: {
		semantic: {
			background: "260 20% 97%",
			foreground: "260 25% 20%",
			card: "260 20% 97%",
			cardForeground: "260 25% 20%",
			popover: "260 20% 97%",
			popoverForeground: "260 25% 20%",
			primary: "262 52% 48%",
			primaryForeground: "0 0% 100%",
			secondary: "260 15% 92%",
			secondaryForeground: "260 25% 20%",
			muted: "260 15% 92%",
			mutedForeground: "260 20% 45%",
			accent: "260 15% 92%",
			accentForeground: "260 25% 20%",
			destructive: "0 84% 60%",
			destructiveForeground: "0 0% 100%",
			border: "260 15% 85%",
			input: "260 15% 85%",
			ring: "262 52% 48%",
		},
		selectionOverlay: "rgba(139, 92, 246, 0.1)",
		scrollbar: "hsl(260 15% 80% / 0.9)",
		focusRing: "rgb(139 92 246)",
		highlight: {
			background: "rgba(139, 92, 246, 0.15)",
			foreground: "rgb(124, 58, 237)",
		},
		hover: {
			background: "rgba(139, 92, 246, 0.1)",
			foreground: "rgb(124, 58, 237)",
		},
		score: {
			mainGlyph: "#2d1b4e",
			secondaryGlyph: "rgba(45, 27, 78, 0.6)",
			staffLine: "#c4b5fd",
			barSeparator: "#c4b5fd",
			barNumber: "#7c3aed",
			scoreInfo: "#4c1d95",
		},
		playerCursor: {
			background: "rgba(139, 92, 246, 0.4)",
			border: "rgb(124, 58, 237)",
			barHighlight: "rgba(139, 92, 246, 0.15)",
		},
	},
	dark: {
		semantic: {
			background: "260 25% 8%",
			foreground: "260 10% 88%",
			card: "260 25% 11%",
			cardForeground: "260 10% 88%",
			popover: "260 25% 8%",
			popoverForeground: "260 10% 88%",
			primary: "262 52% 58%",
			primaryForeground: "0 0% 100%",
			secondary: "260 20% 18%",
			secondaryForeground: "260 10% 88%",
			muted: "260 20% 18%",
			mutedForeground: "260 10% 55%",
			accent: "260 20% 22%",
			accentForeground: "260 10% 88%",
			destructive: "0 84% 60%",
			destructiveForeground: "0 0% 100%",
			border: "260 20% 20%",
			input: "260 20% 20%",
			ring: "262 52% 58%",
		},
		selectionOverlay: "rgba(139, 92, 246, 0.08)",
		scrollbar: "hsl(260 20% 25% / 0.9)",
		focusRing: "rgb(167 139 250)",
		highlight: {
			background: "rgba(139, 92, 246, 0.25)",
			foreground: "rgb(167, 139, 250)",
		},
		hover: {
			background: "rgba(139, 92, 246, 0.15)",
			foreground: "rgb(167, 139, 250)",
		},
		score: {
			mainGlyph: "#f0ebff",
			secondaryGlyph: "rgba(240, 235, 255, 0.6)",
			staffLine: "#4a4458",
			barSeparator: "#4a4458",
			barNumber: "#9ca3af",
			scoreInfo: "#d1d5db",
		},
		playerCursor: {
			background: "rgba(167, 139, 250, 0.4)",
			border: "rgb(167, 139, 250)",
			barHighlight: "rgba(167, 139, 250, 0.15)",
		},
	},
};

const dracula: UITheme = {
	id: "dracula",
	name: "Dracula",
	description: "经典的 Dracula 高对比度主题",
	light: {
		semantic: {
			background: "0 0% 98%",
			foreground: "231 15% 25%",
			card: "0 0% 98%",
			cardForeground: "231 15% 25%",
			popover: "0 0% 98%",
			popoverForeground: "231 15% 25%",
			primary: "326 100% 55%",
			primaryForeground: "0 0% 100%",
			secondary: "231 10% 92%",
			secondaryForeground: "231 15% 25%",
			muted: "231 10% 92%",
			mutedForeground: "231 10% 50%",
			accent: "231 10% 92%",
			accentForeground: "231 15% 25%",
			destructive: "0 100% 67%",
			destructiveForeground: "0 0% 100%",
			border: "231 10% 85%",
			input: "231 10% 85%",
			ring: "326 100% 55%",
		},
		selectionOverlay: "rgba(255, 121, 198, 0.08)",
		scrollbar: "hsl(231 10% 80% / 0.9)",
		focusRing: "rgb(255 121 198)",
		highlight: {
			background: "rgba(255, 121, 198, 0.15)",
			foreground: "rgb(219, 39, 119)",
		},
		hover: {
			background: "rgba(255, 121, 198, 0.1)",
			foreground: "rgb(219, 39, 119)",
		},
		score: {
			mainGlyph: "#282a36",
			secondaryGlyph: "rgba(40, 42, 54, 0.6)",
			staffLine: "#bd93f9",
			barSeparator: "#bd93f9",
			barNumber: "#ff79c6",
			scoreInfo: "#44475a",
		},
		playerCursor: {
			background: "rgba(255, 121, 198, 0.4)",
			border: "rgb(219, 39, 119)",
			barHighlight: "rgba(255, 121, 198, 0.15)",
		},
	},
	dark: {
		semantic: {
			background: "231 15% 18%",
			foreground: "60 30% 96%",
			card: "231 15% 22%",
			cardForeground: "60 30% 96%",
			popover: "231 15% 18%",
			popoverForeground: "60 30% 96%",
			primary: "326 100% 74%",
			primaryForeground: "231 15% 18%",
			secondary: "231 15% 25%",
			secondaryForeground: "60 30% 96%",
			muted: "231 15% 25%",
			mutedForeground: "60 30% 70%",
			accent: "231 15% 30%",
			accentForeground: "60 30% 96%",
			destructive: "0 100% 67%",
			destructiveForeground: "60 30% 96%",
			border: "231 15% 28%",
			input: "231 15% 28%",
			ring: "326 100% 74%",
		},
		selectionOverlay: "rgba(255, 121, 198, 0.1)",
		scrollbar: "hsl(231 15% 35% / 0.9)",
		focusRing: "rgb(255 121 198)",
		highlight: {
			background: "rgba(255, 121, 198, 0.2)",
			foreground: "rgb(255, 121, 198)",
		},
		hover: {
			background: "rgba(255, 121, 198, 0.1)",
			foreground: "rgb(255, 121, 198)",
		},
		score: {
			mainGlyph: "#f8f8f2",
			secondaryGlyph: "rgba(248, 248, 242, 0.6)",
			staffLine: "#6272a4",
			barSeparator: "#6272a4",
			barNumber: "#bd93f9",
			scoreInfo: "#f8f8f2",
		},
		playerCursor: {
			background: "rgba(255, 121, 198, 0.4)",
			border: "rgb(255, 121, 198)",
			barHighlight: "rgba(255, 121, 198, 0.15)",
		},
	},
};

const nord: UITheme = {
	id: "nord",
	name: "Nord",
	description: "北极风格的蓝灰色主题",
	light: {
		semantic: {
			background: "220 20% 97%",
			foreground: "220 16% 28%",
			card: "220 20% 97%",
			cardForeground: "220 16% 28%",
			popover: "220 20% 97%",
			popoverForeground: "220 16% 28%",
			primary: "213 32% 42%",
			primaryForeground: "0 0% 100%",
			secondary: "220 15% 92%",
			secondaryForeground: "220 16% 28%",
			muted: "220 15% 92%",
			mutedForeground: "220 16% 50%",
			accent: "220 15% 92%",
			accentForeground: "220 16% 28%",
			destructive: "354 42% 56%",
			destructiveForeground: "0 0% 100%",
			border: "220 15% 85%",
			input: "220 15% 85%",
			ring: "213 32% 42%",
		},
		selectionOverlay: "rgba(129, 161, 193, 0.08)",
		scrollbar: "hsl(220 15% 80% / 0.9)",
		focusRing: "rgb(129 161 193)",
		highlight: {
			background: "rgba(129, 161, 193, 0.2)",
			foreground: "rgb(89, 116, 143)",
		},
		hover: {
			background: "rgba(129, 161, 193, 0.12)",
			foreground: "rgb(89, 116, 143)",
		},
		score: {
			mainGlyph: "#2e3440",
			secondaryGlyph: "rgba(46, 52, 64, 0.6)",
			staffLine: "#81a1c1",
			barSeparator: "#81a1c1",
			barNumber: "#5e81ac",
			scoreInfo: "#3b4252",
		},
		playerCursor: {
			background: "rgba(129, 161, 193, 0.4)",
			border: "rgb(89, 116, 143)",
			barHighlight: "rgba(129, 161, 193, 0.15)",
		},
	},
	dark: {
		semantic: {
			background: "220 16% 22%",
			foreground: "218 27% 94%",
			card: "220 16% 26%",
			cardForeground: "218 27% 94%",
			popover: "220 16% 22%",
			popoverForeground: "218 27% 94%",
			primary: "213 32% 52%",
			primaryForeground: "0 0% 100%",
			secondary: "220 16% 32%",
			secondaryForeground: "218 27% 94%",
			muted: "220 16% 32%",
			mutedForeground: "218 20% 65%",
			accent: "220 16% 36%",
			accentForeground: "218 27% 94%",
			destructive: "354 42% 56%",
			destructiveForeground: "0 0% 100%",
			border: "220 16% 30%",
			input: "220 16% 30%",
			ring: "213 32% 52%",
		},
		selectionOverlay: "rgba(129, 161, 193, 0.12)",
		scrollbar: "hsl(220 16% 40% / 0.9)",
		focusRing: "rgb(136 192 208)",
		highlight: {
			background: "rgba(136, 192, 208, 0.25)",
			foreground: "rgb(136, 192, 208)",
		},
		hover: {
			background: "rgba(136, 192, 208, 0.15)",
			foreground: "rgb(136, 192, 208)",
		},
		score: {
			mainGlyph: "#eceff4",
			secondaryGlyph: "rgba(236, 239, 244, 0.6)",
			staffLine: "#4c566a",
			barSeparator: "#4c566a",
			barNumber: "#81a1c1",
			scoreInfo: "#d8dee9",
		},
		playerCursor: {
			background: "rgba(136, 192, 208, 0.4)",
			border: "rgb(136, 192, 208)",
			barHighlight: "rgba(136, 192, 208, 0.15)",
		},
	},
};

const monokai: UITheme = {
	id: "monokai",
	name: "Monokai",
	description: "经典的 Monokai 代码编辑器主题",
	light: {
		semantic: {
			background: "60 10% 97%",
			foreground: "70 8% 20%",
			card: "60 10% 97%",
			cardForeground: "70 8% 20%",
			popover: "60 10% 97%",
			popoverForeground: "70 8% 20%",
			primary: "80 76% 43%",
			primaryForeground: "0 0% 100%",
			secondary: "70 8% 92%",
			secondaryForeground: "70 8% 20%",
			muted: "70 8% 92%",
			mutedForeground: "70 8% 50%",
			accent: "70 8% 92%",
			accentForeground: "70 8% 20%",
			destructive: "0 100% 68%",
			destructiveForeground: "0 0% 100%",
			border: "70 8% 85%",
			input: "70 8% 85%",
			ring: "80 76% 43%",
		},
		selectionOverlay: "rgba(174, 129, 255, 0.08)",
		scrollbar: "hsl(70 8% 80% / 0.9)",
		focusRing: "rgb(174 129 255)",
		highlight: {
			background: "rgba(174, 129, 255, 0.15)",
			foreground: "rgb(147, 51, 234)",
		},
		hover: {
			background: "rgba(174, 129, 255, 0.1)",
			foreground: "rgb(147, 51, 234)",
		},
		score: {
			mainGlyph: "#272822",
			secondaryGlyph: "rgba(39, 40, 34, 0.6)",
			staffLine: "#a6e22e",
			barSeparator: "#a6e22e",
			barNumber: "#f92672",
			scoreInfo: "#49483e",
		},
		playerCursor: {
			background: "rgba(174, 129, 255, 0.4)",
			border: "rgb(147, 51, 234)",
			barHighlight: "rgba(174, 129, 255, 0.15)",
		},
	},
	dark: {
		semantic: {
			background: "70 8% 15%",
			foreground: "60 9% 87%",
			card: "70 8% 18%",
			cardForeground: "60 9% 87%",
			popover: "70 8% 15%",
			popoverForeground: "60 9% 87%",
			primary: "80 76% 53%",
			primaryForeground: "70 8% 15%",
			secondary: "70 8% 22%",
			secondaryForeground: "60 9% 87%",
			muted: "70 8% 22%",
			mutedForeground: "60 9% 65%",
			accent: "70 8% 26%",
			accentForeground: "60 9% 87%",
			destructive: "0 100% 68%",
			destructiveForeground: "0 0% 100%",
			border: "70 8% 25%",
			input: "70 8% 25%",
			ring: "80 76% 53%",
		},
		selectionOverlay: "rgba(174, 129, 255, 0.1)",
		scrollbar: "hsl(70 8% 30% / 0.9)",
		focusRing: "rgb(174 129 255)",
		highlight: {
			background: "rgba(174, 129, 255, 0.2)",
			foreground: "rgb(174, 129, 255)",
		},
		hover: {
			background: "rgba(174, 129, 255, 0.1)",
			foreground: "rgb(174, 129, 255)",
		},
		score: {
			mainGlyph: "#f8f8f2",
			secondaryGlyph: "rgba(248, 248, 242, 0.6)",
			staffLine: "#75715e",
			barSeparator: "#75715e",
			barNumber: "#66d9ef",
			scoreInfo: "#f8f8f2",
		},
		playerCursor: {
			background: "rgba(174, 129, 255, 0.4)",
			border: "rgb(174, 129, 255)",
			barHighlight: "rgba(174, 129, 255, 0.15)",
		},
	},
};

const solarized: UITheme = {
	id: "solarized",
	name: "Solarized",
	description: "护眼暖色调主题",
	light: {
		semantic: {
			background: "44 87% 94%",
			foreground: "195 100% 23%",
			card: "44 87% 94%",
			cardForeground: "195 100% 23%",
			popover: "44 87% 94%",
			popoverForeground: "195 100% 23%",
			primary: "18 80% 44%",
			primaryForeground: "0 0% 100%",
			secondary: "44 40% 88%",
			secondaryForeground: "195 100% 23%",
			muted: "44 40% 88%",
			mutedForeground: "195 40% 40%",
			accent: "44 40% 88%",
			accentForeground: "195 100% 23%",
			destructive: "1 71% 52%",
			destructiveForeground: "0 0% 100%",
			border: "44 40% 80%",
			input: "44 40% 80%",
			ring: "18 80% 44%",
		},
		selectionOverlay: "rgba(7, 54, 66, 0.08)",
		scrollbar: "hsl(44 40% 70% / 0.9)",
		focusRing: "rgb(203 75 22)",
		highlight: {
			background: "rgba(203, 75, 22, 0.2)",
			foreground: "rgb(203, 75, 22)",
		},
		hover: {
			background: "rgba(203, 75, 22, 0.1)",
			foreground: "rgb(203, 75, 22)",
		},
		score: {
			mainGlyph: "#073642",
			secondaryGlyph: "rgba(7, 54, 66, 0.6)",
			staffLine: "#93a1a1",
			barSeparator: "#93a1a1",
			barNumber: "#586e75",
			scoreInfo: "#073642",
		},
		playerCursor: {
			background: "rgba(203, 75, 22, 0.4)",
			border: "rgb(203, 75, 22)",
			barHighlight: "rgba(203, 75, 22, 0.15)",
		},
	},
	dark: {
		semantic: {
			background: "192 81% 14%",
			foreground: "43 59% 81%",
			card: "192 81% 17%",
			cardForeground: "43 59% 81%",
			popover: "192 81% 14%",
			popoverForeground: "43 59% 81%",
			primary: "175 59% 43%",
			primaryForeground: "0 0% 100%",
			secondary: "192 40% 22%",
			secondaryForeground: "43 59% 81%",
			muted: "192 40% 22%",
			mutedForeground: "43 40% 55%",
			accent: "192 40% 26%",
			accentForeground: "43 59% 81%",
			destructive: "1 71% 52%",
			destructiveForeground: "0 0% 100%",
			border: "192 40% 25%",
			input: "192 40% 25%",
			ring: "175 59% 43%",
		},
		selectionOverlay: "rgba(253, 246, 227, 0.08)",
		scrollbar: "hsl(192 40% 30% / 0.9)",
		focusRing: "rgb(42 161 152)",
		highlight: {
			background: "rgba(42, 161, 152, 0.2)",
			foreground: "rgb(42, 161, 152)",
		},
		hover: {
			background: "rgba(42, 161, 152, 0.1)",
			foreground: "rgb(42, 161, 152)",
		},
		score: {
			mainGlyph: "#eee8d5",
			secondaryGlyph: "rgba(238, 232, 213, 0.6)",
			staffLine: "#586e75",
			barSeparator: "#586e75",
			barNumber: "#2aa198",
			scoreInfo: "#fdf6e3",
		},
		playerCursor: {
			background: "rgba(42, 161, 152, 0.4)",
			border: "rgb(42, 161, 152)",
			barHighlight: "rgba(42, 161, 152, 0.15)",
		},
	},
};

const tokyoNight: UITheme = {
	id: "tokyo-night",
	name: "Tokyo Night",
	description: "Tokyo Night 蓝紫霓虹风格主题",
	light: {
		semantic: {
			background: "225 25% 98%",
			foreground: "232 28% 22%",
			card: "225 25% 99%",
			cardForeground: "232 28% 22%",
			popover: "225 25% 99%",
			popoverForeground: "232 28% 22%",
			primary: "221 84% 62%",
			primaryForeground: "0 0% 100%",
			secondary: "223 24% 93%",
			secondaryForeground: "232 28% 22%",
			muted: "223 24% 93%",
			mutedForeground: "230 14% 45%",
			accent: "223 24% 93%",
			accentForeground: "232 28% 22%",
			destructive: "0 72% 53%",
			destructiveForeground: "0 0% 100%",
			border: "224 20% 86%",
			input: "224 20% 86%",
			ring: "221 84% 62%",
		},
		selectionOverlay: "rgba(122, 162, 247, 0.12)",
		scrollbar: "hsl(224 20% 75% / 0.9)",
		focusRing: "rgb(122 162 247)",
		highlight: {
			background: "rgba(122, 162, 247, 0.2)",
			foreground: "rgb(58, 108, 217)",
		},
		hover: {
			background: "rgba(122, 162, 247, 0.1)",
			foreground: "rgb(58, 108, 217)",
		},
	},
	dark: {
		semantic: {
			background: "234 27% 12%",
			foreground: "226 64% 86%",
			card: "233 27% 14%",
			cardForeground: "226 64% 86%",
			popover: "233 27% 14%",
			popoverForeground: "226 64% 86%",
			primary: "221 84% 72%",
			primaryForeground: "233 27% 14%",
			secondary: "233 23% 20%",
			secondaryForeground: "226 64% 86%",
			muted: "233 23% 20%",
			mutedForeground: "230 28% 60%",
			accent: "233 23% 24%",
			accentForeground: "226 64% 86%",
			destructive: "0 72% 60%",
			destructiveForeground: "0 0% 100%",
			border: "233 23% 24%",
			input: "233 23% 24%",
			ring: "221 84% 72%",
		},
		selectionOverlay: "rgba(122, 162, 247, 0.16)",
		scrollbar: "hsl(233 23% 30% / 0.9)",
		focusRing: "rgb(122 162 247)",
		highlight: {
			background: "rgba(122, 162, 247, 0.25)",
			foreground: "rgb(122, 162, 247)",
		},
		hover: {
			background: "rgba(122, 162, 247, 0.14)",
			foreground: "rgb(122, 162, 247)",
		},
	},
};

const catppuccin: UITheme = {
	id: "catppuccin",
	name: "Catppuccin",
	description: "Catppuccin 柔和马卡龙风格主题",
	light: {
		semantic: {
			background: "220 23% 95%",
			foreground: "234 16% 35%",
			card: "220 23% 96%",
			cardForeground: "234 16% 35%",
			popover: "220 23% 96%",
			popoverForeground: "234 16% 35%",
			primary: "267 84% 58%",
			primaryForeground: "0 0% 100%",
			secondary: "220 20% 90%",
			secondaryForeground: "234 16% 35%",
			muted: "220 20% 90%",
			mutedForeground: "230 10% 47%",
			accent: "220 20% 90%",
			accentForeground: "234 16% 35%",
			destructive: "2 79% 58%",
			destructiveForeground: "0 0% 100%",
			border: "220 16% 85%",
			input: "220 16% 85%",
			ring: "267 84% 58%",
		},
		selectionOverlay: "rgba(136, 57, 239, 0.14)",
		scrollbar: "hsl(220 16% 76% / 0.9)",
		focusRing: "rgb(136 57 239)",
		highlight: {
			background: "rgba(136, 57, 239, 0.22)",
			foreground: "rgb(111, 45, 191)",
		},
		hover: {
			background: "rgba(136, 57, 239, 0.12)",
			foreground: "rgb(111, 45, 191)",
		},
	},
	dark: {
		semantic: {
			background: "240 21% 15%",
			foreground: "227 70% 88%",
			card: "240 21% 16%",
			cardForeground: "227 70% 88%",
			popover: "240 21% 16%",
			popoverForeground: "227 70% 88%",
			primary: "267 84% 81%",
			primaryForeground: "240 21% 15%",
			secondary: "240 16% 22%",
			secondaryForeground: "227 70% 88%",
			muted: "240 16% 22%",
			mutedForeground: "228 18% 64%",
			accent: "240 16% 26%",
			accentForeground: "227 70% 88%",
			destructive: "343 81% 75%",
			destructiveForeground: "240 21% 15%",
			border: "240 16% 26%",
			input: "240 16% 26%",
			ring: "267 84% 81%",
		},
		selectionOverlay: "rgba(203, 166, 247, 0.18)",
		scrollbar: "hsl(240 16% 32% / 0.9)",
		focusRing: "rgb(203 166 247)",
		highlight: {
			background: "rgba(203, 166, 247, 0.24)",
			foreground: "rgb(203, 166, 247)",
		},
		hover: {
			background: "rgba(203, 166, 247, 0.14)",
			foreground: "rgb(203, 166, 247)",
		},
	},
};

// ===== 编辑器高亮主题预设 =====

const githubEditorTheme: EditorTheme = {
	id: "github",
	name: "GitHub",
	variant: "universal",
	colors: {
		comment: "#6a737d",
		keyword: "#d73a49",
		operator: "#d73a49",
		string: "#032f62",
		number: "#005cc5",
		atom: "#f59e0b",
		function: "#6f42c1",
		tag: "#22863a",
		attribute: "#6f42c1",
		variable: "#24292e",
		bracket: "#24292e",
		atomBackground: "rgba(245, 158, 11, 0.12)",
		matchBackground: "rgba(36, 41, 46, 0.04)",
		selectionMatch: "rgba(9, 105, 218, 0.18)",
	},
	cmConfig: {
		background: "hsl(var(--card))",
		foreground: "hsl(var(--foreground))",
		gutterBackground: "transparent",
		gutterForeground: "hsl(var(--muted-foreground))",
		lineHighlight: "hsl(var(--muted) / 0.06)",
		selection: "var(--selection-overlay)",
		cursor: "hsl(var(--primary))",
	},
};

const vscodeEditorTheme: EditorTheme = {
	id: "vscode",
	name: "VS Code",
	variant: "universal",
	colors: {
		comment: "#6a9955",
		keyword: "#569cd6",
		operator: "#d4d4d4",
		string: "#ce9178",
		number: "#b5cea8",
		atom: "#dcdcaa",
		function: "#dcdcaa",
		tag: "#569cd6",
		attribute: "#9cdcfe",
		variable: "#9cdcfe",
		bracket: "#ffd700",
		atomBackground: "rgba(220, 220, 170, 0.12)",
		matchBackground: "rgba(255, 255, 255, 0.04)",
		selectionMatch: "rgba(0, 122, 204, 0.18)",
	},
	cmConfig: {
		background: "hsl(var(--card))",
		foreground: "hsl(var(--foreground))",
		gutterBackground: "transparent",
		gutterForeground: "hsl(var(--muted-foreground))",
		lineHighlight: "hsl(var(--muted) / 0.06)",
		selection: "var(--selection-overlay)",
		cursor: "hsl(var(--primary))",
	},
};

const monokaiEditorTheme: EditorTheme = {
	id: "monokai",
	name: "Monokai",
	variant: "dark",
	colors: {
		comment: "#75715e",
		keyword: "#f92672",
		operator: "#f92672",
		string: "#e6db74",
		number: "#ae81ff",
		atom: "#fd971f",
		function: "#a6e22e",
		tag: "#f92672",
		attribute: "#a6e22e",
		variable: "#f8f8f2",
		bracket: "#f8f8f2",
		atomBackground: "rgba(253, 151, 31, 0.15)",
		matchBackground: "rgba(248, 248, 242, 0.05)",
		selectionMatch: "rgba(174, 129, 255, 0.2)",
	},
	cmConfig: {
		background: "hsl(var(--card))",
		foreground: "#f8f8f2",
		gutterBackground: "transparent",
		gutterForeground: "#75715e",
		lineHighlight: "rgba(255, 255, 255, 0.03)",
		selection: "rgba(174, 129, 255, 0.15)",
		cursor: "#f8f8f2",
	},
};

const draculaEditorTheme: EditorTheme = {
	id: "dracula",
	name: "Dracula",
	variant: "dark",
	colors: {
		comment: "#6272a4",
		keyword: "#ff79c6",
		operator: "#ff79c6",
		string: "#f1fa8c",
		number: "#bd93f9",
		atom: "#ffb86c",
		function: "#50fa7b",
		tag: "#ff79c6",
		attribute: "#50fa7b",
		variable: "#f8f8f2",
		bracket: "#f8f8f2",
		atomBackground: "rgba(255, 184, 108, 0.15)",
		matchBackground: "rgba(248, 248, 242, 0.05)",
		selectionMatch: "rgba(255, 121, 198, 0.2)",
	},
	cmConfig: {
		background: "hsl(var(--card))",
		foreground: "#f8f8f2",
		gutterBackground: "transparent",
		gutterForeground: "#6272a4",
		lineHighlight: "rgba(255, 255, 255, 0.03)",
		selection: "rgba(255, 121, 198, 0.15)",
		cursor: "#f8f8f2",
	},
};

const nordEditorTheme: EditorTheme = {
	id: "nord",
	name: "Nord",
	variant: "dark",
	colors: {
		comment: "#616e88",
		keyword: "#81a1c1",
		operator: "#81a1c1",
		string: "#a3be8c",
		number: "#b48ead",
		atom: "#ebcb8b",
		function: "#88c0d0",
		tag: "#81a1c1",
		attribute: "#8fbcbb",
		variable: "#eceff4",
		bracket: "#eceff4",
		atomBackground: "rgba(235, 203, 139, 0.15)",
		matchBackground: "rgba(236, 239, 244, 0.05)",
		selectionMatch: "rgba(129, 161, 193, 0.2)",
	},
	cmConfig: {
		background: "hsl(var(--card))",
		foreground: "#eceff4",
		gutterBackground: "transparent",
		gutterForeground: "#616e88",
		lineHighlight: "rgba(255, 255, 255, 0.03)",
		selection: "rgba(129, 161, 193, 0.15)",
		cursor: "#eceff4",
	},
};

const tokyoNightEditorTheme: EditorTheme = {
	id: "tokyo-night",
	name: "Tokyo Night",
	variant: "dark",
	colors: {
		comment: "#565f89",
		keyword: "#bb9af7",
		operator: "#89ddff",
		string: "#9ece6a",
		number: "#ff9e64",
		atom: "#e0af68",
		function: "#7aa2f7",
		tag: "#7dcfff",
		attribute: "#73daca",
		variable: "#c0caf5",
		bracket: "#c0caf5",
		atomBackground: "rgba(224, 175, 104, 0.18)",
		matchBackground: "rgba(86, 95, 137, 0.25)",
		selectionMatch: "rgba(122, 162, 247, 0.28)",
	},
	cmConfig: {
		background: "hsl(var(--card))",
		foreground: "#c0caf5",
		gutterBackground: "transparent",
		gutterForeground: "#565f89",
		lineHighlight: "rgba(122, 162, 247, 0.08)",
		selection: "rgba(122, 162, 247, 0.16)",
		cursor: "#7aa2f7",
	},
};

const catppuccinEditorTheme: EditorTheme = {
	id: "catppuccin",
	name: "Catppuccin",
	variant: "dark",
	colors: {
		comment: "#9399b2",
		keyword: "#cba6f7",
		operator: "#89dceb",
		string: "#a6e3a1",
		number: "#fab387",
		atom: "#f9e2af",
		function: "#89b4fa",
		tag: "#94e2d5",
		attribute: "#89b4fa",
		variable: "#cdd6f4",
		bracket: "#bac2de",
		atomBackground: "rgba(249, 226, 175, 0.18)",
		matchBackground: "rgba(147, 153, 178, 0.24)",
		selectionMatch: "rgba(203, 166, 247, 0.28)",
	},
	cmConfig: {
		background: "hsl(var(--card))",
		foreground: "#cdd6f4",
		gutterBackground: "transparent",
		gutterForeground: "#9399b2",
		lineHighlight: "rgba(203, 166, 247, 0.08)",
		selection: "rgba(203, 166, 247, 0.16)",
		cursor: "#cba6f7",
	},
};

// ===== 注册表 =====

class ThemeRegistryImpl implements ThemeRegistry {
	uiThemes: Map<string, UITheme> = new Map();
	editorThemes: Map<string, EditorTheme> = new Map();
	defaultCombinations: Map<string, string> = new Map();

	constructor() {
		// 注册 UI 主题
		this.registerUITheme(github);
		this.registerUITheme(vscode);
		this.registerUITheme(obsidian);
		this.registerUITheme(dracula);
		this.registerUITheme(nord);
		this.registerUITheme(monokai);
		this.registerUITheme(solarized);
		this.registerUITheme(tokyoNight);
		this.registerUITheme(catppuccin);

		// 注册编辑器主题
		this.registerEditorTheme(githubEditorTheme);
		this.registerEditorTheme(vscodeEditorTheme);
		this.registerEditorTheme(monokaiEditorTheme);
		this.registerEditorTheme(draculaEditorTheme);
		this.registerEditorTheme(nordEditorTheme);
		this.registerEditorTheme(tokyoNightEditorTheme);
		this.registerEditorTheme(catppuccinEditorTheme);

		// 设置默认组合
		this.defaultCombinations.set("github", "github");
		this.defaultCombinations.set("vscode", "vscode");
		this.defaultCombinations.set("obsidian", "dracula");
		this.defaultCombinations.set("dracula", "dracula");
		this.defaultCombinations.set("nord", "nord");
		this.defaultCombinations.set("monokai", "monokai");
		this.defaultCombinations.set("solarized", "github");
		this.defaultCombinations.set("tokyo-night", "tokyo-night");
		this.defaultCombinations.set("catppuccin", "catppuccin");
	}

	registerUITheme(theme: UITheme): void {
		this.uiThemes.set(theme.id, theme);
	}

	registerEditorTheme(theme: EditorTheme): void {
		this.editorThemes.set(theme.id, theme);
	}

	getUITheme(id: string): UITheme | undefined {
		return this.uiThemes.get(id);
	}

	getEditorTheme(id: string): EditorTheme | undefined {
		return this.editorThemes.get(id);
	}

	getDefaultEditorThemeForUI(uiThemeId: string): string {
		return this.defaultCombinations.get(uiThemeId) ?? "github";
	}

	getAllUIThemes(): UITheme[] {
		return Array.from(this.uiThemes.values());
	}

	getAllEditorThemes(): EditorTheme[] {
		return Array.from(this.editorThemes.values());
	}
}

// 单例实例
export const themeRegistry = new ThemeRegistryImpl();

// 辅助函数
export function getUITheme(id: string): UITheme | undefined {
	return themeRegistry.getUITheme(id);
}

export function getEditorTheme(id: string): EditorTheme | undefined {
	return themeRegistry.getEditorTheme(id);
}

export function getAllUIThemes(): UITheme[] {
	return themeRegistry.getAllUIThemes();
}

export function getAllEditorThemes(): EditorTheme[] {
	return themeRegistry.getAllEditorThemes();
}

export function getDefaultEditorThemeForUI(uiThemeId: string): string {
	return themeRegistry.getDefaultEditorThemeForUI(uiThemeId);
}
