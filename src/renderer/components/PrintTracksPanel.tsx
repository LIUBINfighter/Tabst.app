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
 * 五线谱显示选项
 */
interface StaffDisplayOptions {
	showStandardNotation: boolean;
	showTablature: boolean;
	showSlash: boolean;
	showNumbered: boolean;
}

/**
 * 音轨选择状态
 */
interface TrackSelection {
	track: AlphaTab.model.Track;
	isSelected: boolean;
	staffOptions: StaffDisplayOptions[];
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
}

/**
 * 打印预览音轨选择面板
 */
export function PrintTracksPanel({
	api,
	isOpen,
	onClose,
	onTracksChange,
}: PrintTracksPanelProps) {
	// 当前曲谱
	const [score, setScore] = useState<AlphaTab.model.Score | null>(null);

	// 音轨选择状态
	const [trackSelections, setTrackSelections] = useState<TrackSelection[]>([]);

	// 初始化：从 API 获取曲谱和当前选中的音轨
	useEffect(() => {
		if (!api?.score) return;

		const currentScore = api.score;
		setScore(currentScore);

		// 构建音轨选择状态
		const selectedTrackIndices = new Set(api.tracks.map((t) => t.index));

		const selections: TrackSelection[] = currentScore.tracks.map((track) => ({
			track,
			isSelected: selectedTrackIndices.has(track.index),
			staffOptions: track.staves.map((staff) => ({
				showStandardNotation: staff.showStandardNotation,
				showTablature: staff.showTablature,
				showSlash: staff.showSlash,
				showNumbered: staff.showNumbered,
			})),
		}));

		setTrackSelections(selections);
	}, [api, api?.score]);

	// 切换音轨选择
	const toggleTrackSelection = useCallback(
		(trackIndex: number) => {
			if (!api || !score) return;

			setTrackSelections((prev) => {
				const newSelections = prev.map((sel) =>
					sel.track.index === trackIndex
						? { ...sel, isSelected: !sel.isSelected }
						: sel,
				);

				// 确保至少有一个音轨被选中
				const hasSelected = newSelections.some((s) => s.isSelected);
				if (!hasSelected) {
					return prev; // 保持原状态
				}

				// 获取选中的音轨并排序
				const selectedTracks = newSelections
					.filter((s) => s.isSelected)
					.map((s) => s.track)
					.sort((a, b) => a.index - b.index);

				// 更新 alphaTab 渲染
				api.renderTracks(selectedTracks);

				// 通知父组件
				onTracksChange?.(selectedTracks);

				return newSelections;
			});
		},
		[api, score, onTracksChange],
	);

	// 全选音轨
	const selectAllTracks = useCallback(() => {
		if (!api || !score) return;

		const allTracks = score.tracks.slice().sort((a, b) => a.index - b.index);
		api.renderTracks(allTracks);

		setTrackSelections((prev) =>
			prev.map((sel) => ({ ...sel, isSelected: true })),
		);

		onTracksChange?.(allTracks);
	}, [api, score, onTracksChange]);

	// 取消全选（保留第一个）
	const deselectAllTracks = useCallback(() => {
		if (!api || !score || score.tracks.length === 0) return;

		const firstTrack = score.tracks[0];
		api.renderTracks([firstTrack]);

		setTrackSelections((prev) =>
			prev.map((sel, idx) => ({ ...sel, isSelected: idx === 0 })),
		);

		onTracksChange?.([firstTrack]);
	}, [api, score, onTracksChange]);

	// 切换五线谱显示选项
	const toggleStaffOption = useCallback(
		(
			trackIndex: number,
			staffIndex: number,
			option: keyof StaffDisplayOptions,
		) => {
			if (!api) return;

			setTrackSelections((prev) => {
				const newSelections = prev.map((sel) => {
					if (sel.track.index !== trackIndex) return sel;

					const newStaffOptions = [...sel.staffOptions];
					const currentOptions = newStaffOptions[staffIndex];

					// 切换选项
					const newValue = !currentOptions[option];

					// 确保至少有一个显示选项被选中
					const testOptions = { ...currentOptions, [option]: newValue };
					const hasAnyOption = Object.values(testOptions).some((v) => v);
					if (!hasAnyOption) return sel;

					newStaffOptions[staffIndex] = {
						...currentOptions,
						[option]: newValue,
					};

					// 应用到 staff 对象
					const staff = sel.track.staves[staffIndex];
					if (staff) {
						staff[option] = newValue;
					}

					return { ...sel, staffOptions: newStaffOptions };
				});

				// 触发重新渲染
				api.render();

				return newSelections;
			});
		},
		[api],
	);

	// 计算选中数量
	const selectedCount = trackSelections.filter((s) => s.isSelected).length;
	const totalCount = trackSelections.length;

	if (!isOpen) return null;

	return (
		<div className="w-72 border-l border-border bg-card flex flex-col h-full shrink-0">
			{/* Header */}
			<div className="h-12 border-b border-border flex items-center justify-between px-3 shrink-0">
				<div className="flex items-center gap-2">
					<Layers className="h-4 w-4" />
					<span className="text-sm font-medium">音轨选择</span>
				</div>
				<div className="flex items-center gap-1">
					<Button
						variant="ghost"
						size="sm"
						className="h-7 px-2 text-xs"
						onClick={selectAllTracks}
						title="全选"
					>
						全选
					</Button>
					<Button
						variant="ghost"
						size="sm"
						className="h-7 px-2 text-xs"
						onClick={deselectAllTracks}
						title="仅第一个"
					>
						清除
					</Button>
				</div>
			</div>

			{/* Content */}
			<div className="flex-1 overflow-y-auto p-2">
				{!score || trackSelections.length === 0 ? (
					<div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
						暂无音轨
					</div>
				) : (
					<div className="space-y-1">
						{trackSelections.map((sel) => (
							<TrackItem
								key={sel.track.index}
								selection={sel}
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
	selection: TrackSelection;
	onToggleSelection: (trackIndex: number) => void;
	onToggleStaffOption: (
		trackIndex: number,
		staffIndex: number,
		option: keyof StaffDisplayOptions,
	) => void;
}

function TrackItem({
	selection,
	onToggleSelection,
	onToggleStaffOption,
}: TrackItemProps) {
	const { track, isSelected, staffOptions } = selection;
	const [isExpanded, setIsExpanded] = useState(false);

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
				className="flex items-center gap-2 p-2 cursor-pointer hover:bg-muted/50 rounded-md w-full text-left"
				onClick={() => onToggleSelection(track.index)}
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
					title={track.name}
				>
					{track.name || `Track ${track.index + 1}`}
				</span>

				{/* 展开/收起五线谱选项 */}
				{staffOptions.length > 0 && (
					<Button
						variant="ghost"
						size="sm"
						className="h-6 w-6 p-0"
						onClick={(e) => {
							e.stopPropagation();
							setIsExpanded(!isExpanded);
						}}
						title={isExpanded ? "收起选项" : "展开选项"}
					>
						<span
							className={`text-xs transition-transform ${isExpanded ? "rotate-90" : ""}`}
						>
							▶
						</span>
					</Button>
				)}
			</button>

			{/* 五线谱显示选项（展开时显示） */}
			{isExpanded && isSelected && (
				<div className="px-2 pb-2 pt-1 space-y-1">
					{staffOptions.map((options, staffIdx) => (
						<div
							key={`staff-${track.index}-${staffIdx}`}
							className="flex items-center gap-1 pl-7 text-xs"
						>
							<span className="text-muted-foreground w-12 shrink-0">
								谱表 {staffIdx + 1}:
							</span>
							<div className="flex gap-1">
								<StaffOptionButton
									label="五线"
									icon="𝅘𝅥"
									isActive={options.showStandardNotation}
									onClick={() =>
										onToggleStaffOption(
											track.index,
											staffIdx,
											"showStandardNotation",
										)
									}
									title="标准记谱法"
								/>
								<StaffOptionButton
									label="TAB"
									isActive={options.showTablature}
									onClick={() =>
										onToggleStaffOption(track.index, staffIdx, "showTablature")
									}
									title="六线谱"
								/>
								<StaffOptionButton
									label="/"
									icon="𝄍"
									isActive={options.showSlash}
									onClick={() =>
										onToggleStaffOption(track.index, staffIdx, "showSlash")
									}
									title="斜线记谱法"
								/>
								<StaffOptionButton
									label="123"
									isActive={options.showNumbered}
									onClick={() =>
										onToggleStaffOption(track.index, staffIdx, "showNumbered")
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
