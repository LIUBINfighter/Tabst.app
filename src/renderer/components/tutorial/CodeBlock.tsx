import { useEffect, useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import {
	oneDark,
	oneLight,
} from "react-syntax-highlighter/dist/esm/styles/prism";

// 移除主题中所有背景色的辅助函数
const removeBackgroundFromTheme = (theme: typeof oneDark) => {
	const cleanedTheme = { ...theme };
	Object.keys(cleanedTheme).forEach((key) => {
		const style = cleanedTheme[key as keyof typeof cleanedTheme];
		if (style && typeof style === "object" && style !== null) {
			// 移除 background 和 backgroundColor
			if ("background" in style) {
				delete (style as { background?: string }).background;
			}
			if ("backgroundColor" in style) {
				delete (style as { backgroundColor?: string }).backgroundColor;
			}
		}
	});
	return cleanedTheme;
};

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

	// 创建移除背景色的自定义主题
	const theme = isDark ? oneDark : oneLight;
	const cleanedTheme = removeBackgroundFromTheme(theme);

	return (
		<div className="not-prose my-4 overflow-hidden rounded-md border border-border bg-muted/30 code-block-no-text-bg">
			<SyntaxHighlighter
				language={detectedLanguage}
				style={cleanedTheme}
				customStyle={{
					margin: 0,
					padding: "0.5rem 0.75rem",
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
