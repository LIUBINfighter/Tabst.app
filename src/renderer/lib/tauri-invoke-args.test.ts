import { describe, expect, it } from "vitest";
import { normalizeTauriInvokeArgs } from "./tauri-invoke-args";

describe("normalizeTauriInvokeArgs", () => {
	it("converts top-level snake_case keys to camelCase", () => {
		const result = normalizeTauriInvokeArgs({
			dir_path: "/tmp/repo",
			repo_path: "/tmp/repo",
			file_path: "/tmp/repo/a.atex",
		});

		expect(result).toEqual({
			dirPath: "/tmp/repo",
			repoPath: "/tmp/repo",
			filePath: "/tmp/repo/a.atex",
		});
	});

	it("converts nested snake_case keys recursively", () => {
		const result = normalizeTauriInvokeArgs({
			repo_path: "/tmp/repo",
			metadata: {
				expanded_folders: ["/tmp/repo/docs"],
				custom_player_config: {
					components: [{ playback_speed: true }],
				},
			},
		});

		expect(result).toEqual({
			repoPath: "/tmp/repo",
			metadata: {
				expandedFolders: ["/tmp/repo/docs"],
				customPlayerConfig: {
					components: [{ playbackSpeed: true }],
				},
			},
		});
	});

	it("keeps Uint8Array payloads intact", () => {
		const bytes = new Uint8Array([1, 2, 3]);
		const result = normalizeTauriInvokeArgs({ gp_bytes: bytes });

		expect(result).toEqual({ gpBytes: bytes });
		expect(result?.gpBytes).toBe(bytes);
	});

	it("returns undefined when args are undefined", () => {
		expect(normalizeTauriInvokeArgs()).toBeUndefined();
	});
});
