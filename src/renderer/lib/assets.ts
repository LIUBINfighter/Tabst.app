import type * as alphaTab from "@coderline/alphatab";

const ASSET_PROTOCOL_CHUNK_SIZE = 100;

/**
 * 构造 Tauri asset protocol URL（asset://localhost/<encoded absolute path>）
 * 用于在 CSP 允许的 connect-src 范围内 fetch 外部本地文件。
 * 分段 percent-encode 避免 WKWebView 对超长 URL 的 chunk 限制。
 */
export function toAssetProtocolUrl(filePath: string): string {
	const encoded = filePath
		.split("")
		.map((char, index) =>
			index % ASSET_PROTOCOL_CHUNK_SIZE === 0 ? encodeURIComponent(char) : char,
		)
		.join("");
	return `asset://localhost/${encoded}`;
}

function toAscii(bytes: Uint8Array, start: number, length: number): string {
	return String.fromCharCode(...bytes.slice(start, start + length));
}

function isLikelySoundFont(bytes: Uint8Array): boolean {
	if (bytes.length < 12) return false;
	const riff = toAscii(bytes, 0, 4);
	const sfbk = toAscii(bytes, 8, 4);
	return riff === "RIFF" && sfbk === "sfbk";
}

function isDesktopShellRuntime(): boolean {
	if (typeof window === "undefined") return false;

	const maybeWindow = window as Window & {
		__TAURI_INTERNALS__?: unknown;
		__TAURI__?: unknown;
		__TAURI_IPC__?: unknown;
	};
	const userAgent = typeof navigator === "undefined" ? "" : navigator.userAgent;

	return (
		Boolean(maybeWindow.__TAURI_INTERNALS__) ||
		Boolean(maybeWindow.__TAURI__) ||
		Boolean(maybeWindow.__TAURI_IPC__) ||
		window.location.protocol === "tauri:" ||
		window.location.hostname === "tauri.localhost" ||
		/\bTauri\b/i.test(userAgent)
	);
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
	const fontNames = ["Bravura", "alphaTab"];
	if (
		typeof document !== "undefined" &&
		typeof document.fonts?.check === "function" &&
		fontNames.every((fontName) => document.fonts.check(`1em "${fontName}"`))
	) {
		return true;
	}

	if (bravuraFontLoadPromise && loadedBravuraFontUrl === fontUrl) {
		return bravuraFontLoadPromise;
	}

	loadedBravuraFontUrl = fontUrl;
	bravuraFontLoadPromise = (async () => {
		try {
			const fontFaces = fontNames.map(
				(fontName) => new FontFace(fontName, `url(${fontUrl})`),
			);
			await Promise.all(fontFaces.map((fontFace) => fontFace.load()));
			for (const fontFace of fontFaces) {
				document.fonts.add(fontFace);
			}
			console.info(
				`[AssetLoader] Loaded Bravura/alphaTab fonts from: ${fontUrl}`,
			);
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

const soundFontLoadsInFlight = new Map<string, Promise<boolean>>();

/**
 * 通过 URL 加载音频到 alphaTab
 * 适用于已经通过 ResourceLoaderService 生成的音频 URL
 *
 * 并发调用同一 URL 时复用同一个加载任务；字体以替换（非追加）方式加载，
 * 避免 focus/visibility 并发恢复或重复恢复导致相同 SoundFont 被重复 append。
 */
export async function loadSoundFontFromUrl(
	api: alphaTab.AlphaTabApi | null,
	soundFontUrl: string,
): Promise<boolean> {
	if (!api) {
		console.warn("[AssetLoader] AlphaTab API not available");
		return false;
	}

	const inFlight = soundFontLoadsInFlight.get(soundFontUrl);
	if (inFlight) {
		return inFlight;
	}

	const task = loadSoundFontFromUrlInner(api, soundFontUrl);
	soundFontLoadsInFlight.set(soundFontUrl, task);
	try {
		return await task;
	} finally {
		soundFontLoadsInFlight.delete(soundFontUrl);
	}
}

async function loadSoundFontFromUrlInner(
	api: alphaTab.AlphaTabApi,
	soundFontUrl: string,
): Promise<boolean> {
	try {
		if (!isDesktopShellRuntime() && !hasUserActivatedAudio()) {
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
			api.loadSoundFont?.(u8, false);
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
