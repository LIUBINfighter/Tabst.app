import { FileText } from "lucide-react";
import { useEffect } from "react";
import { useAppStore } from "../store/appStore";

export interface TutorialItem {
	id: string;
	title: string;
	description?: string;
}

export function TutorialsSidebar() {
	const defaultTutorials: TutorialItem[] = [
		{
			id: "getting-started",
			title: "快速开始",
			description: "从零开始了解基础使用",
		},
		{
			id: "editor-basics",
			title: "编辑器基础",
			description: "编辑器中常见操作",
		},
		{
			id: "alphaTex-guide",
			title: "AlphaTeX 教程",
			description: "AlphaTeX 专用语法介绍",
		},
	];

	const activeTutorialId = useAppStore((s) => s.activeTutorialId);
	const setActiveTutorialId = useAppStore((s) => s.setActiveTutorialId);
	const setWorkspaceMode = useAppStore((s) => s.setWorkspaceMode);

	useEffect(() => {
		// Initialize to first tutorial if none selected
		if (!activeTutorialId) {
			setActiveTutorialId(defaultTutorials[0].id);
		}
	}, [activeTutorialId, setActiveTutorialId]);

	return (
		<div className="py-1">
			{defaultTutorials.map((t) => (
				<button
					key={t.id}
					type="button"
					onClick={() => {
						setActiveTutorialId(t.id);
						setWorkspaceMode("tutorial");
					}}
					className={`w-full group flex items-center gap-2 px-3 py-1.5 cursor-pointer text-xs transition-colors text-left ${
						activeTutorialId === t.id
							? "bg-blue-500/20 text-blue-600"
							: "hover:bg-blue-500/20 hover:text-blue-600 text-muted-foreground"
					}`}
				>
					<FileText
						className={`flex-none h-3.5 w-3.5 ${
							activeTutorialId === t.id
								? "text-blue-600"
								: "text-muted-foreground hover:text-blue-600"
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
