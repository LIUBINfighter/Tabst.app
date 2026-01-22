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
	const components: Components = {
		// 代码块
		code({ node, className, children, ...props }) {
			// 检查是否是内联代码（通过检查是否有 className）
			const isInline = !className;

			// 内联代码
			if (isInline) {
				return (
					<code
						className="px-1.5 py-0.5 bg-muted rounded text-sm font-mono before:content-none after:content-none"
						{...props}
					>
						{children}
					</code>
				);
			}

			// 代码块
			return (
				<CodeBlock className={className} {...props}>
					{String(children).replace(/\n$/, "")}
				</CodeBlock>
			);
		},

		// 图片
		img({ src, alt, title }) {
			return <TutorialImage src={src || ""} alt={alt} title={title} />;
		},

		// 标题样式
		h1: ({ children }) => (
			<h1 className="text-2xl font-bold mt-6 mb-4 first:mt-0">{children}</h1>
		),
		h2: ({ children }) => (
			<h2 className="text-xl font-semibold mt-5 mb-3">{children}</h2>
		),
		h3: ({ children }) => (
			<h3 className="text-lg font-medium mt-4 mb-2">{children}</h3>
		),
		h4: ({ children }) => (
			<h4 className="text-base font-medium mt-3 mb-2">{children}</h4>
		),

		// 段落
		p: ({ children }) => (
			<p className="text-sm text-foreground mb-4 leading-relaxed">{children}</p>
		),

		// 列表
		ul: ({ children }) => (
			<ul className="list-disc list-inside mb-4 space-y-2 text-sm">
				{children}
			</ul>
		),
		ol: ({ children }) => (
			<ol className="list-decimal list-inside mb-4 space-y-2 text-sm">
				{children}
			</ol>
		),
		li: ({ children }) => <li className="ml-2">{children}</li>,

		// 引用
		blockquote: ({ children }) => (
			<blockquote className="border-l-4 border-border pl-4 py-2 my-4 bg-muted/50 italic text-sm">
				{children}
			</blockquote>
		),

		// 链接
		a: ({ href, children }) => (
			<a
				href={href}
				className="text-primary hover:underline"
				target={href?.startsWith("http") ? "_blank" : undefined}
				rel={href?.startsWith("http") ? "noopener noreferrer" : undefined}
			>
				{children}
			</a>
		),

		// 水平线
		hr: () => <hr className="my-6 border-border" />,

		// 表格
		table: ({ children }) => (
			<div className="overflow-x-auto my-4">
				<table className="min-w-full border-collapse border border-border text-sm">
					{children}
				</table>
			</div>
		),
		thead: ({ children }) => <thead className="bg-muted">{children}</thead>,
		tbody: ({ children }) => <tbody>{children}</tbody>,
		tr: ({ children }) => (
			<tr className="border-b border-border">{children}</tr>
		),
		th: ({ children }) => (
			<th className="border border-border px-4 py-2 text-left font-semibold">
				{children}
			</th>
		),
		td: ({ children }) => (
			<td className="border border-border px-4 py-2">{children}</td>
		),
	};

	return (
		<div className="prose prose-sm max-w-none">
			<ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
				{content}
			</ReactMarkdown>
		</div>
	);
}
