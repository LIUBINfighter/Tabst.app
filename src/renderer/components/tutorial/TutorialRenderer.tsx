import { Children, isValidElement } from "react";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import { CodeBlock } from "./CodeBlock";
import { TutorialImage } from "./TutorialImage";

interface TutorialRendererProps {
	content: string;
	allowHtml?: boolean;
}

export function TutorialRenderer({
	content,
	allowHtml = true,
}: TutorialRendererProps) {
	const components = {
		pre: ({ children }: { children?: React.ReactNode }) => <>{children}</>,

		code({
			node,
			inline,
			className,
			children,
			...props
		}: {
			node?: unknown;
			inline?: boolean;
			className?: string;
			children?: React.ReactNode;
			[key: string]: unknown;
		}) {
			if (inline) {
				return (
					<code
						className="px-1.5 py-0.5 bg-muted rounded text-sm font-mono before:content-none after:content-none break-words whitespace-normal"
						{...props}
					>
						{children}
					</code>
				);
			}

			const detectedLanguage = className?.replace(/language-/, "") || undefined;

			return (
				<CodeBlock className={className} language={detectedLanguage} {...props}>
					{String(children).replace(/\n$/, "")}
				</CodeBlock>
			);
		},

		img({ src, alt, title }: { src?: string; alt?: string; title?: string }) {
			return <TutorialImage src={src || ""} alt={alt} title={title} />;
		},

		h1: ({
			children,
			align,
		}: {
			children?: React.ReactNode;
			align?: string;
		}) => (
			<h1
				className="text-2xl font-bold mt-6 mb-4 first:mt-0"
				style={
					align
						? { textAlign: align as React.CSSProperties["textAlign"] }
						: undefined
				}
			>
				{children}
			</h1>
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

		div: ({
			children,
			align,
		}: {
			children?: React.ReactNode;
			align?: string;
		}) => {
			const alignClass =
				align === "center"
					? "text-center"
					: align === "right"
						? "text-right"
						: align === "left"
							? "text-left"
							: align === "justify"
								? "text-justify"
								: "";
			return <div className={alignClass}>{children}</div>;
		},

		p: ({ children }: { children?: React.ReactNode }) => {
			const childrenArray = Children.toArray(children);
			const hasImage = childrenArray.some((child) => {
				if (isValidElement(child)) {
					const props = child.props as
						| { src?: string; alt?: string; title?: string }
						| undefined;
					return (
						child.type === TutorialImage ||
						(typeof props?.src === "string" && props.src.length > 0)
					);
				}
				return false;
			});

			if (hasImage) {
				return (
					<div className="text-sm text-foreground mb-4 leading-relaxed break-words">
						{children}
					</div>
				);
			}

			return (
				<p className="text-sm text-foreground mb-4 leading-relaxed break-words whitespace-normal">
					{children}
				</p>
			);
		},

		ul: ({ children }: { children?: React.ReactNode }) => (
			<ul className="list-disc list-inside mb-4 space-y-2 text-sm">
				{children}
			</ul>
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
				target={
					typeof href === "string" && href.startsWith("http")
						? "_blank"
						: undefined
				}
				rel={
					typeof href === "string" && href.startsWith("http")
						? "noopener noreferrer"
						: undefined
				}
			>
				{children}
			</a>
		),

		hr: () => <hr className="my-6 border-border" />,

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
	} as unknown as Components;

	return (
		<div className="prose prose-sm max-w-none dark:prose-invert">
			<ReactMarkdown
				remarkPlugins={[remarkGfm]}
				rehypePlugins={allowHtml ? [rehypeRaw] : []}
				components={components}
			>
				{content}
			</ReactMarkdown>
		</div>
	);
}
