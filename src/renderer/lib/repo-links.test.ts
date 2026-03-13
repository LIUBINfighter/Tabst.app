import { describe, expect, it } from "vitest";
import {
	isExternalHref,
	isHashHref,
	normalizeExternalHref,
	resolveRepoRelativeHref,
} from "./repo-links";

describe("repo link resolution", () => {
	it("keeps external URLs unchanged", () => {
		expect(resolveRepoRelativeHref("https://example.com/docs")).toBe(
			"https://example.com/docs",
		);
		expect(isExternalHref("mailto:hello@example.com")).toBe(true);
		expect(normalizeExternalHref("//example.com/docs")).toBe(
			"https://example.com/docs",
		);
	});

	it("keeps hash links unchanged", () => {
		expect(resolveRepoRelativeHref("#features")).toBe("#features");
		expect(isHashHref("#features")).toBe(true);
	});

	it("keeps relative links unchanged without explicit repo context", () => {
		expect(resolveRepoRelativeHref("./getting-started.md")).toBe(
			"./getting-started.md",
		);
	});

	it("rewrites README relative links to GitHub blob URLs", () => {
		expect(
			resolveRepoRelativeHref("./README.zh.md", {
				sourcePath: "README.md",
			}),
		).toBe("https://github.com/LIUBINfighter/Tabst.app/blob/dev/README.zh.md");
	});

	it("rewrites nested repo links relative to the source path", () => {
		expect(
			resolveRepoRelativeHref("../README.md", {
				sourcePath: "docs/ROADMAP.md",
			}),
		).toBe("https://github.com/LIUBINfighter/Tabst.app/blob/dev/README.md");
	});

	it("preserves query and hash suffixes on rewritten links", () => {
		expect(
			resolveRepoRelativeHref(
				"./docs/dev/TAURI_MIGRATION_STATUS.md?plain=1#next",
				{
					sourcePath: "README.md",
				},
			),
		).toBe(
			"https://github.com/LIUBINfighter/Tabst.app/blob/dev/docs/dev/TAURI_MIGRATION_STATUS.md?plain=1#next",
		);
	});

	it("preserves slash-separated branch names in GitHub blob URLs", () => {
		expect(
			resolveRepoRelativeHref("./README.zh.md", {
				sourcePath: "README.md",
				repoBranch: "feature/link-handling",
			}),
		).toBe(
			"https://github.com/LIUBINfighter/Tabst.app/blob/feature/link-handling/README.zh.md",
		);
	});
});
