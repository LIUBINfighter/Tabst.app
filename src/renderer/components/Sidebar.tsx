import { useTranslation } from "react-i18next";
import { useFileOperations } from "../hooks/useFileOperations";
import { useAppStore } from "../store/appStore";
import { FileTreeItem } from "./FileTreeItem";
import { SettingsSidebar } from "./SettingsSidebar";
import { SidebarBottomBar, SidebarCommands } from "./SidebarCommands";
import { TutorialsSidebar } from "./TutorialsSidebar";
import { ScrollArea } from "./ui/scroll-area";
import { TooltipProvider } from "./ui/tooltip";

export interface SidebarProps {
	onCollapse?: () => void;
}

export function Sidebar({ onCollapse }: SidebarProps) {
	const { t } = useTranslation("sidebar");
	const files = useAppStore((s) => s.files);
	const workspaceMode = useAppStore((s) => s.workspaceMode);

	const {
		handleOpenFile,
		handleNewFile,
		editingId,
		renameValue,
		renameExt,
		setRenameValue,
		handleRenameClick,
		handleRenameCancel,
		handleRenameSubmit,
		splitName,
	} = useFileOperations();

	const handleToggleTheme = () => {
		const root = document.documentElement;
		root.classList.toggle("dark");
		const isDark = root.classList.contains("dark");
		try {
			localStorage.setItem("theme", isDark ? "dark" : "light");
		} catch {
			// ignore storage errors
		}
	};

	return (
		<TooltipProvider delayDuration={200}>
			<div className="w-60 max-w-[15rem] h-full border-r border-border flex flex-col bg-card box-border overflow-x-hidden shrink-0">
				<SidebarCommands
					onCollapse={onCollapse}
					onOpenFile={handleOpenFile}
					onNewFile={handleNewFile}
					onToggleTheme={handleToggleTheme}
				/>

				{/* 文件列表 */}
				<ScrollArea className="flex-1 w-full overflow-hidden min-h-0">
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
							files.map((file) => (
								<FileTreeItem
									key={file.id}
									file={file}
									isEditing={editingId === file.id}
									renameValue={renameValue}
									renameExt={renameExt}
									onRenameValueChange={setRenameValue}
									onRenameClick={handleRenameClick}
									onRenameSubmit={handleRenameSubmit}
									onRenameCancel={handleRenameCancel}
									splitName={splitName}
								/>
							))
						)}
					</div>
				</ScrollArea>

				{/* 底部栏：教程、设置 */}
				<SidebarBottomBar />
			</div>
		</TooltipProvider>
	);
}
