import { useEffect, useMemo, useState } from "react";
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
						setMessage("正在检查更新...");
						setVisible(true);
						break;
					case "available":
						setStatus("available");
						setVersion(event.version ?? null);
						setMessage("发现新版本，准备下载...");
						setVisible(true);
						break;
					case "progress":
						setStatus("downloading");
						setProgress(event.percent ?? 0);
						setMessage("更新下载中...");
						setVisible(true);
						break;
					case "downloaded":
						setStatus("downloaded");
						setVersion(event.version ?? null);
						setMessage("更新已下载完成");
						setVisible(true);
						break;
					case "not-available":
						setStatus("not-available");
						setMessage("当前已是最新版本");
						setVisible(true);
						break;
					case "error":
						setStatus("error");
						setMessage(event.message ?? "更新失败，请稍后重试");
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
	}, []);

	const canDismiss = useMemo(
		() => status !== "downloading" && status !== "checking",
		[status],
	);

	if (!visible) return null;

	return (
		<div className="fixed bottom-4 right-4 z-50 w-80 rounded-lg border border-border bg-card p-4 shadow-lg">
			<div className="flex items-start justify-between gap-3">
				<div className="space-y-1">
					<p className="text-sm font-medium">更新提示</p>
					<p className="text-xs text-muted-foreground">
						{version ? `版本：${version}` : ""}
					</p>
				</div>
				{canDismiss && (
					<Button variant="ghost" size="sm" onClick={() => setVisible(false)}>
						关闭
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
					正在准备下载更新，请稍候…
				</div>
			)}

			{status === "downloaded" && (
				<div className="mt-4 flex items-center gap-2">
					<Button
						onClick={() => {
							window.electronAPI.installUpdate();
						}}
					>
						安装并重启
					</Button>
					<Button variant="secondary" onClick={() => setVisible(false)}>
						稍后
					</Button>
				</div>
			)}

			{status === "not-available" && (
				<div className="mt-3 text-xs text-muted-foreground">
					如果刚发布新版本，请稍等后再检查。
				</div>
			)}

			{status === "error" && (
				<div className="mt-3 text-xs text-destructive">{message}</div>
			)}
		</div>
	);
}
