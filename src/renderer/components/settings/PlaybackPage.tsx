import { useTranslation } from "react-i18next";
import { useAppStore } from "../../store/appStore";
import { Switch } from "../ui/switch";

export function PlaybackPage() {
	const { t } = useTranslation("settings");
	const enableSyncScroll = useAppStore((s) => s.enableSyncScroll);
	const setEnableSyncScroll = useAppStore((s) => s.setEnableSyncScroll);
	const enableCursorBroadcast = useAppStore((s) => s.enableCursorBroadcast);
	const setEnableCursorBroadcast = useAppStore((s) => s.setEnableCursorBroadcast);

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

			<div>
				<h3 className="text-sm font-medium mb-2">
					{t("playbackSection.enableSyncScroll")}
				</h3>
				<div className="flex items-center gap-3">
					<Switch
						checked={enableSyncScroll}
						onCheckedChange={setEnableSyncScroll}
					/>
					<p className="text-xs text-muted-foreground">
						{t("playbackSection.syncScrollHint")}
					</p>
				</div>
			</div>

			<div>
				<h3 className="text-sm font-medium mb-2">
					{t("playbackSection.enableCursorBroadcast")}
				</h3>
				<div className="flex items-center gap-3">
					<Switch
						checked={enableCursorBroadcast}
						onCheckedChange={setEnableCursorBroadcast}
					/>
					<p className="text-xs text-muted-foreground">
						{t("playbackSection.cursorBroadcastHint")}
					</p>
				</div>
			</div>
		</section>
	);
}
