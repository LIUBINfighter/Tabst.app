# 参数丢失问题的修复方案

## 问题回顾

主题切换时，tracks 的 `showTablature` 等显示选项丢失，原因是：

1. 初次加载和主题重建的流程不对称
2. tracks 配置只保存在 React state 中，重建时没有恢复机制
3. scoreLoaded 回调的多次执行可能导致状态混乱

---

## 修复方案

### 核心思路

**分离关注点**，将初始化过程分解为清晰的步骤：

```
初始化流程（首次 + 主题重建都使用）：
1. 创建 settings 对象（包含颜色、资源等）
2. 创建 AlphaTabApi 实例
3. 加载音频字体
4. 加载乐谱内容（tex）
5. 等待 scoreLoaded 事件
6. 应用 tracks 显示配置（从保存的配置恢复）
7. 更新 React state（setFirstStaffOptions）
8. 渲染
```

---

## 实现方案 A：使用 Ref 保存 tracks 配置

### 改进 1：添加 trackConfigRef 来保存配置

```typescript
const containerRef = useRef<HTMLDivElement>(null);
const apiRef = useRef<alphaTab.AlphaTabApi | null>(null);
const cursorRef = useRef<HTMLDivElement | null>(null);
const [firstStaffOptions, setFirstStaffOptions] = useState<{...} | null>(null);

// 🆕 新增：保存 tracks 配置，以便在主题切换时恢复
const trackConfigRef = useRef<{
  showTablature?: boolean;
  showStandardNotation?: boolean;
  showSlash?: boolean;
  showNumbered?: boolean;
} | null>(null);
```

### 改进 2：在 toggleFirstStaffOpt 中更新 trackConfigRef

```typescript
const toggleFirstStaffOpt = (key: 'showTablature' | ...) => {
  const api = apiRef.current;
  if (!api || !api.score) return;
  const firstTrack = api.score.tracks?.[0];
  if (!firstTrack || !firstTrack.staves?.length) return;

  const s0 = firstTrack.staves[0] as alphaTab.model.Staff;
  let current = false;

  // ... existing logic ...

  const newValue = !current;
  firstTrack.staves.forEach((st: alphaTab.model.Staff) => {
    switch (key) {
      case "showTablature":
        st.showTablature = newValue;
        break;
      // ... other cases ...
    }
  });

  // 🆕 同时保存到 ref，以便主题切换时恢复
  trackConfigRef.current = {
    ...trackConfigRef.current,
    [key]: newValue,
  };

  setFirstStaffOptions((prev) => ({
    ...(prev ?? {}),
    [key]: newValue,
  }));

  api.renderTracks([firstTrack]);
};
```

### 改进 3：提取 applyTracksConfig 函数

```typescript
/**
 * 应用 tracks 显示配置到第一个音轨
 * 从 trackConfigRef 读取保存的配置
 */
const applyTracksConfig = (api: alphaTab.AlphaTabApi) => {
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
};
```

### 改进 4：统一 scoreLoaded 处理

```typescript
// 在 useEffect 内，替换原有的 scoreLoaded 事件处理：

apiRef.current.scoreLoaded.on((score) => {
  try {
    if (score?.tracks?.length > 0) {
      // 🆕 统一调用 applyTracksConfig，无论是首次还是重建
      applyTracksConfig(apiRef.current!);
    }
  } catch (e) {
    console.error("[Preview] Failed to apply tracks config", e);
  }
});
```

### 改进 5：统一主题重建中的 scoreLoaded 处理

在主题切换时的重建中，不需要重复设置 scoreLoaded，因为新 API 创建时已经设置过了：

```typescript
setupThemeObserver(() => {
  void (async () => {
    try {
      const currentContent = content;

      // 保存当前的 tracks 配置
      if (apiRef.current?.score?.tracks?.[0]) {
        const st = apiRef.current.score.tracks[0].staves[0];
        trackConfigRef.current = {
          showTablature: st.showTablature,
          showStandardNotation: st.showStandardNotation,
          showSlash: st.showSlash,
          showNumbered: st.showNumbered,
        };
      }

      // 销毁旧 API
      apiRef.current?.destroy();

      const newColors = getAlphaTabColorsForTheme();
      const newSettings: Record<string, unknown> = {
        // ... 配置 ...
      };

      // 创建新 API
      apiRef.current = new alphaTab.AlphaTabApi(el, newSettings);

      // 🆕 重新设置 scoreLoaded（必须做，因为新 API）
      // 但现在可以使用统一的 applyTracksConfig
      apiRef.current.scoreLoaded.on((score) => {
        try {
          if (score?.tracks?.length > 0) {
            applyTracksConfig(apiRef.current!);
          }
        } catch (e) {
          console.error("[Preview] Failed to apply tracks after rebuild", e);
        }
      });

      // 加载音频
      await loadSoundFontFromUrl(apiRef.current, urls.soundFontUrl);

      // 重新加载乐谱
      // 这会触发 scoreLoaded，从而调用 applyTracksConfig
      apiRef.current.tex(currentContent);

      console.log("[Preview] alphaTab rebuilt with new theme colors");
    } catch (e) {
      console.error(
        "[Preview] Failed to rebuild alphaTab after theme change:",
        e
      );
    }
  })();
});
```

---

## 改进方案 B：创建高阶初始化函数

### 核心函数：initializeAlphaTabInstance

```typescript
interface AlphaTabInstanceConfig {
  element: HTMLElement;
  scrollElement: HTMLElement;
  resourceUrls: Awaited<ReturnType<typeof getResourceUrls>>;
  colors: ReturnType<typeof getAlphaTabColorsForTheme>;
  contentToLoad?: string;
}

interface AlphaTabInstanceResult {
  api: alphaTab.AlphaTabApi;
  unsubscribeTheme: () => void;
}

/**
 * 统一的 AlphaTabApi 初始化函数
 * 用于首次初始化和主题重建
 */
const initializeAlphaTabInstance = async (
  config: AlphaTabInstanceConfig
): Promise<AlphaTabInstanceResult> => {
  const { element, scrollElement, resourceUrls, colors, contentToLoad } =
    config;

  // 1. 创建 settings
  const settings: Record<string, unknown> = {
    core: {
      tex: true,
      scriptFile: resourceUrls.workerUrl,
      fontDirectory: resourceUrls.bravuraFontDirectory,
    },
    display: {
      layoutMode: alphaTab.LayoutMode.Page,
      scale: 1.0,
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
      soundFont: resourceUrls.soundFontUrl,
      scrollMode: alphaTab.ScrollMode.Continuous,
      scrollElement: scrollElement,
      scrollSpeed: 300,
    },
  };

  // 2. 创建 API
  const api = new alphaTab.AlphaTabApi(element, settings);

  // 3. 设置 scoreLoaded 回调
  api.scoreLoaded.on((score) => {
    try {
      if (score?.tracks?.length > 0) {
        applyTracksConfig(api);
      }
    } catch (e) {
      console.error("[Preview] Failed to apply tracks config", e);
    }
  });

  // 4. 绑定其他事件
  api.soundFontLoaded?.on(() => {
    console.info("[Preview] alphaTab soundfont loaded");
    try {
      if (api) api.masterVolume = 1.0;
    } catch (_) {
      // ignore
    }
  });

  api.renderFinished.on((r) =>
    console.info("[Preview] alphaTab render complete:", r)
  );
  api.error.on((err) => console.error("[Preview] alphaTab error:", err));

  // 5. 加载音频字体
  try {
    await loadSoundFontFromUrl(api, resourceUrls.soundFontUrl);
  } catch (err) {
    console.debug("[Preview] Could not load soundfont:", err);
  }

  // 6. 加载乐谱内容
  if (contentToLoad) {
    try {
      api.tex(contentToLoad);
    } catch (_e) {
      console.error("[Preview] Failed to set alphaTex content:", _e);
    }
  }

  // 7. 设置主题监听器
  const unsubscribeTheme = setupThemeObserver(() => {
    console.log("[Preview] Theme changed, rebuilding alphaTab with new colors");

    if (api && contentToLoad) {
      void (async () => {
        try {
          // 保存当前 tracks 配置
          if (api.score?.tracks?.[0]) {
            const st = api.score.tracks[0].staves[0];
            trackConfigRef.current = {
              showTablature: st.showTablature,
              showStandardNotation: st.showStandardNotation,
              showSlash: st.showSlash,
              showNumbered: st.showNumbered,
            };
          }

          api.destroy();

          // 递归调用，重建新 API
          const newColors = getAlphaTabColorsForTheme();
          const result = await initializeAlphaTabInstance({
            element,
            scrollElement,
            resourceUrls,
            colors: newColors,
            contentToLoad,
          });

          apiRef.current = result.api;
          // 更新 unsubscribeTheme ref（避免双重订阅）
          (
            apiRef.current as unknown as Record<string, unknown>
          ).__unsubscribeTheme = result.unsubscribeTheme;
        } catch (e) {
          console.error("[Preview] Failed to rebuild alphaTab:", e);
        }
      })();
    }
  });

  return { api, unsubscribeTheme };
};
```

### 简化后的 useEffect

```typescript
useEffect(() => {
  if (!containerRef.current) return;

  const initAlphaTab = async () => {
    try {
      // 加载字体（必须先做）
      const urls = await getResourceUrls();
      try {
        await loadBravuraFont(urls.bravuraFontUrl);
      } catch (e) {
        console.warn("[Preview] Bravura font load failed:", e);
      }

      if (!apiRef.current) {
        const el = containerRef.current as HTMLElement;
        const scrollEl = (el.parentElement ?? el) as HTMLElement;
        const colors = getAlphaTabColorsForTheme();

        // 使用统一的初始化函数
        const result = await initializeAlphaTabInstance({
          element: el,
          scrollElement: scrollEl,
          resourceUrls: urls,
          colors,
          contentToLoad: content,
        });

        apiRef.current = result.api;
        (
          apiRef.current as unknown as Record<string, unknown>
        ).__unsubscribeTheme = result.unsubscribeTheme;
      } else if (content) {
        // 只有 content 变化，直接加载
        try {
          apiRef.current.tex(content);
        } catch (_e) {
          console.error("[Preview] Failed to set alphaTex content:", _e);
        }
      }
    } catch (err) {
      console.error("[Preview] Failed to initialize alphaTab:", err);
    }
  };

  initAlphaTab();

  // Cleanup
  return () => {
    if (apiRef.current) {
      const unsubscribeTheme = (
        apiRef.current as unknown as Record<string, unknown>
      ).__unsubscribeTheme;
      if (typeof unsubscribeTheme === "function") {
        unsubscribeTheme();
      }
      apiRef.current.destroy();
      apiRef.current = null;
    }
  };
}, [content]);
```

---

## 修复方案 C：引入初始化状态管理

```typescript
type AlphaTabInitState = "idle" | "initializing" | "ready" | "rebuilding";

const [initState, setInitState] = useState<AlphaTabInitState>("idle");

useEffect(() => {
  if (!containerRef.current) return;

  const initAlphaTab = async () => {
    // 防止重复初始化
    if (initState === "initializing" || initState === "rebuilding") {
      console.warn("[Preview] Already initializing or rebuilding");
      return;
    }

    setInitState("initializing");

    try {
      // ... 初始化逻辑 ...
      setInitState("ready");
    } catch (err) {
      console.error("[Preview] Initialization failed:", err);
      setInitState("idle");
    }
  };

  initAlphaTab();

  return () => {
    // 清理
  };
}, [content, initState]);
```

**好处**：

- 清楚地知道初始化状态
- 可以防止重复初始化
- 便于调试（console 中能看到状态）

---

## 总结对比

| 方案                           | 复杂度 | 改动量 | 可靠性    | 推荐度     |
| ------------------------------ | ------ | ------ | --------- | ---------- |
| **A：Ref + applyTracksConfig** | 低     | 中     | ✅ 高     | ⭐⭐⭐⭐   |
| **B：高阶初始化函数**          | 中     | 大     | ✅✅ 很高 | ⭐⭐⭐⭐⭐ |
| **C：状态管理**                | 中     | 中     | ✅ 高     | ⭐⭐⭐     |

**建议**：从方案 A 开始，如果需要进一步的清晰性和可维护性，再升级到方案 B。

---

## 验证清单

实施后，需要验证：

- [ ] 首次加载乐谱时，tracks 显示选项正确应用
- [ ] 在页面上切换 TAB/标准五线谱，状态保留
- [ ] 切换主题（亮→暗）后，tracks 显示选项仍然生效
- [ ] 再次切换回亮色，tracks 显示选项仍然生效
- [ ] 快速连续切换主题，不会出现状态混乱
- [ ] 主题切换期间，如果加载新乐谱，tracks 显示选项不会冲突
- [ ] 控制台没有重复的 scoreLoaded 警告或错误
