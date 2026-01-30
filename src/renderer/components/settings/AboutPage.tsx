import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { TutorialRenderer } from "../tutorial/TutorialRenderer";

export function AboutPage() {
	const { t } = useTranslation(["settings", "common"]);
	const [readmeContent, setReadmeContent] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [version, setVersion] = useState<string | null>(null);

	useEffect(() => {
		let mounted = true;
		void window.electronAPI
			.getAppVersion()
			.then((v) => {
				if (mounted) setVersion(v);
			})
			.catch(() => {});
		return () => {
			mounted = false;
		};
	}, []);

	useEffect(() => {
		const loadReadme = async () => {
			try {
				setLoading(true);
				setError(null);
				const data = await window.electronAPI.readAsset("docs/README.md");
				const decoder = new TextDecoder("utf-8");
				const content = decoder.decode(data);
				setReadmeContent(content);
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

		void loadReadme();
	}, [t]);

	return (
		<div className="space-y-4">
			<section className="bg-card border border-border rounded p-4">
				<h3 className="text-sm font-medium mb-2">
					{version
						? t("settings:aboutHeader", { version })
						: t("settings:about")}
				</h3>
				<div className="space-y-2">
					<p className="text-xs text-muted-foreground">
						{t("settings:aboutTagline1")}
					</p>
					<p className="text-xs text-muted-foreground">
						{t("settings:aboutTagline2")}
					</p>
					<a
						href="https://github.com/LIUBINfighter/Tabst.app"
						target="_blank"
						rel="noopener noreferrer"
						className="text-xs text-primary hover:underline inline-block"
					>
						{t("settings:githubLink")}
					</a>
				</div>
			</section>

			<section className="bg-card border border-border rounded p-4 flex items-center justify-center">
				<img
					src="/assets/alphaTab.svg"
					alt={t("settings:alphatabLogoAlt")}
					className="h-32 w-auto"
				/>
			</section>

			<section className="bg-card border border-border rounded p-4">
				<h3 className="text-sm font-medium mb-4">
					{t("settings:readmeTitle")}
				</h3>
				{loading && (
					<div className="flex items-center justify-center py-8">
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
				{!loading && !error && readmeContent && (
					<TutorialRenderer content={readmeContent} />
				)}
			</section>
		</div>
	);
}
