import { useTranslation } from 'react-i18next';
import { useTheme } from '../../lib/theme-system/use-theme';
import {
	getAllUIThemes,
	getAllEditorThemes,
	getDefaultEditorThemeForUI,
	themeRegistry,
} from '../../lib/theme-system/theme-registry';
import { Button } from '../ui/button';
import { Switch } from '../ui/switch';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '../ui/select';

export function ThemeSelector() {
	const { t } = useTranslation(['settings']);
	const {
		uiTheme,
		editorTheme,
		followSystem,
		setUITheme,
		setEditorTheme,
		setFollowSystem,
		switchToVariant,
	} = useTheme();

	const uiThemes = getAllUIThemes();
	const editorThemes = getAllEditorThemes();

	const handleUIThemeChange = (themeId: string) => {
		setUITheme(themeId);
	};

	const handleEditorThemeChange = (themeId: string) => {
		setEditorTheme(themeId);
	};

	// 检查当前主题是否有对应变体
	const hasVariant = themeRegistry.getThemeVariant(uiTheme.id) !== null;
	const variantTheme = hasVariant ? getAllUIThemes().find(t => t.id === themeRegistry.getThemeVariant(uiTheme.id)) : null;

	const handleVariantSwitch = () => {
		const targetVariant = uiTheme.variant === 'light' ? 'dark' : 'light';
		switchToVariant(targetVariant);
	};

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h3 className="text-sm font-medium">
						{t('settings:appearance.followSystem')}
					</h3>
					<p className="text-xs text-muted-foreground mt-1">
						{t('settings:appearance.followSystemDescription')}
					</p>
				</div>
				<Switch
					checked={followSystem}
					onCheckedChange={setFollowSystem}
				/>
			</div>

			<div className="space-y-3">
				<label className="text-sm font-medium">
					{t('settings:appearance.uiTheme')}
				</label>
				<Select value={uiTheme.id} onValueChange={handleUIThemeChange}>
					<SelectTrigger className="w-full">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<div className="grid gap-1">
							{uiThemes.map((theme) => (
								<SelectItem key={theme.id} value={theme.id}>
									<div className="flex items-center gap-2">
										<span
											className="w-3 h-3 rounded-full"
											style={{
												background: `linear-gradient(135deg, ${theme.colors.primary} 50%, ${theme.colors.background} 50%)`,
											}}
										/>
										<span>{theme.name}</span>
										<span className="text-xs text-muted-foreground">
											({theme.variant === 'dark' ? 'Dark' : 'Light'})
										</span>
									</div>
								</SelectItem>
							))}
						</div>
					</SelectContent>
				</Select>
				{uiTheme.description && (
					<p className="text-xs text-muted-foreground">{uiTheme.description}</p>
				)}
				{hasVariant && variantTheme && (
					<Button
						variant="outline"
						size="sm"
						onClick={handleVariantSwitch}
						className="w-full mt-2"
					>
						切换到 {variantTheme.name}
					</Button>
				)}
			</div>

			<div className="space-y-3">
				<label className="text-sm font-medium">
					{t('settings:appearance.editorTheme')}
				</label>
				<Select value={editorTheme.id} onValueChange={handleEditorThemeChange}>
					<SelectTrigger className="w-full">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
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
				{editorTheme.description && (
					<p className="text-xs text-muted-foreground">
						{editorTheme.description}
					</p>
				)}
			</div>

			<div className="rounded-lg border p-4 bg-muted/30">
				<h4 className="text-sm font-medium mb-2">
					{t('settings:appearance.preview')}
				</h4>
				<div className="space-y-2">
					<div className="flex items-center gap-2 text-sm">
						<span className="text-muted-foreground">UI:</span>
						<span className="font-medium">{uiTheme.name}</span>
					</div>
					<div className="flex items-center gap-2 text-sm">
						<span className="text-muted-foreground">Editor:</span>
						<span className="font-medium">{editorTheme.name}</span>
					</div>
				</div>
			</div>
		</div>
	);
}
