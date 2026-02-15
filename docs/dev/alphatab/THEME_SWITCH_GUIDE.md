# alphaTab 刷新和重建机制 - 速查表

## 核心问题

**Worker 线程缓存**：alphaTab 的 Web Worker 在初始化时读取并缓存 `resources` 对象中的颜色配置。运行时修改 JavaScript 侧的颜色值**无法**自动同步到 Worker 的缓存副本。

---

## 快速对比

| 场景                          | 调用方法                    | 代价  | 结果                         |
| ----------------------------- | --------------------------- | ----- | ---------------------------- |
| 单音轨显示切换（TAB↔五线谱） | `api.renderTracks([track])` | ✅ 低 | ✅ 立即生效                  |
| 打开新乐谱文件                | `api.tex(content)`          | ⚠️ 中 | ✅ 立即生效                  |
| **主题切换（暗→亮）**         | **完全重建**                | ⚠️ 中 | ✅ 必须这样做                |
| 简单的颜色修改后              | ❌ `api.render()`           | ✅ 低 | ❌ **无效**（Worker 不知道） |

---

## 为什么主题切换需要完全重建？

```
简单方案（❌ 不工作）：
┌─────────────────────────────────────────┐
│ JavaScript 侧修改颜色变量                  │
│ api.settings.display.resources.color = X │
│ api.render()                             │
└──────────────┬──────────────────────────┘
               │
        ❌ Worker 不知道
      （Worker 仍用旧缓存）
               │
               ▼
        乐谱颜色不变
```

```
正确方案（✅ 工作）：
┌────────────────────────────────────────┐
│ 1. api.destroy()                       │
│    （销毁旧 Worker，释放资源）            │
└──────────────┬─────────────────────────┘
               │
┌──────────────▼─────────────────────────┐
│ 2. new AlphaTabApi(el, newSettings)    │
│    （创建新 Worker）                    │
│    Worker 初始化时读取新颜色配置         │
│    → Worker 缓存新颜色                   │
└──────────────┬─────────────────────────┘
               │
┌──────────────▼─────────────────────────┐
│ 3. api.tex(content)                    │
│    （加载乐谱，用新 Worker 新颜色渲染）  │
└────────────────────────────────────────┘
               │
               ▼
        ✅ 乐谱颜色正确更新
```

---

## 实现代码框架

### 初始化（第一次加载）

```typescript
const urls = await getResourceUrls();
const colors = getAlphaTabColorsForTheme(); // 亮色模式

const settings = {
  core: {
    /* ... */
  },
  display: {
    resources: {
      mainGlyphColor: colors.mainGlyphColor,
      // ... 其他颜色
    },
  },
  player: {
    /* ... */
  },
};

apiRef.current = new alphaTab.AlphaTabApi(el, settings);
await loadSoundFontFromUrl(apiRef.current, urls.soundFontUrl);
apiRef.current.tex(content);
```

### 主题切换（必须完全重建）

```typescript
setupThemeObserver(() => {
  void (async () => {
    if (!apiRef.current || !content) return;

    // 步骤 1: 保存乐谱内容
    const currentContent = content;

    // 步骤 2: 销毁旧 API（包括 Worker）
    apiRef.current.destroy();

    // 步骤 3: 获取新颜色（亮→暗 或 暗→亮）
    const newColors = getAlphaTabColorsForTheme();

    // 步骤 4: 创建新配置对象
    const newSettings = {
      core: {
        /* 同前，但用新颜色 */
      },
      display: {
        resources: {
          mainGlyphColor: newColors.mainGlyphColor,
          // ... 其他新颜色
        },
      },
      player: {
        /* 同前 */
      },
    };

    // 步骤 5: 创建新 API（新 Worker，新颜色初始化）
    apiRef.current = new alphaTab.AlphaTabApi(el, newSettings);

    // 步骤 6: 重新加载音频（可选，但推荐）
    await loadSoundFontFromUrl(apiRef.current, urls.soundFontUrl);

    // 步骤 7: 重新加载乐谱（用新颜色渲染）
    apiRef.current.tex(currentContent);
  })();
});
```

---

## 关键问题：Tracks 参数丢失

### 问题现象

- ✅ **初次加载**：settings（颜色） + tracks（显示选项）都正确应用
- ❌ **主题切换**：settings（颜色）更新了，但 tracks（showTablature/showStandardNotation 等）丢失了

### 根本原因：流程不对称

```
初次加载（正常）：
┌─ createAPI(settings)
├─ tex(content) → scoreLoaded 事件
├─ 修改 tracks 显示选项
├─ setFirstStaffOptions()  ← React state 记录了这些值
└─ renderTracks()  ← 显示生效

主题切换（异常）：
┌─ destroy()  ← ❌ 销毁了所有状态
├─ createAPI(newSettings)  ← ⚠️ 新 settings，但没有 tracks 配置
├─ tex(content) → scoreLoaded 事件
├─ 修改 tracks 显示选项  ← 重新设置，但...
├─ setFirstStaffOptions()  ← ❌ React state 被覆盖
└─ renderTracks()  ← 显示生效（但丢失了之前的记录）

问题：tracks 配置只保存在 React state 中，重建时没有恢复机制
```

### 解决方案

**添加 trackConfigRef 保存 tracks 配置**：

```typescript
// 1. 添加 ref 保存配置
const trackConfigRef = useRef<{
  showTablature?: boolean;
  showStandardNotation?: boolean;
  showSlash?: boolean;
  showNumbered?: boolean;
} | null>(null);

// 2. 在 toggle 时保存
const toggleFirstStaffOpt = (key) => {
  // ... 修改 tracks ...
  trackConfigRef.current = {
    ...trackConfigRef.current,
    [key]: newValue,
  };
  setFirstStaffOptions((prev) => ({ ...prev, [key]: newValue }));
  api.renderTracks([firstTrack]);
};

// 3. 在 scoreLoaded 时恢复
apiRef.current.scoreLoaded.on((score) => {
  if (score?.tracks?.length > 0) {
    const firstTrack = score.tracks[0];
    const config = trackConfigRef.current || {
      showTablature: true,
      showStandardNotation: false,
      showSlash: false,
      showNumbered: false,
    };
    firstTrack.staves.forEach((st) => {
      Object.assign(st, config);
    });
    setFirstStaffOptions({ ...config });
    apiRef.current?.renderTracks([firstTrack]);
  }
});
```

---

## 时序问题与异步处理

### 主题切换的完整时序

```
时间轴：
T0: 亮色模式，乐谱已正确加载
    ├─ API 已创建
    ├─ tracks 已设置为 {showTablature: true, ...}
    └─ 乐谱显示正确

T1: 用户切换到暗色模式
    └─ MutationObserver 检测 .dark class 变化
       └─ setupThemeObserver() 回调触发
          ├─ 获取 currentContent = content
          ├─ apiRef.current?.destroy()  ← 销毁旧 API
          ├─ 创建 newSettings（新颜色）
          ├─ new AlphaTabApi(el, newSettings)  ← 新 API
          ├─ await loadSoundFont()  ← 异步等待
          └─ apiRef.current.tex(currentContent)  ← 重新加载

T2: scoreLoaded 事件触发
    └─ 应用 tracks 配置（从 trackConfigRef 恢复）
       └─ ✅ 参数正确恢复
```

### 关键注意事项

1. **异步操作使用 `void (async () => {})()`**：
   - `setupThemeObserver` 期望同步回调
   - 但重建需要异步操作（加载字体）
   - 使用 `void` 操作符启动后台异步任务

2. **保存 content 的快照**：
   - 在 destroy 前捕获 `const currentContent = content`
   - 防止异步操作期间 content 变化

3. **tracks 配置持久化**：
   - 使用 `trackConfigRef` 保存用户选择
   - 在 `scoreLoaded` 回调中恢复
   - 避免每次重建都重置为默认值

---

## 关键细节

### 为什么用 `void (async () => { ... })()`？

```typescript
// ❌ 错误：回调声明为 async
setupThemeObserver(async () => {
  // 错误！setupThemeObserver 期望同步回调
});

// ✅ 正确：回调保持同步，异步操作在后台
setupThemeObserver(() => {
  void (async () => {
    // 异步操作在后台进行，不阻塞回调
    await loadSoundFontFromUrl(...);
  })();
});
```

`void` 操作符的作用：

- 告诉 TypeScript 我们故意忽略 Promise 结果
- 代码风格更清晰：这是一个"火即忘"的异步操作

### 为什么需要保存 `content`？

```typescript
// ❌ 错误：直接使用 content 变量（可能在异步操作期间改变）
const currentContent = content;  // 立即捕获当前值

// 然后在 destroy/rebuild 之后
await loadSoundFontFromUrl(...);
apiRef.current.tex(currentContent);  // 使用捕获的值
```

### 为什么用 `Record<string, unknown>` 而不是 `any`？

```typescript
// ❌ 不推荐
(apiRef.current as any).__unsubscribeTheme = fn;

// ✅ 推荐
(apiRef.current as unknown as Record<string, unknown>).__unsubscribeTheme = fn;
```

原因：类型安全。虽然两者都有类型绕过，但后者更明确表达意图："这是一个可以存储任意键值的对象"。

---

## 故障排查

### 问题：主题切换后乐谱不显示

**检查清单**：

1. ✅ 是否调用了 `destroy()`？
2. ✅ 是否创建了新的 `AlphaTabApi` 实例？
3. ✅ 新 `settings` 中是否包含新颜色？
4. ✅ 是否调用了 `tex(currentContent)`？
5. 📋 检查浏览器控制台是否有错误

### 问题：tracks 参数丢失

**检查清单**：

1. ✅ 是否使用了 `trackConfigRef` 保存配置？
2. ✅ 是否在 `toggleFirstStaffOpt` 中更新 ref？
3. ✅ 是否在 `scoreLoaded` 回调中恢复配置？
4. ✅ 检查配置恢复逻辑是否在 `renderTracks` 之前

### 问题：颜色没有更新

**原因诊断**：

- ❌ 只调用了 `api.render()`？→ 这不工作，需要完全重建
- ❌ `newSettings` 中没有新颜色？→ 检查 `getAlphaTabColorsForTheme()` 返回值
- ❌ 没有调用 `tex()`？→ 必须重新加载乐谱内容

### 问题：主题切换时播放中断

**原因**：目前的实现没有保留播放状态。如需改进：

```typescript
// 保存播放信息（可选升级）
const wasPlaying = apiRef.current.isPlaying;
const currentBeat = apiRef.current.playbackBeat;

// ... 执行重建 ...

// 恢复播放（如果原来正在播放）
if (wasPlaying && currentBeat) {
  apiRef.current.playBeat(currentBeat);
}
```

---

## 文件导航

| 文件                                        | 作用                                                  |
| ------------------------------------------- | ----------------------------------------------------- |
| `src/renderer/lib/themeManager.ts`          | `getAlphaTabColorsForTheme()` - 根据 CSS 变量获取颜色 |
| `src/renderer/lib/resourceLoaderService.ts` | `getResourceUrls()` - 获取 Worker URL 和字体路径      |
| `src/renderer/lib/assets.ts`                | `loadSoundFontFromUrl()` - 加载音频字体               |
| `src/renderer/components/Preview.tsx`       | 主要集成点，包含 `setupThemeObserver` 回调            |
| `src/renderer/index.css`                    | CSS 变量定义（亮→暗主题切换）                         |

---

## 性能建议

### 1. 防止快速切换

```typescript
let rebuildScheduled = false;

const debouncedThemeChange = () => {
  if (rebuildScheduled) return;
  rebuildScheduled = true;

  // 稍后执行重建
  setTimeout(() => {
    // ... 重建 ...
    rebuildScheduled = false;
  }, 100);
};
```

### 2. 仅在有内容时重建

```typescript
if (apiRef.current && content) {
  // 执行重建
}
// 如果没有加载乐谱，跳过重建
```

### 3. 监控性能

```typescript
console.time("[Preview] API rebuild");
// ... 重建逻辑 ...
console.timeEnd("[Preview] API rebuild");
```

---

## 总结

**一句话**：alphaTab 的 Worker 线程缓存颜色配置。要更新颜色，必须重新创建 Worker。

**实现步骤**：

1. `destroy()` 旧 API
2. `new AlphaTabApi()` 新 API（含新颜色）
3. `tex()` 重新加载乐谱

**何时使用**：

- ✅ 主题切换
- ✅ 根本性的配置改变
- ❌ 不适用于：简单的配置修改、单音轨显示切换

**关键文件**：`Preview.tsx` 中的 `setupThemeObserver` 回调（第 162-225 行）
