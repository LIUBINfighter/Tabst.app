import DOMPurify from "dompurify";
import moment from "moment";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/button";

interface ReleaseEntry {
	id: string;
	title: string;
	link: string;
	updated: string;
	content: string;
}

export function UpdatesPage() {
	const { t } = useTranslation("updates");
	const [checkingUpdate, setCheckingUpdate] = useState(false);
	const [updateStatus, setUpdateStatus] = useState<string | null>(null);
	const [releases, setReleases] = useState<ReleaseEntry[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const fetchReleases = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const result = await window.electronAPI.fetchReleasesFeed();
			if (!result.success || !result.data) {
				throw new Error(result.error || "Failed to fetch releases");
			}

			const parser = new DOMParser();
			const xmlDoc = parser.parseFromString(result.data, "text/xml");

			const parseErr = xmlDoc.querySelector("parsererror");
			if (parseErr) {
				throw new Error("Failed to parse XML");
			}

			const entries = xmlDoc.querySelectorAll("entry");
			const parsedReleases: ReleaseEntry[] = [];

			entries.forEach((entry) => {
				const id = entry.querySelector("id")?.textContent || "";
				const title = entry.querySelector("title")?.textContent || "";
				const linkAttr =
					entry.querySelector("link")?.getAttribute("href") || "";
				const updated = entry.querySelector("updated")?.textContent || "";
				const rawContent = entry.querySelector("content")?.textContent || "";

				let link = "";
				try {
					if (linkAttr) {
						const url = new URL(linkAttr);
						if (url.protocol === "https:" && url.hostname === "github.com") {
							link = linkAttr;
						}
					}
				} catch {}

				const sanitizedContent = DOMPurify.sanitize(rawContent, {
					ALLOWED_TAGS: [
						"p",
						"br",
						"strong",
						"em",
						"u",
						"a",
						"ul",
						"ol",
						"li",
						"h1",
						"h2",
						"h3",
						"h4",
						"h5",
						"h6",
						"code",
						"pre",
						"blockquote",
					],
					ALLOWED_ATTR: ["href", "target", "rel"],
					ALLOWED_URI_REGEXP: /^(https?):\/\/github\.com/,
				});

				parsedReleases.push({
					id,
					title,
					link,
					updated,
					content: sanitizedContent,
				});
			});

			setReleases(parsedReleases);
		} catch (err) {
			setError(t("loadFailed", { reason: String(err) }));
		} finally {
			setLoading(false);
		}
	}, [t]);

	useEffect(() => {
		void fetchReleases();
	}, [fetchReleases]);

	const handleCheckUpdate = async () => {
		setCheckingUpdate(true);
		setUpdateStatus(t("checkingUpdate"));
		try {
			const result = await window.electronAPI.checkForUpdates();
			if (!result?.supported) {
				setUpdateStatus(result?.message ?? t("unsupported"));
			} else {
				setUpdateStatus(t("triggered"));
			}
		} catch (err) {
			setUpdateStatus(t("checkFailed", { reason: String(err) }));
		} finally {
			setCheckingUpdate(false);
		}
	};

	const formatDate = (dateString: string) => {
		try {
			const m = moment(dateString);
			return m.isValid() ? m.format("LL") : dateString;
		} catch {
			return dateString;
		}
	};

	return (
		<div className="space-y-4">
			<section className="bg-card border border-border rounded p-4">
				<h3 className="text-sm font-medium mb-2">{t("checkUpdate")}</h3>
				<div className="flex items-center gap-3">
					<Button
						type="button"
						onClick={handleCheckUpdate}
						disabled={checkingUpdate}
					>
						{checkingUpdate ? t("checking") : t("checkUpdate")}
					</Button>
					{updateStatus && (
						<p className="text-xs text-muted-foreground">{updateStatus}</p>
					)}
				</div>
			</section>

			<section className="bg-card border border-border rounded p-4">
				<div className="flex items-center justify-between mb-4">
					<h3 className="text-sm font-medium">{t("changelog")}</h3>
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={fetchReleases}
						disabled={loading}
					>
						{loading ? t("loading") : t("refresh")}
					</Button>
				</div>

				{error && <div className="text-xs text-destructive mb-4">{error}</div>}

				{loading && releases.length === 0 && (
					<div className="text-xs text-muted-foreground">{t("loading")}</div>
				)}

				{!loading && releases.length === 0 && !error && (
					<div className="text-xs text-muted-foreground">
						{t("noChangelog")}
					</div>
				)}

				<div className="space-y-4">
					{releases.map((release) => (
						<div
							key={release.id}
							className="border border-border rounded p-3 space-y-2"
						>
							<div className="flex items-start justify-between gap-2">
								<h4 className="text-sm font-medium flex-1">{release.title}</h4>
								{release.link && (
									<a
										href={release.link}
										target="_blank"
										rel="noopener noreferrer"
										className="text-xs text-primary hover:underline shrink-0"
									>
										{t("viewRelease")}
									</a>
								)}
							</div>
							{release.updated && (
								<p className="text-xs text-muted-foreground">
									{formatDate(release.updated)}
								</p>
							)}
							{release.content && (
								<div
									className="text-xs text-muted-foreground prose prose-sm max-w-none dark:prose-invert prose-headings:text-foreground prose-p:text-muted-foreground prose-a:text-primary prose-strong:text-foreground prose-code:text-foreground prose-pre:bg-muted prose-pre:text-foreground"
									// biome-ignore lint/security/noDangerouslySetInnerHtml: sanitized with DOMPurify
									dangerouslySetInnerHTML={{ __html: release.content }}
								/>
							)}
						</div>
					))}
				</div>
			</section>
		</div>
	);
}
