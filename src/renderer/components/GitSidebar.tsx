import {
	AlertCircle,
	FilePlus2,
	GitBranch,
	Loader2,
	RefreshCw,
} from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useAppStore } from "../store/appStore";
import type { GitChangeEntry, GitChangeGroup } from "../types/git";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";

function shortStatus(entry: GitChangeEntry): string {
	return `${entry.x}${entry.y}`.trim() || "--";
}

function statusToneClass(status: string): string {
	if (status.includes("U")) {
		return "text-red-600 dark:text-red-400 bg-red-500/10";
	}
	if (status === "??") {
		return "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10";
	}
	if (status.includes("A") && status.includes("M")) {
		return "text-violet-600 dark:text-violet-400 bg-violet-500/10";
	}
	if (status.includes("D")) {
		return "text-rose-600 dark:text-rose-400 bg-rose-500/10";
	}
	if (status.includes("R") || status.includes("C")) {
		return "text-sky-600 dark:text-sky-400 bg-sky-500/10";
	}
	if (status.includes("A")) {
		return "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10";
	}
	if (status.includes("M")) {
		return "text-amber-600 dark:text-amber-400 bg-amber-500/10";
	}
	return "text-muted-foreground bg-muted/50";
}

function fileLabel(entry: { path: string; fromPath?: string }): string {
	if (entry.fromPath && entry.fromPath !== entry.path) {
		return `${entry.fromPath} → ${entry.path}`;
	}
	return entry.path;
}

function formatRepoPathForTerminal(repoPath: string): string {
	const macHomePrefix = /^\/Users\/[^/]+/;
	const linuxHomePrefix = /^\/home\/[^/]+/;
	if (macHomePrefix.test(repoPath)) {
		return repoPath.replace(macHomePrefix, "~");
	}
	if (linuxHomePrefix.test(repoPath)) {
		return repoPath.replace(linuxHomePrefix, "~");
	}
	return repoPath;
}

export function GitSidebar() {
	const { t } = useTranslation("sidebar");
	const workspaceMode = useAppStore((s) => s.workspaceMode);
	const activeRepoId = useAppStore((s) => s.activeRepoId);
	const repos = useAppStore((s) => s.repos);
	const gitStatus = useAppStore((s) => s.gitStatus);
	const gitStatusLoading = useAppStore((s) => s.gitStatusLoading);
	const gitStatusError = useAppStore((s) => s.gitStatusError);
	const gitActionLoading = useAppStore((s) => s.gitActionLoading);
	const gitActionError = useAppStore((s) => s.gitActionError);
	const gitSelectedChange = useAppStore((s) => s.gitSelectedChange);
	const gitCommitMessage = useAppStore((s) => s.gitCommitMessage);
	const setGitCommitMessage = useAppStore((s) => s.setGitCommitMessage);
	const refreshGitStatus = useAppStore((s) => s.refreshGitStatus);
	const selectGitChange = useAppStore((s) => s.selectGitChange);
	const toggleGitStage = useAppStore((s) => s.toggleGitStage);
	const addAllGitChanges = useAppStore((s) => s.addAllGitChanges);
	const syncGitPull = useAppStore((s) => s.syncGitPull);
	const commitGitChanges = useAppStore((s) => s.commitGitChanges);
	const rowOrderRef = useRef<Map<string, number>>(new Map());

	const activeRepoPath = useMemo(
		() => repos.find((repo) => repo.id === activeRepoId)?.path ?? "",
		[repos, activeRepoId],
	);

	useEffect(() => {
		if (workspaceMode !== "git") return;
		if (!activeRepoId) return;
		void refreshGitStatus();

		const timer = window.setInterval(() => {
			void refreshGitStatus();
		}, 2500);

		return () => {
			window.clearInterval(timer);
		};
	}, [workspaceMode, activeRepoId, refreshGitStatus]);

	useEffect(() => {
		if (!activeRepoId) {
			rowOrderRef.current = new Map();
			return;
		}
		rowOrderRef.current = new Map();
	}, [activeRepoId]);

	type UnifiedRow = {
		key: string;
		path: string;
		fromPath?: string;
		order: number;
		status: string;
		preferredGroup: GitChangeGroup;
		staged: boolean;
		partiallyStaged: boolean;
	};

	const rows = useMemo(() => {
		const stagedMap = new Map<string, GitChangeEntry>();
		const unstagedMap = new Map<string, GitChangeEntry>();
		for (const entry of gitStatus?.staged ?? []) {
			stagedMap.set(`${entry.path}:${entry.fromPath ?? ""}`, entry);
		}

		for (const entry of gitStatus?.unstaged ?? []) {
			unstagedMap.set(`${entry.path}:${entry.fromPath ?? ""}`, entry);
		}

		const merged = new Map<string, UnifiedRow>();
		const order: Array<{ group: GitChangeGroup; entries: GitChangeEntry[] }> = [
			{ group: "conflicted", entries: gitStatus?.conflicted ?? [] },
			{ group: "unstaged", entries: gitStatus?.unstaged ?? [] },
			{ group: "untracked", entries: gitStatus?.untracked ?? [] },
			{ group: "staged", entries: gitStatus?.staged ?? [] },
		];

		for (const { group, entries } of order) {
			for (const entry of entries) {
				const key = `${entry.path}:${entry.fromPath ?? ""}`;
				const isStaged = stagedMap.has(key);
				const isUnstaged = unstagedMap.has(key);
				if (!merged.has(key)) {
					merged.set(key, {
						key,
						path: entry.path,
						fromPath: entry.fromPath,
						order: entry.order,
						status: shortStatus(entry),
						preferredGroup: group,
						staged: isStaged,
						partiallyStaged: isStaged && isUnstaged,
					});
					continue;
				}

				const current = merged.get(key);
				if (current) {
					merged.set(key, {
						...current,
						order: Math.min(current.order, entry.order),
						staged: current.staged || isStaged,
						partiallyStaged:
							current.partiallyStaged ||
							((current.staged || isStaged) && isUnstaged),
					});
				}
			}
		}

		const nextRows = [...merged.values()];
		const hasPriorOrder = rowOrderRef.current.size > 0;
		nextRows.sort((left, right) => {
			const leftOrder = rowOrderRef.current.get(left.key);
			const rightOrder = rowOrderRef.current.get(right.key);

			if (leftOrder !== undefined && rightOrder !== undefined) {
				return leftOrder - rightOrder;
			}
			if (leftOrder !== undefined) return -1;
			if (rightOrder !== undefined) return 1;
			if (!hasPriorOrder) {
				return left.order - right.order || left.key.localeCompare(right.key);
			}
			return left.order - right.order || left.key.localeCompare(right.key);
		});

		const nextOrder = new Map<string, number>();
		nextRows.forEach((row, index) => {
			nextOrder.set(row.key, index);
		});
		rowOrderRef.current = nextOrder;

		return nextRows;
	}, [gitStatus]);

	if (!activeRepoId) {
		return (
			<div className="p-3 text-xs text-muted-foreground text-center">
				{t("noRepoSelected")}
			</div>
		);
	}

	return (
		<div className="flex h-full min-h-0 w-full flex-col">
			<div className="h-9 px-2 border-b border-border/60 flex items-center gap-2">
				<div className="text-xs font-medium flex items-center gap-1.5 truncate min-w-0">
					<GitBranch className="h-3.5 w-3.5" />
					<span className="truncate">
						{gitStatus?.branch
							? `${t("gitBranch")}: ${gitStatus.branch}`
							: t("gitNoBranch")}
					</span>
				</div>
				<button
					type="button"
					className="ml-auto inline-flex items-center justify-center h-7 w-7 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
					onClick={() => void refreshGitStatus()}
					aria-label={t("gitRefresh")}
				>
					{gitStatusLoading ? (
						<Loader2 className="h-3.5 w-3.5 animate-spin" />
					) : (
						<RefreshCw className="h-3.5 w-3.5" />
					)}
				</button>
			</div>

			{gitStatusError ? (
				<div className="m-2 p-2 text-xs rounded border border-destructive/40 bg-destructive/10 text-destructive flex items-start gap-2">
					<AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
					<span>{gitStatusError}</span>
				</div>
			) : null}

			{gitActionError ? (
				<div className="mx-2 mb-2 p-2 text-xs rounded border border-destructive/40 bg-destructive/10 text-destructive space-y-2">
					<div className="flex items-start gap-2">
						<AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
						<span>{gitActionError}</span>
					</div>
					{activeRepoPath ? (
						<div className="space-y-1.5">
							<div className="text-[11px] text-destructive/90">
								{t("gitRepoPathLabel")}
							</div>
							<div className="rounded border border-destructive/20 bg-background/70 px-2 py-1 text-[11px] text-foreground font-mono select-all break-all">
								{formatRepoPathForTerminal(activeRepoPath)}
							</div>
							<div className="text-[10px] text-destructive/80">
								{t("gitRepoPathHelp")}
							</div>
						</div>
					) : null}
				</div>
			) : null}

			<ScrollArea className="flex-1 w-full overflow-hidden min-h-0">
				<div className="py-1 w-full overflow-hidden">
					{rows.length === 0 && !gitStatusLoading ? (
						<div className="p-3 text-xs text-muted-foreground text-center">
							{t("gitNoChanges")}
						</div>
					) : null}

					{rows.map((row) => {
						const selected =
							gitSelectedChange?.path === row.path &&
							(gitSelectedChange.fromPath ?? "") === (row.fromPath ?? "");

						const selectionGroup = row.preferredGroup;

						return (
							<button
								type="button"
								key={row.key}
								onClick={() =>
									void selectGitChange({
										group: selectionGroup,
										path: row.path,
										fromPath: row.fromPath,
									})
								}
								className={`w-full px-3 py-1.5 text-left text-xs transition-colors flex items-start gap-2 ${
									selected
										? "bg-[var(--highlight-bg)] text-[var(--highlight-text)]"
										: "text-muted-foreground hover:bg-[var(--hover-bg)] hover:text-[var(--hover-text)]"
								}`}
							>
								<span className="font-mono text-[10px] mt-0.5 shrink-0 w-5 text-center">
									<span
										className={`inline-flex min-w-5 justify-center rounded px-1 py-[1px] ${statusToneClass(row.status)}`}
									>
										{row.status}
									</span>
								</span>
								<span
									className="truncate min-w-0 flex-1"
									title={fileLabel(row)}
								>
									{fileLabel(row)}
								</span>
								<input
									type="checkbox"
									checked={row.staged && !row.partiallyStaged}
									disabled={gitActionLoading}
									ref={(element) => {
										if (!element) return;
										element.indeterminate = row.partiallyStaged;
									}}
									onClick={(event) => event.stopPropagation()}
									onChange={(event) => {
										event.stopPropagation();
										void toggleGitStage(
											{
												group: row.staged ? "staged" : row.preferredGroup,
												path: row.path,
												fromPath: row.fromPath,
											},
											event.currentTarget.checked,
										);
									}}
									aria-label={
										row.staged ? t("gitUnstageToggle") : t("gitStageToggle")
									}
									aria-checked={row.partiallyStaged ? "mixed" : row.staged}
									className="h-4 w-4 mt-0.5 shrink-0 accent-primary"
								/>
							</button>
						);
					})}
				</div>
			</ScrollArea>

			<div className="border-t border-border/60 p-2 space-y-2">
				<div className="grid grid-cols-2 gap-1.5">
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className="h-8 text-xs rounded-md bg-muted text-muted-foreground border border-transparent hover:bg-[var(--hover-bg)] hover:text-[var(--hover-text)]"
						disabled={gitActionLoading}
						onClick={() => void syncGitPull()}
					>
						{t("gitSyncButton")}
					</Button>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className="h-8 text-xs rounded-md bg-muted text-muted-foreground border border-transparent hover:bg-[var(--hover-bg)] hover:text-[var(--hover-text)]"
						disabled={gitActionLoading}
						onClick={() => void addAllGitChanges()}
					>
						{t("gitAddAllButton")}
					</Button>
				</div>

				<textarea
					value={gitCommitMessage}
					onChange={(event) => setGitCommitMessage(event.currentTarget.value)}
					placeholder={t("gitCommitPlaceholder")}
					className="w-full h-24 rounded-md border border-input bg-background px-2 py-1.5 text-xs resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
				/>
				<Button
					type="button"
					variant="ghost"
					size="sm"
					className={`w-full h-8 text-xs rounded-md border transition-colors ${
						gitCommitMessage.trim().length > 0
							? "bg-[var(--highlight-bg)] text-[var(--highlight-text)] border-[var(--highlight-text)] hover:bg-[var(--highlight-bg)]/90"
							: "bg-muted text-muted-foreground border-transparent"
					}`}
					disabled={gitActionLoading || gitCommitMessage.trim().length === 0}
					onClick={() => void commitGitChanges()}
				>
					{gitActionLoading ? t("gitCommitting") : t("gitCommitButton")}
				</Button>
			</div>

			{gitStatusLoading && !gitStatus ? (
				<div className="px-3 py-2 text-xs text-muted-foreground border-t border-border/60 flex items-center gap-2">
					<Loader2 className="h-3.5 w-3.5 animate-spin" />
					<span>{t("gitLoading")}</span>
				</div>
			) : null}

			{gitStatus?.clean ? (
				<div className="px-3 py-2 text-xs text-muted-foreground border-t border-border/60 flex items-center gap-2">
					<FilePlus2 className="h-3.5 w-3.5" />
					<span>{t("gitWorkingTreeClean")}</span>
				</div>
			) : null}
		</div>
	);
}
