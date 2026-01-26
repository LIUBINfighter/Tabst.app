import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "./ui/button";

interface UpdateEvent {
	type:
		| "checking"
		| "available"
		| "not-available"
		| "progress"
		| "downloaded"
		| "error";
	version?: string;
	releaseNotes?: string | null;
	percent?: number;
	transferred?: number;
	total?: number;
	message?: string;
}

type ToastStatus =
	| "idle"
	| "checking"
	| "available"
	| "downloading"
	| "downloaded"
	| "not-available"
	| "error";

export default function UpdateToast() {
	const { t } = useTranslation("updates");
	const [status, setStatus] = useState<ToastStatus>("idle");
	const [version, setVersion] = useState<string | null>(null);
	const [progress, setProgress] = useState(0);
	const [message, setMessage] = useState<string | null>(null);
	const [visible, setVisible] = useState(false);

	useEffect(() => {
		const unsubscribe = window.electronAPI?.onUpdateEvent(
			(event: UpdateEvent) => {
				switch (event.type) {
					case "checking":
						setStatus("checking");
						setMessage(t("toast.checking"));
						setVisible(true);
						break;
					case "available":
						setStatus("available");
						setVersion(event.version ?? null);
						setMessage(t("toast.availableMessage"));
						setVisible(true);
						break;
					case "progress":
						setStatus("downloading");
						setProgress(event.percent ?? 0);
						setMessage(t("toast.downloadingMessage"));
						setVisible(true);
						break;
					case "downloaded":
						setStatus("downloaded");
						setVersion(event.version ?? null);
						setMessage(t("toast.downloaded"));
						setVisible(true);
						break;
					case "not-available":
						setStatus("not-available");
						setMessage(t("toast.latest"));
						setVisible(true);
						break;
					case "error":
						setStatus("error");
						setMessage(event.message ?? t("toast.error"));
						setVisible(true);
						break;
					default:
						break;
				}
			},
		);

		return () => {
			if (typeof unsubscribe === "function") {
				unsubscribe();
			}
		};
	}, [t]);

	const canDismiss = useMemo(
		() => status !== "downloading" && status !== "checking",
		[status],
	);

	if (!visible) return null;

	return (
		<div className="fixed bottom-4 right-4 z-50 w-80 rounded-lg border border-border bg-card p-4 shadow-lg">
			<div className="flex items-start justify-between gap-3">
				<div className="space-y-1">
					<p className="text-sm font-medium">{t("toast.title")}</p>
					<p className="text-xs text-muted-foreground">
						{version ? t("toast.version", { version }) : ""}
					</p>
				</div>
				{canDismiss && (
					<Button variant="ghost" size="sm" onClick={() => setVisible(false)}>
						{t("toast.close")}
					</Button>
				)}
			</div>

			<div className="mt-2 text-sm">{message}</div>

			{status === "downloading" && (
				<div className="mt-3 space-y-2">
					<div className="h-2 w-full rounded bg-muted">
						<div
							className="h-2 rounded bg-primary transition-all"
							style={{ width: `${Math.min(progress, 100)}%` }}
						/>
					</div>
					<div className="text-xs text-muted-foreground">
						{progress.toFixed(1)}%
					</div>
				</div>
			)}

			{status === "available" && (
				<div className="mt-3 text-xs text-muted-foreground">
					{t("toast.preparing")}
				</div>
			)}

			{status === "downloaded" && (
				<div className="mt-4 flex items-center gap-2">
					<Button
						onClick={() => {
							window.electronAPI.installUpdate();
						}}
					>
						{t("toast.installRestart")}
					</Button>
					<Button variant="secondary" onClick={() => setVisible(false)}>
						{t("toast.later")}
					</Button>
				</div>
			)}

			{status === "not-available" && (
				<div className="mt-3 text-xs text-muted-foreground">
					{t("toast.waitHint")}
				</div>
			)}

			{status === "error" && (
				<div className="mt-3 text-xs text-destructive">{message}</div>
			)}
		</div>
	);
}
