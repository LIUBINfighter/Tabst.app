import { useTranslation } from "react-i18next";
import { useAppStore } from "../../store/appStore";
import { CheckboxToggle } from "../ui/checkbox-toggle";
import { PlayerConfigurator } from "../ui/player-configurator";

export function PlaybackPage() {
	const { t } = useTranslation("settings");
	const enableSyncScroll = useAppStore((s) => s.enableSyncScroll);
	const setEnableSyncScroll = useAppStore((s) => s.setEnableSyncScroll);
	const enableCursorBroadcast = useAppStore((s) => s.enableCursorBroadcast);
	const setEnableCursorBroadcast = useAppStore(
		(s) => s.setEnableCursorBroadcast,
	);

	return (
		<section className="bg-card border border-border rounded p-4 space-y-4">
			<div>
				<h3 className="text-sm font-medium mb-2">{t("playback")}</h3>
				<div className="flex items-center gap-3">
					<p className="text-xs text-muted-foreground">
						{t("playbackPlaceholder")}
					</p>
				</div>
			</div>

			<div
				className="bg-card border border-border rounded-lg p-3 hover:bg-accent/50 transition-colors cursor-pointer"
				onClick={() => setEnableSyncScroll(!enableSyncScroll)}
				onKeyDown={(event) => {
					if (event.key === " " || event.key === "Enter") {
						event.preventDefault();
						setEnableSyncScroll(!enableSyncScroll);
					}
				}}
				role="button"
				tabIndex={0}
			>
				<div className="flex items-center gap-3">
					<CheckboxToggle
						checked={enableSyncScroll}
						onCheckedChange={setEnableSyncScroll}
						aria-label={t("playbackSection.enableSyncScroll")}
					/>
					<div className="flex-1 min-w-0">
						<h4 className="text-sm font-medium">
							{t("playbackSection.enableSyncScroll")}
						</h4>
						<p className="text-xs text-muted-foreground mt-1">
							{t("playbackSection.syncScrollHint")}
						</p>
					</div>
				</div>
			</div>

			<div
				className="bg-card border border-border rounded-lg p-3 hover:bg-accent/50 transition-colors cursor-pointer"
				onClick={() => setEnableCursorBroadcast(!enableCursorBroadcast)}
				onKeyDown={(event) => {
					if (event.key === " " || event.key === "Enter") {
						event.preventDefault();
						setEnableCursorBroadcast(!enableCursorBroadcast);
					}
				}}
				role="button"
				tabIndex={0}
			>
				<div className="flex items-center gap-3">
					<CheckboxToggle
						checked={enableCursorBroadcast}
						onCheckedChange={setEnableCursorBroadcast}
						aria-label={t("playbackSection.enableCursorBroadcast")}
					/>
					<div className="flex-1 min-w-0">
						<h4 className="text-sm font-medium">
							{t("playbackSection.enableCursorBroadcast")}
						</h4>
						<p className="text-xs text-muted-foreground mt-1">
							{t("playbackSection.cursorBroadcastHint")}
						</p>
					</div>
				</div>
			</div>

			<div>
				<h3 className="text-sm font-medium mb-3">
					{t("playbackSection.customPlayer")}
				</h3>
				<p className="text-xs text-muted-foreground mb-4">
					{t("playbackSection.customPlayerHint")}
				</p>
				<PlayerConfigurator />
			</div>
		</section>
	);
}
