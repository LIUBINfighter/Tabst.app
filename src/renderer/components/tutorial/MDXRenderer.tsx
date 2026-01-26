import { MDXProvider } from "@mdx-js/react";
import type { MDXModule } from "mdx/types";
import { components as mdxComponents } from "./mdx-components";

interface MDXRendererProps {
	module: MDXModule;
}

// 合并自定义组件和 Markdown 元素样式
const allComponents = {
	...mdxComponents,
	// Markdown 元素样式（与 TutorialRenderer 保持一致）
	h1: ({ children }: { children?: React.ReactNode }) => (
		<h1 className="text-2xl font-bold mt-6 mb-4 first:mt-0">{children}</h1>
	),
	h2: ({ children }: { children?: React.ReactNode }) => (
		<h2 className="text-xl font-semibold mt-5 mb-3">{children}</h2>
	),
	h3: ({ children }: { children?: React.ReactNode }) => (
		<h3 className="text-lg font-medium mt-4 mb-2">{children}</h3>
	),
	h4: ({ children }: { children?: React.ReactNode }) => (
		<h4 className="text-base font-medium mt-3 mb-2">{children}</h4>
	),
	p: ({ children }: { children?: React.ReactNode }) => (
		<p className="text-sm text-foreground mb-4 leading-relaxed break-words whitespace-normal">
			{children}
		</p>
	),
	ul: ({ children }: { children?: React.ReactNode }) => (
		<ul className="list-disc list-inside mb-4 space-y-2 text-sm">{children}</ul>
	),
	ol: ({ children }: { children?: React.ReactNode }) => (
		<ol className="list-decimal list-inside mb-4 space-y-2 text-sm">
			{children}
		</ol>
	),
	li: ({ children }: { children?: React.ReactNode }) => (
		<li className="ml-2">{children}</li>
	),
	blockquote: ({ children }: { children?: React.ReactNode }) => (
		<blockquote className="border-l-4 border-border pl-4 py-2 my-4 bg-muted/50 italic text-sm">
			{children}
		</blockquote>
	),
	a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
		<a
			href={href}
			className="text-primary hover:underline break-words whitespace-normal"
			target={href?.startsWith("http") ? "_blank" : undefined}
			rel={href?.startsWith("http") ? "noopener noreferrer" : undefined}
		>
			{children}
		</a>
	),
	hr: () => <hr className="my-6 border-border" />,
	strong: ({ children }: { children?: React.ReactNode }) => (
		<strong className="font-semibold">{children}</strong>
	),
	em: ({ children }: { children?: React.ReactNode }) => (
		<em className="italic">{children}</em>
	),
	pre: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
	code: ({
		children,
		className,
	}: {
		children?: React.ReactNode;
		className?: string;
	}) => {
		// 如果没有 className，区分内联 vs 块级：包含换行视为块级代码
		const text = String(children || "");
		if (!className) {
			if (text.includes("\n")) {
				return (
					<mdxComponents.CodeBlock>
						{String(children || "").replace(/\n$/, "")}
					</mdxComponents.CodeBlock>
				);
			}
			return (
				<code className="px-1.5 py-0.5 bg-muted rounded text-sm font-mono before:content-none after:content-none break-words whitespace-normal">
					{children}
				</code>
			);
		}
		// 代码块由 CodeBlock 组件处理（在 mdxComponents 中）
		return (
			<mdxComponents.CodeBlock className={className}>
				{String(children || "").replace(/\n$/, "")}
			</mdxComponents.CodeBlock>
		);
	},
	table: ({ children }: { children?: React.ReactNode }) => (
		<div className="overflow-x-auto my-4">
			<table className="min-w-full border-collapse border border-border text-sm">
				{children}
			</table>
		</div>
	),
	thead: ({ children }: { children?: React.ReactNode }) => (
		<thead className="bg-muted">{children}</thead>
	),
	tbody: ({ children }: { children?: React.ReactNode }) => (
		<tbody>{children}</tbody>
	),
	tr: ({ children }: { children?: React.ReactNode }) => (
		<tr className="border-b border-border">{children}</tr>
	),
	th: ({ children }: { children?: React.ReactNode }) => (
		<th className="border border-border px-4 py-2 text-left font-semibold">
			{children}
		</th>
	),
	td: ({ children }: { children?: React.ReactNode }) => (
		<td className="border border-border px-4 py-2">{children}</td>
	),
};

export function MDXRenderer({ module }: MDXRendererProps) {
	const Content = module.default as React.ComponentType;

	return (
		<MDXProvider components={allComponents}>
			<div className="prose prose-sm max-w-none dark:prose-invert">
				<Content />
			</div>
		</MDXProvider>
	);
}
