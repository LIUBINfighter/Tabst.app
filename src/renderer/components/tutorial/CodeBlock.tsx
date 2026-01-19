import { useEffect, useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import {
	vs,
	vscDarkPlus,
} from "react-syntax-highlighter/dist/esm/styles/prism";

interface CodeBlockProps {
	language?: string;
	children?: string;
	className?: string;
}

export function CodeBlock({ language, children, className }: CodeBlockProps) {
	const [isDark, setIsDark] = useState(false);

	useEffect(() => {
		// 检测当前主题
		const checkTheme = () => {
			setIsDark(document.documentElement.classList.contains("dark"));
		};

		checkTheme();

		// 监听主题变化
		const observer = new MutationObserver(checkTheme);
		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ["class"],
		});

		return () => observer.disconnect();
	}, []);

	// 如果没有语言标识，尝试从 className 中提取（Markdown 代码块通常有 `language-xxx` 类）
	const detectedLanguage =
		language || className?.replace(/language-/, "") || "text";

	// 移除可能的换行符
	const code = String(children || "").replace(/\n$/, "");

	return (
		<div className="my-4 rounded-lg overflow-hidden border border-border">
			<SyntaxHighlighter
				language={detectedLanguage === "alphatex" ? "text" : detectedLanguage}
				style={isDark ? vscDarkPlus : vs}
				customStyle={{
					margin: 0,
					padding: "1rem",
					background: "transparent",
					fontSize: "0.875rem",
					lineHeight: "1.5",
				}}
				PreTag="div"
			>
				{code}
			</SyntaxHighlighter>
		</div>
	);
}
