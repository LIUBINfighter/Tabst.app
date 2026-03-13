export const TABST_GITHUB_REPO_URL =
	"https://github.com/LIUBINfighter/Tabst.app";
export const TABST_GITHUB_DEFAULT_BRANCH = "dev";

export interface RepoLinkContext {
	sourcePath?: string;
	repoUrl?: string;
	repoBranch?: string;
}

const EXTERNAL_PROTOCOL_RE = /^[a-zA-Z][a-zA-Z\d+.-]*:/;

interface HrefParts {
	path: string;
	query: string;
	hash: string;
}

function splitHrefParts(href: string): HrefParts {
	const hashIndex = href.indexOf("#");
	const queryIndex = href.indexOf("?");
	const firstSuffixIndex = [hashIndex, queryIndex]
		.filter((value) => value >= 0)
		.sort((left, right) => left - right)[0];
	const path =
		firstSuffixIndex === undefined ? href : href.slice(0, firstSuffixIndex);
	const query =
		queryIndex >= 0
			? href.slice(
					queryIndex,
					hashIndex >= 0 && hashIndex > queryIndex ? hashIndex : undefined,
				)
			: "";
	const hash = hashIndex >= 0 ? href.slice(hashIndex) : "";
	return { path, query, hash };
}

function normalizePath(path: string): string {
	const segments = path.split("/");
	const normalized: string[] = [];

	for (const segment of segments) {
		if (!segment || segment === ".") {
			continue;
		}
		if (segment === "..") {
			normalized.pop();
			continue;
		}
		normalized.push(segment);
	}

	return normalized.join("/");
}

function encodePathSegments(path: string): string {
	return path
		.split("/")
		.filter(Boolean)
		.map((segment) => encodeURIComponent(segment))
		.join("/");
}

function encodeBranchSegments(branch: string): string {
	return branch
		.split("/")
		.filter(Boolean)
		.map((segment) => encodeURIComponent(segment))
		.join("/");
}

export function isHashHref(href: string): boolean {
	return href.startsWith("#");
}

export function isExternalHref(href: string): boolean {
	return EXTERNAL_PROTOCOL_RE.test(href) || href.startsWith("//");
}

export function normalizeExternalHref(href: string): string {
	return href.startsWith("//") ? `https:${href}` : href;
}

export function resolveRepoRelativeHref(
	href: string,
	context: RepoLinkContext = {},
): string {
	if (!href || isHashHref(href) || isExternalHref(href)) {
		return href;
	}
	if (!context.sourcePath && !context.repoUrl && !context.repoBranch) {
		return href;
	}

	const { path, query, hash } = splitHrefParts(href);
	const repoUrl = context.repoUrl ?? TABST_GITHUB_REPO_URL;
	const repoBranch = context.repoBranch ?? TABST_GITHUB_DEFAULT_BRANCH;
	const sourcePath = context.sourcePath?.trim();
	const sourceSegments = sourcePath
		? sourcePath.split("/").filter(Boolean).slice(0, -1)
		: [];
	const targetSegments = path.split("/").filter(Boolean);
	const normalizedPath = path.startsWith("/")
		? normalizePath(targetSegments.join("/"))
		: normalizePath([...sourceSegments, ...targetSegments].join("/"));

	if (!normalizedPath) {
		return href;
	}

	return `${repoUrl.replace(/\/+$/, "")}/blob/${encodeBranchSegments(repoBranch)}/${encodePathSegments(normalizedPath)}${query}${hash}`;
}
