export interface ResourceUrls {
	workerUrl: string;
	bravuraFontUrl: string;
	bravuraFontDirectory: string;
	soundFontUrl: string;
}

const DOCUMENT_PATH_EXTENSIONS = new Set([
	"html",
	"htm",
	"xhtml",
	"php",
	"asp",
	"aspx",
	"jsp",
]);

function looksLikeDocumentPath(pathname: string): boolean {
	const lastSlashIndex = pathname.lastIndexOf("/");
	const lastSegment = pathname
		.slice(lastSlashIndex + 1)
		.trim()
		.toLowerCase();
	if (!lastSegment) return false;

	const dotIndex = lastSegment.lastIndexOf(".");
	if (dotIndex <= 0 || dotIndex >= lastSegment.length - 1) return false;

	const extension = lastSegment.slice(dotIndex + 1);
	return DOCUMENT_PATH_EXTENSIONS.has(extension);
}

function normalizeDirectoryPath(pathname: string): string {
	if (pathname.length === 0) return "/";
	if (pathname.endsWith("/")) return pathname;

	if (looksLikeDocumentPath(pathname)) {
		const lastSlashIndex = pathname.lastIndexOf("/");
		return lastSlashIndex >= 0 ? pathname.slice(0, lastSlashIndex + 1) : "/";
	}

	return `${pathname}/`;
}

function toBaseWithTrailingSlash(base: string): string {
	return base.endsWith("/") ? base : `${base}/`;
}

/**
 * 获取所有 AlphaTab 资源 URL
 * 自动区分开发环境和打包环境，生成正确的资源 URL
 */
export async function getResourceUrls(): Promise<ResourceUrls> {
	const buildPublicAssetUrl = (fileName: string): string => {
		const assetPath = `assets/${fileName}`.replace(/\/{2,}/g, "/");

		// 获取当前页面 URL
		if (typeof window === "undefined" || !window.location?.href) {
			console.warn(
				"[ResourceLoaderService] No window.location available, falling back to absolute path",
			);
			return `/${assetPath}`;
		}

		const href = window.location.href;
		const origin = window.location.origin;
		const viteBaseUrlRaw =
			typeof import.meta !== "undefined" &&
			"env" in import.meta &&
			typeof (import.meta as unknown as { env?: { BASE_URL?: unknown } })
				.env === "object"
				? (import.meta as unknown as { env?: { BASE_URL?: unknown } }).env
						?.BASE_URL
				: undefined;
		const viteBaseUrl =
			typeof viteBaseUrlRaw === "string" && viteBaseUrlRaw.trim().length > 0
				? viteBaseUrlRaw.trim()
				: "/";

		try {
			// 例如：file:///C:/Users/.../resources/app.asar/dist/src/renderer/index.html
			// 此时需要向上遍历到 dist/ 目录，然后再访问 assets/
			// 所以相对路径应该是：../../assets/alphaTab.min.js
			if (href.startsWith("file:")) {
				// 方案 1：相对路径向上两级（从 dist/src/renderer/ → dist/）
				const url = new URL(`../../${assetPath}`, href).toString();
				return url;
			}

			// HTTP 环境：使用 Vite BASE_URL，兼容 GitHub Pages 子路径部署（如 /Tabst.app/）
			if (/^https?:\/\//i.test(viteBaseUrl)) {
				return new URL(
					assetPath,
					toBaseWithTrailingSlash(viteBaseUrl),
				).toString();
			}

			if (viteBaseUrl === "/") {
				return new URL(`/${assetPath}`, origin).toString();
			}

			if (
				viteBaseUrl === "." ||
				viteBaseUrl.startsWith("./") ||
				viteBaseUrl.startsWith("../")
			) {
				const pageBasePath = normalizeDirectoryPath(window.location.pathname);
				const pageBaseUrl = new URL(pageBasePath, origin);
				const relativeBase = viteBaseUrl === "." ? "./" : viteBaseUrl;
				return new URL(`${relativeBase}${assetPath}`, pageBaseUrl).toString();
			}

			const normalizedBase = toBaseWithTrailingSlash(
				viteBaseUrl.startsWith("/") ? viteBaseUrl : `/${viteBaseUrl}`,
			);
			return new URL(`${normalizedBase}${assetPath}`, origin).toString();
		} catch (err) {
			console.warn(
				"[ResourceLoaderService] Failed to build asset URL via URL constructor",
				err,
			);
			// 降级：返回绝对路径
			return `/${assetPath}`;
		}
	};

	const workerUrl = buildPublicAssetUrl("alphaTab.min.js");
	const bravuraFontUrl = buildPublicAssetUrl("Bravura.woff2");
	const soundFontUrl = buildPublicAssetUrl("sonivox.sf3");

	// 获取字体目录：需要移除文件名部分
	// 例如：file:///path/dist/assets/Bravura.woff2 → file:///path/dist/assets/
	const bravuraFontDirectory = bravuraFontUrl.substring(
		0,
		bravuraFontUrl.lastIndexOf("/") + 1,
	);

	// 开发环境日志
	const isDev =
		typeof import.meta !== "undefined" &&
		"env" in import.meta &&
		typeof (import.meta as unknown as Record<string, unknown>).env ===
			"object" &&
		(import.meta as unknown as Record<string, Record<string, unknown>>).env
			.DEV === true;

	if (isDev) {
		// 验证 worker 脚本是否可访问（开发环境）
		try {
			const response = await fetch(workerUrl, { method: "HEAD" });
			if (!response.ok) {
				console.warn(
					`[ResourceLoaderService] ⚠️ Worker script may not be accessible: ${workerUrl} (${response.status})`,
				);
			} else {
			}
		} catch (error) {
			console.warn(
				"[ResourceLoaderService] ⚠️ Failed to verify worker script:",
				error,
			);
		}
	}

	return {
		workerUrl,
		bravuraFontUrl,
		bravuraFontDirectory,
		soundFontUrl,
	};
}
