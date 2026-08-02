import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAppStore } from "../store/appStore";
import { Button } from "./ui/button";

/**
 * 音频输出异常提示：睡眠后 WKWebView 音频子系统失效（页面内无法恢复），
 * 提示用户通过重启应用恢复播放。
 */
export function AudioRecoveryToast() {
	const { t } = useTranslation("audio");
	const [restarting, setRestarting] = useState(false);
	const noticeAt = useAppStore((s) => s.audioStalledNoticeAt);
	const setAudioStalledNoticeAt = useAppStore((s) => s.setAudioStalledNoticeAt);

	if (noticeAt === null) return null;

	const handleRestart = async () => {
		if (restarting) return;
		setRestarting(true);
		try {
			const result = await window.desktopAPI.restartApp();
			if (!result.success) {
				setRestarting(false);
			}
		} catch {
			setRestarting(false);
		}
	};

	return (
		<div className="fixed bottom-4 right-4 z-50 w-80 rounded-lg border border-border bg-card p-4 shadow-lg">
			<div className="flex items-start justify-between gap-3">
				<div className="space-y-1">
					<p className="text-sm font-medium">{t("recoveryToast.title")}</p>
				</div>
				<Button
					variant="ghost"
					size="sm"
					onClick={() => setAudioStalledNoticeAt(null)}
				>
					{t("recoveryToast.dismiss")}
				</Button>
			</div>

			<div className="mt-2 text-sm">{t("recoveryToast.message")}</div>

			<div className="mt-4 flex items-center gap-2">
				<Button onClick={() => void handleRestart()} disabled={restarting}>
					{t("recoveryToast.restart")}
				</Button>
			</div>
		</div>
	);
}
