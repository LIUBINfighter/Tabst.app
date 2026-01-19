import { MDXProvider } from "@mdx-js/react";
import type { MDXModule } from "mdx/types";
import { components } from "./mdx-components";

interface MDXRendererProps {
	module: MDXModule;
}

export function MDXRenderer({ module }: MDXRendererProps) {
	const Content = module.default as React.ComponentType;

	return (
		<MDXProvider components={components}>
			<div className="prose prose-sm max-w-none">
				<Content />
			</div>
		</MDXProvider>
	);
}
