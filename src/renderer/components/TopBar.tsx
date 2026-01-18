import type { ReactNode } from "react";

export interface TopBarProps {
	leading?: ReactNode;
	icon?: ReactNode;
	title?: ReactNode;
	trailing?: ReactNode;
	className?: string;
}

export default function TopBar({
	leading,
	icon,
	title,
	trailing,
	className,
}: TopBarProps) {
	return (
		<div
			className={`h-9 border-b border-border flex items-center px-3 text-xs text-muted-foreground shrink-0 gap-2 bg-card ${
				className ?? ""
			}`}
		>
			{leading}
			{icon}
			<div className="truncate">{title}</div>
			{trailing ? (
				<div className="ml-auto flex items-center gap-1">{trailing}</div>
			) : null}
		</div>
	);
}
