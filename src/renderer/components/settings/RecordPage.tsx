import { useTranslation } from "react-i18next";
import { useAppStore } from "../../store/appStore";
import { Switch } from "../ui/switch";

export function RecordPage() {
	const { t } = useTranslation("settings");
	const showButtonTooltips = useAppStore((state) => state.showButtonTooltips);
	const setShowButtonTooltips = useAppStore(
		(state) => state.setShowButtonTooltips,
	);
	const label = t("recordSection.showButtonTooltips");

	return (
		<section className="bg-card border border-border rounded p-4">
			<div className="flex items-center justify-between gap-6 rounded-lg border border-border p-3">
				<div className="min-w-0">
					<label
						htmlFor="show-button-tooltips"
						className="text-sm font-medium cursor-pointer"
					>
						{label}
					</label>
					<p className="text-xs text-muted-foreground mt-1">
						{t("recordSection.showButtonTooltipsHint")}
					</p>
				</div>
				<Switch
					id="show-button-tooltips"
					checked={showButtonTooltips}
					onCheckedChange={setShowButtonTooltips}
					aria-label={label}
				/>
			</div>
		</section>
	);
}
