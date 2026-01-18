import { FileText, Hash, Music, Slash } from "lucide-react";
import type { StaffDisplayOptions } from "../lib/staff-config";
import IconButton from "./ui/icon-button";

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
			<IconButton
				active={firstStaffOptions?.showStandardNotation}
				title="标准记谱法（五线谱)"
				onClick={() => toggleFirstStaffOpt("showStandardNotation")}
			>
				<Music className="h-4 w-4" />
			</IconButton>

			<IconButton
				active={firstStaffOptions?.showTablature}
				title="六线谱（TAB)"
				onClick={() => toggleFirstStaffOpt("showTablature")}
			>
				<Hash className="h-4 w-4" />
			</IconButton>

			<IconButton
				active={firstStaffOptions?.showSlash}
				title="斜线记谱法（节拍）"
				onClick={() => toggleFirstStaffOpt("showSlash")}
			>
				<Slash className="h-4 w-4" />
			</IconButton>

			<IconButton
				active={firstStaffOptions?.showNumbered}
				title="简谱（数字谱）"
				onClick={() => toggleFirstStaffOpt("showNumbered")}
			>
				<FileText className="h-3.5 w-3.5" />
			</IconButton>
		</div>
	);
}
