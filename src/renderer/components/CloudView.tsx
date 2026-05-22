import { ExternalLink, Globe } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { getCloudPublicScore } from "../lib/cloud-public-scores";
import { type FileItem, useAppStore } from "../store/appStore";
import type { CloudPublicScore } from "../types/cloud";
import { Editor } from "./Editor";
import { AppLink } from "./ui/app-link";

export interface CloudViewProps {
	showExpandSidebar?: boolean;
	onExpandSidebar?: () => void;
	onCollapseSidebar?: () => void;
}

const TABST_DB_PUBLIC_URL = "https://db.tabst.app/#/public";

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

export default function CloudView({
	showExpandSidebar,
	onExpandSidebar,
}: CloudViewProps) {
	const { t } = useTranslation(["sidebar", "common"]);
	const activeCloudObjectId = useAppStore((s) => s.activeCloudObjectId);

	const [score, setScore] = useState<CloudPublicScore | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const sandboxFile = useMemo<FileItem | null>(() => {
		if (!score) {
			return null;
		}

		return {
			id: `cloud:${score.id}`,
			name: `${score.title}.atex`,
			path: `cloud://public/${score.id}.atex`,
			content: score.content,
			contentLoaded: true,
			metaTags: score.tags,
			metaTitle: score.title,
			metaSource: `db.tabst.app/public/scores/${score.id}`,
		};
	}, [score]);

	useEffect(() => {
		if (!activeCloudObjectId) {
			setScore(null);
			setLoading(false);
			setError(null);
			return;
		}

		let cancelled = false;
		setLoading(true);
		setError(null);
		void getCloudPublicScore(activeCloudObjectId)
			.then((nextScore) => {
				if (cancelled) return;
				setScore(nextScore);
			})
			.catch((caught) => {
				if (cancelled) return;
				setScore(null);
				setError(getCloudErrorMessage(caught, t));
			})
			.finally(() => {
				if (cancelled) return;
				setLoading(false);
			});

		return () => {
			cancelled = true;
		};
	}, [activeCloudObjectId, t]);

	if (!loading && !error && score) {
		return (
			<Editor
				sandboxMode
				readOnly
				sandboxFile={sandboxFile}
				onSandboxContentChange={() => {}}
				showExpandSidebar={showExpandSidebar}
				onExpandSidebar={onExpandSidebar}
			/>
		);
	}

	return (
		<div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
			<div className="flex-1 overflow-auto p-4">
				{!activeCloudObjectId && !loading ? (
					<div className="mx-auto flex h-full max-w-2xl flex-col items-center justify-center px-6 py-10 text-center">
						<div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
							<Globe className="h-5 w-5" />
						</div>
						<h1 className="text-xl font-semibold text-foreground">
							{t("cloudSelectTitle")}
						</h1>
						<p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
							{t("cloudSelectDescription")}
						</p>
						<AppLink
							href={TABST_DB_PUBLIC_URL}
							className="mt-5 inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
						>
							<span>{t("cloudOpenInBrowser")}</span>
							<ExternalLink className="h-3.5 w-3.5" />
						</AppLink>
					</div>
				) : null}

				{loading ? (
					<div className="mx-auto max-w-4xl px-6 py-10 text-center text-sm text-muted-foreground">
						{t("cloudDetailLoading")}
					</div>
				) : null}

				{error ? (
					<div className="mx-auto max-w-3xl px-6 py-10 text-center text-sm text-muted-foreground">
						<p>{error}</p>
					</div>
				) : null}
			</div>
		</div>
	);
}
