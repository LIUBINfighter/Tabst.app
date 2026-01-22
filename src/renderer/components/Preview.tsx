import * as alphaTab from "@coderline/alphatab";
import { FileText, Printer } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPreviewSettings } from "../lib/alphatab-config";
import { formatFullError } from "../lib/alphatab-error";
import { loadBravuraFont, loadSoundFontFromUrl } from "../lib/assets";
import type { ResourceUrls } from "../lib/resourceLoaderService";
import { getResourceUrls } from "../lib/resourceLoaderService";
import {
	applyStaffConfig,
	type StaffDisplayOptions,
	toggleFirstStaffOption,
} from "../lib/staff-config";
import {
	getAlphaTabColorsForTheme,
	setupThemeObserver,
} from "../lib/themeManager";
import { useAppStore } from "../store/appStore";
import PrintPreview from "./PrintPreview";
import TopBar from "./TopBar";
import IconButton from "./ui/icon-button";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "./ui/tooltip";

/**
 * 根据 barIndex 和 beatIndex 从乐谱中查找对应的 Beat 对象
 */
function findBeatInScore(
	score: alphaTab.model.Score | null | undefined,
	barIndex: number,
	beatIndex: number,
): alphaTab.model.Beat | null {
	if (!score?.tracks?.length) return null;

	// 遍历第一个音轨的所有 staff
	const track = score.tracks[0];
	for (const staff of track.staves) {
		for (const bar of staff.bars) {
			if (bar.index === barIndex) {
				// 找到对应小节，查找 beat
				for (const voice of bar.voices) {
					for (const beat of voice.beats) {
						if (beat.index === beatIndex) {
							return beat;
						}
					}
				}
				// 如果找不到精确的 beatIndex，返回该小节的第一个 beat
				if (bar.voices[0]?.beats?.length > 0) {
					return bar.voices[0].beats[0];
				}
			}
		}
	}
	return null;
}

export interface PreviewProps {
	fileName?: string;
	content?: string;
	className?: string;
}

export default function Preview({
	fileName,
	content,
	className,
}: PreviewProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const scrollHostRef = useRef<HTMLDivElement>(null);
	const apiRef = useRef<alphaTab.AlphaTabApi | null>(null);
	const cursorRef = useRef<HTMLDivElement | null>(null);
	// Zoom state (percentage)

	const zoomRef = useRef<number>(60);
	// 🆕 保存 tracks 配置，用于主题切换时恢复
	const trackConfigRef = useRef<{
		showNumbered?: boolean;
		showSlash?: boolean;
		showTablature?: boolean;
		showStandardNotation?: boolean;
	} | null>(null);
	// 🆕 保存上一次成功解析的乐谱和内容，用于错误恢复
	const lastValidScoreRef = useRef<{
		score: alphaTab.model.Score;
		content: string;
	} | null>(null);
	// 🆕 标记最近的 load 是否是来自用户的当前 content（而不是恢复/重建）
	const lastLoadWasUserContentRef = useRef<boolean>(false);
	// 🆕 错误状态，用于显示解析错误信息
	const [parseError, setParseError] = useState<string | null>(null);
	// 🆕 pending tex call tracking to detect parse failure on updates
	const pendingTexRef = useRef<{ id: number; content: string } | null>(null);
	const pendingTexTimerRef = useRef<number | null>(null);
	const texSeqRef = useRef(0);
	// 超时时间（ms），用于检测解析延迟（可调整）
	const TEX_TIMEOUT_MS = 3000;
	// 记录是否发生了自动恢复（用于 UI 显示）
	const restorePerformedRef = useRef(false);
	const [restorePerformed, setRestorePerformed] = useState(false);
	// 记录最新内容，供异步回调和主题重建使用
	const latestContentRef = useRef<string>(content ?? "");
	// 打印预览状态和重新初始化触发器
	const [showPrintPreview, setShowPrintPreview] = useState(false);
	const [reinitTrigger, setReinitTrigger] = useState(0);

	// 🆕 订阅编辑器光标位置，用于反向同步（编辑器 → 乐谱）
	const editorCursor = useAppStore((s) => s.editorCursor);
	const setFirstStaffOptions = useAppStore((s) => s.setFirstStaffOptions);
	const pendingStaffToggle = useAppStore((s) => s.pendingStaffToggle);
	const toggleFirstStaffOptionStore = useAppStore(
		(s) => s.toggleFirstStaffOption,
	);
	const playbackSpeed = useAppStore((s) => s.playbackSpeed);
	const metronomeVolume = useAppStore((s) => s.metronomeVolume);
	// 使用 ref 保存最新的播放速度/节拍器音量，避免它们变化时触发「重建 alphaTab API」的 useEffect
	const playbackSpeedRef = useRef(playbackSpeed);
	const metronomeVolumeRef = useRef(metronomeVolume);
	// 防止因乐谱选择触发的光标更新导致循环
	const isEditorCursorFromScoreRef = useRef(false);

	useEffect(() => {
		latestContentRef.current = content ?? "";
	}, [content]);

	// 同步全局状态到已初始化的 alphaTab（不重建 score）
	useEffect(() => {
		playbackSpeedRef.current = playbackSpeed;
		const api = apiRef.current;
		if (!api) return;
		try {
			api.playbackSpeed = playbackSpeed;
		} catch (err) {
			console.debug("Failed to apply playback speed:", err);
		}
	}, [playbackSpeed]);

	useEffect(() => {
		metronomeVolumeRef.current = metronomeVolume;
		const api = apiRef.current;
		if (!api) return;
		try {
			api.metronomeVolume = metronomeVolume;
		} catch (err) {
			console.debug("Failed to apply metronome volume:", err);
		}
	}, [metronomeVolume]);

	// ✅ 统一滚动缓冲：不使用 vh，按预览滚动容器高度的 60% 计算底部留白（px）
	useEffect(() => {
		const host = scrollHostRef.current;
		if (!host) return;

		const apply = () => {
			const h = host.getBoundingClientRect().height;
			const px = Math.max(0, Math.floor(h * 0.6));
			host.style.setProperty("--scroll-buffer", `${px}px`);
		};

		apply();

		const ro = new ResizeObserver(() => apply());
		ro.observe(host);
		return () => ro.disconnect();
	}, []);

	// Apply zoom to alphaTab API
	const applyZoom = useCallback((newPercent: number) => {
		const pct = Math.max(10, Math.min(400, Math.round(newPercent)));
		// Keep store in sync
		useAppStore.getState().setZoomPercent(pct);
		zoomRef.current = pct;
		const api = apiRef.current;
		if (!api || !api.settings) return;
		try {
			const disp = api.settings.display as unknown as { scale?: number };
			disp.scale = pct / 100;
			api.updateSettings?.();
			// Prefer partial re-render if available
			if (api.render) api.render();
		} catch (e) {
			console.error("[Preview] Failed to apply zoom:", e);
		}
	}, []);

	/**
	 * 🆕 应用 tracks 显示配置到第一个音轨
	 * 从 trackConfigRef 读取保存的配置，如果没有则使用默认值
	 */
	const applyTracksConfig = useCallback(
		(api: alphaTab.AlphaTabApi) => {
			// 从 ref 获取保存的配置，如果没有则使用默认值
			const config: StaffDisplayOptions = trackConfigRef.current || {
				showTablature: true,
				showStandardNotation: false,
				showSlash: false,
				showNumbered: false,
			};

			// 应用配置
			const appliedConfig = applyStaffConfig(api, config);
			if (appliedConfig) {
				// 更新 UI state
				setFirstStaffOptions(appliedConfig);
			}
		},
		[setFirstStaffOptions],
	);

	/**
	 * 🆕 监听编辑器光标变化，反向同步到乐谱选区
	 * 实现点击编辑器代码定位到乐谱对应位置
	 */
	useEffect(() => {
		const api = apiRef.current;
		if (!api || !editorCursor) return;

		// 检查是否是无效的位置（在元数据区域）
		if (editorCursor.barIndex < 0 || editorCursor.beatIndex < 0) {
			return;
		}

		// 防止循环：如果当前光标是由乐谱选择触发的，跳过
		if (isEditorCursorFromScoreRef.current) {
			isEditorCursorFromScoreRef.current = false;
			return;
		}

		// 从当前乐谱中查找对应的 Beat
		const score = api.score;
		const beat = findBeatInScore(
			score,
			editorCursor.barIndex,
			editorCursor.beatIndex,
		);

		if (beat) {
			console.debug(
				"[Preview] Editor cursor → Score sync:",
				`Bar ${editorCursor.barIndex}, Beat ${editorCursor.beatIndex}`,
			);

			try {
				// 使用 Selection API 高亮该 beat
				if (typeof api.highlightPlaybackRange === "function") {
					api.highlightPlaybackRange(beat, beat);
				}

				// 滚动到该 beat 所在位置（可选）
				const bb = api.boundsLookup?.findBeat?.(beat);
				// 实际滚动容器：优先使用 scrollHost（有 overflow-auto），退回到内部容器
				const scrollHost = scrollHostRef.current;
				const container = scrollHost ?? containerRef.current;

				if (bb && container) {
					const visual = bb.visualBounds;
					const containerRect = container.getBoundingClientRect();

					// 检查 beat 是否在可视区域内
					const beatTop = visual.y;
					const beatBottom = visual.y + visual.h;
					const scrollTop = (container as HTMLElement).scrollTop ?? 0;
					const viewportTop = scrollTop;
					const viewportBottom = scrollTop + containerRect.height;

					// 如果 beat 不在可视区域，滚动到它
					if (beatTop < viewportTop || beatBottom > viewportBottom) {
						container.scrollTo({
							top: Math.max(0, beatTop - containerRect.height / 3),
							behavior: "smooth",
						});
					}
				}
			} catch (e) {
				console.debug("[Preview] Failed to sync editor cursor to score:", e);
			}
		}
	}, [editorCursor]);

	// 🆕 处理来自 GlobalBottomBar 的谱表切换请求
	useEffect(() => {
		if (pendingStaffToggle) {
			const api = apiRef.current;
			if (!api) return;

			const newValue = toggleFirstStaffOption(api, pendingStaffToggle);
			if (newValue !== null) {
				// 更新 store 中的状态
				toggleFirstStaffOptionStore(pendingStaffToggle);
			}

			// 清除 pending toggle
			setTimeout(() => useAppStore.setState({ pendingStaffToggle: null }), 0);
		}
	}, [pendingStaffToggle, toggleFirstStaffOptionStore]);

	/**
	 * 🆕 监听编辑器光标变化，反向同步到乐谱选区
	 * 实现点击编辑器代码定位到乐谱对应位置
	 */
	useEffect(() => {
		const api = apiRef.current;
		if (!api || !editorCursor) return;

		// 检查是否是无效的位置（在元数据区域）
		if (editorCursor.barIndex < 0 || editorCursor.beatIndex < 0) {
			return;
		}

		// 防止循环：如果当前光标是由乐谱选择触发的，跳过
		if (isEditorCursorFromScoreRef.current) {
			isEditorCursorFromScoreRef.current = false;
			return;
		}

		// 从当前乐谱中查找对应的 Beat
		const score = api.score;
		const beat = findBeatInScore(
			score,
			editorCursor.barIndex,
			editorCursor.beatIndex,
		);

		if (beat) {
			console.debug(
				"[Preview] Editor cursor → Score sync:",
				`Bar ${editorCursor.barIndex}, Beat ${editorCursor.beatIndex}`,
			);

			try {
				// 使用 Selection API 高亮该 beat
				if (typeof api.highlightPlaybackRange === "function") {
					api.highlightPlaybackRange(beat, beat);
				}

				// 滚动到该 beat 所在位置（可选）
				const bb = api.boundsLookup?.findBeat?.(beat);
				if (bb && containerRef.current) {
					const visual = bb.visualBounds;
					const container = containerRef.current;
					const containerRect = container.getBoundingClientRect();

					// 检查 beat 是否在可视区域内
					const beatTop = visual.y;
					const beatBottom = visual.y + visual.h;
					const scrollTop = container.scrollTop;
					const viewportTop = scrollTop;
					const viewportBottom = scrollTop + containerRect.height;

					// 如果 beat 不在可视区域，滚动到它
					if (beatTop < viewportTop || beatBottom > viewportBottom) {
						container.scrollTo({
							top: Math.max(0, beatTop - containerRect.height / 3),
							behavior: "smooth",
						});
					}
				}
			} catch (e) {
				console.debug("[Preview] Failed to sync editor cursor to score:", e);
			}
		}
	}, [editorCursor]);

	useEffect(() => {
		if (!containerRef.current) return;

		// 使用 reinitTrigger 触发重新初始化（例如从打印预览返回时）
		if (reinitTrigger > 0) {
			console.log(
				"[Preview] Reinitializing alphaTab API (trigger:",
				reinitTrigger,
				")",
			);
		}

		/**
		 * 🆕 统一附加所有 alphaTab 事件监听器
		 * 确保在初始化和主题重建时都能正确绑定所有功能
		 */
		const attachApiListeners = (api: alphaTab.AlphaTabApi) => {
			// 1. 音频加载
			try {
				api.soundFontLoaded?.on(() => {
					console.info("[Preview] alphaTab soundfont loaded");
					try {
						if (api) api.masterVolume = 1.0;
					} catch (_) {
						// ignore if property not available
					}
				});
			} catch (e) {
				console.debug("[Preview] Soundfont event binding failed:", e);
			}

			// 2. 渲染完成（处理光标，注意：不要修改播放状态）
			api.renderFinished.on((r) => {
				console.info("[Preview] alphaTab render complete:", r);
				const cursor = cursorRef.current;
				if (cursor) cursor.classList.add("hidden");
				// 渲染完成时回到无高亮状态（避免保留旧的黄色小节高亮导致滚动锁定）
				useAppStore.getState().clearPlaybackHighlights();
			});

			// 3. 播放进度（更新光标位置）
			api.playedBeatChanged?.on((beat: alphaTab.model.Beat | null) => {
				if (!beat) {
					// 播放停止/结束时回到无高亮状态（同时清除黄色小节高亮的来源）
					useAppStore.getState().clearPlaybackHighlights();
					useAppStore.getState().setPlayerIsPlaying(false);
					return;
				}
				const barIndex = beat.voice?.bar?.index ?? 0;
				const beatIndex = beat.index ?? 0;
				useAppStore.getState().setPlaybackBeat({ barIndex, beatIndex });
				// 🆕 同时更新播放器光标位置（暂停后保留）
				useAppStore.getState().setPlayerCursorPosition({ barIndex, beatIndex });

				const cursor = cursorRef.current;
				if (!cursor) return;
				const bb = api.boundsLookup?.findBeat?.(beat);
				if (!bb) {
					cursor.classList.add("hidden");
					return;
				}
				cursor.classList.remove("hidden");
				const visual = bb.visualBounds;
				cursor.style.left = `${visual.x}px`;
				cursor.style.top = `${visual.y}px`;
				cursor.style.width = `${visual.w}px`;
				cursor.style.height = `${visual.h}px`;
			});

			// 4. 播放器完成/状态变化事件：确保 UI 与播放器同步
			api.playerFinished?.on(() => {
				console.info("[Preview] alphaTab player finished");
				// 播放结束后播放器光标可能回到默认位置，但 store 仍可能停留在末尾
				// 这里强制回到无高亮状态，避免编辑器高亮/滚动锁死在末尾
				useAppStore.getState().clearPlaybackHighlights();
				useAppStore.getState().setPlayerIsPlaying(false);
			});

			api.playerStateChanged?.on((e: { state: number; stopped?: boolean }) => {
				console.info("[Preview] alphaTab player state changed:", e);
				if (e?.stopped) {
					// stopped 明确表示停止（而不是暂停），停止时清除播放相关高亮
					useAppStore.getState().clearPlaybackHighlights();
					useAppStore.getState().setPlayerIsPlaying(false);
				} else if (e?.state === 1 /* Playing */) {
					useAppStore.getState().setPlayerIsPlaying(true);
				} else {
					useAppStore.getState().setPlayerIsPlaying(false);
				}
			});

			// 🆕 Register playback controls to store so controls can live outside of Preview
			try {
				useAppStore.getState().registerPlayerControls({
					play: () => api.play?.(),
					pause: () => api.pause?.(),
					stop: () => api.stop?.(),
					applyPlaybackSpeed: (speed: number) => {
						try {
							api.playbackSpeed = speed;
						} catch (err) {
							console.error("Failed to set playback speed:", err);
						}
					},
					setMetronomeVolume: (volume: number) => {
						try {
							api.metronomeVolume = volume;
						} catch (err) {
							console.error("Failed to set metronome volume:", err);
						}
					},
					applyZoom: (pct: number) => applyZoom(pct),
				});
			} catch (err) {
				console.debug("Failed to register player controls:", err);
			}

			// 3.6. 点击曲谱时更新播放器光标位置（不播放也能设置）
			api.beatMouseDown?.on((beat: alphaTab.model.Beat) => {
				if (!beat) return;
				const barIndex = beat.voice?.bar?.index ?? 0;
				const beatIndex = beat.index ?? 0;
				console.info("[Preview] Beat clicked:", `Bar ${barIndex}:${beatIndex}`);
				// 🆕 清除播放高亮（绿色），让黄色小节高亮能够显示
				useAppStore.getState().clearPlaybackBeat();
				// 更新播放器光标位置，触发编辑器黄色高亮
				useAppStore.getState().setPlayerCursorPosition({ barIndex, beatIndex });
			});

			// 🆕 3.5. Selection API (alphaTab 1.8.0+): 监听选区变化，同步到编辑器
			try {
				api.playbackRangeHighlightChanged?.on((e) => {
					const { setScoreSelection, clearScoreSelection } =
						useAppStore.getState();

					// 如果没有选区，清除编辑器高亮
					if (!e.startBeat || !e.endBeat) {
						clearScoreSelection();
						return;
					}

					// 标记：这次编辑器光标更新是由乐谱选择触发的，防止循环
					isEditorCursorFromScoreRef.current = true;

					// 从 Beat 对象中提取小节和 Beat 索引
					const startBeat = e.startBeat;
					const endBeat = e.endBeat;

					// 获取小节索引
					const startBarIndex = startBeat.voice?.bar?.index ?? 0;
					const endBarIndex = endBeat.voice?.bar?.index ?? startBarIndex;

					// 获取 Beat 在小节内的索引
					const startBeatIndex = startBeat.index ?? 0;
					const endBeatIndex = endBeat.index ?? 0;

					console.info(
						"[Preview] Selection changed:",
						`Bar ${startBarIndex}:${startBeatIndex} -> Bar ${endBarIndex}:${endBeatIndex}`,
					);

					// 更新 store，触发 Editor 高亮
					setScoreSelection({
						startBarIndex,
						startBeatIndex,
						endBarIndex,
						endBeatIndex,
					});
				});
			} catch (e) {
				console.debug(
					"[Preview] playbackRangeHighlightChanged not available (requires alphaTab 1.8.0+):",
					e,
				);
			}

			// 4. 改进的错误处理：保留上一次成功的渲染
			api.error.on((err: unknown) => {
				console.error("[Preview] alphaTab error:", err);
				console.error("[Preview] Error type:", typeof err, err);
				console.error("[Preview] Error keys:", err ? Object.keys(err) : "null");

				// 使用工具函数格式化错误
				const fullError = formatFullError(err);
				console.error("[Preview] Setting error state:", fullError);
				setParseError(fullError);

				// 清除 pending tex 请求
				if (pendingTexTimerRef.current) {
					clearTimeout(pendingTexTimerRef.current);
					pendingTexTimerRef.current = null;
				}
				pendingTexRef.current = null;
				// 如果有上一次成功的乐谱，恢复渲染
				if (lastValidScoreRef.current?.score && apiRef.current) {
					try {
						console.info("[Preview] Restoring last valid score after error");
						// 标记：这次 renderScore 是恢复操作，避免在 scoreLoaded 中清除 parseError
						lastLoadWasUserContentRef.current = false;
						// 记录恢复状态以便 UI 显示真实恢复发生过
						restorePerformedRef.current = true;
						setRestorePerformed(true);
						apiRef.current.renderScore(lastValidScoreRef.current.score, [0]);
					} catch (restoreErr) {
						console.error(
							"[Preview] Failed to restore last valid score:",
							restoreErr,
						);
					}
				}
			});

			// 5. 处理 scoreLoaded 事件：保存成功的乐谱并清除错误
			api.scoreLoaded.on((score) => {
				try {
					if (score?.tracks && score.tracks.length > 0) {
						const currentContent = latestContentRef.current ?? "";
						// 如果当前有 pending 请求，并且内容匹配，则将其视为成功解析，保存为 lastValid
						if (
							pendingTexRef.current &&
							pendingTexRef.current.content === currentContent
						) {
							lastValidScoreRef.current = {
								score: score,
								content: currentContent,
							};
							// 清除错误与 pending 状态
							setParseError(null);
							if (pendingTexTimerRef.current) {
								clearTimeout(pendingTexTimerRef.current);
								pendingTexTimerRef.current = null;
							}
							pendingTexRef.current = null;
							// 如果之前有自动恢复过，清除该标记
							if (restorePerformedRef.current) {
								restorePerformedRef.current = false;
								setRestorePerformed(false);
							}
						} else {
							console.info(
								"[Preview] scoreLoaded does not match pending content; ignoring for lastValid",
							);
						}
						// 🆕 统一调用 applyTracksConfig，无论是首次还是重建
						if (apiRef.current) applyTracksConfig(apiRef.current);
						// Reset load flag after handling a scoreLoaded to avoid stale state
						lastLoadWasUserContentRef.current = false;
					}
				} catch (e) {
					console.error("[Preview] Failed to apply tracks config", e);
				}
			});
		};

		const initAlphaTab = async () => {
			try {
				// 1. 获取所有资源 URL（自动适配 dev 和打包环境）
				const urls = await getResourceUrls();
				const el = containerRef.current as HTMLElement;
				// 实际滚动容器：优先使用 scrollHostRef（overflow-auto），
				// 退回到原来的父元素以保持兼容性。
				const fallbackScrollEl = (el.parentElement ?? el) as HTMLElement;
				const scrollEl =
					(scrollHostRef.current as HTMLElement | null) ?? fallbackScrollEl;

				// 2. 加载 Bravura 字体
				try {
					await loadBravuraFont(urls.bravuraFontUrl);
				} catch (e) {
					console.warn("[Preview] Bravura font load failed:", e);
				}

				// 3. 如果 API 尚未初始化，创建它
				if (!apiRef.current) {
					// 获取当前主题的颜色
					const colors = getAlphaTabColorsForTheme();

					// 使用工具函数创建预览配置
					const settings = createPreviewSettings(urls as ResourceUrls, {
						scale: zoomRef.current / 100,
						scrollElement: scrollEl,
						enablePlayer: true,
						colors,
					});

					console.log("[Preview] AlphaTab initialization:", {
						containerWidth: el.offsetWidth,
						containerHeight: el.offsetHeight,
						scale: zoomRef.current / 100,
						layoutMode: alphaTab.LayoutMode[alphaTab.LayoutMode.Page],
					});

					apiRef.current = new alphaTab.AlphaTabApi(el, settings);

					// 初始应用全局状态的播放速度与节拍器音量
					try {
						apiRef.current.playbackSpeed = playbackSpeedRef.current;
						apiRef.current.metronomeVolume = metronomeVolumeRef.current;
					} catch (err) {
						console.debug("Failed to apply initial speed/metronome:", err);
					}

					// 4. 附加监听器
					attachApiListeners(apiRef.current);

					// 5. 设置主题监听器（监听暗色模式变化）
					const unsubscribeTheme = setupThemeObserver(() => {
						// 当主题变化时，重建 API 以应用新的颜色配置
						console.log(
							"[Preview] Theme changed, rebuilding alphaTab with new colors",
						);

						if (apiRef.current && latestContentRef.current) {
							// 使用 void 操作符确保异步操作在后台执行（不阻塞回调）
							void (async () => {
								try {
									// 保存当前的 tracks 配置
									if (apiRef.current?.score?.tracks?.[0]) {
										const st = apiRef.current.score.tracks[0].staves?.[0];
										if (st) {
											trackConfigRef.current = {
												showTablature: st.showTablature,
												showStandardNotation: st.showStandardNotation,
												showSlash: st.showSlash,
												showNumbered: st.showNumbered,
											};
											console.log(
												"[Preview] Saved tracks config before rebuild:",
												trackConfigRef.current,
											);
										}
									}

									// 保存当前的乐谱内容（使用最新值，避免闭包过期）
									const currentContent = latestContentRef.current;

									// 销毁旧的 API
									apiRef.current?.destroy();

									// 获取新的颜色配置
									const newColors = getAlphaTabColorsForTheme();

									// 使用工具函数重新创建 API 配置
									const newSettings = createPreviewSettings(
										urls as ResourceUrls,
										{
											scale: zoomRef.current / 100,
											scrollElement:
												(scrollHostRef.current as HTMLElement | null) ??
												scrollEl,
											enablePlayer: true,
											colors: newColors,
										},
									);

									// 创建新的 API
									apiRef.current = new alphaTab.AlphaTabApi(el, newSettings);

									// 重新应用全局状态的播放速度与节拍器音量
									try {
										apiRef.current.playbackSpeed = playbackSpeedRef.current;
										apiRef.current.metronomeVolume = metronomeVolumeRef.current;
									} catch (err) {
										console.debug(
											"Failed to reapply speed/metronome after rebuild:",
											err,
										);
									}

									// 🆕 附加所有监听器（包括 scoreLoaded, error, playback 等）
									attachApiListeners(apiRef.current);

									// 重新加载音频
									await loadSoundFontFromUrl(apiRef.current, urls.soundFontUrl);

									// 重新设置乐谱内容
									// 这会触发 scoreLoaded，从而调用 applyTracksConfig 恢复配置
									try {
										// track pending as we do elsewhere
										texSeqRef.current += 1;
										const seq = texSeqRef.current;
										pendingTexRef.current = {
											id: seq,
											content: currentContent,
										};
										if (pendingTexTimerRef.current) {
											clearTimeout(pendingTexTimerRef.current);
										}
										pendingTexTimerRef.current = window.setTimeout(() => {
											if (pendingTexRef.current?.id === seq) {
												const msg = "AlphaTex 解析超时（theme 重建）";
												console.warn(
													"[Preview] tex timeout (theme rebuild), seq:",
													seq,
													"msg:",
													msg,
												);
												// 🆕 主题重建时的超时不显示错误 UI，因为内容通常是有效的
												// 仅在控制台记录警告
											}
										}, TEX_TIMEOUT_MS);

										// 标记：这次 load 是用户内容（theme 重建更新）
										lastLoadWasUserContentRef.current = true;
										apiRef.current.tex(currentContent);
									} catch (syncError) {
										console.error(
											"[Preview] Synchronous error in theme rebuild tex():",
											syncError,
										);
									}
									console.log(
										"[Preview] alphaTab rebuilt with new theme colors",
									);
								} catch (e) {
									console.error(
										"[Preview] Failed to rebuild alphaTab after theme change:",
										e,
									);
								}
							})();
						}
					});

					// 保存清理函数供后续使用
					(
						apiRef.current as unknown as Record<string, unknown>
					).__unsubscribeTheme = unsubscribeTheme;

					// 6. 加载音频字体
					try {
						await loadSoundFontFromUrl(apiRef.current, urls.soundFontUrl);
					} catch (err) {
						console.debug(
							"[Preview] Could not load soundfont (this is optional):",
							err,
						);
					}
				} // 7. 设置内容
				if (apiRef.current && latestContentRef.current) {
					try {
						console.log(
							"[Preview] Setting alphaTex content, length:",
							latestContentRef.current.length,
						);
						// Track pending tex call so we can detect parse failures even
						// if alphaTab doesn't emit an error event in some cases.
						texSeqRef.current += 1;
						const seq = texSeqRef.current;
						pendingTexRef.current = {
							id: seq,
							content: latestContentRef.current,
						};
						// 仍保留之前的解析错误，直到新的解析成功或明确失败
						if (pendingTexTimerRef.current) {
							clearTimeout(pendingTexTimerRef.current);
						}
						// If no scoreLoaded event occurs for this tex within timeout, mark as parse timeout (do NOT restore immediately)
						pendingTexTimerRef.current = window.setTimeout(() => {
							if (pendingTexRef.current?.id === seq) {
								const msg = "AlphaTex 解析超时（未加载新乐谱）";
								console.warn(
									"[Preview] tex timeout (content update), seq:",
									seq,
									"msg:",
									msg,
								);
								// 标记解析超时，但不要直接恢复旧乐谱 — 留待后续的 scoreLoaded 或 error 去处理
								setParseError(`${msg}（等待解析结果或检查语法）`);
							}
						}, TEX_TIMEOUT_MS);

						// 标记：这次 load 是用户内容
						lastLoadWasUserContentRef.current = true;
						apiRef.current.tex(latestContentRef.current);
					} catch (syncError) {
						// 同步错误：记录到控制台，但不要修改 parseError UI state.
						console.error("[Preview] Synchronous error in tex():", syncError);
						const errorMsg =
							syncError instanceof Error
								? syncError.message
								: String(syncError);
						console.warn(
							"[Preview] sync tex() call failed; not showing parse error UI:",
							errorMsg,
						);
					}
				} else if (apiRef.current && !latestContentRef.current) {
					// clear pending and errors
					if (pendingTexTimerRef.current) {
						clearTimeout(pendingTexTimerRef.current);
						pendingTexTimerRef.current = null;
					}
					pendingTexRef.current = null;
					setParseError(null);
					// 标记：这次 load 是用户内容（清空）
					lastLoadWasUserContentRef.current = true;
					apiRef.current.tex("");
				}
			} catch (err) {
				console.error("[Preview] Failed to initialize alphaTab:", err);
			}
		};

		initAlphaTab();

		// Cleanup on unmount
		return () => {
			if (apiRef.current) {
				// 清理主题观察者
				const unsubscribeTheme = (
					apiRef.current as unknown as Record<string, unknown>
				).__unsubscribeTheme;
				if (typeof unsubscribeTheme === "function") {
					unsubscribeTheme();
				}
				apiRef.current.destroy();
				apiRef.current = null;
			}
			// 清除 pending tex 相关计时器
			if (pendingTexTimerRef.current) {
				clearTimeout(pendingTexTimerRef.current);
				pendingTexTimerRef.current = null;
			}
			pendingTexRef.current = null;
		};
	}, [applyTracksConfig, reinitTrigger, applyZoom]);

	// 内容更新：仅调用 tex，不销毁 API，避免闪烁
	useEffect(() => {
		const api = apiRef.current;
		if (!api) return;

		if (content) {
			try {
				console.log(
					"[Preview] Updating alphaTex content, length:",
					content.length,
				);
				texSeqRef.current += 1;
				const seq = texSeqRef.current;
				pendingTexRef.current = { id: seq, content };
				if (pendingTexTimerRef.current) {
					clearTimeout(pendingTexTimerRef.current);
				}
				pendingTexTimerRef.current = window.setTimeout(() => {
					if (pendingTexRef.current?.id === seq) {
						const msg = "AlphaTex 解析超时（未加载新乐谱）";
						console.warn(
							"[Preview] tex timeout (content update), seq:",
							seq,
							"msg:",
							msg,
						);
						// 标记解析超时，但不要直接恢复旧乐谱 — 以免在切换文件时回退到上一个文件
						setParseError(`${msg}（等待解析结果或检查语法）`);
					}
				}, TEX_TIMEOUT_MS);

				lastLoadWasUserContentRef.current = true;
				api.tex(content);
			} catch (syncError) {
				console.error("[Preview] Synchronous error in tex():", syncError);
				const errorMsg =
					syncError instanceof Error ? syncError.message : String(syncError);
				console.warn(
					"[Preview] sync tex() call failed; not showing parse error UI:",
					errorMsg,
				);
			}
		} else {
			if (pendingTexTimerRef.current) {
				clearTimeout(pendingTexTimerRef.current);
				pendingTexTimerRef.current = null;
			}
			pendingTexRef.current = null;
			setParseError(null);
			lastLoadWasUserContentRef.current = true;
			try {
				api.tex("");
			} catch (emptyErr) {
				console.error("[Preview] Failed to clear score:", emptyErr);
			}
		}
	}, [content]);

	// 管理打印预览的生命周期：销毁和重建 alphaTab API 以避免设置污染
	useEffect(() => {
		if (showPrintPreview) {
			// 打开打印预览：销毁当前 API 释放资源（特别是字体缓存）
			console.log("[Preview] Destroying API for print preview");
			if (apiRef.current) {
				// 清理主题观察者
				const unsubscribeTheme = (
					apiRef.current as unknown as Record<string, unknown>
				).__unsubscribeTheme;
				if (typeof unsubscribeTheme === "function") {
					unsubscribeTheme();
				}
				// Unregister controls from store so bottom bar won't call destroyed API
				try {
					useAppStore.getState().unregisterPlayerControls();
				} catch (e) {
					console.debug("Failed to unregister player controls:", e);
				}
				apiRef.current.destroy();
				apiRef.current = null;
			}
		} else if (!showPrintPreview && !apiRef.current) {
			// 关闭打印预览：延迟重新初始化 API，确保 PrintPreview 完全卸载
			console.log(
				"[Preview] Scheduling API reinitialization after print preview",
			);
			const timer = setTimeout(() => {
				setReinitTrigger((prev) => prev + 1);
			}, 150);
			return () => clearTimeout(timer);
		}
	}, [showPrintPreview]);

	// 管理打印预览的生命周期：销毁和重建 alphaTab API 以避免设置污染
	useEffect(() => {
		if (showPrintPreview) {
			// 打开打印预览：销毁当前 API 释放资源（特别是字体缓存）
			console.log("[Preview] Destroying API for print preview");
			if (apiRef.current) {
				// 清理主题观察者
				const unsubscribeTheme = (
					apiRef.current as unknown as Record<string, unknown>
				).__unsubscribeTheme;
				if (typeof unsubscribeTheme === "function") {
					unsubscribeTheme();
				}
				apiRef.current.destroy();
				apiRef.current = null;
			}
		} else if (!showPrintPreview && !apiRef.current) {
			// 关闭打印预览：延迟重新初始化 API，确保 PrintPreview 完全卸载
			console.log(
				"[Preview] Scheduling API reinitialization after print preview",
			);
			const timer = setTimeout(() => {
				setReinitTrigger((prev) => prev + 1);
			}, 150);
			return () => clearTimeout(timer);
		}
	}, [showPrintPreview]);

	return (
		<TooltipProvider delayDuration={200}>
			<div
				className={`flex-1 flex flex-col h-full overflow-hidden ${className ?? ""}`}
			>
				{/* 当打印预览显示时，隐藏主预览区域以避免资源冲突 */}
				{!showPrintPreview && (
					<>
						{/* 错误提示已移到底部 */}
						<TopBar
							icon={
								<FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
							}
							title={<span className="sr-only">{fileName ?? "预览"}</span>}
							trailing={
								<>
									{/* 打印按钮 */}
									<div className="ml-2 flex items-center gap-1">
										<Tooltip>
											<TooltipTrigger asChild>
												<IconButton
													onClick={() => setShowPrintPreview(true)}
													disabled={!content}
												>
													<Printer className="h-4 w-4" />
												</IconButton>
											</TooltipTrigger>
											<TooltipContent side="bottom">
												<p>打印预览</p>
											</TooltipContent>
										</Tooltip>
									</div>
								</>
							}
						/>
						<div
							ref={scrollHostRef}
							className="flex-1 overflow-auto relative h-full"
						>
							<div className="w-full min-h-full pb-[var(--scroll-buffer)]">
								<div ref={containerRef} className="w-full h-full" />
							</div>
							<div
								ref={cursorRef}
								className="pointer-events-none absolute z-20 bg-amber-300/40 rounded-sm hidden"
							/>
						</div>
						{parseError && (
							<div className="bg-destructive/10 text-destructive px-3 py-2 text-xs border-t border-destructive/20 flex items-start gap-2">
								<span className="font-semibold shrink-0">⚠️</span>
								<div className="flex-1 min-w-0">
									<div className="font-medium">AlphaTex 解析错误</div>
									<div className="mt-0.5 text-destructive/80 break-words">
										{parseError}
									</div>
									{restorePerformed && lastValidScoreRef.current && (
										<div className="mt-1 text-destructive/60 text-[11px]">
											已恢复到上一次成功的乐谱
										</div>
									)}
								</div>
								<button
									type="button"
									onClick={() => setParseError(null)}
									className="shrink-0 text-destructive/60 hover:text-destructive text-lg leading-none"
									title="关闭错误提示"
								>
									×
								</button>
							</div>
						)}
					</>
				)}

				{/* 打印预览模态窗口 */}
				{showPrintPreview && content && (
					<PrintPreview
						content={content}
						fileName={fileName}
						onClose={() => setShowPrintPreview(false)}
					/>
				)}
			</div>
		</TooltipProvider>
	);
}
