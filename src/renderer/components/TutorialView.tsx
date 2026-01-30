import { ChevronLeft, ChevronRight, FileText, X } from "lucide-react";
import type { MDXModule } from "mdx/types";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
	getNextTutorial,
	getPrevTutorial,
	getTutorialMetadata,
	loadTutorial,
	loadTutorialComponent,
} from "../lib/tutorial-loader";
import { useAppStore } from "../store/appStore";
import TopBar from "./TopBar";
import { MDXRenderer } from "./tutorial/MDXRenderer";
import { TutorialRenderer } from "./tutorial/TutorialRenderer";
import IconButton from "./ui/icon-button";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "./ui/tooltip";

export interface TutorialViewProps {
	showExpandSidebar?: boolean;
	onExpandSidebar?: () => void;
	onCollapseSidebar?: () => void;
}

export default function TutorialView({
	showExpandSidebar,
	onExpandSidebar,
	onCollapseSidebar,
}: TutorialViewProps) {
	const { t } = useTranslation(["sidebar", "common"]);
	const setWorkspaceMode = useAppStore((s) => s.setWorkspaceMode);
	const activeTutorialId = useAppStore((s) => s.activeTutorialId);
	const setActiveTutorialId = useAppStore((s) => s.setActiveTutorialId);

	const [mdxModule, setMdxModule] = useState<MDXModule | null>(null);
	const [content, setContent] = useState<string>("");
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const metadata = activeTutorialId
		? getTutorialMetadata(activeTutorialId)
		: null;

	const prevTutorial = activeTutorialId
		? getPrevTutorial(activeTutorialId)
		: null;
	const nextTutorial = activeTutorialId
		? getNextTutorial(activeTutorialId)
		: null;

	// 加载教程内容（优先尝试 MDX，如果不存在则回退到 Markdown）
	useEffect(() => {
		if (!activeTutorialId) return;

		setLoading(true);
		setError(null);
		setMdxModule(null);
		setContent("");

		// 首先尝试加载 MDX
		loadTutorialComponent(activeTutorialId)
			.then((module) => {
				if (module) {
					setMdxModule(module);
					setLoading(false);
				} else {
					// MDX 不存在，回退到 Markdown
					return loadTutorial(activeTutorialId);
				}
			})
			.then((loadedContent) => {
				if (typeof loadedContent === "string") {
					setContent(loadedContent);
					setLoading(false);
				}
			})
			.catch((err) => {
				console.error("Failed to load tutorial:", err);
				setError(
					err instanceof Error ? err.message : t("common:loadTutorialFailed"),
				);
				setLoading(false);
			});
	}, [activeTutorialId, t]);

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
		<TooltipProvider delayDuration={200}>
			<div className="flex-1 flex flex-col min-h-0 overflow-hidden">
				<TopBar
					leading={
						showExpandSidebar
							? onExpandSidebar && (
									<div className="flex items-center gap-1">
										<Tooltip>
											<TooltipTrigger asChild>
												<IconButton onClick={onExpandSidebar}>
													<ChevronRight className="h-4 w-4" />
												</IconButton>
											</TooltipTrigger>
											<TooltipContent side="bottom">
												<p>{t("expandSidebar")}</p>
											</TooltipContent>
										</Tooltip>
									</div>
								)
							: onCollapseSidebar && (
									<div className="flex items-center gap-1">
										<Tooltip>
											<TooltipTrigger asChild>
												<IconButton onClick={onCollapseSidebar}>
													<ChevronLeft className="h-4 w-4" />
												</IconButton>
											</TooltipTrigger>
											<TooltipContent side="bottom">
												<p>{t("collapseSidebar")}</p>
											</TooltipContent>
										</Tooltip>
									</div>
								)
					}
					trailing={
						<div className="flex items-center gap-1">
							<Tooltip>
								<TooltipTrigger asChild>
									<IconButton
										destructive
										onClick={() => {
											setWorkspaceMode("editor");
											setActiveTutorialId(null);
										}}
									>
										<X className="h-4 w-4" />
									</IconButton>
								</TooltipTrigger>
								<TooltipContent side="bottom">
									<p>{t("common:close")}</p>
								</TooltipContent>
							</Tooltip>
						</div>
					}
					icon={
						<FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
					}
					title={t("tutorial")}
				/>

				<div className="flex-1 p-4 overflow-auto">
					{/* Content container: center with a generous max width to avoid right overflow */}
					<div className="mx-auto w-full max-w-[900px]">
						{loading && (
							<div className="flex items-center justify-center h-full">
								<p className="text-sm text-muted-foreground">
									{t("common:loading")}
								</p>
							</div>
						)}

						{error && (
							<div className="bg-destructive/10 border border-destructive rounded p-4">
								<p className="text-sm text-destructive">{error}</p>
							</div>
						)}

						{/* 如果加载了 MDX 模块，使用 MDX 渲染器 */}
						{!loading && !error && mdxModule && (
							<MDXRenderer module={mdxModule} />
						)}

						{/* 否则使用 Markdown 渲染器 */}
						{!loading && !error && !mdxModule && content && (
							<TutorialRenderer content={content} />
						)}

						{!loading && !error && !mdxModule && !content && metadata && (
							<div>
								<h2 className="text-lg font-semibold mb-2">{metadata.title}</h2>
								<p className="text-sm text-muted-foreground">教程内容为空</p>
							</div>
						)}
					</div>
				</div>
			</div>
		</TooltipProvider>
	);
}
