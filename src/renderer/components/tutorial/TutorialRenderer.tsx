import { Children, isValidElement } from "react";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CodeBlock } from "./CodeBlock";
import { TutorialImage } from "./TutorialImage";

interface TutorialRendererProps {
	content: string;
}

export function TutorialRenderer({ content }: TutorialRendererProps) {
	// 自定义组件映射
	const components = {
		// pre 标签：直接传递子元素，不添加容器
		pre: ({ children }: { children?: React.ReactNode }) => <>{children}</>,

		// 代码块
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
			// 使用 ReactMarkdown 提供的 `inline` 来判断是否为内联代码
			// 使用 ReactMarkdown 提供的 `inline` 来判断是否为内联代码
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

			// 块级代码（有时没有 language 类），尽量从 className 提取语言以便高亮
			const detectedLanguage = className?.replace(/language-/, "") || undefined;

			return (
				<CodeBlock className={className} language={detectedLanguage} {...props}>
					{String(children).replace(/\n$/, "")}
				</CodeBlock>
			);
		},

		// 图片
		img({ src, alt, title }: { src?: string; alt?: string; title?: string }) {
			return <TutorialImage src={src || ""} alt={alt} title={title} />;
		},

		// 标题样式
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

		// 段落
		p: ({ children }: { children?: React.ReactNode }) => {
			// 检查子元素中是否包含图片（TutorialImage 会渲染为 <figure>）
			// 如果包含图片，不能将 <figure> 包裹在 <p> 中（HTML 规范不允许）
			const childrenArray = Children.toArray(children);
			const hasImage = childrenArray.some((child) => {
				if (isValidElement(child)) {
					// 检查是否是 TutorialImage 组件
					// TutorialImage 组件会接收 src, alt, title 属性
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

			// 如果包含图片，使用 div 而不是 p（因为 <figure> 不能是 <p> 的子元素）
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

		// 列表
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

		// 引用
		blockquote: ({ children }: { children?: React.ReactNode }) => (
			<blockquote className="border-l-4 border-border pl-4 py-2 my-4 bg-muted/50 italic text-sm">
				{children}
			</blockquote>
		),

		// 链接
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

		// 水平线
		hr: () => <hr className="my-6 border-border" />,

		// 表格
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
			<ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
				{content}
			</ReactMarkdown>
		</div>
	);
}
