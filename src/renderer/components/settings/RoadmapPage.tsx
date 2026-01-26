import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { TutorialRenderer } from "../tutorial/TutorialRenderer";

export function RoadmapPage() {
	const { t } = useTranslation(["settings", "common"]);
	const [roadmapContent, setRoadmapContent] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const loadRoadmap = async () => {
			try {
				setLoading(true);
				setError(null);
				const data = await window.electronAPI.readAsset("docs/ROADMAP.md");
				const decoder = new TextDecoder("utf-8");
				const content = decoder.decode(data);
				setRoadmapContent(content);
			} catch (err) {
				setError(
					err instanceof Error
						? t("common:loadFailed", { reason: err.message })
						: t("common:loadFailed", { reason: String(err) }),
				);
			} finally {
				setLoading(false);
			}
		};

		void loadRoadmap();
	}, [t]);

	return (
		<section className="bg-card border border-border rounded p-4">
			<h3 className="text-sm font-medium mb-4">{t("roadmap")}</h3>
			{loading && (
				<div className="flex items-center justify-center py-8">
					<p className="text-sm text-muted-foreground">{t("common:loading")}</p>
				</div>
			)}
			{error && (
				<div className="bg-destructive/10 border border-destructive rounded p-4">
					<p className="text-sm text-destructive">{error}</p>
				</div>
			)}
			{!loading && !error && roadmapContent && (
				<TutorialRenderer content={roadmapContent} />
			)}
		</section>
	);
}
