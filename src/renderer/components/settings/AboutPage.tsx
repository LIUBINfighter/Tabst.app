export function AboutPage() {
	return (
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
	);
}
