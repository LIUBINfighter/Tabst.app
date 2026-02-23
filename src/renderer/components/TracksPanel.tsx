/**
 * TracksPanel - 音轨选择面板
 *
 * 从 PrintTracksPanel 拆分出来的可复用组件
 * 用于在 Preview 组件中控制音轨显示和谱表选项
 */

import type * as AlphaTab from "@coderline/alphatab";
import { Check, Eye, EyeOff, Layers, Music, X } from "lucide-react";
import {
	type ReactNode,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import { useTranslation } from "react-i18next";
import { useAppStore } from "../store/appStore";
import { Button } from "./ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "./ui/tooltip";

/**
 * 谱表配置（纯数据，不依赖 AlphaTab 对象）
 */
interface StaffConfig {
	staffIndex: number;
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
	index: number;
	name: string;
	isSelected: boolean;
	staves: StaffConfig[];
}

export interface TracksPanelProps {
	/** AlphaTab API instance */
	api: AlphaTab.AlphaTabApi | null;
	/** Whether panel is open */
	isOpen: boolean;
	/** Callback to close panel */
	onClose: () => void;
	/** Callback when track selection changes */
	onTracksChange?: (tracks: AlphaTab.model.Track[]) => void;
}

/**
 * 音轨选择面板
 */
export function TracksPanel({
	api,
	isOpen,
	onClose,
	onTracksChange,
}: TracksPanelProps) {
	const { t } = useTranslation("print");
	const [trackConfigs, setTrackConfigs] = useState<TrackConfig[]>([]);

	// 订阅 store 的 firstStaffOptions 以保持同步
	const firstStaffOptions = useAppStore((s) => s.firstStaffOptions);
	const setFirstStaffOptions = useAppStore((s) => s.setFirstStaffOptions);
	// 防止循环更新的标志
	const isUpdatingFromStoreRef = useRef(false);

	// 初始化：从 API 读取初始状态
	useEffect(() => {
		if (!api?.score) {
			setTrackConfigs([]);
			return;
		}

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
	}, [api, api?.score]);

	// 监听 store 的 firstStaffOptions 变化，同步到本地状态（来自底栏 StaffControls 的更改）
	useEffect(() => {
		if (!firstStaffOptions || isUpdatingFromStoreRef.current) return;
		if (trackConfigs.length === 0) return;

		// 只更新第一个音轨的第一个谱表配置
		setTrackConfigs((prev) => {
			if (prev.length === 0) return prev;
			const first = prev[0];
			if (!first.staves.length) return prev;

			const currentStaff = first.staves[0];
			// 检查是否有变化
			if (
				currentStaff.showStandardNotation ===
					firstStaffOptions.showStandardNotation &&
				currentStaff.showTablature === firstStaffOptions.showTablature &&
				currentStaff.showSlash === firstStaffOptions.showSlash &&
				currentStaff.showNumbered === firstStaffOptions.showNumbered
			) {
				return prev;
			}

			const newStaves: StaffConfig[] = first.staves.map((s, idx) =>
				idx === 0
					? {
							...s,
							showStandardNotation:
								firstStaffOptions.showStandardNotation ??
								s.showStandardNotation,
							showTablature: firstStaffOptions.showTablature ?? s.showTablature,
							showSlash: firstStaffOptions.showSlash ?? s.showSlash,
							showNumbered: firstStaffOptions.showNumbered ?? s.showNumbered,
						}
					: s,
			);

			return prev.map((cfg, idx) =>
				idx === 0 ? { ...cfg, staves: newStaves } : cfg,
			);
		});
	}, [firstStaffOptions, trackConfigs.length]);

	// 切换音轨选择
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
					return prev;
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

	// 同步第一个音轨的第一个谱表配置到 store
	const syncFirstStaffToStore = useCallback(
		(staffConfig: StaffConfig) => {
			isUpdatingFromStoreRef.current = true;
			setFirstStaffOptions({
				showStandardNotation: staffConfig.showStandardNotation,
				showTablature: staffConfig.showTablature,
				showSlash: staffConfig.showSlash,
				showNumbered: staffConfig.showNumbered,
			});
			// 延迟重置标志，确保 useEffect 不会响应这次更新
			setTimeout(() => {
				isUpdatingFromStoreRef.current = false;
			}, 0);
		},
		[setFirstStaffOptions],
	);

	// 切换谱表显示选项
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

					if (!hasAnyOption) return cfg;

					// 更新配置
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

					// 如果是第一个音轨的第一个谱表，同步到 store
					if (trackIndex === 0 && staffIndex === 0) {
						const updatedStaff = { ...currentStaff, [option]: newValue };
						syncFirstStaffToStore(updatedStaff);
					}

					return { ...cfg, staves: newStaves };
				});

				// 触发重新渲染
				score && api.render();

				return newConfigs;
			});
		},
		[api, syncFirstStaffToStore],
	);

	// 计算选中数量
	const selectedCount = trackConfigs.filter((c) => c.isSelected).length;
	const totalCount = trackConfigs.length;

	if (!isOpen) return null;

	return (
		<TooltipProvider delayDuration={200}>
			<div className="w-64 border-l border-border bg-card flex flex-col h-full shrink-0 shadow-lg absolute right-0 top-0 bottom-0 z-[2001]">
				{/* Header */}
				<div className="h-10 border-b border-border flex items-center justify-between px-3 shrink-0">
					<div className="flex items-center gap-2">
						<Layers className="h-4 w-4" />
						<span className="text-sm font-medium">{t("trackSelect")}</span>
					</div>
					<Tooltip>
						<TooltipTrigger asChild>
							<button
								type="button"
								onClick={onClose}
								className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted transition-colors"
							>
								<X className="h-4 w-4" />
							</button>
						</TooltipTrigger>
						<TooltipContent side="left">
							<p>{t("close")}</p>
						</TooltipContent>
					</Tooltip>
				</div>

				{/* Content */}
				<div className="flex-1 overflow-y-auto p-2">
					<div className="flex items-center justify-between mb-2 px-1">
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
						<div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
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

				{/* Footer */}
				<div className="h-9 border-t border-border flex items-center justify-between px-3 text-xs text-muted-foreground shrink-0">
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

function TrackStaffRow({
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
			{/* 谱表显示选项 */}
			{isSelected && staves.length > 0 && (
				<div className="px-2 pb-2 pt-1 space-y-1">
					{staves.map((staffConfig, staffIdx) => (
						<TrackStaffRow
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

export default TracksPanel;
