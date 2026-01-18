export default function GlobalBottomBar() {
	return (
		<footer className="fixed bottom-0 left-0 right-0 z-40 h-9 border-t border-border bg-card flex items-center justify-between px-4 text-xs text-muted-foreground">
			{/* Left: app status */}
			<div className="flex items-center gap-3">
				<span className="font-medium">Tabst</span>
				<span className="text-muted-foreground">就绪</span>
			</div>

			{/* Right: helpful shortcuts */}
			<div className="flex items-center gap-4">
				<span className="hidden sm:inline">快捷键：Ctrl+S 保存</span>
				<span className="hidden sm:inline">Ctrl+P 打印</span>
				<span className="hidden sm:inline">Esc 关闭</span>
			</div>
		</footer>
	);
}
