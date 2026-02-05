import { Check } from "lucide-react";
import type React from "react";
import { cn } from "../../lib/utils";

interface CheckboxToggleProps {
	checked: boolean;
	onCheckedChange: (checked: boolean) => void;
	className?: string;
	"aria-label"?: string;
}

export function CheckboxToggle({
	checked,
	onCheckedChange,
	className,
	"aria-label": ariaLabel,
}: CheckboxToggleProps) {
	const handleKeyDown = (event: React.KeyboardEvent) => {
		if (event.key === " " || event.key === "Enter") {
			event.preventDefault();
			onCheckedChange(!checked);
		}
	};

	return (
		<div
			className={cn(
				"flex items-center justify-center h-5 w-5 rounded border border-primary/50 cursor-pointer transition-colors hover:border-primary",
				className,
			)}
			onClick={() => onCheckedChange(!checked)}
			onKeyDown={handleKeyDown}
			role="checkbox"
			aria-checked={checked}
			aria-label={ariaLabel}
			tabIndex={0}
		>
			<div
				className={cn(
					"h-3.5 w-3.5 rounded-sm flex items-center justify-center transition-all",
					checked ? "bg-primary text-primary-foreground" : "bg-transparent",
				)}
			>
				{checked && <Check className="h-3 w-3" strokeWidth={3} />}
			</div>
		</div>
	);
}
