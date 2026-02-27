import { EditorState, RangeSetBuilder } from "@codemirror/state";
import {
	Decoration,
	EditorView,
	ViewPlugin,
	type ViewUpdate,
} from "@codemirror/view";
import { basicSetup } from "codemirror";
import {
	AlertCircle,
	ChevronLeft,
	ChevronRight,
	FileDiff,
	GitBranch,
	Loader2,
	X,
} from "lucide-react";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useAppStore } from "../store/appStore";
import TopBar from "./TopBar";
import IconButton from "./ui/icon-button";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "./ui/tooltip";

interface ReadonlyDiffCodeProps {
	content: string;
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
	".cm-lineNumbers .cm-gutterElement": {
		padding: "0 10px 0 8px",
		opacity: "0.78",
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

function ReadonlyDiffCode({ content }: ReadonlyDiffCodeProps) {
	const containerRef = useRef<HTMLDivElement | null>(null);
	const viewRef = useRef<EditorView | null>(null);

	useEffect(() => {
		if (!containerRef.current) return;
		if (viewRef.current) {
			viewRef.current.destroy();
			viewRef.current = null;
		}

		const state = EditorState.create({
			doc: content,
			extensions: [
				basicSetup,
				EditorState.readOnly.of(true),
				EditorView.editable.of(false),
				readonlyDiffTheme,
				diffLineExtension,
			],
		});

		viewRef.current = new EditorView({ state, parent: containerRef.current });

		return () => {
			if (viewRef.current) {
				viewRef.current.destroy();
				viewRef.current = null;
			}
		};
	}, [content]);

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
	const gitSelectedChange = useAppStore((s) => s.gitSelectedChange);
	const gitDiff = useAppStore((s) => s.gitDiff);
	const gitDiffLoading = useAppStore((s) => s.gitDiffLoading);
	const gitDiffError = useAppStore((s) => s.gitDiffError);

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

				<div className="flex-1 overflow-hidden bg-background">
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
						/>
					)}
				</div>
			</div>
		</TooltipProvider>
	);
}
