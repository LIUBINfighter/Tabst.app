import { Effect, Exit } from "effect";
import { describe, expect, it } from "vitest";
import { fetchReleasesFeed } from "./http";

describe("http effects", () => {
	it("fetchReleasesFeed rejects invalid hostname without network call", async () => {
		const result = await Effect.runPromiseExit(
			fetchReleasesFeed("https://evil.com/feed"),
		);
		expect(Exit.isSuccess(result)).toBe(true);
		if (Exit.isSuccess(result)) {
			expect(result.value.success).toBe(false);
			expect(result.value.error).toBe("Invalid hostname");
		}
	});
});
