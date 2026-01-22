import { Button } from "../ui/button";

export function AppearancePage() {
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

	return (
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
	);
}
