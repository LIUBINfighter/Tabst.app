import type { TFunction } from "i18next";
import {
	FileDown,
	FileMusic,
	FilePlus2,
	Loader2,
	Music,
	Printer,
} from "lucide-react";
import type { ReactNode } from "react";
import type { ExportFormat } from "../lib/alphatab-export";
import IconButton from "./ui/icon-button";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

export interface PreviewToolbarProps {
	content?: string;
	onPrintClick: () => void;
	onExportClick: (format: ExportFormat) => void | Promise<void>;
	exportingFormat?: ExportFormat | null;
	hasScore?: boolean;
	onGenerateAtexClick?: () => void;
	isGeneratingAtex?: boolean;
	onEnjoyToggle?: () => void;
	isEnjoyMode?: boolean;
	t: TFunction;
}

export default function PreviewToolbar({
	content,
	onPrintClick,
	onExportClick,
	exportingFormat = null,
	hasScore = false,
	onGenerateAtexClick,
	isGeneratingAtex = false,
	onEnjoyToggle: _onEnjoyToggle,
	isEnjoyMode: _isEnjoyMode = false,
	t,
}: PreviewToolbarProps) {
	const isExporting = exportingFormat !== null;

	const renderExportIcon = (
		format: ExportFormat,
		icon: ReactNode,
	): ReactNode => {
		if (exportingFormat === format) {
			return <Loader2 className="h-4 w-4 animate-spin" />;
		}
		return icon;
	};

	return (
		<div className="ml-2 flex items-center gap-1">
			<Tooltip>
				<TooltipTrigger asChild>
					<IconButton
						onClick={() => void onExportClick("midi")}
						disabled={!hasScore || isExporting}
					>
						{renderExportIcon("midi", <Music className="h-4 w-4" />)}
					</IconButton>
				</TooltipTrigger>
				<TooltipContent side="bottom">
					<p>{t("toolbar:export.midi")}</p>
				</TooltipContent>
			</Tooltip>
			<Tooltip>
				<TooltipTrigger asChild>
					<IconButton
						onClick={() => void onExportClick("wav")}
						disabled={!hasScore || isExporting}
					>
						{renderExportIcon("wav", <FileDown className="h-4 w-4" />)}
					</IconButton>
				</TooltipTrigger>
				<TooltipContent side="bottom">
					<p>{t("toolbar:export.wav")}</p>
				</TooltipContent>
			</Tooltip>
			<Tooltip>
				<TooltipTrigger asChild>
					<IconButton
						onClick={() => void onExportClick("gp")}
						disabled={!hasScore || isExporting}
					>
						{renderExportIcon("gp", <FileMusic className="h-4 w-4" />)}
					</IconButton>
				</TooltipTrigger>
				<TooltipContent side="bottom">
					<p>{t("toolbar:export.gp")}</p>
				</TooltipContent>
			</Tooltip>
			{onGenerateAtexClick && (
				<Tooltip>
					<TooltipTrigger asChild>
						<IconButton
							onClick={onGenerateAtexClick}
							disabled={isGeneratingAtex}
							aria-label={t("toolbar:export.atex")}
						>
							{isGeneratingAtex ? (
								<Loader2 className="h-4 w-4 animate-spin" />
							) : (
								<FilePlus2 className="h-4 w-4" />
							)}
						</IconButton>
					</TooltipTrigger>
					<TooltipContent side="bottom">
						<p>{t("toolbar:export.atex")}</p>
					</TooltipContent>
				</Tooltip>
			)}
			<Tooltip>
				<TooltipTrigger asChild>
					<IconButton onClick={onPrintClick} disabled={!content}>
						<Printer className="h-4 w-4" />
					</IconButton>
				</TooltipTrigger>
				<TooltipContent side="bottom">
					<p>{t("print:printPreview")}</p>
				</TooltipContent>
			</Tooltip>
		</div>
	);
}
