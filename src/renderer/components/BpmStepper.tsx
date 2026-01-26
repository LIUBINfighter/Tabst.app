import { Minus, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAppStore } from "../store/appStore";
import IconButton from "./ui/icon-button";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "./ui/tooltip";

export default function BpmStepper() {
	const { t } = useTranslation("toolbar");
	const songInitialBpm = useAppStore((s) => s.songInitialBpm);
	const playbackSpeed = useAppStore((s) => s.playbackSpeed);
	const setPlaybackSpeed = useAppStore((s) => s.setPlaybackSpeed);
	const playerControls = useAppStore((s) => s.playerControls);

	const [inputBpm, setInputBpm] = useState<number | null>(null);

	useEffect(() => {
		if (!songInitialBpm) {
			setInputBpm(null);
			return;
		}
		const live = Math.round((songInitialBpm ?? 0) * playbackSpeed);
		setInputBpm(live);
	}, [songInitialBpm, playbackSpeed]);

	const applyTargetBpm = (target: number) => {
		if (!songInitialBpm) return;
		const newSpeed = target / songInitialBpm;
		const clamped = Math.max(0.25, Math.min(2.0, newSpeed));
		setPlaybackSpeed(clamped);
		try {
			playerControls?.applyPlaybackSpeed?.(clamped);
		} catch (e) {
			console.error("BpmStepper applyPlaybackSpeed failed:", e);
		}
	};

	const onInc = (delta: number) => {
		if (!songInitialBpm || inputBpm == null) return;
		const next = inputBpm + delta;
		setInputBpm(next);
		applyTargetBpm(next);
	};

	return (
		<TooltipProvider delayDuration={200}>
			<div className="flex items-center gap-1">
				{songInitialBpm ? (
					<>
						<Tooltip>
							<TooltipTrigger asChild>
								<IconButton
									compact
									onClick={() => onInc(-1)}
									aria-label={t("bpm.decrease")}
								>
									<Minus className="h-4 w-4" />
								</IconButton>
							</TooltipTrigger>
							<TooltipContent side="top">
								<p>{t("bpm.decrease")}</p>
							</TooltipContent>
						</Tooltip>

						<input
							aria-label={t("bpm.ariaLabel")}
							type="number"
							value={inputBpm ?? ""}
							onChange={(e) => {
								const v = parseInt(e.target.value ?? "", 10);
								if (Number.isNaN(v)) {
									setInputBpm(null);
									return;
								}
								setInputBpm(v);
							}}
							onBlur={() => {
								if (!inputBpm) return;
								applyTargetBpm(inputBpm);
							}}
							className="w-8 h-6 text-xs text-center rounded bg-transparent border border-border px-1 input-no-spinner"
							step={1}
							min={1}
							max={999}
						/>
						<span className="text-xs text-muted-foreground ml-0.5">
							{t("bpm.label")}
						</span>

						<Tooltip>
							<TooltipTrigger asChild>
								<IconButton
									compact
									onClick={() => onInc(1)}
									aria-label={t("bpm.increase")}
								>
									<Plus className="h-4 w-4" />
								</IconButton>
							</TooltipTrigger>
							<TooltipContent side="top">
								<p>{t("bpm.increase")}</p>
							</TooltipContent>
						</Tooltip>
					</>
				) : (
					<span className="text-xs text-muted-foreground">
						{t("bpm.label")}
					</span>
				)}
			</div>
		</TooltipProvider>
	);
}
