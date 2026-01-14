import * as alphaTab from "@coderline/alphatab";
import {
	FileText,
	Hash,
	Minus,
	Music,
	Pause,
	Play,
	Plus,
	Printer,
	Slash,
	Square,
	Waves,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { loadBravuraFont, loadSoundFontFromUrl } from "../lib/assets";
import { getResourceUrls } from "../lib/resourceLoaderService";
import {
	getAlphaTabColorsForTheme,
	setupThemeObserver,
} from "../lib/themeManager";
import PrintPreview from "./PrintPreview";

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
	const apiRef = useRef<alphaTab.AlphaTabApi | null>(null);
	const cursorRef = useRef<HTMLDivElement | null>(null);
	const [firstStaffOptions, setFirstStaffOptions] = useState<{
		showNumbered?: boolean;
		showSlash?: boolean;
		showTablature?: boolean;
		showStandardNotation?: boolean;
	} | null>(null);
	// Zoom state (percentage)
	const [zoomPercent, setZoomPercent] = useState<number>(60);
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

	useEffect(() => {
		latestContentRef.current = content ?? "";
	}, [content]);

	// AlphaTab error shape helpers
	type AlphaTabDiagnostic = {
		message?: string;
		range?: { start?: { line?: number; character?: number } };
		line?: number;
		character?: number;
		col?: number;
	};
	type AlphaTabErrorLike = {
		message?: string;
		error?: string;
		type?: string | number;
		errorType?: string;
		lexerDiagnostics?: string;
		parserDiagnostics?: AlphaTabDiagnostic[];
		semanticDiagnostics?: AlphaTabDiagnostic[];
		diagnostics?: AlphaTabDiagnostic[] | unknown;
		toString?: () => string;
	};

	const toggleFirstStaffOpt = (
		key:
			| "showTablature"
			| "showStandardNotation"
			| "showSlash"
			| "showNumbered",
	) => {
		const api = apiRef.current;
		if (!api || !api.score) return;
		const firstTrack = api.score.tracks?.[0];
		if (!firstTrack || !firstTrack.staves || firstTrack.staves.length === 0)
			return;

		const s0 = firstTrack.staves[0] as alphaTab.model.Staff;
		let current = false;
		switch (key) {
			case "showTablature":
				current = !!s0.showTablature;
				break;
			case "showStandardNotation":
				current = !!s0.showStandardNotation;
				break;
			case "showSlash":
				current = !!s0.showSlash;
				break;
			case "showNumbered":
				current = !!s0.showNumbered;
				break;
		}

		// If toggling off would disable all options for this staff, prevent it
		const totalSelected =
			Number(!!s0.showTablature) +
			Number(!!s0.showStandardNotation) +
			Number(!!s0.showSlash) +
			Number(!!s0.showNumbered);
		// Only block when we're turning off the *only* active option (current === true)
		if (totalSelected === 1 && current) {
			// toggling on is always okay, toggling off when only one is selected should be blocked
			return;
		}

		const newValue = !current;
		firstTrack.staves.forEach((st: alphaTab.model.Staff) => {
			switch (key) {
				case "showTablature":
					st.showTablature = newValue;
					break;
				case "showStandardNotation":
					st.showStandardNotation = newValue;
					break;
				case "showSlash":
					st.showSlash = newValue;
					break;
				case "showNumbered":
					st.showNumbered = newValue;
					break;
			}
		});

		// Update UI state for compact display
		setFirstStaffOptions((prev) => ({
			...(prev ?? {}),
			[key]: newValue,
		}));

		// 🆕 同时保存到 ref，用于主题切换时恢复
		trackConfigRef.current = {
			...trackConfigRef.current,
			[key]: newValue,
		};

		// Re-render only the first track
		api.renderTracks([firstTrack]);
	};

	// Apply zoom to alphaTab API
	const applyZoom = useCallback((newPercent: number) => {
		const pct = Math.max(10, Math.min(400, Math.round(newPercent)));
		setZoomPercent(pct);
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
	const applyTracksConfig = useCallback((api: alphaTab.AlphaTabApi) => {
		if (!api.score?.tracks?.length) return;

		const firstTrack = api.score.tracks[0];
		if (!firstTrack.staves?.length) return;

		// 从 ref 获取保存的配置，如果没有则使用默认值
		const config = trackConfigRef.current || {
			showTablature: true,
			showStandardNotation: false,
			showSlash: false,
			showNumbered: false,
		};

		// 应用配置到所有 staff
		firstTrack.staves.forEach((st: alphaTab.model.Staff) => {
			st.showTablature = config.showTablature ?? true;
			st.showStandardNotation = config.showStandardNotation ?? false;
			st.showSlash = config.showSlash ?? false;
			st.showNumbered = config.showNumbered ?? false;
		});

		// 更新 UI state
		const s0 = firstTrack.staves[0];
		setFirstStaffOptions({
			showTablature: s0.showTablature,
			showStandardNotation: s0.showStandardNotation,
			showSlash: s0.showSlash,
			showNumbered: s0.showNumbered,
		});

		// 重新渲染
		api.renderTracks([firstTrack]);
	}, []);

	useEffect(() => {
		if (!containerRef.current) return;

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

			// 2. 渲染完成（处理播放状态和光标）
			api.renderFinished.on((r) => {
				console.info("[Preview] alphaTab render complete:", r);
				setIsPlaying(false);
				const cursor = cursorRef.current;
				if (cursor) cursor.style.display = "none";
			});

			// 3. 播放进度（更新光标位置）
			api.playedBeatChanged?.on((beat: alphaTab.model.Beat | null) => {
				if (!beat) return;
				setIsPlaying(true);
				const cursor = cursorRef.current;
				if (!cursor) return;
				const bb = api.boundsLookup?.findBeat?.(beat);
				if (!bb) {
					cursor.style.display = "none";
					return;
				}
				cursor.style.display = "block";
				const visual = bb.visualBounds;
				cursor.style.left = `${visual.x}px`;
				cursor.style.top = `${visual.y}px`;
				cursor.style.width = `${visual.w}px`;
				cursor.style.height = `${visual.h}px`;
			});

			// 4. 改进的错误处理：保留上一次成功的渲染
			api.error.on((err: unknown) => {
				console.error("[Preview] alphaTab error:", err);
				console.error("[Preview] Error type:", typeof err, err);
				console.error("[Preview] Error keys:", err ? Object.keys(err) : "null");

				// 设置错误消息 - 兼容多种错误格式
				let errorMessage = "未知错误";
				let errorType = "解析错误";

				if (err) {
					// Narrow unknown to our custom type
					const e = err as AlphaTabErrorLike;
					errorMessage = e.message || e.error || e.toString?.() || "未知错误";
					errorType = String(e.type ?? e.errorType ?? "AlphaTex");

					// dev: append diagnostics if available (AlphaTab reports lexer/parser/semantic diagnostics)
					if (e.lexerDiagnostics) {
						errorMessage += `\n\nLexer diagnostics:\n${e.lexerDiagnostics}`;
					}

					const fmtDiagArray = (
						arr: unknown[] | undefined,
						name = "Diagnostics",
					) => {
						if (!arr || !Array.isArray(arr) || arr.length === 0) return "";
						try {
							return (
								`${name}:\n` +
								arr
									.map((d) => {
										// Common diagnostic shapes may include 'message' and 'range' / 'line' fields
										const msg =
											(d as { message?: string })?.message ?? JSON.stringify(d);
										// range may be an object with start.line/character
										const start = (
											d as {
												range?: {
													start?: {
														line?: number;
														character?: number;
														row?: number;
														col?: number;
													};
												};
											}
										)?.range?.start;
										if (start) {
											const line = (start.line ?? start.row ?? 0) + 1;
											const ch = (start.character ?? start.col ?? 0) + 1;
											return `  - [${line}:${ch}] ${msg}`;
										}
										if (
											d &&
											typeof (d as { line?: number }).line === "number"
										) {
											const ln = ((d as { line?: number }).line ?? 0) + 1;
											const ch =
												((d as { character?: number; col?: number })
													.character ??
													(d as { character?: number; col?: number }).col ??
													0) + 1;
											return `  - [${ln}:${ch}] ${msg}`;
										}
										return `  - ${msg}`;
									})
									.join("\n")
							);
						} catch {
							return `${name}: ${JSON.stringify(arr)}`;
						}
					};

					if (Array.isArray(e.parserDiagnostics)) {
						errorMessage +=
							`\n\n` + fmtDiagArray(e.parserDiagnostics, "Parser diagnostics");
					}
					if (Array.isArray(e.semanticDiagnostics)) {
						errorMessage +=
							`\n\n` +
							fmtDiagArray(e.semanticDiagnostics, "Semantic diagnostics");
					}
					// Fallback: some versions include a 'diagnostics' key
					if (Array.isArray(e.diagnostics as unknown[])) {
						errorMessage +=
							`\n\n` + fmtDiagArray(e.diagnostics as unknown[], "Diagnostics");
					} else if (e.diagnostics) {
						try {
							errorMessage += `\n\nDiagnostics:\n${JSON.stringify(e.diagnostics, null, 2)}`;
						} catch {
							// ignore stringify errors
						}
					}
				}

				const fullError = `${errorType}: ${errorMessage}`;
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
				const scrollEl = (el.parentElement ?? el) as HTMLElement;

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

					// 使用 ResourceLoaderService 提供的 worker URL
					const settings: Record<string, unknown> = {
						core: {
							tex: true,
							scriptFile: urls.workerUrl, // ← 关键：明确配置 worker 脚本路径
							fontDirectory: urls.bravuraFontDirectory, // ← 直接使用资源服务提供的字体目录
						},
						display: {
							layoutMode: alphaTab.LayoutMode.Page,
							scale: zoomRef.current / 100,
							// 在初始化时直接应用颜色配置
							resources: {
								mainGlyphColor: colors.mainGlyphColor,
								secondaryGlyphColor: colors.secondaryGlyphColor,
								staffLineColor: colors.staffLineColor,
								barSeparatorColor: colors.barSeparatorColor,
								barNumberColor: colors.barNumberColor,
								scoreInfoColor: colors.scoreInfoColor,
							},
						},
						player: {
							playerMode: alphaTab.PlayerMode.EnabledAutomatic,
							enablePlayer: true,
							soundFont: urls.soundFontUrl, // ← 使用 URL 而不是硬编码路径
							scrollMode: alphaTab.ScrollMode.OffScreen,
							scrollElement: scrollEl,
							scrollSpeed: 300,
						},
					};

					apiRef.current = new alphaTab.AlphaTabApi(el, settings);

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

									// 重新创建 API 配置，使用新的颜色
									const newSettings: Record<string, unknown> = {
										core: {
											tex: true,
											scriptFile: urls.workerUrl,
											fontDirectory: urls.bravuraFontDirectory,
										},
										display: {
											layoutMode: alphaTab.LayoutMode.Page,
											scale: zoomRef.current / 100,
											// 使用新的颜色配置
											resources: {
												mainGlyphColor: newColors.mainGlyphColor,
												secondaryGlyphColor: newColors.secondaryGlyphColor,
												staffLineColor: newColors.staffLineColor,
												barSeparatorColor: newColors.barSeparatorColor,
												barNumberColor: newColors.barNumberColor,
												scoreInfoColor: newColors.scoreInfoColor,
											},
										},
										player: {
											playerMode: alphaTab.PlayerMode.EnabledAutomatic,
											enablePlayer: true,
											soundFont: urls.soundFontUrl,
											scrollMode: alphaTab.ScrollMode.OffScreen,
											scrollElement: scrollEl,
											scrollSpeed: 300,
										},
									};

									// 创建新的 API
									apiRef.current = new alphaTab.AlphaTabApi(el, newSettings);

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
	}, [applyTracksConfig]);

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

	// Playback UI states
	const [isPlaying, setIsPlaying] = useState(false);
	const [scrollMode, setScrollMode] = useState<alphaTab.ScrollMode>(
		alphaTab.ScrollMode.OffScreen,
	);

	// 打印预览状态
	const [showPrintPreview, setShowPrintPreview] = useState(false);

	return (
		<div
			className={`flex-1 flex flex-col h-full overflow-hidden ${className ?? ""}`}
		>
			{/* 当打印预览显示时，隐藏主预览区域以避免资源冲突 */}
			{!showPrintPreview && (
				<>
					{/* 错误提示已移到底部 */}
					<div className="h-9 border-b border-border flex items-center px-3 text-xs text-muted-foreground shrink-0 gap-2 bg-card">
						<FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
						<span className="sr-only">{fileName ?? "预览"}</span>

						{/* First track staff options (TAB / Standard / Slash / Numbered) */}
						{firstStaffOptions && (
							<div className="ml-auto flex items-center gap-1">
								<button
									type="button"
									className={`h-6 w-6 p-0.5 rounded ${
										firstStaffOptions?.showStandardNotation
											? "bg-blue-500/20 text-blue-600"
											: "hover:bg-blue-500/20 hover:text-blue-600"
									}`}
									onClick={() => toggleFirstStaffOpt("showStandardNotation")}
									title="标准记谱法（五线谱）"
								>
									<Music className="h-4 w-4" />
								</button>

								<button
									type="button"
									className={`h-6 w-6 p-0.5 rounded ${
										firstStaffOptions?.showTablature
											? "bg-blue-500/20 text-blue-600"
											: "hover:bg-blue-500/20 hover:text-blue-600"
									}`}
									onClick={() => toggleFirstStaffOpt("showTablature")}
									title="六线谱（TAB）"
								>
									<Hash className="h-4 w-4" />
								</button>

								<button
									type="button"
									className={`h-6 w-6 p-0.5 rounded ${
										firstStaffOptions?.showSlash
											? "bg-blue-500/20 text-blue-600"
											: "hover:bg-blue-500/20 hover:text-blue-600"
									}`}
									onClick={() => toggleFirstStaffOpt("showSlash")}
									title="斜线记谱法（节拍）"
								>
									<Slash className="h-4 w-4" />
								</button>

								<button
									type="button"
									className={`h-6 w-6 p-0.5 rounded ${
										firstStaffOptions?.showNumbered
											? "bg-blue-500/20 text-blue-600"
											: "hover:bg-blue-500/20 hover:text-blue-600"
									}`}
									onClick={() => toggleFirstStaffOpt("showNumbered")}
									title="简谱（数字谱）"
								>
									<FileText className="h-3.5 w-3.5" />
								</button>
							</div>
						)}

						{/* Player controls: inline buttons (Play-Pause / Stop / Scroll) */}
						<div className="ml-2 flex items-center gap-1">
							{/* Player enable toggle removed: controls are always enabled */}

							<button
								type="button"
								className={`h-6 w-6 p-0.5 rounded ${isPlaying ? "bg-blue-500/20 text-blue-600" : "hover:bg-blue-500/20 hover:text-blue-600"}`}
								onClick={() => {
									const api = apiRef.current;
									if (!api) return;
									try {
										if (!isPlaying) {
											api.play?.();
											setIsPlaying(true);
										} else {
											api.pause?.();
											setIsPlaying(false);
										}
									} catch (e) {
										console.error("Failed play/pause:", e);
									}
								}}
								title={isPlaying ? "暂停" : "播放"}
							>
								{isPlaying ? (
									<Pause className="h-4 w-4" />
								) : (
									<Play className="h-4 w-4" />
								)}
							</button>

							<button
								type="button"
								className={`h-6 w-6 p-0.5 rounded hover:bg-blue-500/20 hover:text-blue-600`}
								onClick={() => {
									const api = apiRef.current;
									if (!api) return;
									try {
										api.stop?.();
										setIsPlaying(false);
									} catch (e) {
										console.error("Failed stop:", e);
									}
								}}
								title="停止"
							>
								<Square className="h-4 w-4" />
							</button>

							<button
								type="button"
								className={`h-6 w-6 p-0.5 rounded ${
									scrollMode === alphaTab.ScrollMode.Continuous
										? "bg-blue-500/20 text-blue-600"
										: "hover:bg-blue-500/20 hover:text-blue-600"
								}`}
								onClick={() => {
									const api = apiRef.current;
									if (!api || !api.settings) return;
									try {
										const newMode =
											scrollMode === alphaTab.ScrollMode.Continuous
												? alphaTab.ScrollMode.OffScreen
												: alphaTab.ScrollMode.Continuous;
										setScrollMode(newMode);
										(
											api.settings.player as alphaTab.PlayerSettings
										).scrollMode = newMode;
										api.updateSettings?.();
									} catch (error) {
										console.error("Failed to toggle scroll mode:", error);
									}
								}}
								title={`滚动模式：${
									scrollMode === alphaTab.ScrollMode.Continuous
										? "连续滚动"
										: "超出页面后滚动"
								}`}
							>
								<Waves className="h-4 w-4" />
							</button>
						</div>
						{/* Zoom controls: - button, percentage input, + button */}
						<div className="ml-2 flex items-center gap-1">
							<button
								type="button"
								className={`h-6 w-6 p-0.5 rounded hover:bg-blue-500/20 hover:text-blue-600`}
								onClick={() => applyZoom(zoomPercent - 10)}
								title="缩小"
							>
								<Minus className="h-4 w-4" />
							</button>

							<input
								aria-label="缩放百分比"
								value={zoomPercent}
								onChange={(e) => {
									const v = parseInt(e.target.value ?? "60", 10);
									if (Number.isNaN(v)) return;
									applyZoom(v);
								}}
								onBlur={(e) => {
									const v = parseInt(e.target.value ?? "60", 10);
									if (Number.isNaN(v)) return;
									applyZoom(v);
								}}
								className="w-16 h-6 text-xs text-center rounded bg-transparent border border-border px-1 input-no-spinner"
								step={1}
								min={10}
								max={400}
								onKeyDown={(e) => {
									if (e.key === "ArrowUp" || e.key === "ArrowDown") {
										e.preventDefault();
									}
								}}
								onWheel={(e) => {
									e.preventDefault();
								}}
								type="number"
							/>
							<span className="text-xs">%</span>

							<button
								type="button"
								className={`h-6 w-6 p-0.5 rounded hover:bg-blue-500/20 hover:text-blue-600`}
								onClick={() => applyZoom(zoomPercent + 10)}
								title="放大"
							>
								<Plus className="h-4 w-4" />
							</button>
						</div>

						{/* 打印按钮 */}
						<div className="ml-2 flex items-center gap-1">
							<button
								type="button"
								className="h-6 w-6 p-0.5 rounded hover:bg-blue-500/20 hover:text-blue-600"
								onClick={() => setShowPrintPreview(true)}
								title="打印预览"
								disabled={!content}
							>
								<Printer className="h-4 w-4" />
							</button>
						</div>
					</div>
					<div className="flex-1 overflow-auto relative h-full">
						<div ref={containerRef} className="w-full h-full" />
						<div
							ref={cursorRef}
							className="pointer-events-none absolute z-20 bg-amber-300/40 rounded-sm"
							style={{ display: "none" }}
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
	);
}
