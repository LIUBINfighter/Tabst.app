export function getPrintFontFamilies(primaryFontName: string): string[] {
	return Array.from(new Set([primaryFontName, "alphaTab", "Bravura"]));
}

export function buildPrintFontFamilyCssValue(
	primaryFontName: string,
	fallback = "sans-serif",
): string {
	return `${getPrintFontFamilies(primaryFontName)
		.map((fontName) => `'${fontName}'`)
		.join(", ")}, ${fallback}`;
}

export function buildPrintFontFaceCss(
	primaryFontName: string,
	fontUrl: string,
): string {
	return getPrintFontFamilies(primaryFontName)
		.map(
			(fontName) => `
				@font-face {
					font-family: '${fontName}';
					src: url('${fontUrl}') format('woff2');
					font-weight: normal;
					font-style: normal;
					font-display: block;
				}
			`,
		)
		.join("\n");
}
