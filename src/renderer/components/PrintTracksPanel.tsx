/**
 * PrintTracksPanel - 打印预览音轨选择面板
 *
 * 简化版的音轨管理面板，专用于 PrintPreview 组件
 * 仅提供音轨可见性切换和五线谱显示选项
 */

import type * as AlphaTab from "@coderline/alphatab";
import { Check, Eye, EyeOff, Layers } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "./ui/button";

/**
 * 谱表配置（纯数据，不依赖 AlphaTab 对象）
 */
interface StaffConfig {
	staffIndex: number; // stable staff identifier
	showStandardNotation: boolean;
	showTablature: boolean;
	showSlash: boolean;
	showNumbered: boolean;
}

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
	/** AlphaTab API 实例 */
	api: AlphaTab.AlphaTabApi | null;
	/** 面板是否打开 */
	isOpen: boolean;
	/** 关闭面板回调 */
	onClose: () => void;
	/** 音轨选择变化回调 */
	onTracksChange?: (tracks: AlphaTab.model.Track[]) => void;
	/** 当前缩放值 */
	zoom?: number;
	/** 缩放变化回调 */
	onZoomChange?: (zoom: number) => void /** 每行小节数 */;
	barsPerRow?: number;
	/** 每行小节数变化回调 */
	onBarsPerRowChange?: (barsPerRow: number) => void;
	/** 音符间距拉伸力度 */
	stretchForce?: number;
	/** 音符间距拉伸力度变化回调 */
	onStretchForceChange?: (
		stretchForce: number,
	) => void /** 应用配置回调 - 在 render 之前调用，返回选中的音轨列表 */;
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
	// 音轨配置（Source of Truth，纯数据）
	const [trackConfigs, setTrackConfigs] = useState<TrackConfig[]>([]);

	// 标记是否已初始化
	const [isInitialized, setIsInitialized] = useState(false);

	// 初始化：从 API 读取初始状态（仅一次）
	useEffect(() => {
		if (!api?.score || isInitialized) return;

		console.log("[PrintTracksPanel] 初始化配置");

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

		console.log("[PrintTracksPanel] 应用配置到 AlphaTab");

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
		<div className="w-72 border-l border-border bg-card flex flex-col h-full shrink-0">
			{/* Header */}
			<div className="h-12 border-b border-border flex items-center justify-between px-3 shrink-0">
				<div className="flex items-center gap-2">
					<Layers className="h-4 w-4" />
					<span className="text-sm font-medium">打印设置</span>
				</div>
			</div>

			{/* Content */}
			<div className="flex-1 overflow-y-auto p-2">
				{/* 缩放控制 */}
				<div className="mb-3 p-3 bg-muted/30 rounded-md space-y-2">
					<div className="flex items-center justify-between">
						<span className="text-xs font-medium text-muted-foreground">
							缩放比例
						</span>
						<span className="text-xs font-mono text-primary">
							{Math.round(zoom * 100)}%
						</span>
					</div>
					<div className="flex items-center gap-2">
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
							title="调整曲谱缩放比例"
						/>
						<Button
							variant="ghost"
							size="sm"
							className="h-6 px-2 text-xs"
							onClick={() => onZoomChange?.(1.0)}
							title="重置为100%"
						>
							重置
						</Button>
					</div>
					<div className="flex justify-between text-xs text-muted-foreground">
						<span>50%</span>
						<span>100%</span>
					</div>
				</div>
				{/* 每行小节数控制 */}
				<div className="mb-3 p-3 bg-muted/30 rounded-md space-y-2">
					<div className="flex items-center justify-between">
						<span className="text-xs font-medium text-muted-foreground">
							每行小节数
						</span>
						<span className="text-xs font-mono text-primary">
							{barsPerRow === -1 ? "自动" : barsPerRow}
						</span>
					</div>
					<div className="flex items-center gap-2">
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
							title="设置每行显示的小节数，-1为自动模式"
						/>
						<Button
							variant="ghost"
							size="sm"
							className="h-6 px-2 text-xs"
							onClick={() => onBarsPerRowChange?.(-1)}
							title="重置为自动"
						>
							自动
						</Button>
					</div>
					<div className="flex justify-between text-xs text-muted-foreground">
						<span>自动</span>
						<span>8</span>
					</div>
				</div>

				{/* 音符间距拉伸控制 */}
				<div className="mb-3 p-3 bg-muted/30 rounded-md space-y-2">
					<div className="flex items-center justify-between">
						<span className="text-xs font-medium text-muted-foreground">
							音符间距
						</span>
						<span className="text-xs font-mono text-primary">
							{stretchForce.toFixed(1)}×
						</span>
					</div>
					<div className="flex items-center gap-2">
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
							title="调整音符之间的间距，值越大间距越宽"
						/>
						<Button
							variant="ghost"
							size="sm"
							className="h-6 px-2 text-xs"
							onClick={() => onStretchForceChange?.(1.0)}
							title="重置为标准"
						>
							重置
						</Button>
					</div>
					<div className="flex justify-between text-xs text-muted-foreground">
						<span>紧凑</span>
						<span>标准</span>
						<span>宽松</span>
					</div>
				</div>
				{/* 音轨列表标题 */}
				<div className="flex items-center justify-between mb-2 px-1">
					<span className="text-xs font-medium text-muted-foreground">
						音轨选择
					</span>
					<div className="flex items-center gap-1">
						<Button
							variant="ghost"
							size="sm"
							className="h-6 px-2 text-xs"
							onClick={selectAllTracks}
							title="全选"
						>
							全选
						</Button>
						<Button
							variant="ghost"
							size="sm"
							className="h-6 px-2 text-xs"
							onClick={deselectAllTracks}
							title="仅第一个"
						>
							清除
						</Button>
					</div>
				</div>

				{trackConfigs.length === 0 ? (
					<div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
						暂无音轨
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

			{/* Footer */}
			<div className="h-10 border-t border-border flex items-center justify-between px-3 text-xs text-muted-foreground shrink-0">
				<span>
					已选择 {selectedCount} / {totalCount} 音轨
				</span>
				<Button
					variant="ghost"
					size="sm"
					className="h-7 px-2"
					onClick={onClose}
				>
					完成
				</Button>
			</div>
		</div>
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
						<div
							key={`staff-${index}-${staffConfig.staffIndex}`}
							className="flex items-center gap-1 pl-7 text-xs"
						>
							<span className="text-muted-foreground w-12 shrink-0">
								谱表 {staffIdx + 1}:
							</span>
							<div className="flex gap-1">
								<StaffOptionButton
									label="五线"
									icon="𝅘𝅥"
									isActive={staffConfig.showStandardNotation}
									onClick={() =>
										onToggleStaffOption(
											index,
											staffConfig.staffIndex,
											"showStandardNotation",
										)
									}
									title="标准记谱法"
								/>
								<StaffOptionButton
									label="TAB"
									isActive={staffConfig.showTablature}
									onClick={() =>
										onToggleStaffOption(
											index,
											staffConfig.staffIndex,
											"showTablature",
										)
									}
									title="六线谱"
								/>
								<StaffOptionButton
									label="/"
									icon="𝄍"
									isActive={staffConfig.showSlash}
									onClick={() =>
										onToggleStaffOption(
											index,
											staffConfig.staffIndex,
											"showSlash",
										)
									}
									title="斜线记谱法"
								/>
								<StaffOptionButton
									label="123"
									isActive={staffConfig.showNumbered}
									onClick={() =>
										onToggleStaffOption(
											index,
											staffConfig.staffIndex,
											"showNumbered",
										)
									}
									title="简谱"
								/>
							</div>
						</div>
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
	icon?: string;
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
		<button
			type="button"
			className={`h-5 px-1.5 text-xs rounded transition-colors ${
				isActive
					? "bg-primary text-primary-foreground"
					: "bg-muted text-muted-foreground hover:bg-muted/80"
			}`}
			onClick={(e) => {
				e.stopPropagation();
				onClick();
			}}
			title={title}
		>
			{icon || label}
		</button>
	);
}
