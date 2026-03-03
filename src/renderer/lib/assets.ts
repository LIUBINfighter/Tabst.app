import type * as alphaTab from "@coderline/alphatab";

function toAscii(bytes: Uint8Array, start: number, length: number): string {
	return String.fromCharCode(...bytes.slice(start, start + length));
}

function isLikelySoundFont(bytes: Uint8Array): boolean {
	if (bytes.length < 12) return false;
	const riff = toAscii(bytes, 0, 4);
	const sfbk = toAscii(bytes, 8, 4);
	return riff === "RIFF" && sfbk === "sfbk";
}

function isElectronRuntime(): boolean {
	if (typeof navigator === "undefined") return false;
	return /\bElectron\//.test(navigator.userAgent);
}

function hasUserActivatedAudio(): boolean {
	if (typeof navigator === "undefined") return true;
	const userActivation = (
		navigator as Navigator & {
			userActivation?: { hasBeenActive?: boolean; isActive?: boolean };
		}
	).userActivation;
	if (!userActivation) return true;
	return Boolean(userActivation.hasBeenActive || userActivation.isActive);
}

let bravuraFontLoadPromise: Promise<boolean> | null = null;
let loadedBravuraFontUrl: string | null = null;

/**
 * 通过 URL 注入字体到 DOM
 * 适用于已经通过 ResourceLoaderService 生成的字体 URL
 */
export async function loadBravuraFont(fontUrl: string): Promise<boolean> {
	const fontName = "Bravura";
	if (
		typeof document !== "undefined" &&
		typeof document.fonts?.check === "function" &&
		document.fonts.check(`1em "${fontName}"`)
	) {
		return true;
	}

	if (bravuraFontLoadPromise && loadedBravuraFontUrl === fontUrl) {
		return bravuraFontLoadPromise;
	}

	loadedBravuraFontUrl = fontUrl;
	bravuraFontLoadPromise = (async () => {
		try {
			const fontFace = new FontFace(fontName, `url(${fontUrl})`);
			await fontFace.load();
			document.fonts.add(fontFace);
			console.info(`[AssetLoader] Loaded Bravura font from: ${fontUrl}`);
			return true;
		} catch (err) {
			console.warn("[AssetLoader] Failed to load Bravura font:", err);
			loadedBravuraFontUrl = null;
			bravuraFontLoadPromise = null;
			return false;
		}
	})();

	try {
		return await bravuraFontLoadPromise;
	} catch (err) {
		console.warn("[AssetLoader] Failed to load Bravura font:", err);
		loadedBravuraFontUrl = null;
		bravuraFontLoadPromise = null;
		return false;
	}
}

/**
 * 通过 URL 加载音频到 alphaTab
 * 适用于已经通过 ResourceLoaderService 生成的音频 URL
 */
export async function loadSoundFontFromUrl(
	api: alphaTab.AlphaTabApi | null,
	soundFontUrl: string,
): Promise<boolean> {
	if (!api) {
		console.warn("[AssetLoader] AlphaTab API not available");
		return false;
	}

	try {
		if (!isElectronRuntime() && !hasUserActivatedAudio()) {
			console.info(
				"[AssetLoader] Skip soundfont preload before user activation in web runtime",
			);
			return false;
		}

		const response = await fetch(soundFontUrl);
		if (!response.ok) {
			console.warn(
				`[AssetLoader] Failed to fetch soundfont: ${response.status}`,
			);
			return false;
		}

		const contentType =
			response.headers.get("content-type")?.toLowerCase() ?? "";
		if (contentType.includes("text/html")) {
			console.warn(
				`[AssetLoader] Soundfont URL returned HTML content: ${soundFontUrl}`,
			);
			return false;
		}

		const buffer = await response.arrayBuffer();
		const u8 = new Uint8Array(buffer);
		if (!isLikelySoundFont(u8)) {
			const preview = toAscii(u8, 0, Math.min(16, u8.length));
			console.warn(
				`[AssetLoader] Invalid soundfont payload from ${soundFontUrl}; header="${preview}"`,
			);
			return false;
		}

		try {
			api.loadSoundFont?.(u8, true);
		} catch (error) {
			console.warn("[AssetLoader] alphaTab rejected soundfont payload:", error);
			return false;
		}

		console.info(`[AssetLoader] Loaded soundfont from: ${soundFontUrl}`);
		return true;
	} catch (err) {
		console.warn("[AssetLoader] Failed to load soundfont:", err);
		return false;
	}
}
