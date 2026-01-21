import { Button } from "./button";

export interface IconButtonProps
	extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
	active?: boolean;
	compact?: boolean;
	children: React.ReactNode;
	title?: string;
}

export default function IconButton({
	active,
	compact = false,
	className = "",
	children,
	title,
	...rest
}: IconButtonProps) {
	const sizeClass = compact ? "h-6 w-6 p-0.5" : "h-8 w-8 p-0.5";
	const stateClass = active
		? "bg-blue-500/20 text-blue-600"
		: "hover:bg-blue-500/20 hover:text-blue-600";

	return (
		<Button
			variant="ghost"
			size="icon"
			className={`${sizeClass} rounded ${stateClass} ${className}`}
			title={title}
			{...rest}
		>
			{children}
		</Button>
	);
}
