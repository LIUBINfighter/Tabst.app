function toCamelCaseKey(key: string): string {
	return key.replace(/_([a-z])/g, (_match, letter: string) =>
		letter.toUpperCase(),
	);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	if (value === null || typeof value !== "object") return false;
	const proto = Object.getPrototypeOf(value);
	return proto === Object.prototype || proto === null;
}

function normalizeValue(value: unknown): unknown {
	if (Array.isArray(value)) {
		return value.map((item) => normalizeValue(item));
	}

	if (value instanceof Uint8Array) {
		return value;
	}

	if (isPlainObject(value)) {
		const normalized: Record<string, unknown> = {};
		for (const [key, entry] of Object.entries(value)) {
			normalized[toCamelCaseKey(key)] = normalizeValue(entry);
		}
		return normalized;
	}

	return value;
}

export function normalizeTauriInvokeArgs(
	args?: Record<string, unknown>,
): Record<string, unknown> | undefined {
	if (!args) return undefined;
	return normalizeValue(args) as Record<string, unknown>;
}
