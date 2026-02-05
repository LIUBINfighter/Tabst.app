import type { ReactNode } from "react";
import { useState } from "react";
import { CodeBlock } from "./CodeBlock";
import { TutorialImage } from "./TutorialImage";

/**
 * MDX 组件库
 * 所有可以在 MDX 文件中使用的组件都在这里导出
 */
export const components = {
	CodeBlock,
	TutorialImage,

	// 测试用的交互式按钮组件
	TestButton: ({
		children,
		onClick,
		...props
	}: {
		children?: ReactNode;
		onClick?: () => void;
	}) => {
		const [clicked, setClicked] = useState(false);

		return (
			<button
				type="button"
				onClick={() => {
					setClicked(true);
					onClick?.();
					setTimeout(() => setClicked(false), 1000);
				}}
				className={`px-4 py-2 rounded transition-colors ${
					clicked
						? "bg-green-500 text-white"
						: "bg-primary text-primary-foreground hover:bg-primary/90"
				}`}
				{...props}
			>
				{children || "点击测试"}
			</button>
		);
	},

	// 测试用的计数器组件
	Counter: ({ initialValue = 0 }: { initialValue?: number }) => {
		const [count, setCount] = useState(initialValue);

		return (
			<div className="my-4 p-4 border border-border rounded-lg bg-card">
				<p className="text-sm text-muted-foreground mb-2">计数器测试组件</p>
				<div className="flex items-center gap-4">
					<button
						type="button"
						onClick={() => setCount(count - 1)}
						className="px-3 py-1 border rounded hover:bg-accent"
					>
						-
					</button>
					<span className="text-lg font-semibold min-w-[3rem] text-center">
						{count}
					</span>
					<button
						type="button"
						onClick={() => setCount(count + 1)}
						className="px-3 py-1 border rounded hover:bg-accent"
					>
						+
					</button>
				</div>
			</div>
		);
	},

	// 测试用的折叠面板组件
	Collapsible: ({
		title,
		children,
	}: {
		title: string;
		children?: ReactNode;
	}) => {
		const [isOpen, setIsOpen] = useState(false);

		return (
			<div className="my-4 border border-border rounded-lg overflow-hidden">
				<button
					type="button"
					onClick={() => setIsOpen(!isOpen)}
					className="w-full px-4 py-2 text-left bg-muted hover:bg-muted/80 transition-colors flex items-center justify-between"
				>
					<span className="font-medium">{title}</span>
					<span className="text-muted-foreground">{isOpen ? "▼" : "▶"}</span>
				</button>
				{isOpen && <div className="p-4 bg-card">{children}</div>}
			</div>
		);
	},

	// 测试用的提示框组件
	Alert: ({
		type = "info",
		children,
	}: {
		type?: "info" | "success" | "warning" | "error";
		children?: ReactNode;
	}) => {
		const styles = {
			info: "bg-[var(--highlight-bg)] border-[var(--highlight-bg)] text-[var(--highlight-text)]",
			success: "bg-green-500/10 border-green-500/20 text-green-600",
			warning: "bg-yellow-500/10 border-yellow-500/20 text-yellow-600",
			error: "bg-red-500/10 border-red-500/20 text-red-600",
		};

		return (
			<div className={`my-4 p-4 rounded-lg border ${styles[type]}`}>
				{children}
			</div>
		);
	},
};
