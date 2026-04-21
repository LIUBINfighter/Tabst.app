import { useTranslation } from "react-i18next";
import { type Locale, supportedLocales } from "../../i18n";
import {
	BUILT_IN_FONT_OPTIONS,
	BUILT_IN_SOUNDFONT_OPTIONS,
	getBuiltInFontByUrl,
	getBuiltInSoundFontByUrl,
} from "../../lib/resource-asset-catalog";
import { useAppStore } from "../../store/appStore";
import { ThemeSelector } from "../theme";
import { TutorialAlphaTexPlayground } from "../tutorial/TutorialAlphaTexPlayground";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "../ui/select";

const APPEARANCE_PREVIEW_CONTENT = `\\title "Theme and Playback Preview"
\\subtitle "Built-in Font + Soundfont"
\\tempo 95
\\track "Guitar"
  \\instrument acousticguitarsteel
  \\tuning E4 B3 G3 D3 A2 E2
  0.6 2.5 2.4 0.4 | 3.5 2.5 0.5 2.4 |
  (0.4 2.4 2.3) 0.4 | 3.5 2.5 0.5 2.4
`;

export function AppearancePage() {
	const { t } = useTranslation("settings");
	const locale = useAppStore((s) => s.locale);
	const setLocale = useAppStore((s) => s.setLocale);
	const resourceAssetOverrides = useAppStore((s) => s.resourceAssetOverrides);
	const setResourceAssetOverrides = useAppStore(
		(s) => s.setResourceAssetOverrides,
	);
	const playerControls = useAppStore((s) => s.playerControls);

	const selectedFontId =
		getBuiltInFontByUrl(resourceAssetOverrides.bravuraFontUrl)?.id ??
		BUILT_IN_FONT_OPTIONS[0].id;
	const selectedSoundFontId =
		getBuiltInSoundFontByUrl(resourceAssetOverrides.soundFontUrl)?.id ??
		BUILT_IN_SOUNDFONT_OPTIONS[0].id;

	return (
		<div className="space-y-6">
			<section className="bg-card border border-border rounded p-4 space-y-4">
				<div>
					<h3 className="text-sm font-medium mb-2">
						{t("appearanceSection.language")}
					</h3>
					<p className="text-xs text-muted-foreground mb-2">
						{t("appearanceSection.languageHint")}
					</p>
					<Select value={locale} onValueChange={(v) => setLocale(v as Locale)}>
						<SelectTrigger className="w-48">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{supportedLocales.map((l) => (
								<SelectItem key={l} value={l}>
									{l === "en"
										? t("appearanceSection.languageEn")
										: t("appearanceSection.languageZh")}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
			</section>

			<section className="bg-card border border-border rounded p-4 space-y-4">
				<div>
					<h3 className="text-sm font-medium mb-4">
						{t("appearanceSection.theme")}
					</h3>
					<ThemeSelector />
					<TutorialAlphaTexPlayground
						initialContent={APPEARANCE_PREVIEW_CONTENT}
						fileName="appearance-preview.atex"
					/>
				</div>
			</section>

			<section className="bg-card border border-border rounded p-4 space-y-4">
				<div>
					<h3 className="text-sm font-medium mb-2">
						{t("appearanceSection.resourceAssets")}
					</h3>
					<p className="text-xs text-muted-foreground mb-3">
						{t("appearanceSection.resourceAssetsHint")}
					</p>
					<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
						<div>
							<p className="text-xs text-muted-foreground mb-1.5">
								{t("appearanceSection.builtInFont")}
							</p>
							<Select
								value={selectedFontId}
								onValueChange={(nextId) => {
									const selected = BUILT_IN_FONT_OPTIONS.find(
										(option) => option.id === nextId,
									);
									if (!selected) return;
									setResourceAssetOverrides({
										bravuraFontUrl: selected.relativeUrl,
									});
									playerControls?.refresh?.();
								}}
							>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{BUILT_IN_FONT_OPTIONS.map((option) => (
										<SelectItem key={option.id} value={option.id}>
											{`${option.label} (${option.sizeLabel})`}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div>
							<p className="text-xs text-muted-foreground mb-1.5">
								{t("appearanceSection.builtInSoundFont")}
							</p>
							<Select
								value={selectedSoundFontId}
								onValueChange={(nextId) => {
									const selected = BUILT_IN_SOUNDFONT_OPTIONS.find(
										(option) => option.id === nextId,
									);
									if (!selected) return;
									setResourceAssetOverrides({
										soundFontUrl: selected.relativeUrl,
									});
									playerControls?.refresh?.();
								}}
							>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{BUILT_IN_SOUNDFONT_OPTIONS.map((option) => (
										<SelectItem key={option.id} value={option.id}>
											{`${option.label} (${option.sizeLabel})`}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					</div>
				</div>
			</section>
		</div>
	);
}
