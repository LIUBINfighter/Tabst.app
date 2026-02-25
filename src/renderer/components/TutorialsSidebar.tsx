import { FileText } from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
	getReleasedTutorialsByAudience,
	getTutorialDisplayTitle,
	type TutorialAudience,
} from "../lib/tutorial-loader";
import { useAppStore } from "../store/appStore";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "./ui/select";

export function TutorialsSidebar() {
	const { t } = useTranslation(["common"]);
	const tutorialAudience = useAppStore((s) => s.tutorialAudience);
	const setTutorialAudience = useAppStore((s) => s.setTutorialAudience);
	const tutorials = getReleasedTutorialsByAudience(tutorialAudience);

	const activeTutorialId = useAppStore((s) => s.activeTutorialId);
	const setActiveTutorialId = useAppStore((s) => s.setActiveTutorialId);
	const setWorkspaceMode = useAppStore((s) => s.setWorkspaceMode);

	useEffect(() => {
		// Initialize to first tutorial if none selected
		if (!activeTutorialId && tutorials.length > 0) {
			setActiveTutorialId(tutorials[0].id);
			return;
		}
		if (activeTutorialId && !tutorials.some((t) => t.id === activeTutorialId)) {
			setActiveTutorialId(tutorials[0]?.id ?? null);
		}
	}, [activeTutorialId, setActiveTutorialId, tutorials]);

	const audienceLabels: Record<TutorialAudience, string> = {
		user: t("common:user", { defaultValue: "User" }),
		"power-user": t("common:powerUser", { defaultValue: "PowerUser" }),
		developer: t("common:developer", { defaultValue: "Developer" }),
	};

	return (
		<div>
			<div className="px-3 pb-2">
				<Select
					value={tutorialAudience}
					onValueChange={(v) => setTutorialAudience(v as TutorialAudience)}
				>
					<SelectTrigger className="h-7 text-xs">
						<SelectValue />
					</SelectTrigger>
					<SelectContent side="bottom" align="start">
						{(["user", "power-user", "developer"] as TutorialAudience[]).map(
							(level) => (
								<SelectItem key={level} value={level} className="text-xs">
									{audienceLabels[level]}
								</SelectItem>
							),
						)}
					</SelectContent>
				</Select>
			</div>
			{tutorials.map((t) => (
				<button
					key={t.id}
					type="button"
					onClick={() => {
						setActiveTutorialId(t.id);
						setWorkspaceMode("tutorial");
					}}
					className={`w-full group flex items-center gap-2 px-3 py-1.5 cursor-pointer text-xs transition-colors text-left ${
						activeTutorialId === t.id
							? "bg-[var(--highlight-bg)] text-[var(--highlight-text)]"
							: "hover:bg-[var(--hover-bg)] hover:text-[var(--hover-text)] text-muted-foreground"
					}`}
				>
					<FileText
						className={`flex-none h-3.5 w-3.5 ${
							activeTutorialId === t.id
								? "text-[var(--highlight-text)]"
								: "text-muted-foreground hover:text-[var(--hover-text)]"
						}`}
					/>
					<div className="flex-auto min-w-0 h-6 leading-none flex items-center truncate">
						{getTutorialDisplayTitle(t)}
					</div>
				</button>
			))}
		</div>
	);
}
