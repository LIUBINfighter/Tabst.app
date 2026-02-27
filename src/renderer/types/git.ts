export type GitChangeGroup = "staged" | "unstaged" | "untracked" | "conflicted";

export interface GitChangeEntry {
	path: string;
	fromPath?: string;
	x: string;
	y: string;
	order: number;
}

export interface GitStatusSummary {
	branch: string | null;
	tracking: string | null;
	ahead: number;
	behind: number;
	detached: boolean;
	staged: GitChangeEntry[];
	unstaged: GitChangeEntry[];
	untracked: GitChangeEntry[];
	conflicted: GitChangeEntry[];
	clean: boolean;
	generatedAt: number;
}

export interface GitSelectedChange {
	group: GitChangeGroup;
	path: string;
	fromPath?: string;
}

export interface GitDiffResult {
	path: string;
	group: GitChangeGroup;
	mode: "patch" | "text" | "binary";
	binary: boolean;
	content: string;
	notice?: string;
}
