import {
	ChevronLeft,
	Edit,
	FileDown,
	FileMusic,
	FileQuestion,
	FileText,
	FolderOpen,
	Moon,
	Settings,
	Sun,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { type FileItem, useAppStore } from "../store/appStore";
import { SettingsSidebar } from "./SettingsSidebar";
import { TutorialsSidebar } from "./TutorialsSidebar";
import { Button } from "./ui/button";
import IconButton from "./ui/icon-button";
import { ScrollArea } from "./ui/scroll-area";
// Separator import removed - toolbar now includes border
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "./ui/tooltip";

export interface SidebarProps {
	onCollapse?: () => void;
}

// 支持的文件扩展名
const ALLOWED_EXTENSIONS = [".md", ".atex"];

export function Sidebar({ onCollapse }: SidebarProps) {
	const { t } = useTranslation("sidebar");
	const files = useAppStore((s) => s.files);
	const activeFileId = useAppStore((s) => s.activeFileId);
	const addFile = useAppStore((s) => s.addFile);
	// keep removeFile in app state if other components later use it
	const _renameFile = useAppStore((s) => s.renameFile);
	const setActiveFile = useAppStore((s) => s.setActiveFile);

	// 打开文件浏览器
	const handleOpenFile = async () => {
		try {
			const result = await window.electronAPI.openFile(ALLOWED_EXTENSIONS);
			if (result) {
				const file: FileItem = {
					id: crypto.randomUUID(),
					name: result.name,
					path: result.path,
					content: result.content,
				};
				addFile(file);
			}
		} catch (error) {
			console.error("打开文件失败:", error);
		}
	};

	// 新建不同类型的文件 (.atex / .md)
	const handleNewFileWithExt = async (ext: string) => {
		try {
			const result = await window.electronAPI.createFile(ext);
			if (result) {
				const file: FileItem = {
					id: crypto.randomUUID(),
					name: result.name,
					path: result.path,
					content: result.content,
				};
				addFile(file);
			}
		} catch (error) {
			console.error("创建文件失败:", error);
		}
	};

	// 重命名文件（在列表中，更新文件名）
	const [editingId, setEditingId] = useState<string | null>(null);
	const [renameValue, setRenameValue] = useState<string>("");
	const [renameExt, setRenameExt] = useState<string>("");
	const inputRef = useRef<HTMLInputElement | null>(null);
	const workspaceMode = useAppStore((s) => s.workspaceMode);
	const setWorkspaceMode = useAppStore((s) => s.setWorkspaceMode);
	const setActiveTutorialId = useAppStore((s) => s.setActiveTutorialId);

	const splitName = (name: string) => {
		const idx = name.lastIndexOf(".");
		if (idx > 0) return { base: name.slice(0, idx), ext: name.slice(idx + 1) };
		return { base: name, ext: "" };
	};

	const handleRenameClick = (e: React.MouseEvent, f: FileItem) => {
		e.stopPropagation();
		setEditingId(f.id);
		const { base, ext } = splitName(f.name);
		setRenameValue(base);
		setRenameExt(ext);
		// focus will be done after render
	};

	const handleRenameCancel = (e?: React.KeyboardEvent | React.FocusEvent) => {
		if (e && "key" in e && e.key === "Escape") {
			// stop propagation if key event
			e.stopPropagation();
		}
		setEditingId(null);
		setRenameValue("");
		setRenameExt("");
	};

	const handleRenameSubmit = async (id: string) => {
		if (!renameValue?.trim()) return handleRenameCancel();
		// only replace base name, keep original extension
		const finalName = renameExt
			? `${renameValue.trim()}.${renameExt}`
			: `${renameValue.trim()}`;
		if (!finalName) return;
		const ok = await useAppStore.getState().renameFile(id, finalName);
		if (!ok) {
			console.error("failed to rename file");
			return; // keep editing
		}
		setEditingId(null);
		setRenameExt("");
	};

	useEffect(() => {
		if (editingId && inputRef.current) {
			inputRef.current.focus();
			inputRef.current.select();
		}
	}, [editingId]);

	// 明暗色切换：通过切换 html 上的 class 属性实现
	const handleToggleTheme = () => {
		const root = document.documentElement;
		root.classList.toggle("dark");
		const isDark = root.classList.contains("dark");
		try {
			localStorage.setItem("theme", isDark ? "dark" : "light");
		} catch {
			// ignore storage errors in sandboxed environments
		}
	};

	// 打开应用设置（如果主进程提供接口则调用）
	const handleOpenSettings = () => {
		// Toggle settings workspace view; call main openSettings when activating
		try {
			const newMode = workspaceMode === "settings" ? "editor" : "settings";
			setWorkspaceMode(newMode);
			const api = (
				window as unknown as { electronAPI?: { openSettings?: () => void } }
			).electronAPI;
			if (newMode === "settings" && api?.openSettings) {
				api.openSettings();
			}
		} catch (err) {
			console.error("Failed to open settings:", err);
		}
	};

	return (
		<TooltipProvider delayDuration={200}>
			<div className="w-60 max-w-[15rem] h-full border-r border-border flex flex-col bg-card box-border overflow-x-hidden shrink-0">
				{/* 操作按钮 */}
				<div className="h-9 px-3 flex items-center gap-1 border-b border-border bg-muted/40 shrink-0">
					{onCollapse && (
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									variant="ghost"
									size="icon"
									className="h-8 w-8 hover:bg-blue-500/20 hover:text-blue-600"
									onClick={onCollapse}
								>
									<span className="sr-only">{t("collapseSidebar")}</span>
									<ChevronLeft className="h-4 w-4" />
								</Button>
							</TooltipTrigger>
							<TooltipContent side="bottom">
								<p>{t("collapseSidebar")}</p>
							</TooltipContent>
						</Tooltip>
					)}

					{workspaceMode === "editor" && (
						<>
							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										variant="ghost"
										size="icon"
										className="h-8 w-8 hover:bg-blue-500/20 hover:text-blue-600"
										onClick={handleOpenFile}
									>
										<FolderOpen className="h-4 w-4" />
									</Button>
								</TooltipTrigger>
								<TooltipContent side="bottom">
									<p>{t("openFile")}</p>
								</TooltipContent>
							</Tooltip>

							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										variant="ghost"
										size="icon"
										className="h-8 w-8 hover:bg-blue-500/20 hover:text-blue-600"
										onClick={() => handleNewFileWithExt(".atex")}
									>
										<span className="sr-only">{t("newAtex")}</span>
										<FileMusic className="h-4 w-4" />
									</Button>
								</TooltipTrigger>
								<TooltipContent side="bottom">
									<p>{t("newAtex")}</p>
								</TooltipContent>
							</Tooltip>

							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										variant="ghost"
										size="icon"
										className="h-8 w-8 hover:bg-blue-500/20 hover:text-blue-600"
										onClick={() => handleNewFileWithExt(".md")}
									>
										<span className="sr-only">{t("newMd")}</span>
										<FileDown className="h-4 w-4" />
									</Button>
								</TooltipTrigger>
								<TooltipContent side="bottom">
									<p>{t("newMd")}</p>
								</TooltipContent>
							</Tooltip>
						</>
					)}

					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant="ghost"
								size="icon"
								className="h-8 w-8 hover:bg-blue-500/20 hover:text-blue-600"
								onClick={handleToggleTheme}
							>
								<span className="sr-only">{t("toggleTheme")}</span>
								<Sun className="h-4 w-4 block dark:hidden" />
								<Moon className="h-4 w-4 hidden dark:block" />
							</Button>
						</TooltipTrigger>
						<TooltipContent side="bottom">
							<p>{t("toggleTheme")}</p>
						</TooltipContent>
					</Tooltip>
				</div>

				{/* 文件列表 */}
				<ScrollArea className="flex-1 w-full overflow-hidden">
					<div className="py-1 w-full overflow-hidden">
						{workspaceMode === "tutorial" ? (
							<TutorialsSidebar />
						) : workspaceMode === "settings" ? (
							<SettingsSidebar />
						) : files.length === 0 ? (
							<div className="p-3 text-xs text-muted-foreground text-center">
								{t("noFiles")}
							</div>
						) : (
							files.map((file) => {
								const fileExt =
									editingId === file.id ? renameExt : splitName(file.name).ext;
								const isActive = activeFileId === file.id;
								const iconClass = `shrink-0 h-3.5 w-3.5 transition-colors ${
									isActive
										? "text-blue-600"
										: "text-muted-foreground group-hover:text-blue-600"
								}`;

								return (
									// biome-ignore lint/a11y/useSemanticElements: 需要在内部嵌套删除按钮，不能使用button
									<div
										key={file.id}
										onClick={() => {
											// 如果点击已选中的文件，则取消选择；否则选择该文件
											if (isActive) {
												setActiveFile(null);
											} else {
												setActiveFile(file.id);
												setWorkspaceMode("editor");
											}
										}}
										onKeyDown={(e) => {
											if (e.key === "Enter" || e.key === " ") {
												// 如果按 Enter/Space 在已选中的文件上，则取消选择；否则选择该文件
												if (isActive) {
													setActiveFile(null);
												} else {
													setActiveFile(file.id);
													setWorkspaceMode("editor");
												}
											}
										}}
										role="button"
										tabIndex={0}
										className={`
											w-full max-w-full group flex items-center gap-2 px-3 py-1.5 cursor-pointer overflow-hidden
											text-xs text-muted-foreground transition-colors text-left
											${isActive ? "bg-blue-500/20 text-blue-600" : "hover:bg-blue-500/20 hover:text-blue-600"}
										`}
									>
										{/* 图标 */}
										{fileExt === "atex" ? (
											<FileMusic className={iconClass} />
										) : fileExt === "md" ? (
											<FileDown className={iconClass} />
										) : (
											<FileText className={iconClass} />
										)}

										{/* 文件名 - 关键：使用 truncate + min-w-0 */}
										<span className="flex-1 min-w-0 truncate h-6 leading-6">
											{editingId === file.id ? (
												<input
													ref={inputRef}
													value={renameValue}
													onChange={(e) => setRenameValue(e.target.value)}
													onBlur={() => handleRenameSubmit(file.id)}
													onKeyDown={(e) => {
														if (e.key === "Enter") {
															handleRenameSubmit(file.id);
														} else if (e.key === "Escape") {
															handleRenameCancel(e);
														}
													}}
													className="w-full bg-transparent text-xs h-6 leading-6 px-1 border border-border rounded-sm outline-none"
													spellCheck={false}
													autoComplete="off"
												/>
											) : (
												splitName(file.name).base
											)}
										</span>

										{/* 操作按钮 */}
										<div className="shrink-0 flex items-center gap-0.5">
											<button
												type="button"
												onClick={(e) => handleRenameClick(e, file)}
												className={`opacity-0 group-hover:opacity-100 focus-visible:opacity-100 p-1 rounded transition-opacity w-6 h-6 flex items-center justify-center hover:bg-blue-500/20 focus-visible:bg-blue-500/20 ${
													isActive
														? "text-blue-600"
														: "text-muted-foreground hover:text-blue-600 focus-visible:text-blue-600"
												}`}
												aria-label={t("rename")}
											>
												<span className="sr-only">{t("renameFile")}</span>
												<Edit className="h-3 w-3" />
											</button>
											<button
												type="button"
												onClick={async (e) => {
													e.stopPropagation();
													try {
														await window.electronAPI.revealInFolder(file.path);
													} catch (err) {
														console.error("revealInFolder failed:", err);
													}
												}}
												className={`opacity-0 group-hover:opacity-100 focus-visible:opacity-100 p-1 rounded transition-opacity w-6 h-6 flex items-center justify-center hover:bg-blue-500/20 focus-visible:bg-blue-500/20 ${
													isActive
														? "text-blue-600"
														: "text-muted-foreground hover:text-blue-600 focus-visible:text-blue-600"
												}`}
												aria-label={t("showInExplorer")}
											>
												<span className="sr-only">{t("showInExplorer")}</span>
												<FolderOpen className="h-3.5 w-3.5" />
											</button>
										</div>

										{/* 扩展名（仅显示 .md，隐藏 .atex） */}
										{fileExt === "md" && (
											<code
												className={`shrink-0 font-mono bg-muted/50 px-1 rounded text-xs h-6 leading-6 select-none ${
													isActive ? "text-blue-600" : "text-muted-foreground"
												}`}
											>
												{fileExt}
											</code>
										)}
									</div>
								);
							})
						)}
					</div>
				</ScrollArea>

				{/* Sidebar bottom bar */}
				<div className="h-9 px-3 flex items-center gap-1 border-t border-border bg-muted/40 shrink-0">
					<Tooltip>
						<TooltipTrigger asChild>
							<IconButton
								active={workspaceMode === "tutorial"}
								onClick={() => {
									const newMode =
										workspaceMode === "tutorial" ? "editor" : "tutorial";
									setWorkspaceMode(newMode);
									if (newMode === "tutorial") {
										setActiveTutorialId(null);
									}
								}}
								aria-label={t("tutorial")}
							>
								<FileQuestion className="h-4 w-4" />
							</IconButton>
						</TooltipTrigger>
						<TooltipContent side="top">
							<p>
								{workspaceMode === "tutorial"
									? t("exitTutorial")
									: t("enterTutorial")}
							</p>
						</TooltipContent>
					</Tooltip>
					<Tooltip>
						<TooltipTrigger asChild>
							<IconButton
								active={workspaceMode === "settings"}
								onClick={handleOpenSettings}
								aria-label={t("settings")}
							>
								<Settings className="h-4 w-4" />
							</IconButton>
						</TooltipTrigger>
						<TooltipContent side="top">
							<p>{t("settings")}</p>
						</TooltipContent>
					</Tooltip>
				</div>
			</div>
		</TooltipProvider>
	);
}
