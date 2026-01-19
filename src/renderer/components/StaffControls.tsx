import { FileText, Hash, Music, Slash } from "lucide-react";
import type { StaffDisplayOptions } from "../lib/staff-config";
import IconButton from "./ui/icon-button";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

interface StaffControlsProps {
	firstStaffOptions: StaffDisplayOptions | null;
	toggleFirstStaffOpt: (key: keyof StaffDisplayOptions) => void;
}

export default function StaffControls({
	firstStaffOptions,
	toggleFirstStaffOpt,
}: StaffControlsProps) {
	if (!firstStaffOptions) return null;

	return (
		<div className="flex items-center gap-1">
			<Tooltip>
				<TooltipTrigger asChild>
					<IconButton
						active={firstStaffOptions?.showStandardNotation}
						onClick={() => toggleFirstStaffOpt("showStandardNotation")}
					>
						<Music className="h-4 w-4" />
					</IconButton>
				</TooltipTrigger>
				<TooltipContent side="top">
					<p>标准记谱法（五线谱）</p>
				</TooltipContent>
			</Tooltip>

			<Tooltip>
				<TooltipTrigger asChild>
					<IconButton
						active={firstStaffOptions?.showTablature}
						onClick={() => toggleFirstStaffOpt("showTablature")}
					>
						<Hash className="h-4 w-4" />
					</IconButton>
				</TooltipTrigger>
				<TooltipContent side="top">
					<p>六线谱（TAB）</p>
				</TooltipContent>
			</Tooltip>

			<Tooltip>
				<TooltipTrigger asChild>
					<IconButton
						active={firstStaffOptions?.showSlash}
						onClick={() => toggleFirstStaffOpt("showSlash")}
					>
						<Slash className="h-4 w-4" />
					</IconButton>
				</TooltipTrigger>
				<TooltipContent side="top">
					<p>斜线记谱法（节拍）</p>
				</TooltipContent>
			</Tooltip>

			<Tooltip>
				<TooltipTrigger asChild>
					<IconButton
						active={firstStaffOptions?.showNumbered}
						onClick={() => toggleFirstStaffOpt("showNumbered")}
					>
						<FileText className="h-3.5 w-3.5" />
					</IconButton>
				</TooltipTrigger>
				<TooltipContent side="top">
					<p>简谱（数字谱）</p>
				</TooltipContent>
			</Tooltip>
		</div>
	);
}
