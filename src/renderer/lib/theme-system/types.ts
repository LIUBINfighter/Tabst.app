/**
 * Theme System Types
 *
 * 主题系统的核心类型定义
 */

// ===== UI 主题 =====

export interface UIColorScale {
	50: string;
	100: string;
	200: string;
	300: string;
	400: string;
	500: string;
	600: string;
	700: string;
	800: string;
	900: string;
	950: string;
}

export interface UISemanticColors {
	background: string;
	foreground: string;
	card: string;
	cardForeground: string;
	popover: string;
	popoverForeground: string;
	primary: string;
	primaryForeground: string;
	secondary: string;
	secondaryForeground: string;
	muted: string;
	mutedForeground: string;
	accent: string;
	accentForeground: string;
	destructive: string;
	destructiveForeground: string;
	border: string;
	input: string;
	ring: string;
}

export interface UIThemeColors {
	semantic: UISemanticColors;
	selectionOverlay: string;
	scrollbar: string;
	focusRing: string;
	highlight?: {
		background: string;
		foreground: string;
	};
	hover?: {
		background: string;
		foreground: string;
	};
	score?: {
		mainGlyph: string;
		secondaryGlyph: string;
		staffLine: string;
		barSeparator: string;
		barNumber: string;
		scoreInfo: string;
	};
	playerCursor?: {
		background: string;
		border: string;
		barHighlight: string;
	};
}

export interface UITheme {
	id: string;
	name: string;
	description?: string;
	light: UIThemeColors;
	dark: UIThemeColors;
}

// ===== 编辑器高亮主题 =====

export interface EditorHighlightColors {
	comment: string;
	keyword: string;
	operator: string;
	string: string;
	number: string;
	atom: string; // 特殊标记，如时值
	function: string;
	tag: string;
	attribute: string;
	variable: string;
	bracket: string;
	// 背景/修饰
	atomBackground?: string;
	matchBackground?: string;
	selectionMatch?: string;
}

export interface EditorTheme {
	id: string;
	name: string;
	description?: string;
	variant: "light" | "dark" | "universal";
	colors: EditorHighlightColors;
	// CodeMirror 特定配置
	cmConfig?: {
		background: string;
		foreground: string;
		gutterBackground: string;
		gutterForeground: string;
		lineHighlight: string;
		selection: string;
		cursor: string;
	};
}

// ===== 组合主题 =====

export interface CombinedTheme {
	uiThemeId: string;
	editorThemeId: string;
}

// ===== 主题注册表 =====

export interface ThemeRegistry {
	uiThemes: Map<string, UITheme>;
	editorThemes: Map<string, EditorTheme>;
	// 默认组合（UI主题ID -> 推荐的编辑器主题ID）
	defaultCombinations: Map<string, string>;
}

// ===== 主题状态 =====

export interface ThemeState {
	// 当前激活的主题
	currentUITheme: string;
	currentEditorTheme: string;
	// 主题模式: light, dark, system
	themeMode: ThemeMode;
	// 用户保存的偏好
	savedPreference?: CombinedTheme;
}

// ===== 辅助类型 =====

export type ThemeMode = "light" | "dark" | "system";

export interface ThemePreview {
	id: string;
	name: string;
	previewColors: {
		light: { background: string; primary: string };
		dark: { background: string; primary: string };
	};
}
