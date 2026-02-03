import type { AlphaTabApi } from "@coderline/alphatab";
import type { TFunction } from "i18next";
import { FileDown, FileMusic, Music, Printer } from "lucide-react";
import {
	exportToGp7,
	exportToMidi,
	exportToWav,
	getDefaultExportFilename,
} from "../lib/alphatab-export";
import IconButton from "./ui/icon-button";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

export interface PreviewToolbarProps {
	apiRef: React.RefObject<AlphaTabApi | null>;
	fileName?: string;
	content?: string;
	onPrintClick: () => void;
	t: TFunction;
}

export default function PreviewToolbar({
	apiRef,
	fileName,
	content,
	onPrintClick,
	t,
}: PreviewToolbarProps) {
	return (
		<div className="ml-2 flex items-center gap-1">
			<Tooltip>
				<TooltipTrigger asChild>
					<IconButton
						onClick={() => {
							const api = apiRef.current;
							if (!api?.score) return;
							exportToMidi(api);
						}}
						disabled={!apiRef.current?.score}
					>
						<Music className="h-4 w-4" />
					</IconButton>
				</TooltipTrigger>
				<TooltipContent side="bottom">
					<p>{t("toolbar:export.midi")}</p>
				</TooltipContent>
			</Tooltip>
			<Tooltip>
				<TooltipTrigger asChild>
					<IconButton
						onClick={async () => {
							const api = apiRef.current;
							if (!api?.score) return;
							const filename = getDefaultExportFilename(fileName, "wav");
							await exportToWav(api, filename);
						}}
						disabled={!apiRef.current?.score}
					>
						<FileDown className="h-4 w-4" />
					</IconButton>
				</TooltipTrigger>
				<TooltipContent side="bottom">
					<p>{t("toolbar:export.wav")}</p>
				</TooltipContent>
			</Tooltip>
			<Tooltip>
				<TooltipTrigger asChild>
					<IconButton
						onClick={() => {
							const api = apiRef.current;
							if (!api?.score) return;
							const filename = getDefaultExportFilename(fileName, "gp");
							exportToGp7(api, filename);
						}}
						disabled={!apiRef.current?.score}
					>
						<FileMusic className="h-4 w-4" />
					</IconButton>
				</TooltipTrigger>
				<TooltipContent side="bottom">
					<p>{t("toolbar:export.gp")}</p>
				</TooltipContent>
			</Tooltip>
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
