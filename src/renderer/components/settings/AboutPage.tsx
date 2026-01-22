import { useEffect, useState } from "react";
import { TutorialRenderer } from "../tutorial/TutorialRenderer";

export function AboutPage() {
	const [readmeContent, setReadmeContent] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const loadReadme = async () => {
			try {
				setLoading(true);
				setError(null);
				const data = await window.electronAPI.readAsset("docs/README.md");
				// Convert Uint8Array to string
				const decoder = new TextDecoder("utf-8");
				const content = decoder.decode(data);
				setReadmeContent(content);
			} catch (err) {
				setError(err instanceof Error ? err.message : String(err));
			} finally {
				setLoading(false);
			}
		};

		void loadReadme();
	}, []);

	return (
		<div className="space-y-4">
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

			<section className="bg-card border border-border rounded p-4">
				<h3 className="text-sm font-medium mb-4">README</h3>
				{loading && (
					<div className="flex items-center justify-center py-8">
						<p className="text-sm text-muted-foreground">加载中...</p>
					</div>
				)}
				{error && (
					<div className="bg-destructive/10 border border-destructive rounded p-4">
						<p className="text-sm text-destructive">加载失败：{error}</p>
					</div>
				)}
				{!loading && !error && readmeContent && (
					<TutorialRenderer content={readmeContent} />
				)}
			</section>
		</div>
	);
}
