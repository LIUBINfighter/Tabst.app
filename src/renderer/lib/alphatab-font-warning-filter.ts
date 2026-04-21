type WarningLogger = {
	warning: (category: string, message: string, details?: unknown) => void;
	__tabstAlphaTabFontWarningPatched__?: boolean;
};

type InstallOptions = {
	checkFontAvailable?: (family: string) => boolean;
};

type SuppressOptions = {
	checkFontAvailable: (family: string) => boolean;
	message: string;
};

const FONT_WARNING_PATTERN = /^Could not load font '([^']+)' within \d+ seconds$/;

export function parseAlphaTabFontWarningFamily(
	message: string,
): string | null {
	const match = FONT_WARNING_PATTERN.exec(message.trim());
	return match?.[1] ?? null;
}

function defaultCheckFontAvailable(family: string): boolean {
	if (typeof document === "undefined" || typeof document.fonts?.check !== "function") {
		return false;
	}

	try {
		return (
			document.fonts.check(`1em "${family}"`) ||
			document.fonts.check(`1em ${family}`)
		);
	} catch {
		return false;
	}
}

export function shouldSuppressAlphaTabFontWarning(
	category: string,
	options: SuppressOptions,
): boolean {
	if (category !== "Rendering") return false;
	const family = parseAlphaTabFontWarningFamily(options.message);
	if (!family) return false;
	return options.checkFontAvailable(family);
}

export function installAlphaTabFontWarningFilter(
	logger: WarningLogger,
	options: InstallOptions = {},
): void {
	if (logger.__tabstAlphaTabFontWarningPatched__) return;

	const checkFontAvailable =
		options.checkFontAvailable ?? defaultCheckFontAvailable;
	const originalWarning = logger.warning.bind(logger);

	logger.warning = (category: string, message: string, details?: unknown) => {
		if (
			shouldSuppressAlphaTabFontWarning(category, {
				checkFontAvailable,
				message,
			})
		) {
			return;
		}

		originalWarning(category, message, details);
	};

	logger.__tabstAlphaTabFontWarningPatched__ = true;
}
