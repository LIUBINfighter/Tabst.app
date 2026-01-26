import { FileText, Hash, Music, Slash } from "lucide-react";
import { useTranslation } from "react-i18next";
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
	const { t } = useTranslation("print");
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
					<p>{t("staff.standard")}</p>
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
					<p>{t("staff.tab")}</p>
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
					<p>{t("staff.slash")}</p>
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
					<p>{t("staff.numbered")}</p>
				</TooltipContent>
			</Tooltip>
		</div>
	);
}
