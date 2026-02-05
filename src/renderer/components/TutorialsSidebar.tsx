import { FileText } from "lucide-react";
import { useEffect } from "react";
import { getReleasedTutorials } from "../lib/tutorial-loader";
import { useAppStore } from "../store/appStore";

export function TutorialsSidebar() {
	const tutorials = getReleasedTutorials();

	const activeTutorialId = useAppStore((s) => s.activeTutorialId);
	const setActiveTutorialId = useAppStore((s) => s.setActiveTutorialId);
	const setWorkspaceMode = useAppStore((s) => s.setWorkspaceMode);

	useEffect(() => {
		// Initialize to first tutorial if none selected
		if (!activeTutorialId && tutorials.length > 0) {
			setActiveTutorialId(tutorials[0].id);
		}
	}, [activeTutorialId, setActiveTutorialId, tutorials]);

	return (
		<div>
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
						{t.title}
					</div>
				</button>
			))}
		</div>
	);
}
