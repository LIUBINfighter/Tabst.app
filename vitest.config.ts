import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
	test: {
		environment: "node",
		include: ["src/**/*.test.ts"],
		globals: false,
	},
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "src"),
			"@/renderer": path.resolve(__dirname, "src/renderer"),
		},
	},
});
