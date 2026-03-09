import { FileMusic, Hash } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { extractAtDocFileMeta } from "../lib/atdoc";
import { useAppStore } from "../store/appStore";
import type { FileNode } from "../types/repo";
import { Dialog, DialogContent, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";

interface QuickFileSwitcherProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

interface AtexCandidate {
	id: string;
	name: string;
	path: string;
	metaTags: string[];
	metaClass: string[];
	metaStatus?: "draft" | "active" | "done" | "released";
	metaTabist?: string;
	metaApp?: string;
	metaGithub?: string;
	metaLicense?:
		| "CC0-1.0"
		| "CC-BY-4.0"
		| "CC-BY-SA-4.0"
		| "CC-BY-NC-4.0"
		| "CC-BY-NC-SA-4.0"
		| "CC-BY-ND-4.0"
		| "CC-BY-NC-ND-4.0";
	metaSource?: string;
	metaRelease?: string;
	metaAlias: string[];
	metaTitle?: string;
}

function flattenFileNodes(nodes: FileNode[]): FileNode[] {
	const out: FileNode[] = [];
	for (const node of nodes) {
		if (node.type === "file") {
			out.push(node);
			continue;
		}
		if (node.children?.length) {
			out.push(...flattenFileNodes(node.children));
		}
	}
	return out;
}

function normalizePath(path: string): string {
	return path.replace(/\\/g, "/");
}

function sameStringArray(a: string[] | undefined, b: string[]): boolean {
	if (!a && b.length === 0) return true;
	if (!a || a.length !== b.length) return false;
	for (let i = 0; i < a.length; i += 1) {
		if (a[i] !== b[i]) return false;
	}
	return true;
}

function parseQuery(query: string): {
	text: string;
	tags: string[];
	status?: "draft" | "active" | "done" | "released";
} {
	const tokens = query
		.split(/\s+/)
		.map((part) => part.trim())
		.filter((part) => part.length > 0);

	const tags: string[] = [];
	const textParts: string[] = [];
	let status: "draft" | "active" | "done" | "released" | undefined;

	for (const token of tokens) {
		const lower = token.toLowerCase();
		if (lower.startsWith("tag:#")) {
			const tag = token.slice(5).trim().toLowerCase();
			if (tag) tags.push(tag);
			continue;
		}
		if (token.startsWith("#")) {
			const tag = token.slice(1).trim().toLowerCase();
			if (tag) tags.push(tag);
			continue;
		}
		if (lower.startsWith("status:")) {
			const value = lower.slice(7).trim();
			if (
				value === "draft" ||
				value === "active" ||
				value === "done" ||
				value === "released"
			) {
				status = value;
			}
			continue;
		}
		textParts.push(token);
	}

	return { text: textParts.join(" ").toLowerCase(), tags, status };
}

export default function QuickFileSwitcher({
	open,
	onOpenChange,
}: QuickFileSwitcherProps) {
	const fileTree = useAppStore((s) => s.fileTree);
	const openedFiles = useAppStore((s) => s.files);
	const addFile = useAppStore((s) => s.addFile);
	const setActiveFile = useAppStore((s) => s.setActiveFile);
	const setWorkspaceMode = useAppStore((s) => s.setWorkspaceMode);
	const setFileMeta = useAppStore((s) => s.setFileMeta);

	const [query, setQuery] = useState("");
	const [loading, setLoading] = useState(false);
	const [candidates, setCandidates] = useState<AtexCandidate[]>([]);
	const [selectedIndex, setSelectedIndex] = useState(0);
	const wasOpenRef = useRef(false);
	const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

	const loadCandidates = useCallback(async () => {
		const atexNodes = flattenFileNodes(fileTree).filter((node) =>
			node.name.toLowerCase().endsWith(".atex"),
		);

		const byPath = new Map(
			openedFiles.map((file) => [normalizePath(file.path), file]),
		);

		const loaded: AtexCandidate[] = [];
		for (const node of atexNodes) {
			const normalizedPath = normalizePath(node.path);
			const opened = byPath.get(normalizedPath);
			let metaTags = [...(opened?.metaTags ?? [])];
			let metaClass = [...(opened?.metaClass ?? [])];
			let metaAlias = [...(opened?.metaAlias ?? [])];
			let metaStatus = opened?.metaStatus;
			let metaTabist = opened?.metaTabist;
			let metaApp = opened?.metaApp;
			let metaGithub = opened?.metaGithub;
			let metaLicense = opened?.metaLicense;
			let metaSource = opened?.metaSource;
			let metaRelease = opened?.metaRelease;
			let metaTitle = opened?.metaTitle;

			if (
				metaTags.length === 0 &&
				metaClass.length === 0 &&
				metaAlias.length === 0 &&
				!metaStatus &&
				!metaTabist &&
				!metaApp &&
				!metaGithub &&
				!metaLicense &&
				!metaSource &&
				!metaRelease &&
				!metaTitle
			) {
				let content = opened?.content;
				if (typeof content !== "string" || content.length === 0) {
					const readResult = await window.desktopAPI.readFile(node.path);
					if (!readResult.error) {
						content = readResult.content;
					}
				}

				if (typeof content === "string" && content.length > 0) {
					const parsedMeta = extractAtDocFileMeta(content);
					metaTags = parsedMeta.metaTags;
					metaClass = parsedMeta.metaClass;
					metaAlias = parsedMeta.metaAlias;
					metaStatus = parsedMeta.metaStatus;
					metaTabist = parsedMeta.metaTabist;
					metaApp = parsedMeta.metaApp;
					metaGithub = parsedMeta.metaGithub;
					metaLicense = parsedMeta.metaLicense;
					metaSource = parsedMeta.metaSource;
					metaRelease = parsedMeta.metaRelease;
					metaTitle = parsedMeta.metaTitle;
					if (
						opened &&
						(!sameStringArray(opened.metaClass, metaClass) ||
							!sameStringArray(opened.metaTags, metaTags) ||
							opened.metaStatus !== metaStatus ||
							opened.metaTabist !== metaTabist ||
							opened.metaApp !== metaApp ||
							opened.metaGithub !== metaGithub ||
							opened.metaLicense !== metaLicense ||
							opened.metaSource !== metaSource ||
							opened.metaRelease !== metaRelease ||
							!sameStringArray(opened.metaAlias, metaAlias) ||
							opened.metaTitle !== metaTitle)
					) {
						setFileMeta(
							opened.id,
							metaClass,
							metaTags,
							metaStatus,
							metaTabist,
							metaApp,
							metaGithub,
							metaLicense,
							metaSource,
							metaRelease,
							metaAlias,
							metaTitle,
						);
					}
				}
			}

			loaded.push({
				id: opened?.id ?? node.id,
				name: node.name,
				path: node.path,
				metaTags,
				metaClass,
				metaAlias,
				metaStatus,
				metaTabist,
				metaApp,
				metaGithub,
				metaLicense,
				metaSource,
				metaRelease,
				metaTitle,
			});
		}

		loaded.sort((a, b) => a.name.localeCompare(b.name));
		setCandidates(loaded);
	}, [fileTree, openedFiles, setFileMeta]);

	const loadCandidatesRef = useRef(loadCandidates);

	useEffect(() => {
		loadCandidatesRef.current = loadCandidates;
	}, [loadCandidates]);

	useEffect(() => {
		if (!open) {
			wasOpenRef.current = false;
			return;
		}

		if (!wasOpenRef.current) {
			setQuery("");
			setSelectedIndex(0);
			wasOpenRef.current = true;
		}

		setLoading(true);
		void loadCandidatesRef.current().finally(() => setLoading(false));
	}, [open]);

	const filtered = useMemo(() => {
		const parsed = parseQuery(query);
		const text = parsed.text;
		const tags = parsed.tags;
		const status = parsed.status;

		const withScore = candidates
			.filter((item) => {
				if (status && item.metaStatus !== status) return false;
				if (tags.length > 0) {
					const itemTags = item.metaTags.map((tag) => tag.toLowerCase());
					if (!tags.every((tag) => itemTags.includes(tag))) return false;
				}
				if (!text) return true;
				const aliasHit = item.metaAlias.some((alias) =>
					alias.toLowerCase().includes(text),
				);
				const titleHit = (item.metaTitle ?? "").toLowerCase().includes(text);
				return item.name.toLowerCase().includes(text) || aliasHit || titleHit;
			})
			.map((item) => {
				const name = item.name.toLowerCase();
				const title = (item.metaTitle ?? "").toLowerCase();
				const aliasExact = item.metaAlias.some(
					(alias) => alias.toLowerCase() === text,
				);
				const score = !text
					? 0
					: name === text || title === text || aliasExact
						? 4
						: name.startsWith(text) || title.startsWith(text)
							? 3
							: 2;
				return { item, score };
			})
			.sort((a, b) => {
				if (b.score !== a.score) return b.score - a.score;
				return a.item.name.localeCompare(b.item.name);
			});

		return withScore.map((entry) => entry.item);
	}, [candidates, query]);

	useEffect(() => {
		setSelectedIndex((prev) =>
			Math.min(prev, Math.max(filtered.length - 1, 0)),
		);
	}, [filtered.length]);

	useEffect(() => {
		if (!open) return;
		const active = optionRefs.current[selectedIndex];
		if (!active) return;
		active.scrollIntoView({ block: "nearest" });
	}, [open, selectedIndex]);

	const openCandidate = useCallback(
		async (candidate: AtexCandidate | undefined) => {
			if (!candidate) return;

			const normalizedTarget = normalizePath(candidate.path);
			const existing = useAppStore
				.getState()
				.files.find((file) => normalizePath(file.path) === normalizedTarget);

			if (existing) {
				if (!existing.contentLoaded) {
					const readResult = await window.desktopAPI.readFile(candidate.path);
					if (!readResult.error) {
						addFile({
							id: existing.id,
							name: existing.name,
							path: existing.path,
							content: readResult.content,
							metaClass: existing.metaClass,
							metaTags: existing.metaTags,
							metaAlias: existing.metaAlias,
							metaStatus: existing.metaStatus,
							metaTabist: existing.metaTabist,
							metaApp: existing.metaApp,
							metaGithub: existing.metaGithub,
							metaLicense: existing.metaLicense,
							metaSource: existing.metaSource,
							metaRelease: existing.metaRelease,
							metaTitle: existing.metaTitle,
							contentLoaded: true,
						});
					}
				}
				setActiveFile(existing.id);
				setWorkspaceMode("editor");
				onOpenChange(false);
				return;
			}

			const readResult = await window.desktopAPI.readFile(candidate.path);
			if (readResult.error) return;

			addFile({
				id: candidate.path,
				name: candidate.name,
				path: candidate.path,
				content: readResult.content,
				metaClass: candidate.metaClass,
				metaTags: candidate.metaTags,
				metaAlias: candidate.metaAlias,
				metaStatus: candidate.metaStatus,
				metaTabist: candidate.metaTabist,
				metaApp: candidate.metaApp,
				metaGithub: candidate.metaGithub,
				metaLicense: candidate.metaLicense,
				metaSource: candidate.metaSource,
				metaRelease: candidate.metaRelease,
				metaTitle: candidate.metaTitle,
				contentLoaded: true,
			});
			setActiveFile(candidate.path);
			setWorkspaceMode("editor");
			onOpenChange(false);
		},
		[addFile, onOpenChange, setActiveFile, setWorkspaceMode],
	);

	const handleInputKeyDown = useCallback(
		(event: React.KeyboardEvent<HTMLInputElement>) => {
			if (event.key === "ArrowDown") {
				event.preventDefault();
				setSelectedIndex((prev) =>
					Math.min(prev + 1, Math.max(filtered.length - 1, 0)),
				);
				return;
			}
			if (event.key === "ArrowUp") {
				event.preventDefault();
				setSelectedIndex((prev) => Math.max(prev - 1, 0));
				return;
			}
			if (event.key === "Enter") {
				event.preventDefault();
				void openCandidate(filtered[selectedIndex]);
			}
		},
		[filtered, openCandidate, selectedIndex],
	);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-2xl p-0 gap-0">
				<DialogTitle className="sr-only">Quick Open</DialogTitle>
				<div className="border-b border-border p-3">
					<Input
						autoFocus
						placeholder="Search .atex files... use #tag, tag:#tag, status:released"
						value={query}
						onChange={(event) => {
							setQuery(event.target.value);
							setSelectedIndex(0);
						}}
						onKeyDown={handleInputKeyDown}
					/>
				</div>
				<div className="max-h-[55vh] overflow-auto p-2">
					{loading ? (
						<div className="px-3 py-8 text-center text-sm text-muted-foreground">
							Loading files...
						</div>
					) : filtered.length === 0 ? (
						<div className="px-3 py-8 text-center text-sm text-muted-foreground">
							No matching .atex files.
						</div>
					) : (
						<div className="space-y-1">
							{filtered.map((item, index) => (
								<button
									type="button"
									key={item.path}
									ref={(node) => {
										optionRefs.current[index] = node;
									}}
									onMouseEnter={() => setSelectedIndex(index)}
									onClick={() => void openCandidate(item)}
									className={`w-full rounded-md px-3 py-2 text-left transition-colors ${
										selectedIndex === index
											? "bg-accent text-accent-foreground"
											: "hover:bg-accent/60"
									}`}
								>
									<div className="flex items-center gap-2">
										<FileMusic className="h-4 w-4 text-muted-foreground" />
										<span className="text-sm font-medium">
											{item.metaTitle?.trim() || item.name}
										</span>
										{item.metaStatus ? (
											<span
												className={`rounded border px-1.5 py-0.5 text-[10px] uppercase ${
													item.metaStatus === "done"
														? "border-emerald-500/40 bg-emerald-500/15 text-emerald-600"
														: item.metaStatus === "released"
															? "border-amber-700/40 bg-amber-700/15 text-amber-700"
															: item.metaStatus === "active"
																? "border-primary/40 bg-primary/15 text-primary"
																: "border-border bg-background/70 text-muted-foreground"
												}`}
											>
												{item.metaStatus}
											</span>
										) : null}
									</div>
									<div className="mt-1 text-xs text-muted-foreground truncate">
										{item.path}
									</div>
									{item.metaAlias.length > 0 ? (
										<div className="mt-1 text-[11px] text-muted-foreground truncate">
											aka: {item.metaAlias.join(", ")}
										</div>
									) : null}
									{item.metaTags.length > 0 ? (
										<div className="mt-2 flex flex-wrap items-center gap-1">
											{item.metaTags.map((tag) => (
												<span
													key={`${item.path}-${tag}`}
													className="inline-flex items-center gap-1 rounded border border-border bg-background/70 px-1.5 py-0.5 text-[11px] text-muted-foreground"
												>
													<Hash className="h-3 w-3" />
													{tag}
												</span>
											))}
										</div>
									) : null}
								</button>
							))}
						</div>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}
