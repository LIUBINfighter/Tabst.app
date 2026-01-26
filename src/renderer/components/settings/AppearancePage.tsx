import { useTranslation } from "react-i18next";
import { type Locale, supportedLocales } from "../../i18n";
import { useAppStore } from "../../store/appStore";
import { Button } from "../ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "../ui/select";

export function AppearancePage() {
	const { t } = useTranslation("settings");
	const locale = useAppStore((s) => s.locale);
	const setLocale = useAppStore((s) => s.setLocale);

	const toggleTheme = () => {
		const root = document.documentElement;
		root.classList.toggle("dark");
		try {
			localStorage.setItem(
				"theme",
				root.classList.contains("dark") ? "dark" : "light",
			);
		} catch {}
	};

	return (
		<section className="bg-card border border-border rounded p-4 space-y-4">
			<div>
				<h3 className="text-sm font-medium mb-2">
					{t("appearanceSection.title")}
				</h3>
				<div className="flex items-center gap-3">
					<Button
						type="button"
						variant="outline"
						onClick={toggleTheme}
						aria-label={t("appearanceSection.toggleTheme")}
					>
						{t("appearanceSection.toggleTheme")}
					</Button>
					<p className="text-xs text-muted-foreground">
						{t("appearanceSection.themeHint")}
					</p>
				</div>
			</div>

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
	);
}
