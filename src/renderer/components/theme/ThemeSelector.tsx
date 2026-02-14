import { Monitor, Moon, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
	getAllEditorThemes,
	getAllUIThemes,
} from "../../lib/theme-system/theme-registry";
import type { ThemeMode } from "../../lib/theme-system/types";
import { useTheme } from "../../lib/theme-system/use-theme";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "../ui/select";

export function ThemeSelector() {
	const { t } = useTranslation(["settings"]);
	const {
		uiTheme,
		editorTheme,
		themeMode,
		setUITheme,
		setEditorTheme,
		setThemeMode,
	} = useTheme();

	const uiThemes = getAllUIThemes();
	const editorThemes = getAllEditorThemes();

	const handleUIThemeChange = (themeId: string) => {
		setUITheme(themeId);
	};

	const handleEditorThemeChange = (themeId: string) => {
		setEditorTheme(themeId);
	};

	const modeOptions: {
		value: ThemeMode;
		label: string;
		icon: React.ReactNode;
	}[] = [
		{
			value: "light",
			label: t("light"),
			icon: <Sun className="h-4 w-4" />,
		},
		{
			value: "dark",
			label: t("dark"),
			icon: <Moon className="h-4 w-4" />,
		},
		{
			value: "system",
			label: t("system"),
			icon: <Monitor className="h-4 w-4" />,
		},
	];

	return (
		<div className="space-y-6">
			{/* Theme Mode Selection */}
			<div className="space-y-3">
				<h4 className="text-sm font-medium">{t("themeMode")}</h4>
				<div className="flex gap-2">
					{modeOptions.map((option) => (
						<button
							key={option.value}
							type="button"
							onClick={() => setThemeMode(option.value)}
							className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs transition-colors ${
								themeMode === option.value
									? "bg-[var(--highlight-bg)] text-[var(--highlight-text)] border border-[var(--highlight-text)]"
									: "bg-muted hover:bg-[var(--hover-bg)] hover:text-[var(--hover-text)] border border-transparent"
							}`}
						>
							{option.icon}
							<span>{option.label}</span>
						</button>
					))}
				</div>
			</div>

			<div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
				{/* UI Theme Selection */}
				<div className="space-y-3">
					<label htmlFor="ui-theme-select" className="text-sm font-medium">
						{t("appearanceSection.uiTheme")}
					</label>
					<Select value={uiTheme.id} onValueChange={handleUIThemeChange}>
						<SelectTrigger id="ui-theme-select" className="w-full">
							<SelectValue />
						</SelectTrigger>
						<SelectContent className="w-[260px]">
							<div className="grid gap-1">
								{uiThemes.map((theme) => (
									<SelectItem key={theme.id} value={theme.id}>
										<div className="flex items-center gap-2">
											<div className="flex -space-x-1">
												<span
													className="w-3 h-3 rounded-full border border-border"
													style={{
														background: `hsl(${theme.light.semantic.primary})`,
													}}
												/>
												<span
													className="w-3 h-3 rounded-full border border-border"
													style={{
														background: `hsl(${theme.dark.semantic.primary})`,
													}}
												/>
											</div>
											<span>{theme.name}</span>
										</div>
									</SelectItem>
								))}
							</div>
						</SelectContent>
					</Select>
					{uiTheme && (
						<p className="text-xs text-muted-foreground">
							{t(`uiThemes.${uiTheme.id}`)}
						</p>
					)}
				</div>

				{/* Editor Theme Selection */}
				<div className="space-y-3">
					<label htmlFor="editor-theme-select" className="text-sm font-medium">
						{t("appearanceSection.editorTheme")}
					</label>
					<Select
						value={editorTheme.id}
						onValueChange={handleEditorThemeChange}
					>
						<SelectTrigger id="editor-theme-select" className="w-full">
							<SelectValue />
						</SelectTrigger>
						<SelectContent className="w-[260px]">
							{editorThemes.map((theme) => (
								<SelectItem key={theme.id} value={theme.id}>
									<div className="flex items-center gap-2">
										<span
											className="w-3 h-3 rounded-full"
											style={{
												background: `linear-gradient(90deg, ${theme.colors.keyword} 25%, ${theme.colors.string} 25%, ${theme.colors.string} 50%, ${theme.colors.number} 50%, ${theme.colors.number} 75%, ${theme.colors.comment} 75%)`,
											}}
										/>
										<span>{theme.name}</span>
									</div>
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
			</div>
		</div>
	);
}
