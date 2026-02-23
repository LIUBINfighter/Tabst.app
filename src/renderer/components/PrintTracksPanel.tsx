/**
 * PrintTracksPanel - 打印预览音轨选择面板
 *
 * 简化版的音轨管理面板，专用于 PrintPreview 组件
 * 仅提供音轨可见性切换和五线谱显示选项
 */

import type * as AlphaTab from "@coderline/alphatab";
import { Check, Eye, EyeOff, Layers, Music } from "lucide-react";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { StaffConfigWithIndex } from "../lib/staff-config";
import { Button } from "./ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "./ui/tooltip";

/** 谱表配置（与 lib/staff-config 的 StaffDisplayOptions 对齐） */
type StaffConfig = StaffConfigWithIndex;
type StaffDisplayOption = keyof Omit<StaffConfig, "staffIndex">;

/**
 * 音轨配置（纯数据，Source of Truth）
 */
interface TrackConfig {
	index: number; // 音轨索引（稳定 ID）
	name: string; // 音轨名称
	isSelected: boolean; // 是否选中
	staves: StaffConfig[]; // 谱表配置
}

export interface PrintTracksPanelProps {
	/** AlphaTab API instance */
	api: AlphaTab.AlphaTabApi | null;
	/** Whether panel is open */
	isOpen: boolean;
	/** Callback to close panel */
	onClose: () => void;
	/** Callback when track selection changes */
	onTracksChange?: (tracks: AlphaTab.model.Track[]) => void;
	/** Current zoom value */
	zoom?: number;
	/** Callback when zoom changes */
	onZoomChange?: (zoom: number) => void;
	/** Number of bars per row */
	barsPerRow?: number;
	/** Callback when bars per row changes */
	onBarsPerRowChange?: (barsPerRow: number) => void;
	/** Note spacing stretch force */
	stretchForce?: number;
	/** Callback when stretch force changes */
	onStretchForceChange?: (stretchForce: number) => void;
	/** Apply configuration callback - called before render, returns selected track list */
	onApplyStaffOptionsReady?: (applyFn: () => AlphaTab.model.Track[]) => void;
}

/**
 * 打印预览音轨选择面板
 */
export function PrintTracksPanel({
	api,
	isOpen,
	onClose,
	onTracksChange,
	zoom = 0.8,
	onZoomChange,
	barsPerRow = -1,
	onBarsPerRowChange,
	stretchForce = 1.0,
	onStretchForceChange,
	onApplyStaffOptionsReady,
}: PrintTracksPanelProps) {
	const { t } = useTranslation("print");
	const [trackConfigs, setTrackConfigs] = useState<TrackConfig[]>([]);

	// 标记是否已初始化
	const [isInitialized, setIsInitialized] = useState(false);

	// API 实例变化时重置初始化状态，避免持有旧实例的音轨配置
	useEffect(() => {
		setIsInitialized(false);
		if (!api?.score) {
			setTrackConfigs([]);
		}
	}, [api]);

	// 初始化：从 API 读取初始状态（仅一次）
	useEffect(() => {
		if (!api?.score || isInitialized) return;

		const selectedIndices = new Set(api.tracks.map((t) => t.index));

		const configs: TrackConfig[] = api.score.tracks.map((track) => ({
			index: track.index,
			name: track.name || `Track ${track.index + 1}`,
			isSelected: selectedIndices.has(track.index),
			staves: track.staves.map((staff, staffIdx) => ({
				staffIndex:
					typeof (staff as AlphaTab.model.Staff).index === "number"
						? (staff as AlphaTab.model.Staff).index
						: staffIdx,
				showStandardNotation: staff.showStandardNotation,
				showTablature: staff.showTablature,
				showSlash: staff.showSlash,
				showNumbered: staff.showNumbered,
			})),
		}));

		setTrackConfigs(configs);
		setIsInitialized(true);
	}, [api, api?.score, isInitialized]);

	// 应用配置到 AlphaTab 对象（单向：Config -> Object）
	// 返回选中的音轨列表，供渲染使用
	const applyConfigsToAlphaTab = useCallback((): AlphaTab.model.Track[] => {
		const score = api?.score;
		if (!score) return [];

		// 1. 先应用所有 staff 配置
		trackConfigs.forEach((config) => {
			const track = score.tracks.find((t) => t.index === config.index);
			if (!track) return;

			config.staves.forEach((staffConfig) => {
				const staff =
					track.staves.find(
						(s) => (s as AlphaTab.model.Staff).index === staffConfig.staffIndex,
					) || track.staves[0];
				if (staff) {
					staff.showStandardNotation = staffConfig.showStandardNotation;
					staff.showTablature = staffConfig.showTablature;
					staff.showSlash = staffConfig.showSlash;
					staff.showNumbered = staffConfig.showNumbered;
				}
			});
		});

		// 2. 返回选中的音轨列表
		const selectedTracks = trackConfigs
			.filter((c) => c.isSelected)
			.map((c) => score.tracks.find((t) => t.index === c.index))
			.filter((t): t is AlphaTab.model.Track => t !== undefined)
			.sort((a, b) => a.index - b.index);

		return selectedTracks;
	}, [api, trackConfigs]);

	// 暴露应用函数给父组件（用于 zoom 变化前调用）
	// 暴露应用函数给父组件（用于 zoom 变化前调用）
	useEffect(() => {
		if (onApplyStaffOptionsReady) {
			onApplyStaffOptionsReady(applyConfigsToAlphaTab);
		}
	}, [applyConfigsToAlphaTab, onApplyStaffOptionsReady]);

	// 切换音轨选择（更新配置 + 应用到 AlphaTab + 触发渲染）
	const toggleTrackSelection = useCallback(
		(trackIndex: number) => {
			const score = api?.score;
			if (!score) return;

			setTrackConfigs((prev) => {
				const newConfigs = prev.map((cfg) =>
					cfg.index === trackIndex
						? { ...cfg, isSelected: !cfg.isSelected }
						: cfg,
				);

				// 确保至少有一个音轨被选中
				const hasSelected = newConfigs.some((c) => c.isSelected);
				if (!hasSelected) {
					return prev; // 保持原状态
				}

				// 获取选中的音轨
				const selectedTracks = newConfigs
					.filter((c) => c.isSelected)
					.map((c) => score.tracks.find((t) => t.index === c.index))
					.filter((t): t is AlphaTab.model.Track => t !== undefined)
					.sort((a, b) => a.index - b.index);

				// 应用配置到 AlphaTab
				newConfigs.forEach((config) => {
					const track = score.tracks.find((t) => t.index === config.index);
					if (!track) return;

					config.staves.forEach((staffConfig) => {
						const staff =
							track.staves.find(
								(s) =>
									(s as AlphaTab.model.Staff).index === staffConfig.staffIndex,
							) || track.staves[0];
						if (staff) {
							staff.showStandardNotation = staffConfig.showStandardNotation;
							staff.showTablature = staffConfig.showTablature;
							staff.showSlash = staffConfig.showSlash;
							staff.showNumbered = staffConfig.showNumbered;
						}
					});
				});

				// 更新 alphaTab 渲染
				api.renderTracks(selectedTracks);

				// 通知父组件
				onTracksChange?.(selectedTracks);

				return newConfigs;
			});
		},
		[api, onTracksChange],
	);

	// 全选音轨
	const selectAllTracks = useCallback(() => {
		const score = api?.score;
		if (!score) return;

		setTrackConfigs((prev) => {
			const newConfigs = prev.map((cfg) => ({ ...cfg, isSelected: true }));

			const allTracks = score.tracks.slice().sort((a, b) => a.index - b.index);

			// 应用配置
			newConfigs.forEach((config) => {
				const track = score.tracks.find((t) => t.index === config.index);
				if (!track) return;

				config.staves.forEach((staffConfig) => {
					const staff =
						track.staves.find(
							(s) =>
								(s as AlphaTab.model.Staff).index === staffConfig.staffIndex,
						) || track.staves[0];
					if (staff) {
						staff.showStandardNotation = staffConfig.showStandardNotation;
						staff.showTablature = staffConfig.showTablature;
						staff.showSlash = staffConfig.showSlash;
						staff.showNumbered = staffConfig.showNumbered;
					}
				});
			});

			api.renderTracks(allTracks);
			onTracksChange?.(allTracks);

			return newConfigs;
		});
	}, [api, onTracksChange]);

	// 取消全选（保留第一个）
	const deselectAllTracks = useCallback(() => {
		const score = api?.score;
		if (!score || score.tracks.length === 0) return;

		setTrackConfigs((prev) => {
			const newConfigs = prev.map((cfg, idx) => ({
				...cfg,
				isSelected: idx === 0,
			}));

			const firstTrack = score.tracks[0];

			// 应用配置
			const firstConfig = newConfigs[0];
			if (firstConfig) {
				firstConfig.staves.forEach((staffConfig) => {
					const staff =
						firstTrack.staves.find(
							(s) =>
								(s as AlphaTab.model.Staff).index === staffConfig.staffIndex,
						) || firstTrack.staves[0];
					if (staff) {
						staff.showStandardNotation = staffConfig.showStandardNotation;
						staff.showTablature = staffConfig.showTablature;
						staff.showSlash = staffConfig.showSlash;
						staff.showNumbered = staffConfig.showNumbered;
					}
				});
			}

			api.renderTracks([firstTrack]);
			onTracksChange?.([firstTrack]);

			return newConfigs;
		});
	}, [api, onTracksChange]);

	// 切换谱表显示选项（只更新配置，立即应用并渲染）
	const toggleStaffOption = useCallback(
		(trackIndex: number, staffIndex: number, option: StaffDisplayOption) => {
			const score = api?.score;
			if (!score) return;

			setTrackConfigs((prev) => {
				const newConfigs = prev.map((cfg) => {
					if (cfg.index !== trackIndex) return cfg;

					const currentStaff = cfg.staves.find(
						(s) => s.staffIndex === staffIndex,
					);
					if (!currentStaff) return cfg;

					// 计算新值
					const newValue = !currentStaff[option];

					// 确保至少有一个显示选项被选中
					const testStaff = { ...currentStaff, [option]: newValue };
					const hasAnyOption =
						testStaff.showStandardNotation ||
						testStaff.showTablature ||
						testStaff.showSlash ||
						testStaff.showNumbered;

					if (!hasAnyOption) return cfg; // 至少保留一个选项

					// 更新配置（基于 staffIndex 而不是数组位置）
					const newStaves = cfg.staves.map((s) =>
						s.staffIndex === staffIndex ? { ...s, [option]: newValue } : s,
					);

					// 立即应用到 AlphaTab 对象
					const track = score.tracks.find((t) => t.index === trackIndex);
					if (track) {
						const staff =
							track.staves.find(
								(s) => (s as AlphaTab.model.Staff).index === staffIndex,
							) || track.staves[0];
						if (staff) {
							(staff as AlphaTab.model.Staff)[option] = newValue;
						}
					}

					return { ...cfg, staves: newStaves };
				});

				// 触发重新渲染
				score && api.render();

				return newConfigs;
			});
		},
		[api],
	);

	// 计算选中数量
	const selectedCount = trackConfigs.filter((c) => c.isSelected).length;
	const totalCount = trackConfigs.length;

	if (!isOpen) return null;

	return (
		<TooltipProvider delayDuration={200}>
			<div className="w-72 border-l border-border bg-card flex flex-col h-full shrink-0">
				{/* Header */}
				<div className="h-8 border-b border-border flex items-center justify-between px-3 shrink-0">
					<div className="flex items-center gap-2">
						<Layers className="h-4 w-4" />
						<span className="text-sm font-medium">{t("panelTitle")}</span>
					</div>
				</div>

				{/* Content */}
				<div className="flex-1 overflow-y-auto p-2">
					<div className="mb-2 rounded-md border border-border/60 bg-muted/20 p-2.5">
						<div className="mb-2 flex items-center justify-between px-0.5">
							<span className="text-xs font-medium text-muted-foreground">
								{t("trackSelect")}
							</span>
							<div className="flex items-center gap-1">
								<Tooltip>
									<TooltipTrigger asChild>
										<Button
											variant="ghost"
											size="sm"
											className="h-6 px-2 text-xs"
											onClick={selectAllTracks}
										>
											{t("selectAll")}
										</Button>
									</TooltipTrigger>
									<TooltipContent side="top">
										<p>{t("selectAll")}</p>
									</TooltipContent>
								</Tooltip>
								<Tooltip>
									<TooltipTrigger asChild>
										<Button
											variant="ghost"
											size="sm"
											className="h-6 px-2 text-xs"
											onClick={deselectAllTracks}
										>
											{t("clear")}
										</Button>
									</TooltipTrigger>
									<TooltipContent side="top">
										<p>{t("firstOnly")}</p>
									</TooltipContent>
								</Tooltip>
							</div>
						</div>

						{trackConfigs.length === 0 ? (
							<div className="flex h-28 items-center justify-center text-sm text-muted-foreground">
								{t("noTracks")}
							</div>
						) : (
							<div className="space-y-1">
								{trackConfigs.map((config) => (
									<TrackItem
										key={config.index}
										config={config}
										onToggleSelection={toggleTrackSelection}
										onToggleStaffOption={toggleStaffOption}
									/>
								))}
							</div>
						)}
					</div>

					<div className="mb-2 rounded-md border border-border/60 bg-muted/20 p-2.5 space-y-1.5">
						<div className="flex items-center justify-between">
							<span className="text-xs font-medium text-muted-foreground">
								{t("zoomLabel")}
							</span>
							<span className="text-xs font-mono text-primary">
								{Math.round(zoom * 100)}%
							</span>
						</div>
						<div className="flex items-center gap-2">
							<Tooltip>
								<TooltipTrigger asChild>
									<input
										type="range"
										className="flex-1 h-2 bg-muted rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:border-0"
										min="0.5"
										max="1.0"
										step="0.1"
										value={zoom}
										onChange={(e) =>
											onZoomChange?.(Number.parseFloat(e.target.value))
										}
									/>
								</TooltipTrigger>
								<TooltipContent side="top">
									<p>{t("zoomTitle")}</p>
								</TooltipContent>
							</Tooltip>
							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										variant="ghost"
										size="sm"
										className="h-6 px-2 text-xs"
										onClick={() => onZoomChange?.(1.0)}
									>
										{t("reset")}
									</Button>
								</TooltipTrigger>
								<TooltipContent side="top">
									<p>{t("resetTo100")}</p>
								</TooltipContent>
							</Tooltip>
						</div>
						<div className="flex justify-between text-xs text-muted-foreground">
							<span>50%</span>
							<span>100%</span>
						</div>
					</div>

					<div className="mb-2 rounded-md border border-border/60 bg-muted/20 p-2.5 space-y-1.5">
						<div className="flex items-center justify-between">
							<span className="text-xs font-medium text-muted-foreground">
								{t("barsPerRow")}
							</span>
							<span className="text-xs font-mono text-primary">
								{barsPerRow === -1 ? t("auto") : barsPerRow}
							</span>
						</div>
						<div className="flex items-center gap-2">
							<Tooltip>
								<TooltipTrigger asChild>
									<input
										type="range"
										className="flex-1 h-2 bg-muted rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:border-0"
										min="-1"
										max="8"
										step="1"
										value={barsPerRow}
										onChange={(e) =>
											onBarsPerRowChange?.(Number.parseInt(e.target.value, 10))
										}
									/>
								</TooltipTrigger>
								<TooltipContent side="top">
									<p>{t("barsPerRowTitle")}</p>
								</TooltipContent>
							</Tooltip>
							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										variant="ghost"
										size="sm"
										className="h-6 px-2 text-xs"
										onClick={() => onBarsPerRowChange?.(-1)}
									>
										{t("auto")}
									</Button>
								</TooltipTrigger>
								<TooltipContent side="top">
									<p>{t("resetAuto")}</p>
								</TooltipContent>
							</Tooltip>
						</div>
						<div className="flex justify-between text-xs text-muted-foreground">
							<span>{t("auto")}</span>
							<span>8</span>
						</div>
					</div>

					<div className="rounded-md border border-border/60 bg-muted/20 p-2.5 space-y-1.5">
						<div className="flex items-center justify-between">
							<span className="text-xs font-medium text-muted-foreground">
								{t("noteSpacing")}
							</span>
							<span className="text-xs font-mono text-primary">
								{stretchForce.toFixed(1)}×
							</span>
						</div>
						<div className="flex items-center gap-2">
							<Tooltip>
								<TooltipTrigger asChild>
									<input
										type="range"
										className="flex-1 h-2 bg-muted rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:border-0"
										min="0.5"
										max="2.0"
										step="0.1"
										value={stretchForce}
										onChange={(e) =>
											onStretchForceChange?.(Number.parseFloat(e.target.value))
										}
									/>
								</TooltipTrigger>
								<TooltipContent side="top">
									<p>{t("noteSpacingTitle")}</p>
								</TooltipContent>
							</Tooltip>
							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										variant="ghost"
										size="sm"
										className="h-6 px-2 text-xs"
										onClick={() => onStretchForceChange?.(1.0)}
									>
										{t("reset")}
									</Button>
								</TooltipTrigger>
								<TooltipContent side="top">
									<p>{t("resetStandard")}</p>
								</TooltipContent>
							</Tooltip>
						</div>
						<div className="flex justify-between text-xs text-muted-foreground">
							<span>{t("compact")}</span>
							<span>{t("standard")}</span>
							<span>{t("loose")}</span>
						</div>
					</div>
				</div>

				<div className="h-8 border-t border-border flex items-center justify-between px-3 text-xs text-muted-foreground shrink-0">
					<span>
						{t("selectedCount", { n: selectedCount, total: totalCount })}
					</span>
					<Button
						variant="ghost"
						size="sm"
						className="h-7 px-2"
						onClick={onClose}
					>
						{t("done")}
					</Button>
				</div>
			</div>
		</TooltipProvider>
	);
}

/**
 * 单个音轨项
 */
interface TrackItemProps {
	config: TrackConfig;
	onToggleSelection: (trackIndex: number) => void;
	onToggleStaffOption: (
		trackIndex: number,
		staffIndex: number,
		option: StaffDisplayOption,
	) => void;
}

function PrintTrackStaffRow({
	index,
	staffIdx,
	staffConfig,
	onToggleStaffOption,
}: {
	index: number;
	staffIdx: number;
	staffConfig: StaffConfig;
	onToggleStaffOption: (
		trackIndex: number,
		staffIndex: number,
		option: StaffDisplayOption,
	) => void;
}) {
	const { t } = useTranslation("print");
	return (
		<div className="flex items-center gap-1 pl-7 text-xs">
			<span className="text-muted-foreground w-12 shrink-0">
				{t("staffLabel", { n: staffIdx + 1 })}
			</span>
			<div className="flex gap-1">
				<StaffOptionButton
					label={t("staffShort.standard")}
					icon={<Music className="h-3 w-3" />}
					isActive={staffConfig.showStandardNotation}
					onClick={() =>
						onToggleStaffOption(
							index,
							staffConfig.staffIndex,
							"showStandardNotation",
						)
					}
					title={t("staff.standard")}
				/>
				<StaffOptionButton
					label={t("staffShort.tab")}
					isActive={staffConfig.showTablature}
					onClick={() =>
						onToggleStaffOption(index, staffConfig.staffIndex, "showTablature")
					}
					title={t("staff.tab")}
				/>
				<StaffOptionButton
					label={t("staffShort.slash")}
					icon="/"
					isActive={staffConfig.showSlash}
					onClick={() =>
						onToggleStaffOption(index, staffConfig.staffIndex, "showSlash")
					}
					title={t("staff.slash")}
				/>
				<StaffOptionButton
					label={t("staffShort.numbered")}
					isActive={staffConfig.showNumbered}
					onClick={() =>
						onToggleStaffOption(index, staffConfig.staffIndex, "showNumbered")
					}
					title={t("staff.numbered")}
				/>
			</div>
		</div>
	);
}

function TrackItem({
	config,
	onToggleSelection,
	onToggleStaffOption,
}: TrackItemProps) {
	const { index, name, isSelected, staves } = config;

	return (
		<div
			className={`rounded-md border transition-colors ${
				isSelected
					? "border-primary/50 bg-primary/5"
					: "border-transparent bg-muted/30"
			}`}
		>
			{/* 音轨标题行 */}
			<button
				type="button"
				aria-pressed={isSelected}
				className="w-full text-left flex items-center gap-2 p-2 hover:bg-muted/50 rounded-md"
				onClick={() => onToggleSelection(index)}
			>
				{/* 选择指示器 */}
				<div
					className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
						isSelected
							? "bg-primary border-primary text-primary-foreground"
							: "border-muted-foreground/30"
					}`}
				>
					{isSelected && <Check className="h-3 w-3" />}
				</div>

				{/* 可见性图标 */}
				{isSelected ? (
					<Eye className="h-4 w-4 text-primary" />
				) : (
					<EyeOff className="h-4 w-4 text-muted-foreground" />
				)}

				{/* 音轨名称 */}
				<span
					className={`flex-1 text-sm truncate ${
						isSelected ? "font-medium" : "text-muted-foreground"
					}`}
					title={name}
				>
					{name}
				</span>
			</button>
			{/* 谱表显示选项（从配置读取） */}
			{isSelected && staves.length > 0 && (
				<div className="px-2 pb-2 pt-1 space-y-1">
					{staves.map((staffConfig, staffIdx) => (
						<PrintTrackStaffRow
							key={`staff-${index}-${staffConfig.staffIndex}`}
							index={index}
							staffIdx={staffIdx}
							staffConfig={staffConfig}
							onToggleStaffOption={onToggleStaffOption}
						/>
					))}
				</div>
			)}
		</div>
	);
}

/**
 * 五线谱选项按钮
 */
interface StaffOptionButtonProps {
	label: string;
	icon?: ReactNode;
	isActive: boolean;
	onClick: () => void;
	title: string;
}

function StaffOptionButton({
	label,
	icon,
	isActive,
	onClick,
	title,
}: StaffOptionButtonProps) {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<button
					type="button"
					className={`h-5 px-1.5 text-xs rounded transition-colors inline-flex items-center justify-center ${
						isActive
							? "bg-primary text-primary-foreground"
							: "bg-muted text-muted-foreground hover:bg-muted/80"
					}`}
					onClick={(e) => {
						e.stopPropagation();
						onClick();
					}}
				>
					{icon || label}
				</button>
			</TooltipTrigger>
			<TooltipContent side="top">
				<p>{title}</p>
			</TooltipContent>
		</Tooltip>
	);
}
