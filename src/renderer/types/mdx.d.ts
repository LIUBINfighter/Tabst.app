/// <reference types="vite/client" />

declare module "*.mdx" {
	import type { MDXModule } from "mdx/types";
	const component: MDXModule;
	export default component;
}
