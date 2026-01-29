import { Button } from "./button";

export interface IconButtonProps
	extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
	active?: boolean;
	compact?: boolean;
	destructive?: boolean;
	children: React.ReactNode;
	title?: string;
}

export default function IconButton({
	active,
	compact = false,
	destructive = false,
	className = "",
	children,
	title,
	...rest
}: IconButtonProps) {
	const sizeClass = compact ? "h-6 w-6 p-0.5" : "h-8 w-8 p-0.5";
	const colorClass = destructive
		? "hover:bg-red-500/20 hover:text-red-600"
		: active
			? "bg-blue-500/20 text-blue-600"
			: "hover:bg-blue-500/20 hover:text-blue-600";

	return (
		<Button
			variant="ghost"
			size="icon"
			className={`${sizeClass} rounded ${colorClass} ${className}`}
			title={title}
			{...rest}
		>
			{children}
		</Button>
	);
}
