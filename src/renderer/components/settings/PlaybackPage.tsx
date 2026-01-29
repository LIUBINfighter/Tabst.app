import { useTranslation } from "react-i18next";

export function PlaybackPage() {
	const { t } = useTranslation("settings");
	return (
		<section className="bg-card border border-border rounded p-4">
			<h3 className="text-sm font-medium mb-2">{t("playback")}</h3>
			<div className="flex items-center gap-3">
				<p className="text-xs text-muted-foreground">
					{t("playbackPlaceholder")}
				</p>
			</div>
		</section>
	);
}
