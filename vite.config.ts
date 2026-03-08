// vite.config.ts

import mdx from "@mdx-js/rollup";
import react from "@vitejs/plugin-react";
import fs from "fs";
import path from "path";
import remarkGfm from "remark-gfm";
import { fileURLToPath } from "url";
import { defineConfig } from "vite";

// ESM-friendly __dirname shim
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const tauriDevHost = process.env.TAURI_DEV_HOST;
const isTauriBuild = Boolean(process.env.TAURI_ENV_PLATFORM);
const tauriBuildTarget =
	process.env.TAURI_ENV_PLATFORM === "windows" ? "chrome105" : "safari13";

// Plugin to copy docs (README.md, ROADMAP.md) from root to public/docs
const copyDocsPlugin = () => {
	const copyDocs = () => {
		const targetDir = path.join(__dirname, "public", "docs");

		// Ensure target directory exists
		if (!fs.existsSync(targetDir)) {
			fs.mkdirSync(targetDir, { recursive: true });
		}

		// Copy README.md if exists
		const readmePath = path.join(__dirname, "README.md");
		const readmeTarget = path.join(targetDir, "README.md");
		if (fs.existsSync(readmePath)) {
			fs.copyFileSync(readmePath, readmeTarget);
		}

		// Copy ROADMAP.md if exists
		const roadmapPath = path.join(__dirname, "ROADMAP.md");
		const roadmapTarget = path.join(targetDir, "ROADMAP.md");
		if (fs.existsSync(roadmapPath)) {
			fs.copyFileSync(roadmapPath, roadmapTarget);
		}
	};

	return {
		name: "copy-docs",
		buildStart() {
			copyDocs();
		},
		configureServer() {
			// Also copy in dev mode
			copyDocs();
		},
	};
};

export default defineConfig({
	clearScreen: false,
	plugins: [
		copyDocsPlugin(),
		react(),
		mdx({
			remarkPlugins: [remarkGfm],
			providerImportSource: "@mdx-js/react",
		}),
		// dev-only middleware: rewrite root requests to the real HTML inside /src/renderer
		{
			name: "rewrite-middleware",
			configureServer(server) {
				server.middlewares.use((req, res, next) => {
					if (req && req.url) {
						// Redirect / or /index.html to the renderer entry
						if (req.url === "/" || req.url === "/index.html") {
							req.url = "/src/renderer/index.html";
						}
					}
					next();
				});
			},
		},
	],
	base: "./",
	// Keep Vite running from project root so plugins (like Tailwind) can access the full workspace
	root: __dirname,
	publicDir: "public",
	worker: {
		format: "es",
	},
	envPrefix: ["VITE_", "TAURI_ENV_"],
	resolve: {
		alias: {
			"@": path.join(__dirname, "src"),
		},
	},
	build: {
		...(isTauriBuild
			? {
					target: tauriBuildTarget,
					minify: process.env.TAURI_ENV_DEBUG ? false : "esbuild",
					sourcemap: Boolean(process.env.TAURI_ENV_DEBUG),
				}
			: {}),
		outDir: path.join(__dirname, "dist"),
		emptyOutDir: true,
		// Build from workspace root index.html so dist always contains index.html for preview/static hosting
		rollupOptions: {
			input: {
				main: path.resolve(__dirname, "index.html"),
			},
			output: {
				manualChunks(id) {
					if (!id.includes("node_modules")) return;

					if (id.includes("@coderline/alphatab")) {
						return "vendor-alphatab";
					}

					if (
						id.includes("react-syntax-highlighter") ||
						id.includes("refractor") ||
						id.includes("prismjs")
					) {
						return "vendor-syntax";
					}

					if (id.includes("@radix-ui") || id.includes("lucide-react")) {
						return "vendor-ui";
					}

					if (id.includes("codemirror") || id.includes("@codemirror")) {
						return "vendor-codemirror";
					}
				},
			},
		},
	},
	server: {
		host: tauriDevHost || "127.0.0.1",
		port: 7777,
		strictPort: true,
		hmr: tauriDevHost
			? {
					protocol: "ws",
					host: tauriDevHost,
					port: 1421,
				}
			: undefined,
		watch: {
			ignored: ["**/src-tauri/**"],
		},
	},
	optimizeDeps: {
		exclude: ["@coderline/alphatab"],
	},
});
