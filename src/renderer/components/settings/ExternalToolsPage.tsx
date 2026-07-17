import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

type Status =
	| { kind: "idle"; message: string }
	| { kind: "success"; message: string }
	| { kind: "error"; message: string };

export function ExternalToolsPage() {
	const { t } = useTranslation("settings");
	const [executablePath, setExecutablePath] = useState("");
	const [busyAction, setBusyAction] = useState<"load" | "test" | "save" | null>(
		"load",
	);
	const [status, setStatus] = useState<Status>({
		kind: "idle",
		message: t("externalToolsSection.notValidated"),
	});

	const errorMessage = useCallback(
		(error?: string) => {
			const key = `externalToolsSection.errors.${error ?? "unknown"}`;
			const translated = t(key);
			return translated === key
				? error || t("externalToolsSection.errors.unknown")
				: translated;
		},
		[t],
	);

	useEffect(() => {
		let cancelled = false;
		void window.desktopAPI.loadMuseScoreSettings().then((result) => {
			if (cancelled) return;
			setBusyAction(null);
			if (!result.success) {
				setStatus({ kind: "error", message: errorMessage(result.error) });
				return;
			}
			setExecutablePath(result.executablePath ?? "");
			setStatus({
				kind: "idle",
				message: result.executablePath
					? t("externalToolsSection.savedNotValidated")
					: t("externalToolsSection.notConfigured"),
			});
		});
		return () => {
			cancelled = true;
		};
	}, [errorMessage, t]);

	const handleTest = async () => {
		setBusyAction("test");
		const result =
			await window.desktopAPI.validateMuseScoreExecutable(executablePath);
		setBusyAction(null);
		if (!result.success) {
			setStatus({ kind: "error", message: errorMessage(result.error) });
			return;
		}
		if (result.executablePath) setExecutablePath(result.executablePath);
		setStatus({
			kind: "success",
			message: result.version
				? t("externalToolsSection.validVersion", { version: result.version })
				: t("externalToolsSection.valid"),
		});
	};

	const handleSave = async () => {
		setBusyAction("save");
		const result = await window.desktopAPI.saveMuseScoreExecutablePath(
			executablePath.trim() || null,
		);
		setBusyAction(null);
		if (!result.success) {
			setStatus({ kind: "error", message: errorMessage(result.error) });
			return;
		}
		if (result.executablePath) setExecutablePath(result.executablePath);
		setStatus({
			kind: "success",
			message: result.executablePath
				? t("externalToolsSection.saved")
				: t("externalToolsSection.cleared"),
		});
	};

	const isBusy = busyAction !== null;

	return (
		<section className="bg-card border border-border rounded p-4 space-y-4">
			<div>
				<h3 className="text-sm font-medium">
					{t("externalToolsSection.museScoreTitle")}
				</h3>
				<p className="text-xs text-muted-foreground mt-1">
					{t("externalToolsSection.museScoreHint")}
				</p>
			</div>

			<div className="space-y-2">
				<label
					htmlFor="musescore-executable-path"
					className="text-xs font-medium"
				>
					{t("externalToolsSection.executablePath")}
				</label>
				<Input
					id="musescore-executable-path"
					value={executablePath}
					onChange={(event) => {
						setExecutablePath(event.target.value);
						setStatus({
							kind: "idle",
							message: t("externalToolsSection.notValidated"),
						});
					}}
					placeholder={t("externalToolsSection.pathPlaceholder")}
					disabled={isBusy}
					spellCheck={false}
				/>
			</div>

			<div className="flex flex-wrap gap-2">
				<Button
					type="button"
					variant="outline"
					onClick={() => void handleTest()}
					disabled={isBusy || !executablePath.trim()}
				>
					{busyAction === "test" && <Loader2 className="animate-spin" />}
					{t("externalToolsSection.test")}
				</Button>
				<Button
					type="button"
					onClick={() => void handleSave()}
					disabled={isBusy}
				>
					{busyAction === "save" && <Loader2 className="animate-spin" />}
					{t("externalToolsSection.save")}
				</Button>
				<Button
					type="button"
					variant="ghost"
					onClick={() => {
						setExecutablePath("");
						setStatus({
							kind: "idle",
							message: t("externalToolsSection.saveToClear"),
						});
					}}
					disabled={isBusy || !executablePath}
				>
					{t("externalToolsSection.clear")}
				</Button>
			</div>

			<div
				className={`flex items-start gap-2 rounded border p-3 text-xs ${
					status.kind === "success"
						? "border-emerald-500/40 text-emerald-600"
						: status.kind === "error"
							? "border-destructive/40 text-destructive"
							: "border-border text-muted-foreground"
				}`}
			>
				{busyAction === "load" ? (
					<Loader2 className="h-4 w-4 shrink-0 animate-spin" />
				) : status.kind === "success" ? (
					<CheckCircle2 className="h-4 w-4 shrink-0" />
				) : status.kind === "error" ? (
					<XCircle className="h-4 w-4 shrink-0" />
				) : null}
				<span>{status.message}</span>
			</div>

			<p className="text-xs text-muted-foreground">
				{t("externalToolsSection.licenseHint")}
			</p>
		</section>
	);
}
