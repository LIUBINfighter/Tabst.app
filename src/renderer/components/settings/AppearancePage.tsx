import { useTranslation } from "react-i18next";
import { type Locale, supportedLocales } from "../../i18n";
import { useAppStore } from "../../store/appStore";
import { ThemeSelector } from "../theme";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "../ui/select";
import { EditorPreview } from "./EditorPreview";

export function AppearancePage() {
	const { t } = useTranslation("settings");
	const locale = useAppStore((s) => s.locale);
	const setLocale = useAppStore((s) => s.setLocale);

	return (
		<div className="space-y-6">
			<section className="bg-card border border-border rounded p-4 space-y-4">
				<div>
					<h3 className="text-sm font-medium mb-4">
						{t("appearanceSection.theme")}
					</h3>
					<ThemeSelector />
					<EditorPreview />
				</div>
			</section>

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
		</div>
	);
}
