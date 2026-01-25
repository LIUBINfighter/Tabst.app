import { useEffect, useState } from "react";
import { TutorialRenderer } from "../tutorial/TutorialRenderer";

export function RoadmapPage() {
	const [roadmapContent, setRoadmapContent] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const loadRoadmap = async () => {
			try {
				setLoading(true);
				setError(null);
				const data = await window.electronAPI.readAsset("docs/ROADMAP.md");
				// Convert Uint8Array to string
				const decoder = new TextDecoder("utf-8");
				const content = decoder.decode(data);
				setRoadmapContent(content);
			} catch (err) {
				setError(err instanceof Error ? err.message : String(err));
			} finally {
				setLoading(false);
			}
		};

		void loadRoadmap();
	}, []);

	return (
		<section className="bg-card border border-border rounded p-4">
			<h3 className="text-sm font-medium mb-4">路线图</h3>
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
			{!loading && !error && roadmapContent && (
				<TutorialRenderer content={roadmapContent} />
			)}
		</section>
	);
}
