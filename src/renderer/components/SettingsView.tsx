import { ChevronLeft, Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { useAppStore } from "../store/appStore";
import TopBar from "./TopBar";
import { Button } from "./ui/button";
import IconButton from "./ui/icon-button";

export default function SettingsView() {
	const setWorkspaceMode = useAppStore((s) => s.setWorkspaceMode);
	const [checkingUpdate, setCheckingUpdate] = useState(false);
	const [updateStatus, setUpdateStatus] = useState<string | null>(null);

	// 键盘快捷键：ESC 返回编辑器
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				setWorkspaceMode("editor");
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [setWorkspaceMode]);

	const toggleTheme = () => {
		const root = document.documentElement;
		root.classList.toggle("dark");
		try {
			localStorage.setItem(
				"theme",
				root.classList.contains("dark") ? "dark" : "light",
			);
		} catch {}
	};

	const handleCheckUpdate = async () => {
		setCheckingUpdate(true);
		setUpdateStatus("正在检查更新...");
		try {
			const result = await window.electronAPI.checkForUpdates();
			if (!result?.supported) {
				setUpdateStatus(result?.message ?? "当前环境不支持更新检查");
			} else {
				setUpdateStatus("已触发检查，请留意右下角更新提示");
			}
		} catch (err) {
			setUpdateStatus(`检查失败：${String(err)}`);
		} finally {
			setCheckingUpdate(false);
		}
	};

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
					<Settings className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
				}
				title="设置"
			/>

			<div className="flex-1 overflow-auto p-4 space-y-4">
				<section className="bg-card border border-border rounded p-4">
					<h3 className="text-sm font-medium mb-2">外观</h3>
					<div className="flex items-center gap-3">
						<Button
							type="button"
							variant="outline"
							onClick={toggleTheme}
							aria-label="切换明暗主题"
						>
							切换明暗主题
						</Button>
						<p className="text-xs text-muted-foreground">
							当前主题由页面 class 控制
						</p>
					</div>
				</section>

				<section className="bg-card border border-border rounded p-4">
					<h3 className="text-sm font-medium mb-2">更新</h3>
					<div className="flex items-center gap-3">
						<Button
							type="button"
							onClick={handleCheckUpdate}
							disabled={checkingUpdate}
						>
							{checkingUpdate ? "检查中..." : "检查更新"}
						</Button>
						{updateStatus && (
							<p className="text-xs text-muted-foreground">{updateStatus}</p>
						)}
					</div>
				</section>

				<section className="bg-card border border-border rounded p-4">
					<h3 className="text-sm font-medium mb-2">关于 v0.1.4</h3>
					<div className="space-y-2">
						<p className="text-xs text-muted-foreground">
							Tabst. Write guitar tabs like markdown. Powered by alphaTab.js.
						</p>
						<p className="text-xs text-muted-foreground">
							高效编写 alphaTex，播放乐谱，分享 PDF/GP。
						</p>
						<a
							href="https://github.com/LIUBINfighter/Tabst.app"
							target="_blank"
							rel="noopener noreferrer"
							className="text-xs text-primary hover:underline inline-block"
						>
							GitHub →
						</a>
					</div>
				</section>
			</div>
		</div>
	);
}
