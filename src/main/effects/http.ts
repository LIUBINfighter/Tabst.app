import https from "node:https";
import { Effect } from "effect";

export class HttpError {
	readonly _tag = "HttpError";
	constructor(
		readonly message: string,
		readonly cause?: unknown,
	) {}
}

const MAX_RESPONSE_SIZE = 5 * 1024 * 1024; // 5MB
const REQUEST_TIMEOUT_MS = 10000;

function httpsGet(
	url: string,
): Promise<{ success: boolean; data?: string; error?: string }> {
	return new Promise((resolve) => {
		const urlObj = new URL(url);

		if (urlObj.hostname !== "github.com") {
			resolve({ success: false, error: "Invalid hostname" });
			return;
		}

		let data = "";
		let totalSize = 0;

		const options = {
			hostname: urlObj.hostname,
			path: urlObj.pathname + urlObj.search,
			method: "GET",
			headers: {
				"User-Agent": "Tabst/1.0",
			},
		};

		const req = https.request(options, (res) => {
			const contentLength = res.headers["content-length"];
			if (
				contentLength &&
				Number.parseInt(contentLength, 10) > MAX_RESPONSE_SIZE
			) {
				res.destroy();
				resolve({ success: false, error: "Response too large" });
				return;
			}

			res.on("data", (chunk: Buffer | string) => {
				totalSize += chunk.length;
				if (totalSize > MAX_RESPONSE_SIZE) {
					res.destroy();
					resolve({
						success: false,
						error: "Response too large",
					});
					return;
				}
				data += chunk.toString("utf-8");
			});

			res.on("end", () => {
				if (res.statusCode === 200) {
					resolve({ success: true, data });
				} else {
					resolve({
						success: false,
						error: `HTTP ${res.statusCode ?? "unknown"}`,
					});
				}
			});
		});

		req.on("error", () => {
			resolve({
				success: false,
				error: "Network error",
			});
		});

		req.setTimeout(REQUEST_TIMEOUT_MS, () => {
			req.destroy();
			resolve({
				success: false,
				error: "Request timeout",
			});
		});

		req.end();
	});
}

export const fetchReleasesFeed = (
	url: string,
): Effect.Effect<
	{ success: boolean; data?: string; error?: string },
	HttpError
> =>
	Effect.tryPromise({
		try: () => httpsGet(url),
		catch: (error) => new HttpError("Failed to fetch releases feed", error),
	});
