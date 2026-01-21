import { ChevronLeft, FileText } from "lucide-react";
import { useEffect } from "react";
import { useAppStore } from "../store/appStore";
import TopBar from "./TopBar";
import IconButton from "./ui/icon-button";

export const defaultTutorials = [
	{
		id: "getting-started",
		title: "快速开始",
		content:
			"欢迎使用 Tabst！这是一个示例教程页面。这里可以放入多步引导、视频或示例文档。",
	},
	{
		id: "editor-basics",
		title: "编辑器基础",
		content:
			"编辑器支持基本的编辑操作、撤销/重做、自动保存等（示例占位文本）。",
	},
	{
		id: "alphaTex-guide",
		title: "AlphaTeX 教程",
		content:
			"AlphaTeX 是用于表示乐谱的标记语言。在这里可以展示语法高亮与示例。",
	},
];

export default function TutorialView() {
	const setWorkspaceMode = useAppStore((s) => s.setWorkspaceMode);
	const activeTutorialId = useAppStore((s) => s.activeTutorialId);
	const setActiveTutorialId = useAppStore((s) => s.setActiveTutorialId);

	const cur =
		defaultTutorials.find((t) => t.id === activeTutorialId) ??
		defaultTutorials[0];

	// 计算前一页和后一页
	const currentIndex = defaultTutorials.findIndex(
		(t) => t.id === activeTutorialId,
	);
	const prevTutorial =
		currentIndex > 0 ? defaultTutorials[currentIndex - 1] : null;
	const nextTutorial =
		currentIndex >= 0 && currentIndex < defaultTutorials.length - 1
			? defaultTutorials[currentIndex + 1]
			: null;

	// 键盘快捷键：ESC 返回编辑器，左右箭头键翻页
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				setWorkspaceMode("editor");
			} else if (e.key === "ArrowLeft" && prevTutorial) {
				e.preventDefault();
				setActiveTutorialId(prevTutorial.id);
			} else if (e.key === "ArrowRight" && nextTutorial) {
				e.preventDefault();
				setActiveTutorialId(nextTutorial.id);
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [setWorkspaceMode, setActiveTutorialId, prevTutorial, nextTutorial]);

	return (
		<div className="flex-1 flex flex-col min-h-0 overflow-hidden">
			<TopBar
				leading={
					<IconButton
						onClick={() => setWorkspaceMode("editor")}
						title="返回编辑器"
					>
						<ChevronLeft className="h-4 w-4" />
					</IconButton>
				}
				icon={
					<FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
				}
				title="教程"
			/>

			<div className="flex-1 p-4 overflow-auto">
				{/* 左侧：教程列表 */}

				{/* 教程内容 */}

				<h2 className="text-lg font-semibold mb-2">{cur.title}</h2>
				<p className="text-sm text-muted-foreground mb-4">{cur.content}</p>
				<div className="bg-card border border-border p-3 rounded">
					<p className="text-xs text-muted-foreground">
						这里可以放更多的步骤、图片或嵌入的示例。当前为占位内容，方便你查看布局效果。
					</p>
				</div>
			</div>
		</div>
	);
}
