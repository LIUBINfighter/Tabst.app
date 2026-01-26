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

	// 将 alphatex 映射到 markdown 作为回退（当前没有专用高亮器）
	let finalLanguage = detectedLanguage
		? String(detectedLanguage).toLowerCase()
		: "text";
	if (finalLanguage === "alphatex") finalLanguage = "markdown";

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
		<div className="not-prose my-4 overflow-x-auto rounded-md border border-border bg-muted/30 code-block-no-text-bg">
			<SyntaxHighlighter
				language={finalLanguage}
				style={cleanedTheme}
				wrapLongLines={true}
				lineProps={{
					style: {
						// 所有语言都使用 pre-wrap，避免出现右侧多余溢出/截断感
						whiteSpace: "pre-wrap",
						wordBreak: "break-word",
					},
				}}
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
