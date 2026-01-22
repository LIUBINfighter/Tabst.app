interface CodeBlockProps {
	language?: string;
	children?: string;
	className?: string;
}

export function CodeBlock({ language, children, className }: CodeBlockProps) {
	// 如果没有语言标识，尝试从 className 中提取（Markdown 代码块通常有 `language-xxx` 类）
	const detectedLanguage =
		language || className?.replace(/language-/, "") || "text";

	// 清理代码内容：移除首尾的换行符（语义字符不应由这里处理）
	const code = String(children || "").replace(/^\n+|\n+$/g, "");

	return (
		<pre className="not-prose my-1 overflow-auto rounded-md border border-border bg-transparent p-2 text-xs leading-5">
			<code
				className={`whitespace-pre language-${detectedLanguage} before:content-none after:content-none`}
			>
				{code}
			</code>
		</pre>
	);
}
