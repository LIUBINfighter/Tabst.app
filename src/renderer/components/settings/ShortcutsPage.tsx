import { Keyboard } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { getGlobalCommands } from "../../lib/command-registry";
import {
	formatShortcut,
	getEffectiveCommandShortcuts,
	getShortcutFromKeyboardEvent,
} from "../../lib/shortcut-utils";
import { useAppStore } from "../../store/appStore";
import { Button } from "../ui/button";

export function ShortcutsPage() {
	const { t } = useTranslation("settings");
	const commandShortcuts = useAppStore((s) => s.commandShortcuts);
	const setCommandShortcuts = useAppStore((s) => s.setCommandShortcuts);
	const resetCommandShortcuts = useAppStore((s) => s.resetCommandShortcuts);
	const [capturingCommandId, setCapturingCommandId] = useState<string | null>(
		null,
	);

	const commands = useMemo(() => getGlobalCommands(), []);

	const effectiveShortcuts = useMemo(
		() => getEffectiveCommandShortcuts(commandShortcuts),
		[commandShortcuts],
	);

	const conflictShortcutsByCommand = useMemo(() => {
		const ownersByShortcut = new Map<string, string[]>();
		for (const command of commands) {
			for (const shortcut of effectiveShortcuts[command.id]) {
				const owners = ownersByShortcut.get(shortcut) ?? [];
				ownersByShortcut.set(shortcut, [...owners, command.id]);
			}
		}

		const conflicts = new Map<string, string[]>();
		for (const [shortcut, owners] of ownersByShortcut) {
			if (owners.length < 2) continue;
			for (const ownerId of owners) {
				const existing = conflicts.get(ownerId) ?? [];
				conflicts.set(ownerId, [...existing, shortcut]);
			}
		}

		return conflicts;
	}, [commands, effectiveShortcuts]);

	useEffect(() => {
		if (!capturingCommandId) return;

		const handleCapture = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				event.preventDefault();
				event.stopPropagation();
				setCapturingCommandId(null);
				return;
			}

			const shortcut = getShortcutFromKeyboardEvent(event);
			if (!shortcut) return;

			event.preventDefault();
			event.stopPropagation();

			for (const command of commands) {
				if (command.id === capturingCommandId) continue;
				if (!effectiveShortcuts[command.id].includes(shortcut)) continue;

				const deduped = effectiveShortcuts[command.id].filter(
					(item) => item !== shortcut,
				);
				setCommandShortcuts(command.id, deduped);
			}

			setCommandShortcuts(capturingCommandId, [shortcut]);
			setCapturingCommandId(null);
		};

		window.addEventListener("keydown", handleCapture, true);
		return () => window.removeEventListener("keydown", handleCapture, true);
	}, [capturingCommandId, commands, effectiveShortcuts, setCommandShortcuts]);

	return (
		<section className="bg-card border border-border rounded p-4 space-y-4">
			<div>
				<h3 className="text-sm font-medium mb-2">{t("shortcuts")}</h3>
				<p className="text-xs text-muted-foreground">{t("shortcutsDesc")}</p>
				<p className="text-xs text-muted-foreground mt-1">
					{t("shortcutsCaptureHint")}
				</p>
			</div>

			<div className="space-y-2">
				{commands.map((command) => {
					const shortcuts = effectiveShortcuts[command.id];
					const hasCustomShortcut = Object.hasOwn(commandShortcuts, command.id);
					const isCapturing = capturingCommandId === command.id;
					const conflictShortcuts =
						conflictShortcutsByCommand.get(command.id) ?? [];

					return (
						<div
							key={command.id}
							className="bg-card border border-border rounded-md px-3 py-2 hover:bg-accent/40 transition-colors"
						>
							<div className="flex items-start gap-3">
								<div className="shrink-0 mt-0.5 text-muted-foreground">
									<Keyboard className="h-4 w-4" />
								</div>
								<div className="flex-1 min-w-0 space-y-1">
									<div className="flex flex-wrap items-center gap-2">
										<h4 className="text-sm font-medium">{command.label}</h4>
										<span className="text-[10px] uppercase tracking-wide rounded border border-border px-1.5 py-0.5 text-muted-foreground">
											{hasCustomShortcut
												? t("shortcutsCustom")
												: t("shortcutsDefault")}
										</span>
									</div>
									<p className="text-xs text-muted-foreground">
										{command.description}
									</p>
									<div className="flex flex-wrap items-center gap-1.5 pt-1">
										{shortcuts.length > 0 ? (
											shortcuts.map((shortcut) => (
												<span
													key={`${command.id}-${shortcut}`}
													className="rounded border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium"
												>
													{formatShortcut(shortcut)}
												</span>
											))
										) : (
											<span className="text-[11px] text-muted-foreground">
												{t("shortcutsNone")}
											</span>
										)}
									</div>
									{conflictShortcuts.length > 0 ? (
										<p className="text-[11px] text-amber-600">
											{t("shortcutsConflict")}:{" "}
											{conflictShortcuts.map(formatShortcut).join(", ")}
										</p>
									) : null}
									<p className="text-[11px] text-muted-foreground/80 font-mono truncate">
										{command.id}
									</p>
								</div>

								<div className="shrink-0 flex items-center gap-1">
									<Button
										type="button"
										variant={isCapturing ? "default" : "outline"}
										size="sm"
										onClick={() => setCapturingCommandId(command.id)}
									>
										{isCapturing
											? t("shortcutsListening")
											: shortcuts.length > 0
												? t("shortcutsChange")
												: t("shortcutsSet")}
									</Button>
									<Button
										type="button"
										variant="outline"
										size="sm"
										onClick={() => setCommandShortcuts(command.id, [])}
										disabled={shortcuts.length === 0}
									>
										{t("shortcutsClear")}
									</Button>
									<Button
										type="button"
										variant="outline"
										size="sm"
										onClick={() => resetCommandShortcuts(command.id)}
										disabled={!hasCustomShortcut}
									>
										{t("shortcutsReset")}
									</Button>
								</div>
							</div>
						</div>
					);
				})}
			</div>
		</section>
	);
}
