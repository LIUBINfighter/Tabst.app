import { EditorState, RangeSetBuilder } from "@codemirror/state";
import {
	Decoration,
	EditorView,
	GutterMarker,
	gutter,
	ViewPlugin,
	type ViewUpdate,
} from "@codemirror/view";
import {
	AlertCircle,
	ArrowLeft,
	ArrowRight,
	ChevronLeft,
	ChevronRight,
	FileDiff,
	GitBranch,
	Loader2,
	Plus,
	X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
	type ParsedUnifiedDiff,
	parseUnifiedDiff,
} from "../lib/git-unified-diff";
import { useAppStore } from "../store/appStore";
import type { GitChangeEntry, GitChangeGroup } from "../types/git";
import TopBar from "./TopBar";
import { Button } from "./ui/button";
import IconButton from "./ui/icon-button";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "./ui/tooltip";

interface ReadonlyDiffCodeProps {
	content: string;
	parsedDiff: ParsedUnifiedDiff | null;
}

const addedLineDecoration = Decoration.line({ class: "cm-gitdiff-add-line" });
const removedLineDecoration = Decoration.line({
	class: "cm-gitdiff-remove-line",
});

function buildDiffLineDecorations(state: EditorState) {
	const builder = new RangeSetBuilder<Decoration>();
	for (let lineNumber = 1; lineNumber <= state.doc.lines; lineNumber += 1) {
		const line = state.doc.line(lineNumber);
		const text = line.text;
		if (text.startsWith("+") && !text.startsWith("+++")) {
			builder.add(line.from, line.from, addedLineDecoration);
			continue;
		}
		if (text.startsWith("-") && !text.startsWith("---")) {
			builder.add(line.from, line.from, removedLineDecoration);
		}
	}
	return builder.finish();
}

const diffLineExtension = ViewPlugin.fromClass(
	class {
		decorations;

		constructor(view: EditorView) {
			this.decorations = buildDiffLineDecorations(view.state);
		}

		update(update: ViewUpdate) {
			if (update.docChanged) {
				this.decorations = buildDiffLineDecorations(update.state);
			}
		}
	},
	{
		decorations: (value) => value.decorations,
	},
);

const readonlyDiffTheme = EditorView.theme({
	"&": {
		height: "100%",
		backgroundColor: "hsl(var(--background))",
	},
	".cm-scroller": {
		fontFamily:
			"ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
		lineHeight: "1.5",
	},
	".cm-content": {
		padding: "8px 0",
	},
	".cm-line": {
		padding: "0 12px",
	},
	".cm-gutters": {
		backgroundColor: "hsl(var(--card))",
		color: "hsl(var(--muted-foreground))",
		borderRight: "1px solid hsl(var(--border))",
	},
	".cm-realLineGutter": {
		backgroundColor: "hsl(var(--card))",
		borderRight: "1px solid hsl(var(--border))",
	},
	".cm-realLineGutter .cm-gutterElement": {
		padding: "0 8px",
		minWidth: "7.5ch",
		textAlign: "right",
		opacity: "0.82",
		fontVariantNumeric: "tabular-nums",
		whiteSpace: "pre",
	},
	".cm-activeLine, .cm-activeLineGutter": {
		backgroundColor: "transparent",
	},
	".cm-gitdiff-add-line": {
		backgroundColor: "rgba(34, 197, 94, 0.12)",
		boxShadow: "inset 2px 0 0 rgba(34, 197, 94, 0.7)",
	},
	".cm-gitdiff-remove-line": {
		backgroundColor: "rgba(239, 68, 68, 0.12)",
		boxShadow: "inset 2px 0 0 rgba(239, 68, 68, 0.7)",
	},
});

class RealLineNumberMarker extends GutterMarker {
	private label: string;

	constructor(label: string) {
		super();
		this.label = label;
	}

	eq(other: RealLineNumberMarker) {
		return this.label === other.label;
	}

	toDOM() {
		const element = document.createElement("span");
		element.textContent = this.label;
		element.className = "cm-real-line-number";
		return element;
	}
}

function createRealLineNumberLabels(
	parsedDiff: ParsedUnifiedDiff | null,
): string[] {
	if (!parsedDiff) return [];

	const maxOld = parsedDiff.lines.reduce(
		(max, line) =>
			line.oldLine !== null && line.oldLine > max ? line.oldLine : max,
		0,
	);
	const maxNew = parsedDiff.lines.reduce(
		(max, line) =>
			line.newLine !== null && line.newLine > max ? line.newLine : max,
		0,
	);

	const oldWidth = Math.max(1, String(maxOld || 0).length);
	const newWidth = Math.max(1, String(maxNew || 0).length);

	return parsedDiff.lines.map((line) => {
		if (line.oldLine === null && line.newLine === null) {
			return "";
		}

		const oldLabel =
			line.oldLine === null
				? " ".repeat(oldWidth)
				: String(line.oldLine).padStart(oldWidth, " ");
		const newLabel =
			line.newLine === null
				? " ".repeat(newWidth)
				: String(line.newLine).padStart(newWidth, " ");
		return `${oldLabel}│${newLabel}`;
	});
}

function createRealLineNumberGutter(parsedDiff: ParsedUnifiedDiff | null) {
	const labels = createRealLineNumberLabels(parsedDiff);
	const maxLabel = labels.reduce(
		(max, label) => (label.length > max.length ? label : max),
		"",
	);

	return gutter({
		class: "cm-realLineGutter",
		lineMarker(view, line) {
			const lineNumber = view.state.doc.lineAt(line.from).number;
			const label = labels[lineNumber - 1] ?? "";
			return new RealLineNumberMarker(label);
		},
		initialSpacer() {
			return new RealLineNumberMarker(maxLabel || "1│1");
		},
	});
}

function ReadonlyDiffCode({ content, parsedDiff }: ReadonlyDiffCodeProps) {
	const containerRef = useRef<HTMLDivElement | null>(null);
	const viewRef = useRef<EditorView | null>(null);

	const realLineNumberGutter = useMemo(
		() => createRealLineNumberGutter(parsedDiff),
		[parsedDiff],
	);

	useEffect(() => {
		if (!containerRef.current) return;
		if (viewRef.current) {
			viewRef.current.destroy();
			viewRef.current = null;
		}

		const state = EditorState.create({
			doc: content,
			extensions: [
				EditorState.readOnly.of(true),
				EditorView.editable.of(false),
				readonlyDiffTheme,
				diffLineExtension,
				realLineNumberGutter,
			],
		});

		viewRef.current = new EditorView({ state, parent: containerRef.current });

		return () => {
			if (viewRef.current) {
				viewRef.current.destroy();
				viewRef.current = null;
			}
		};
	}, [content, realLineNumberGutter]);

	return <div ref={containerRef} className="h-full w-full overflow-hidden" />;
}

export interface GitWorkspaceProps {
	showExpandSidebar?: boolean;
	onExpandSidebar?: () => void;
	onCollapseSidebar?: () => void;
}

export default function GitWorkspace({
	showExpandSidebar,
	onExpandSidebar,
	onCollapseSidebar,
}: GitWorkspaceProps) {
	const { t } = useTranslation(["sidebar", "common"]);
	const setWorkspaceMode = useAppStore((s) => s.setWorkspaceMode);
	const activeRepoId = useAppStore((s) => s.activeRepoId);
	const gitStatus = useAppStore((s) => s.gitStatus);
	const gitSelectedChange = useAppStore((s) => s.gitSelectedChange);
	const gitDiff = useAppStore((s) => s.gitDiff);
	const gitDiffLoading = useAppStore((s) => s.gitDiffLoading);
	const gitDiffError = useAppStore((s) => s.gitDiffError);
	const gitActionLoading = useAppStore((s) => s.gitActionLoading);
	const selectGitChange = useAppStore((s) => s.selectGitChange);
	const toggleGitStage = useAppStore((s) => s.toggleGitStage);
	const rowOrderRef = useRef<Map<string, number>>(new Map());

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

	const selectedIndex = useMemo(() => {
		if (!gitSelectedChange) return -1;
		return rows.findIndex(
			(row) =>
				row.path === gitSelectedChange.path &&
				(row.fromPath ?? "") === (gitSelectedChange.fromPath ?? ""),
		);
	}, [rows, gitSelectedChange]);

	const selectedRow = selectedIndex >= 0 ? rows[selectedIndex] : null;
	const canAddCurrent =
		!!selectedRow && (!selectedRow.staged || selectedRow.partiallyStaged);

	const parsedDiff = useMemo(() => {
		if (!gitDiff || gitDiff.binary || gitDiff.mode !== "patch") {
			return null;
		}
		return parseUnifiedDiff(gitDiff.content);
	}, [gitDiff]);

	const selectRow = useCallback(
		async (row: UnifiedRow | null) => {
			if (!row) return;
			const group: GitChangeGroup =
				row.staged && !row.partiallyStaged ? "staged" : row.preferredGroup;
			await selectGitChange({
				group,
				path: row.path,
				fromPath: row.fromPath,
			});
		},
		[selectGitChange],
	);

	const selectRelative = useCallback(
		async (direction: 1 | -1) => {
			if (rows.length === 0) return;
			if (selectedIndex < 0) {
				const fallback = direction === 1 ? rows[0] : rows[rows.length - 1];
				await selectRow(fallback);
				return;
			}
			const nextIndex =
				(selectedIndex + direction + rows.length) % Math.max(rows.length, 1);
			await selectRow(rows[nextIndex] ?? null);
		},
		[rows, selectedIndex, selectRow],
	);

	const addCurrent = useCallback(async () => {
		if (!selectedRow) return;
		const group: GitChangeGroup =
			selectedRow.staged && !selectedRow.partiallyStaged
				? "staged"
				: selectedRow.preferredGroup;
		await toggleGitStage(
			{
				group,
				path: selectedRow.path,
				fromPath: selectedRow.fromPath,
			},
			true,
		);
	}, [selectedRow, toggleGitStage]);

	useEffect(() => {
		const isTypingTarget = (target: EventTarget | null): boolean => {
			if (!(target instanceof HTMLElement)) return false;
			const tagName = target.tagName.toLowerCase();
			return (
				tagName === "input" ||
				tagName === "textarea" ||
				tagName === "select" ||
				target.isContentEditable
			);
		};

		const handleKeyDown = (event: KeyboardEvent) => {
			if (gitActionLoading) return;
			if (isTypingTarget(event.target)) return;

			if (
				event.key === "Enter" ||
				event.key === " " ||
				event.key === "Spacebar"
			) {
				if (!selectedRow) return;
				event.preventDefault();
				if (canAddCurrent) {
					void addCurrent();
				} else {
					void selectRelative(1);
				}
				return;
			}

			if (event.key === "ArrowRight") {
				event.preventDefault();
				void selectRelative(1);
				return;
			}

			if (event.key === "ArrowLeft") {
				event.preventDefault();
				void selectRelative(-1);
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [
		canAddCurrent,
		gitActionLoading,
		addCurrent,
		selectRelative,
		selectedRow,
	]);

	return (
		<TooltipProvider delayDuration={200}>
			<div className="flex-1 flex flex-col min-h-0 overflow-hidden">
				<TopBar
					leading={
						showExpandSidebar
							? onExpandSidebar && (
									<div className="flex items-center gap-1">
										<Tooltip>
											<TooltipTrigger asChild>
												<IconButton onClick={onExpandSidebar}>
													<ChevronRight className="h-4 w-4" />
												</IconButton>
											</TooltipTrigger>
											<TooltipContent side="bottom">
												<p>{t("sidebar:expandSidebar")}</p>
											</TooltipContent>
										</Tooltip>
									</div>
								)
							: onCollapseSidebar && (
									<div className="flex items-center gap-1">
										<Tooltip>
											<TooltipTrigger asChild>
												<IconButton onClick={onCollapseSidebar}>
													<ChevronLeft className="h-4 w-4" />
												</IconButton>
											</TooltipTrigger>
											<TooltipContent side="bottom">
												<p>{t("sidebar:collapseSidebar")}</p>
											</TooltipContent>
										</Tooltip>
									</div>
								)
					}
					icon={
						<GitBranch className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
					}
					title={t("sidebar:gitView")}
					trailing={
						<div className="flex items-center gap-1">
							<Tooltip>
								<TooltipTrigger asChild>
									<IconButton
										destructive
										onClick={() => setWorkspaceMode("editor")}
									>
										<X className="h-4 w-4" />
									</IconButton>
								</TooltipTrigger>
								<TooltipContent side="bottom">
									<p>{t("common:close")}</p>
								</TooltipContent>
							</Tooltip>
						</div>
					}
				/>

				<div className="relative flex-1 overflow-hidden bg-background">
					{!activeRepoId ? (
						<div className="h-full flex items-center justify-center text-sm text-muted-foreground">
							{t("sidebar:noRepoSelected")}
						</div>
					) : gitDiffLoading ? (
						<div className="h-full flex items-center justify-center text-sm text-muted-foreground gap-2">
							<Loader2 className="h-4 w-4 animate-spin" />
							<span>{t("sidebar:gitLoadingDiff")}</span>
						</div>
					) : gitDiffError ? (
						<div className="h-full p-4">
							<div className="rounded border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive flex items-start gap-2">
								<AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
								<span>{gitDiffError}</span>
							</div>
						</div>
					) : !gitSelectedChange ? (
						<div className="h-full flex items-center justify-center text-sm text-muted-foreground gap-2">
							<FileDiff className="h-4 w-4" />
							<span>{t("sidebar:gitSelectFileHint")}</span>
						</div>
					) : gitDiff?.binary ? (
						<div className="h-full p-4">
							<div className="rounded border border-border bg-card p-4 text-sm">
								<div className="font-medium mb-1">{gitDiff.path}</div>
								<div className="text-muted-foreground">
									{gitDiff.notice ?? t("sidebar:gitBinaryNotice")}
								</div>
							</div>
						</div>
					) : (
						<ReadonlyDiffCode
							content={gitDiff?.content || t("sidebar:gitEmptyDiffFallback")}
							parsedDiff={parsedDiff}
						/>
					)}

					{selectedRow ? (
						<div className="pointer-events-none absolute bottom-4 right-4 z-20">
							{canAddCurrent ? (
								<Button
									type="button"
									variant="ghost"
									size="sm"
									onClick={() => void addCurrent()}
									disabled={gitActionLoading}
									className="pointer-events-auto h-9 min-w-28 justify-center gap-1.5 text-xs rounded-md transition-colors bg-[var(--highlight-bg)] text-[var(--highlight-text)] border border-[var(--highlight-text)] hover:bg-[var(--highlight-bg)]/90"
								>
									<Plus className="h-3.5 w-3.5 text-emerald-500" />
									<span>{t("sidebar:gitPrimaryAdd")}</span>
									<span className="rounded border border-current/20 px-1 py-0 text-[10px] leading-none opacity-80">
										{t("sidebar:gitPrimaryAddKeys")}
									</span>
								</Button>
							) : (
								<div className="pointer-events-auto flex items-center gap-1.5">
									<Button
										type="button"
										variant="ghost"
										size="sm"
										onClick={() => void selectRelative(-1)}
										disabled={gitActionLoading}
										className="h-9 min-w-20 justify-center gap-1.5 text-xs rounded-md bg-muted text-muted-foreground border border-transparent hover:bg-[var(--hover-bg)] hover:text-[var(--hover-text)]"
									>
										<ArrowLeft className="h-3.5 w-3.5" />
										<span>{t("sidebar:gitPrimaryPrev")}</span>
									</Button>
									<Button
										type="button"
										variant="ghost"
										size="sm"
										onClick={() => void selectRelative(1)}
										disabled={gitActionLoading}
										className="h-9 min-w-24 justify-center gap-1.5 text-xs rounded-md bg-muted text-muted-foreground border border-transparent hover:bg-[var(--hover-bg)] hover:text-[var(--hover-text)]"
									>
										<ArrowRight className="h-3.5 w-3.5" />
										<span>{t("sidebar:gitPrimaryNext")}</span>
										<span className="rounded border border-current/20 px-1 py-0 text-[10px] leading-none opacity-80">
											{t("sidebar:gitPrimaryNextKeys")}
										</span>
									</Button>
								</div>
							)}
						</div>
					) : null}
				</div>
			</div>
		</TooltipProvider>
	);
}
