// vite.config.ts

import react from "@vitejs/plugin-react";
import mdx from "@mdx-js/rollup";
import remarkGfm from "remark-gfm";
import path from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "vite";

// ESM-friendly __dirname shim
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
	plugins: [
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
	resolve: {
		alias: {
			"@": path.join(__dirname, "src"),
		},
	},
	build: {
		outDir: path.join(__dirname, "dist"),
		emptyOutDir: true,
		// Because the root changed, we must explicitly tell Rollup (Vite) where the HTML entry is
		rollupOptions: {
			input: {
				main: path.resolve(__dirname, "src/renderer/index.html"),
			},
		},
	},
	server: {
		host: "127.0.0.1",
		port: 7777,
	},
	optimizeDeps: {
		exclude: ["@coderline/alphatab"],
	},
});
