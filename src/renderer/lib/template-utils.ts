function normalizePath(path: string): string {
	return path.replace(/\\/g, "/");
}

export function normalizeTemplatePath(path: string): string {
	return normalizePath(path);
}

export function isTemplateCandidateName(name: string): boolean {
	const lower = name.toLowerCase();
	return lower.endsWith(".atex") || lower.endsWith(".md");
}

export function isTemplateCandidatePath(path: string): boolean {
	const normalized = normalizePath(path);
	const lastSlashIndex = normalized.lastIndexOf("/");
	const fileName =
		lastSlashIndex >= 0 ? normalized.slice(lastSlashIndex + 1) : normalized;
	if (!fileName) return false;
	return isTemplateCandidateName(fileName);
}

export function sanitizeTemplatePathList(paths: string[]): string[] {
	const sanitized: string[] = [];

	for (const path of paths) {
		const normalized = normalizeTemplatePath(path);
		if (!normalized) continue;
		if (!isTemplateCandidatePath(normalized)) continue;
		if (!sanitized.includes(normalized)) {
			sanitized.push(normalized);
		}
	}

	return sanitized;
}
