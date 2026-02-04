import { Check } from "lucide-react";
import React from "react";
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
	return (
		<div
			className={cn(
				"flex items-center justify-center h-5 w-5 rounded border border-primary/50 cursor-pointer transition-colors hover:border-primary",
				className,
			)}
			onClick={() => onCheckedChange(!checked)}
			role="checkbox"
			aria-checked={checked}
			aria-label={ariaLabel}
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
