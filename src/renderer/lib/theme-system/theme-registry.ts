/**
 * Theme Registry
 *
 * 主题注册中心 - 管理所有可用的UI主题和编辑器主题
 */

import type { UITheme, EditorTheme, ThemeRegistry } from './types';

// ===== UI 主题预设 =====

const githubLight: UITheme = {
	id: 'github-light',
	name: 'GitHub Light',
	description: '经典的 GitHub 亮色主题',
	variant: 'light',
	colors: {
		background: '0 0% 100%',
		foreground: '210 13% 16%',
		card: '0 0% 100%',
		cardForeground: '210 13% 16%',
		popover: '0 0% 100%',
		popoverForeground: '210 13% 16%',
		primary: '212 92% 45%',
		primaryForeground: '0 0% 100%',
		secondary: '210 29% 97%',
		secondaryForeground: '210 13% 16%',
		muted: '210 29% 97%',
		mutedForeground: '210 9% 41%',
		accent: '210 29% 97%',
		accentForeground: '210 13% 16%',
		destructive: '356 71% 53%',
		destructiveForeground: '0 0% 100%',
		border: '213 27% 84%',
		input: '213 27% 84%',
		ring: '212 92% 45%',
	},
	extended: {
		selectionOverlay: 'rgba(0, 0, 0, 0.03)',
		scrollbar: 'hsl(213 27% 84% / 0.7)',
		focusRing: 'rgb(59 130 246)',
		score: {
			mainGlyph: '#0f172a',
			secondaryGlyph: 'rgba(15, 23, 42, 0.6)',
			staffLine: '#cbd5e1',
			barSeparator: '#cbd5e1',
			barNumber: '#475569',
			scoreInfo: '#1e293b',
		},
	},
};

const githubDark: UITheme = {
	id: 'github-dark',
	name: 'GitHub Dark',
	description: '经典的 GitHub 暗色主题',
	variant: 'dark',
	colors: {
		background: '216 28% 7%',
		foreground: '212 12% 82%',
		card: '216 28% 7%',
		cardForeground: '212 12% 82%',
		popover: '215 28% 10%',
		popoverForeground: '212 12% 82%',
		primary: '212 92% 58%',
		primaryForeground: '0 0% 100%',
		secondary: '215 28% 10%',
		secondaryForeground: '212 12% 82%',
		muted: '215 28% 10%',
		mutedForeground: '212 10% 56%',
		accent: '215 28% 10%',
		accentForeground: '212 12% 82%',
		destructive: '356 60% 45%',
		destructiveForeground: '0 0% 100%',
		border: '215 14% 21%',
		input: '215 14% 21%',
		ring: '212 92% 58%',
	},
	extended: {
		selectionOverlay: 'rgba(255, 255, 255, 0.03)',
		scrollbar: 'hsl(215 14% 21% / 0.7)',
		focusRing: 'rgb(96 165 250)',
		score: {
			mainGlyph: '#f1f5f9',
			secondaryGlyph: 'rgba(241, 245, 249, 0.6)',
			staffLine: '#475569',
			barSeparator: '#475569',
			barNumber: '#94a3b8',
			scoreInfo: '#cbd5e1',
		},
	},
};

const vscodeLight: UITheme = {
	id: 'vscode-light',
	name: 'VS Code Light',
	description: 'Visual Studio Code 默认亮色',
	variant: 'light',
	colors: {
		background: '0 0% 100%',
		foreground: '0 0% 15%',
		card: '0 0% 100%',
		cardForeground: '0 0% 15%',
		popover: '0 0% 100%',
		popoverForeground: '0 0% 15%',
		primary: '207 82% 48%',
		primaryForeground: '0 0% 100%',
		secondary: '220 13% 91%',
		secondaryForeground: '0 0% 15%',
		muted: '220 13% 91%',
		mutedForeground: '0 0% 45%',
		accent: '220 13% 91%',
		accentForeground: '0 0% 15%',
		destructive: '0 84% 60%',
		destructiveForeground: '0 0% 100%',
		border: '220 13% 85%',
		input: '220 13% 85%',
		ring: '207 82% 48%',
	},
	extended: {
		selectionOverlay: 'rgba(0, 0, 0, 0.04)',
		scrollbar: 'hsl(220 13% 75% / 0.7)',
		focusRing: 'rgb(0 122 204)',
		score: {
			mainGlyph: '#1a1a1a',
			secondaryGlyph: 'rgba(26, 26, 26, 0.6)',
			staffLine: '#d4d4d4',
			barSeparator: '#d4d4d4',
			barNumber: '#616161',
			scoreInfo: '#333333',
		},
	},
};

const vscodeDark: UITheme = {
	id: 'vscode-dark',
	name: 'VS Code Dark+',
	description: 'Visual Studio Code 默认暗色',
	variant: 'dark',
	colors: {
		background: '220 13% 8%',
		foreground: '220 10% 85%',
		card: '220 13% 11%',
		cardForeground: '220 10% 85%',
		popover: '220 13% 8%',
		popoverForeground: '220 10% 85%',
		primary: '207 82% 52%',
		primaryForeground: '0 0% 100%',
		secondary: '220 13% 18%',
		secondaryForeground: '220 10% 85%',
		muted: '220 13% 18%',
		mutedForeground: '220 10% 55%',
		accent: '220 13% 22%',
		accentForeground: '220 10% 85%',
		destructive: '0 84% 60%',
		destructiveForeground: '0 0% 100%',
		border: '220 13% 20%',
		input: '220 13% 20%',
		ring: '207 82% 52%',
	},
	extended: {
		selectionOverlay: 'rgba(255, 255, 255, 0.04)',
		scrollbar: 'hsl(220 13% 25% / 0.7)',
		focusRing: 'rgb(0 122 204)',
		score: {
			mainGlyph: '#e0e0e0',
			secondaryGlyph: 'rgba(224, 224, 224, 0.6)',
			staffLine: '#4a4a4a',
			barSeparator: '#4a4a4a',
			barNumber: '#858585',
			scoreInfo: '#cccccc',
		},
	},
};

const obsidian: UITheme = {
	id: 'obsidian',
	name: 'Obsidian',
	description: 'Obsidian 笔记的紫色调深色主题',
	variant: 'dark',
	colors: {
		background: '260 25% 8%',
		foreground: '260 10% 88%',
		card: '260 25% 11%',
		cardForeground: '260 10% 88%',
		popover: '260 25% 8%',
		popoverForeground: '260 10% 88%',
		primary: '262 52% 58%',
		primaryForeground: '0 0% 100%',
		secondary: '260 20% 18%',
		secondaryForeground: '260 10% 88%',
		muted: '260 20% 18%',
		mutedForeground: '260 10% 55%',
		accent: '260 20% 22%',
		accentForeground: '260 10% 88%',
		destructive: '0 84% 60%',
		destructiveForeground: '0 0% 100%',
		border: '260 20% 20%',
		input: '260 20% 20%',
		ring: '262 52% 58%',
	},
	extended: {
		selectionOverlay: 'rgba(139, 92, 246, 0.08)',
		scrollbar: 'hsl(260 20% 25% / 0.7)',
		focusRing: 'rgb(167 139 250)',
		score: {
			mainGlyph: '#f0ebff',
			secondaryGlyph: 'rgba(240, 235, 255, 0.6)',
			staffLine: '#4a4458',
			barSeparator: '#4a4458',
			barNumber: '#9ca3af',
			scoreInfo: '#d1d5db',
		},
	},
};

const dracula: UITheme = {
	id: 'dracula',
	name: 'Dracula',
	description: '经典的 Dracula 高对比度主题',
	variant: 'dark',
	colors: {
		background: '231 15% 18%',
		foreground: '60 30% 96%',
		card: '231 15% 22%',
		cardForeground: '60 30% 96%',
		popover: '231 15% 18%',
		popoverForeground: '60 30% 96%',
		primary: '326 100% 74%',
		primaryForeground: '231 15% 18%',
		secondary: '231 15% 25%',
		secondaryForeground: '60 30% 96%',
		muted: '231 15% 25%',
		mutedForeground: '60 30% 70%',
		accent: '231 15% 30%',
		accentForeground: '60 30% 96%',
		destructive: '0 100% 67%',
		destructiveForeground: '60 30% 96%',
		border: '231 15% 28%',
		input: '231 15% 28%',
		ring: '326 100% 74%',
	},
	extended: {
		selectionOverlay: 'rgba(255, 121, 198, 0.1)',
		scrollbar: 'hsl(231 15% 35% / 0.7)',
		focusRing: 'rgb(255 121 198)',
		score: {
			mainGlyph: '#f8f8f2',
			secondaryGlyph: 'rgba(248, 248, 242, 0.6)',
			staffLine: '#6272a4',
			barSeparator: '#6272a4',
			barNumber: '#bd93f9',
			scoreInfo: '#f8f8f2',
		},
	},
};

const nord: UITheme = {
	id: 'nord',
	name: 'Nord',
	description: '北极风格的蓝灰色主题',
	variant: 'dark',
	colors: {
		background: '220 16% 22%',
		foreground: '218 27% 94%',
		card: '220 16% 26%',
		cardForeground: '218 27% 94%',
		popover: '220 16% 22%',
		popoverForeground: '218 27% 94%',
		primary: '213 32% 52%',
		primaryForeground: '0 0% 100%',
		secondary: '220 16% 32%',
		secondaryForeground: '218 27% 94%',
		muted: '220 16% 32%',
		mutedForeground: '218 20% 65%',
		accent: '220 16% 36%',
		accentForeground: '218 27% 94%',
		destructive: '354 42% 56%',
		destructiveForeground: '0 0% 100%',
		border: '220 16% 30%',
		input: '220 16% 30%',
		ring: '213 32% 52%',
	},
	extended: {
		selectionOverlay: 'rgba(129, 161, 193, 0.12)',
		scrollbar: 'hsl(220 16% 40% / 0.7)',
		focusRing: 'rgb(136 192 208)',
		score: {
			mainGlyph: '#eceff4',
			secondaryGlyph: 'rgba(236, 239, 244, 0.6)',
			staffLine: '#4c566a',
			barSeparator: '#4c566a',
			barNumber: '#81a1c1',
			scoreInfo: '#d8dee9',
		},
	},
};

const monokai: UITheme = {
	id: 'monokai',
	name: 'Monokai',
	description: '经典的 Monokai 代码编辑器主题',
	variant: 'dark',
	colors: {
		background: '70 8% 15%',
		foreground: '60 9% 87%',
		card: '70 8% 18%',
		cardForeground: '60 9% 87%',
		popover: '70 8% 15%',
		popoverForeground: '60 9% 87%',
		primary: '80 76% 53%',
		primaryForeground: '70 8% 15%',
		secondary: '70 8% 22%',
		secondaryForeground: '60 9% 87%',
		muted: '70 8% 22%',
		mutedForeground: '60 9% 65%',
		accent: '70 8% 26%',
		accentForeground: '60 9% 87%',
		destructive: '0 100% 68%',
		destructiveForeground: '0 0% 100%',
		border: '70 8% 25%',
		input: '70 8% 25%',
		ring: '80 76% 53%',
	},
	extended: {
		selectionOverlay: 'rgba(174, 129, 255, 0.1)',
		scrollbar: 'hsl(70 8% 30% / 0.7)',
		focusRing: 'rgb(174 129 255)',
		score: {
			mainGlyph: '#f8f8f2',
			secondaryGlyph: 'rgba(248, 248, 242, 0.6)',
			staffLine: '#75715e',
			barSeparator: '#75715e',
			barNumber: '#66d9ef',
			scoreInfo: '#f8f8f2',
		},
	},
};

const solarizedLight: UITheme = {
	id: 'solarized-light',
	name: 'Solarized Light',
	description: '护眼暖色调亮色主题',
	variant: 'light',
	colors: {
		background: '44 87% 94%',
		foreground: '195 100% 23%',
		card: '44 87% 94%',
		cardForeground: '195 100% 23%',
		popover: '44 87% 94%',
		popoverForeground: '195 100% 23%',
		primary: '18 80% 44%',
		primaryForeground: '0 0% 100%',
		secondary: '44 40% 88%',
		secondaryForeground: '195 100% 23%',
		muted: '44 40% 88%',
		mutedForeground: '195 40% 40%',
		accent: '44 40% 88%',
		accentForeground: '195 100% 23%',
		destructive: '1 71% 52%',
		destructiveForeground: '0 0% 100%',
		border: '44 40% 80%',
		input: '44 40% 80%',
		ring: '18 80% 44%',
	},
	extended: {
		selectionOverlay: 'rgba(7, 54, 66, 0.08)',
		scrollbar: 'hsl(44 40% 70% / 0.7)',
		focusRing: 'rgb(203 75 22)',
		score: {
			mainGlyph: '#073642',
			secondaryGlyph: 'rgba(7, 54, 66, 0.6)',
			staffLine: '#93a1a1',
			barSeparator: '#93a1a1',
			barNumber: '#586e75',
			scoreInfo: '#073642',
		},
	},
};

const solarizedDark: UITheme = {
	id: 'solarized-dark',
	name: 'Solarized Dark',
	description: '护眼暖色调暗色主题',
	variant: 'dark',
	colors: {
		background: '192 81% 14%',
		foreground: '43 59% 81%',
		card: '192 81% 17%',
		cardForeground: '43 59% 81%',
		popover: '192 81% 14%',
		popoverForeground: '43 59% 81%',
		primary: '175 59% 43%',
		primaryForeground: '0 0% 100%',
		secondary: '192 40% 22%',
		secondaryForeground: '43 59% 81%',
		muted: '192 40% 22%',
		mutedForeground: '43 40% 55%',
		accent: '192 40% 26%',
		accentForeground: '43 59% 81%',
		destructive: '1 71% 52%',
		destructiveForeground: '0 0% 100%',
		border: '192 40% 25%',
		input: '192 40% 25%',
		ring: '175 59% 43%',
	},
	extended: {
		selectionOverlay: 'rgba(253, 246, 227, 0.08)',
		scrollbar: 'hsl(192 40% 30% / 0.7)',
		focusRing: 'rgb(42 161 152)',
		score: {
			mainGlyph: '#eee8d5',
			secondaryGlyph: 'rgba(238, 232, 213, 0.6)',
			staffLine: '#586e75',
			barSeparator: '#586e75',
			barNumber: '#2aa198',
			scoreInfo: '#fdf6e3',
		},
	},
};

// ===== 编辑器高亮主题预设 =====

const githubEditorTheme: EditorTheme = {
	id: 'github',
	name: 'GitHub',
	variant: 'universal',
	colors: {
		comment: '#6a737d',
		keyword: '#d73a49',
		operator: '#d73a49',
		string: '#032f62',
		number: '#005cc5',
		atom: '#f59e0b',
		function: '#6f42c1',
		tag: '#22863a',
		attribute: '#6f42c1',
		variable: '#24292e',
		bracket: '#24292e',
		atomBackground: 'rgba(245, 158, 11, 0.12)',
		matchBackground: 'rgba(36, 41, 46, 0.04)',
		selectionMatch: 'rgba(9, 105, 218, 0.18)',
	},
	cmConfig: {
		background: 'hsl(var(--card))',
		foreground: 'hsl(var(--foreground))',
		gutterBackground: 'transparent',
		gutterForeground: 'hsl(var(--muted-foreground))',
		lineHighlight: 'hsl(var(--muted) / 0.06)',
		selection: 'var(--selection-overlay)',
		cursor: 'hsl(var(--primary))',
	},
};

const vscodeEditorTheme: EditorTheme = {
	id: 'vscode',
	name: 'VS Code',
	variant: 'universal',
	colors: {
		comment: '#6a9955',
		keyword: '#569cd6',
		operator: '#d4d4d4',
		string: '#ce9178',
		number: '#b5cea8',
		atom: '#dcdcaa',
		function: '#dcdcaa',
		tag: '#569cd6',
		attribute: '#9cdcfe',
		variable: '#9cdcfe',
		bracket: '#ffd700',
		atomBackground: 'rgba(220, 220, 170, 0.12)',
		matchBackground: 'rgba(255, 255, 255, 0.04)',
		selectionMatch: 'rgba(0, 122, 204, 0.18)',
	},
	cmConfig: {
		background: 'hsl(var(--card))',
		foreground: 'hsl(var(--foreground))',
		gutterBackground: 'transparent',
		gutterForeground: 'hsl(var(--muted-foreground))',
		lineHighlight: 'hsl(var(--muted) / 0.06)',
		selection: 'var(--selection-overlay)',
		cursor: 'hsl(var(--primary))',
	},
};

const monokaiEditorTheme: EditorTheme = {
	id: 'monokai',
	name: 'Monokai',
	variant: 'dark',
	colors: {
		comment: '#75715e',
		keyword: '#f92672',
		operator: '#f92672',
		string: '#e6db74',
		number: '#ae81ff',
		atom: '#fd971f',
		function: '#a6e22e',
		tag: '#f92672',
		attribute: '#a6e22e',
		variable: '#f8f8f2',
		bracket: '#f8f8f2',
		atomBackground: 'rgba(253, 151, 31, 0.15)',
		matchBackground: 'rgba(248, 248, 242, 0.05)',
		selectionMatch: 'rgba(174, 129, 255, 0.2)',
	},
	cmConfig: {
		background: 'hsl(var(--card))',
		foreground: '#f8f8f2',
		gutterBackground: 'transparent',
		gutterForeground: '#75715e',
		lineHighlight: 'rgba(255, 255, 255, 0.03)',
		selection: 'rgba(174, 129, 255, 0.15)',
		cursor: '#f8f8f2',
	},
};

const draculaEditorTheme: EditorTheme = {
	id: 'dracula',
	name: 'Dracula',
	variant: 'dark',
	colors: {
		comment: '#6272a4',
		keyword: '#ff79c6',
		operator: '#ff79c6',
		string: '#f1fa8c',
		number: '#bd93f9',
		atom: '#ffb86c',
		function: '#50fa7b',
		tag: '#ff79c6',
		attribute: '#50fa7b',
		variable: '#f8f8f2',
		bracket: '#f8f8f2',
		atomBackground: 'rgba(255, 184, 108, 0.15)',
		matchBackground: 'rgba(248, 248, 242, 0.05)',
		selectionMatch: 'rgba(255, 121, 198, 0.2)',
	},
	cmConfig: {
		background: 'hsl(var(--card))',
		foreground: '#f8f8f2',
		gutterBackground: 'transparent',
		gutterForeground: '#6272a4',
		lineHighlight: 'rgba(255, 255, 255, 0.03)',
		selection: 'rgba(255, 121, 198, 0.15)',
		cursor: '#f8f8f2',
	},
};

const nordEditorTheme: EditorTheme = {
	id: 'nord',
	name: 'Nord',
	variant: 'dark',
	colors: {
		comment: '#616e88',
		keyword: '#81a1c1',
		operator: '#81a1c1',
		string: '#a3be8c',
		number: '#b48ead',
		atom: '#ebcb8b',
		function: '#88c0d0',
		tag: '#81a1c1',
		attribute: '#8fbcbb',
		variable: '#eceff4',
		bracket: '#eceff4',
		atomBackground: 'rgba(235, 203, 139, 0.15)',
		matchBackground: 'rgba(236, 239, 244, 0.05)',
		selectionMatch: 'rgba(129, 161, 193, 0.2)',
	},
	cmConfig: {
		background: 'hsl(var(--card))',
		foreground: '#eceff4',
		gutterBackground: 'transparent',
		gutterForeground: '#616e88',
		lineHighlight: 'rgba(255, 255, 255, 0.03)',
		selection: 'rgba(129, 161, 193, 0.15)',
		cursor: '#eceff4',
	},
};

// ===== 注册表 =====

class ThemeRegistryImpl implements ThemeRegistry {
	uiThemes: Map<string, UITheme> = new Map();
	editorThemes: Map<string, EditorTheme> = new Map();
	defaultCombinations: Map<string, string> = new Map();

	// 主题变体映射
	private themeVariants: Map<string, string> = new Map();

	constructor() {
		// 注册 UI 主题
		this.registerUITheme(githubLight);
		this.registerUITheme(githubDark);
		this.registerUITheme(vscodeLight);
		this.registerUITheme(vscodeDark);
		this.registerUITheme(obsidian);
		this.registerUITheme(dracula);
		this.registerUITheme(nord);
		this.registerUITheme(monokai);
		this.registerUITheme(solarizedLight);
		this.registerUITheme(solarizedDark);

		// 注册编辑器主题
		this.registerEditorTheme(githubEditorTheme);
		this.registerEditorTheme(vscodeEditorTheme);
		this.registerEditorTheme(monokaiEditorTheme);
		this.registerEditorTheme(draculaEditorTheme);
		this.registerEditorTheme(nordEditorTheme);

		// 设置默认组合
		this.defaultCombinations.set('github-light', 'github');
		this.defaultCombinations.set('github-dark', 'github');
		this.defaultCombinations.set('vscode-light', 'vscode');
		this.defaultCombinations.set('vscode-dark', 'vscode');
		this.defaultCombinations.set('obsidian', 'dracula');
		this.defaultCombinations.set('dracula', 'dracula');
		this.defaultCombinations.set('nord', 'nord');
		this.defaultCombinations.set('monokai', 'monokai');
		this.defaultCombinations.set('solarized-light', 'github');
		this.defaultCombinations.set('solarized-dark', 'nord');

		// 设置主题变体映射
		this.setupThemeVariants();
	}

	private setupThemeVariants(): void {
		// 建立双向映射
		this.themeVariants.set('github-light', 'github-dark');
		this.themeVariants.set('github-dark', 'github-light');
		this.themeVariants.set('vscode-light', 'vscode-dark');
		this.themeVariants.set('vscode-dark', 'vscode-light');
		this.themeVariants.set('solarized-light', 'solarized-dark');
		this.themeVariants.set('solarized-dark', 'solarized-light');
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
		return this.defaultCombinations.get(uiThemeId) ?? 'github';
	}

	getAllUIThemes(): UITheme[] {
		return Array.from(this.uiThemes.values());
	}

	getAllEditorThemes(): EditorTheme[] {
		return Array.from(this.editorThemes.values());
	}

	getUIThemesByVariant(variant: 'light' | 'dark'): UITheme[] {
		return this.getAllUIThemes().filter((t) => t.variant === variant);
	}

	/**
	 * 获取主题的对应变体（明暗切换）
	 * @param themeId 当前主题ID
	 * @returns 对应变体的主题ID，如果不存在则返回null
	 */
	getThemeVariant(themeId: string): string | null {
		return this.themeVariants.get(themeId) ?? null;
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
