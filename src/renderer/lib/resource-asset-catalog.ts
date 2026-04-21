export interface BuiltInResourceAsset {
	id: string;
	label: string;
	relativeUrl: string;
	sizeLabel: string;
	licensePath: string;
}

export const BUILT_IN_FONT_OPTIONS: BuiltInResourceAsset[] = [
	{
		id: "bravura",
		label: "Bravura",
		relativeUrl: "assets/Bravura.woff2",
		sizeLabel: "0.2 MB",
		licensePath: "public/assets/fonts/bravura/LICENSE.md",
	},
	{
		id: "leland",
		label: "Leland",
		relativeUrl: "assets/fonts/leland/Leland.otf",
		sizeLabel: "0.1 MB",
		licensePath: "public/assets/fonts/leland/LICENSE.md",
	},
	{
		id: "petaluma",
		label: "Petaluma",
		relativeUrl: "assets/fonts/petaluma/Petaluma.otf",
		sizeLabel: "0.4 MB",
		licensePath: "public/assets/fonts/petaluma/LICENSE.md",
	},
];

export const BUILT_IN_SOUNDFONT_OPTIONS: BuiltInResourceAsset[] = [
	{
		id: "sonivox",
		label: "Sonivox",
		relativeUrl: "assets/sonivox.sf3",
		sizeLabel: "0.9 MB",
		licensePath: "public/assets/soundfonts/sonivox/LICENSE.md",
	},
	{
		id: "generaluser-gs",
		label: "GeneralUser GS",
		relativeUrl: "assets/soundfonts/generaluser-gs/GeneralUser-GS.sf2",
		sizeLabel: "30.8 MB",
		licensePath: "public/assets/soundfonts/generaluser-gs/LICENSE.md",
	},
];

export function normalizeAssetOverrideUrl(url: string): string {
	const trimmed = url.trim();
	if (trimmed.length === 0) return "";
	if (/^[a-z][a-z\d+\-.]*:/i.test(trimmed)) return trimmed;
	return trimmed.replace(/^\/+/, "");
}

export function getBuiltInFontByUrl(url: string): BuiltInResourceAsset | null {
	const normalized = normalizeAssetOverrideUrl(url);
	return (
		BUILT_IN_FONT_OPTIONS.find(
			(option) => normalizeAssetOverrideUrl(option.relativeUrl) === normalized,
		) ?? null
	);
}

export function getBuiltInSoundFontByUrl(
	url: string,
): BuiltInResourceAsset | null {
	const normalized = normalizeAssetOverrideUrl(url);
	return (
		BUILT_IN_SOUNDFONT_OPTIONS.find(
			(option) => normalizeAssetOverrideUrl(option.relativeUrl) === normalized,
		) ?? null
	);
}
