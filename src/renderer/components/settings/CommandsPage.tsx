import { useTranslation } from "react-i18next";
import { getGlobalCommands } from "../../lib/command-registry";
import { getCommandAvailability } from "../../lib/ui-command-registry";
import { useAppStore } from "../../store/appStore";
import { CheckboxToggle } from "../ui/checkbox-toggle";

export function CommandsPage() {
	const { t } = useTranslation("settings");
	const disabledCommandIds = useAppStore((s) => s.disabledCommandIds);
	const setCommandEnabled = useAppStore((s) => s.setCommandEnabled);
	const pinnedCommandIds = useAppStore((s) => s.pinnedCommandIds);
	const setCommandPinned = useAppStore((s) => s.setCommandPinned);
	const commandMruIds = useAppStore((s) => s.commandMruIds);

	const commands = getGlobalCommands().map((command) => ({
		...command,
		availability: getCommandAvailability(command.id),
	}));
	const pinnedCommands = commands.filter((command) =>
		pinnedCommandIds.includes(command.id),
	);

	return (
		<section className="bg-card border border-border rounded p-4 space-y-4">
			<div>
				<h3 className="text-sm font-medium mb-2">{t("commands")}</h3>
				<p className="text-xs text-muted-foreground">{t("commandsDesc")}</p>
				<p className="text-xs text-muted-foreground mt-1">
					{t("commandsPinnedHint")}
				</p>
			</div>

			<div className="border-t border-border pt-3">
				<div className="text-xs text-muted-foreground mb-2">
					{t("commandsPinned")}
				</div>
				{pinnedCommands.length > 0 ? (
					<div className="flex flex-wrap gap-1.5">
						{pinnedCommands.map((command) => (
							<span
								key={`pinned-${command.id}`}
								className="text-[11px] rounded border border-sky-500/40 text-sky-600 px-1.5 py-0.5"
							>
								{command.label}
							</span>
						))}
					</div>
				) : (
					<div className="text-[11px] text-muted-foreground/80">
						{t("commandsPinnedNone")}
					</div>
				)}
			</div>

			<div className="space-y-2">
				{commands.map((command) => {
					const enabled = !disabledCommandIds.includes(command.id);
					const pinned = pinnedCommandIds.includes(command.id);
					const mruIndex = commandMruIds.indexOf(command.id);
					return (
						<div
							key={command.id}
							className="bg-card border border-border rounded-md px-3 py-2 hover:bg-accent/40 transition-colors"
						>
							<div className="flex items-center gap-3">
								<div className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground shrink-0">
									<CheckboxToggle
										checked={enabled}
										onCheckedChange={(value) =>
											setCommandEnabled(command.id, value)
										}
										aria-label={command.label}
									/>
									<span>{t("commandsEnable")}</span>
								</div>
								<div className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground shrink-0">
									<CheckboxToggle
										checked={pinned}
										onCheckedChange={(value) =>
											setCommandPinned(command.id, value)
										}
										aria-label={`${command.label} ${t("commandsPinTop")}`}
									/>
									<span>{t("commandsPinTop")}</span>
								</div>
								<div className="flex-1 min-w-0 flex items-center gap-2 text-xs">
									<h4 className="text-sm font-medium shrink-0">
										{command.label}
									</h4>
									{pinned ? (
										<span className="text-[10px] uppercase tracking-wide rounded border border-sky-500/40 text-sky-600 px-1.5 py-0.5">
											{t("commandsPinned")}
										</span>
									) : null}
									<p className="text-xs text-muted-foreground truncate">
										{command.description}
										{command.availability.reason
											? ` · ${command.availability.reason}`
											: ""}
									</p>
									<p className="text-[11px] text-muted-foreground/80 font-mono truncate">
										{command.id}
									</p>
									{mruIndex >= 0 ? (
										<p className="text-[11px] text-muted-foreground/80 shrink-0">
											{t("commandsRecentRank", { rank: mruIndex + 1 })}
										</p>
									) : null}
								</div>
							</div>
						</div>
					);
				})}
			</div>
		</section>
	);
}
