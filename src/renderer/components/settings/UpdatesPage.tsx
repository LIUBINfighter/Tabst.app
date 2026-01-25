import DOMPurify from "dompurify";
import { useCallback, useEffect, useState } from "react";
import { Button } from "../ui/button";

interface ReleaseEntry {
	id: string;
	title: string;
	link: string;
	updated: string;
	content: string;
}

export function UpdatesPage() {
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

			// 检查解析错误
			const parseError = xmlDoc.querySelector("parsererror");
			if (parseError) {
				throw new Error("Failed to parse XML");
			}

			// 解析 Atom feed
			const entries = xmlDoc.querySelectorAll("entry");
			const parsedReleases: ReleaseEntry[] = [];

			entries.forEach((entry) => {
				const id = entry.querySelector("id")?.textContent || "";
				const title = entry.querySelector("title")?.textContent || "";
				const linkAttr =
					entry.querySelector("link")?.getAttribute("href") || "";
				const updated = entry.querySelector("updated")?.textContent || "";
				const rawContent = entry.querySelector("content")?.textContent || "";

				// Security: Validate and sanitize link URL
				let link = "";
				try {
					if (linkAttr) {
						const url = new URL(linkAttr);
						// Only allow https://github.com links
						if (url.protocol === "https:" && url.hostname === "github.com") {
							link = linkAttr;
						}
					}
				} catch {
					// Invalid URL, leave link empty
				}

				// Security: Sanitize HTML content to prevent XSS
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
			setError(`加载失败：${String(err)}`);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		// 自动加载一次
		void fetchReleases();
	}, [fetchReleases]);

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

	const formatDate = (dateString: string) => {
		try {
			const date = new Date(dateString);
			return date.toLocaleDateString("zh-CN", {
				year: "numeric",
				month: "long",
				day: "numeric",
			});
		} catch {
			return dateString;
		}
	};

	return (
		<div className="space-y-4">
			<section className="bg-card border border-border rounded p-4">
				<h3 className="text-sm font-medium mb-2">检查更新</h3>
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
				<div className="flex items-center justify-between mb-4">
					<h3 className="text-sm font-medium">更新日志</h3>
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={fetchReleases}
						disabled={loading}
					>
						{loading ? "加载中..." : "刷新"}
					</Button>
				</div>

				{error && <div className="text-xs text-destructive mb-4">{error}</div>}

				{loading && releases.length === 0 && (
					<div className="text-xs text-muted-foreground">加载中...</div>
				)}

				{!loading && releases.length === 0 && !error && (
					<div className="text-xs text-muted-foreground">暂无更新日志</div>
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
										查看 →
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
									// Security: Content is sanitized with DOMPurify before rendering
									// biome-ignore lint/security/noDangerouslySetInnerHtml: Content sanitized with DOMPurify
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
