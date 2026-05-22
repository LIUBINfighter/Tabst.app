import { Globe, Lock, Search, Upload } from "lucide-react";
import {
	type FormEvent,
	useCallback,
	useEffect,
	useMemo,
	useState,
} from "react";
import { useTranslation } from "react-i18next";
import { listCloudPublicScores } from "../lib/cloud-public-scores";
import { useAppStore } from "../store/appStore";
import type { CloudPublicScoreListItem } from "../types/cloud";
import { AppLink } from "./ui/app-link";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

const TABST_DB_PUBLIC_URL = "https://db.tabst.app/#/public";

function formatDateLabel(value: string): string {
	const parsed = Date.parse(value);
	if (Number.isNaN(parsed)) {
		return value;
	}

	return new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
	}).format(parsed);
}

function getCloudErrorMessage(
	error: unknown,
	t: (key: string) => string,
): string {
	if (error instanceof Error) {
		if (error.message === "cloud-not-configured") {
			return t("cloudUnavailable");
		}

		if (error.message === "cloud-score-not-found") {
			return t("cloudDetailMissing");
		}

		return error.message;
	}

	return t("cloudUnavailable");
}

export function CloudSidebar() {
	const { t } = useTranslation("sidebar");
	const activeCloudObjectId = useAppStore((s) => s.activeCloudObjectId);
	const setActiveCloudObjectId = useAppStore((s) => s.setActiveCloudObjectId);

	const [query, setQuery] = useState("");
	const [scores, setScores] = useState<CloudPublicScoreListItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const hasActiveScore = useMemo(
		() => scores.some((score) => score.id === activeCloudObjectId),
		[scores, activeCloudObjectId],
	);

	const loadScores = useCallback(
		async (nextQuery = query) => {
			setLoading(true);
			setError(null);
			try {
				const nextScores = await listCloudPublicScores(nextQuery);
				setScores(nextScores);
			} catch (caught) {
				setScores([]);
				setError(getCloudErrorMessage(caught, t));
			} finally {
				setLoading(false);
			}
		},
		[query, t],
	);

	useEffect(() => {
		void loadScores("");
	}, [loadScores]);

	useEffect(() => {
		if (scores.length === 0) {
			if (activeCloudObjectId) {
				setActiveCloudObjectId(null);
			}
			return;
		}

		if (!hasActiveScore) {
			setActiveCloudObjectId(scores[0].id);
		}
	}, [scores, activeCloudObjectId, hasActiveScore, setActiveCloudObjectId]);

	const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		void loadScores(query);
	};

	return (
		<div className="flex h-full flex-col">
			<div className="border-b border-border px-3 py-3">
				<div className="mb-3 grid grid-cols-3 gap-1 text-[11px]">
					<div className="flex items-center justify-center gap-1 rounded-md bg-[var(--highlight-bg)] px-2 py-1.5 text-[var(--highlight-text)]">
						<Globe className="h-3.5 w-3.5" />
						<span>{t("cloudPublic")}</span>
					</div>
					<div className="flex items-center justify-center gap-1 rounded-md border border-dashed border-border px-2 py-1.5 text-muted-foreground opacity-70">
						<Lock className="h-3.5 w-3.5" />
						<span>{t("cloudPrivateSoon")}</span>
					</div>
					<div className="flex items-center justify-center gap-1 rounded-md border border-dashed border-border px-2 py-1.5 text-muted-foreground opacity-70">
						<Upload className="h-3.5 w-3.5" />
						<span>{t("cloudUploadSoon")}</span>
					</div>
				</div>

				<form className="space-y-2" onSubmit={handleSubmit}>
					<div className="relative">
						<Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
						<Input
							value={query}
							onChange={(event) => setQuery(event.target.value)}
							placeholder={t("cloudSearchPlaceholder")}
							className="h-8 pl-8 text-xs"
							aria-label={t("cloudSearchPlaceholder")}
						/>
					</div>
					<Button type="submit" size="sm" className="h-7 w-full text-xs">
						{t("cloudSearchAction")}
					</Button>
				</form>
			</div>

			<div className="flex-1 overflow-auto">
				{error ? (
					<div className="space-y-3 px-3 py-4 text-xs text-muted-foreground">
						<p>{error}</p>
						<AppLink
							href={TABST_DB_PUBLIC_URL}
							className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1.5 text-foreground transition-colors hover:bg-muted"
						>
							<span>{t("cloudOpenInBrowser")}</span>
						</AppLink>
					</div>
				) : null}

				{loading ? (
					<div className="px-3 py-4 text-xs text-muted-foreground">
						{t("cloudLoading")}
					</div>
				) : null}

				{!loading && !error && scores.length === 0 ? (
					<div className="px-3 py-4 text-xs text-muted-foreground">
						{t("cloudEmpty")}
					</div>
				) : null}

				{scores.map((score) => {
					const isActive = activeCloudObjectId === score.id;

					return (
						<button
							key={score.id}
							type="button"
							onClick={() => setActiveCloudObjectId(score.id)}
							className={`w-full border-b border-border/60 px-3 py-2.5 text-left transition-colors ${
								isActive
									? "bg-[var(--highlight-bg)] text-[var(--highlight-text)]"
									: "text-foreground hover:bg-[var(--hover-bg)]"
							}`}
						>
							<div className="flex items-start justify-between gap-2">
								<div className="min-w-0 flex-1">
									<div className="truncate text-xs font-medium leading-5">
										{score.title}
									</div>
									<div
										className={`mt-0.5 line-clamp-2 text-[11px] leading-4 ${
											isActive
												? "text-[var(--highlight-text)]/85"
												: "text-muted-foreground"
										}`}
									>
										{score.description || t("cloudNoDescription")}
									</div>
								</div>
								<div
									className={`shrink-0 text-[10px] uppercase tracking-wide ${
										isActive
											? "text-[var(--highlight-text)]/85"
											: "text-muted-foreground"
									}`}
								>
									{formatDateLabel(score.updated_at)}
								</div>
							</div>

							{score.tags.length > 0 ? (
								<div className="mt-2 flex flex-wrap gap-1">
									{score.tags.slice(0, 3).map((tag) => (
										<span
											key={tag}
											className={`rounded-full border px-1.5 py-0.5 text-[10px] ${
												isActive
													? "border-[var(--highlight-text)]/25 text-[var(--highlight-text)]"
													: "border-border text-muted-foreground"
											}`}
										>
											{tag}
										</span>
									))}
								</div>
							) : null}
						</button>
					);
				})}
			</div>
		</div>
	);
}
