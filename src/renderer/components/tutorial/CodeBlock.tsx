import { useEffect, useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import {
	oneDark,
	oneLight,
} from "react-syntax-highlighter/dist/esm/styles/prism";

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

	// 检测当前主题
	const [isDark, setIsDark] = useState(false);

	useEffect(() => {
		const checkTheme = () => {
			setIsDark(document.documentElement.classList.contains("dark"));
		};

		checkTheme();
		const observer = new MutationObserver(checkTheme);
		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ["class"],
		});

		return () => observer.disconnect();
	}, []);

	return (
		<div className="not-prose my-4 overflow-hidden rounded-md border border-border bg-muted/30">
			<SyntaxHighlighter
				language={detectedLanguage}
				style={isDark ? oneDark : oneLight}
				customStyle={{
					margin: 0,
					padding: "1rem",
					fontSize: "0.75rem",
					lineHeight: "1.5",
					background: "transparent",
				}}
				PreTag="div"
			>
				{code}
			</SyntaxHighlighter>
		</div>
	);
}
