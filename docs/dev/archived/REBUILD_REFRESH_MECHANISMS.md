# alphaTab 各层级重建和刷新机制总结

## 概述

alphaTab 的渲染系统是一个多层级的架构，涉及 Worker 线程、DOM 操作、状态管理等多个维度。本文档系统地总结从浅层刷新到深层重建的各种机制，以及它们的使用场景。

---

## 第一层：轻量级刷新 - `api.render()`

### 定义

重新渲染当前加载的乐谱，**不改变任何配置或数据**。

### 触发条件

- 颜色配置改变了，但 Worker 已经初始化
- 只需要视觉上更新显示效果
- 内存中的乐谱数据保持不变

### 实现方式

```typescript
api.render();
```

### 工作流程

1. JavaScript 侧调用 `render()`
2. Worker 收到渲染命令
3. Worker 使用当前的颜色配置重新绘制
4. Canvas 更新呈现最新样式

### 代码位置

- 声明：`themeManager.ts` - `updateAlphaTabColorsForTheme()` 函数
- 使用场景：简单的配置更新（已弃用，原因见下文）

### 关键问题（已识别）

❌ **不工作**：Worker 在初始化时缓存颜色配置，`render()` 调用不会让 Worker 使用新的颜色

- 原因：alphaTab 的 Worker 线程内部维护自己的颜色状态副本
- 修改 JavaScript 侧的 `resources` 对象不会自动同步到 Worker
- 需要更激进的方式来强制 Worker 重新初始化

---

## 第二层：部分重新渲染 - `api.renderTracks()`

### 定义

仅重新渲染特定的音轨集合，其他音轨保持不变。

### 触发条件

- 用户切换第一个音轨的显示选项（TAB/标准五线谱/Slash/Numbered）
- 需要快速反应用户交互，但不影响其他音轨

### 实现方式

```typescript
const firstTrack = api.score.tracks[0];
api.renderTracks([firstTrack]);
```

### 工作流程

1. 修改 `Staff` 对象的显示标志（`showTablature`、`showStandardNotation` 等）
2. 调用 `api.renderTracks([track])`
3. 仅该音轨的视觉重新计算
4. Canvas 更新只包含该音轨的区域

### 代码位置

- 触发点：`Preview.tsx` - `toggleFirstStaffOpt()` 函数
- 使用：在 UI 中切换 TAB/标准五线谱显示

### 优势

✅ 性能最佳：只计算需要的部分
✅ 保留上下文：其他音轨、滚动位置、播放状态都保持

### 示例场景

```typescript
// 用户点击 "Toggle Tablature" 按钮
toggleFirstStaffOpt("showTablature");
// 内部：
// 1. 修改 staff[0].showTablature = !current
// 2. api.renderTracks([firstTrack])
// 3. 仅第一个音轨重新绘制，其他不受影响
```

---

## 第三层：重新加载乐谱内容 - `api.tex()`

### 定义

用新的 AlphaTex 文本重新解析和加载整个乐谱。

### 触发条件

- 用户打开了不同的文件
- 乐谱内容完全改变
- 主题切换时需要用新颜色重新渲染整个乐谱

### 实现方式

```typescript
api.tex(alphaTexString);
```

### 工作流程

1. JavaScript 侧传递 AlphaTex 字符串给 Worker
2. Worker 完整解析文本
3. Worker 构建音乐数据模型
4. Worker 重新计算所有布局（考虑当前颜色配置）
5. 渲染到 Canvas

### 代码位置

- 初始加载：`Preview.tsx` - `useEffect` 中 `apiRef.current.tex(content)`
- 主题切换重建：`setupThemeObserver` 回调中 `apiRef.current.tex(currentContent)`

### 关键特性

✅ 完整重新解析：从文本到数据到渲染的全流程
⚠️ 代价较大：需要重新解析和计算所有布局
✅ 应用新配置：Worker 在渲染时使用当前的颜色设置

### 示例场景

```typescript
// 方案 A：仅调用 tex()（已证明不工作）
// ❌ 不行，因为 Worker 的颜色配置没有更新
api.tex(currentContent);

// 方案 B：重建整个 API（现在的实现）
// ✅ 工作，因为新的 Worker 初始化时采用新颜色
apiRef.current.destroy();
apiRef.current = new AlphaTabApi(el, newSettingsWithNewColors);
apiRef.current.tex(currentContent);
```

---

## 第四层：完全重建 - API 销毁和重新创建

### 定义

销毁当前的 AlphaTabApi 实例，创建新的实例，并重新初始化 Worker 进程。

### 触发条件

- 主题切换需要改变 Worker 的颜色缓存
- 需要改变根本性的配置（如字体目录、Worker URL）
- 简单的配置修改无法应用时的强制方案

### 实现方式

```typescript
// 步骤 1: 保存当前状态
const currentContent = content;

// 步骤 2: 销毁旧 API（清理 Worker、事件监听、DOM 引用）
apiRef.current.destroy();

// 步骤 3: 获取新配置（特别是新的颜色）
const newColors = getAlphaTabColorsForTheme();

// 步骤 4: 创建新的 settings 对象（包含新颜色）
const newSettings: any = {
  core: {
    tex: true,
    scriptFile: urls.workerUrl,
    fontDirectory: urls.bravuraFontDirectory,
  },
  display: {
    layoutMode: alphaTab.LayoutMode.Page,
    scale: 1.0,
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
    scrollMode: alphaTab.ScrollMode.Continuous,
    scrollElement: scrollEl,
    scrollSpeed: 300,
  },
};

// 步骤 5: 创建新 API（新 Worker 进程，新颜色初始化）
apiRef.current = new alphaTab.AlphaTabApi(el, newSettings);

// 步骤 6: 重新加载音频字体
await loadSoundFontFromUrl(apiRef.current, urls.soundFontUrl);

// 步骤 7: 重新加载乐谱内容（新 Worker 用新颜色渲染）
apiRef.current.tex(currentContent);
```

### 代码位置

- 实现位置：`Preview.tsx` - `setupThemeObserver()` 回调（第 162-225 行）
- 使用场景：主题从亮色切换到暗色或反之

### 关键细节

#### 为什么需要完全重建？

1. **Worker 缓存问题**：alphaTab 的 Worker 在初始化时读取并缓存 `resources` 对象中的颜色
2. **单向同步**：JavaScript 侧修改颜色不会自动同步到 Worker 的内存副本
3. **强制重新初始化**：只有通过创建新的 AlphaTabApi 实例，新的 Worker 才能用新颜色初始化

#### 异步处理

```typescript
// 使用 void 操作符包装异步 IIFE，确保回调不会阻塞
void (async () => {
  // 异步操作在后台执行
  await loadSoundFontFromUrl(apiRef.current, urls.soundFontUrl);
})();
```

原因：`setupThemeObserver` 的回调必须是同步的，但我们需要执行异步操作。解决方案是在后台启动异步任务，不等待其完成。

### 优势与代价

| 维度   | 优势                | 代价                      |
| ------ | ------------------- | ------------------------- |
| 功能   | ✅ 保证颜色更新生效 | ❌ 重建整个 Worker        |
| 性能   | ❌ 较重的操作       | ⚠️ 可能有短暂延迟         |
| 状态   | ✅ 完全刷新         | ⚠️ 需要手动恢复滚动位置等 |
| 可靠性 | ✅ 最可靠           | ✅ 经过测试               |

### 内存管理

```typescript
// 销毁时的清理顺序
1. destroy() - 清理 Worker、事件监听、DOM 引用
2. 新的 AlphaTabApi 创建新的 Worker 进程
3. JavaScript 垃圾回收：旧 apiRef.current 被新实例替换
```

---

## 第五层：高级场景 - 播放状态保留

### 场景

主题切换时，用户可能正在播放音乐。理想情况下应该：

- 保留当前播放位置
- 保留播放速度
- 保留音量设置
- 换新颜色后继续播放

### 当前实现

❌ **未实现**：目前的重建会中断播放

### 潜在解决方案

```typescript
// 保存播放状态
const playbackState = {
  isPlaying: apiRef.current.isPlaying,
  beat: apiRef.current.playbackBeat,
  tempo: apiRef.current.tempo,
  masterVolume: apiRef.current.masterVolume,
};

// ... 执行重建 ...

// 恢复播放状态
if (playbackState.isPlaying) {
  await apiRef.current.playBeat(playbackState.beat);
  apiRef.current.masterVolume = playbackState.masterVolume;
}
```

### 实现建议

如果需要实现，应在第四层重建方案的基础上增加这部分逻辑。

---

## 刷新机制对比表

| 机制               | 触发时机          | 代价 | 保留状态    | 应用场景                           |
| ------------------ | ----------------- | ---- | ----------- | ---------------------------------- |
| **render()**       | 简单配置更新      | 极低 | ✅ 完全     | ❌ 已弃用（不工作）                |
| **renderTracks()** | 单个音轨显示切换  | 低   | ✅ 完全     | TAB vs 标准五线谱切换              |
| **tex()**          | 内容改变/重新解析 | 中   | ✅ 配置     | 打开新文件、主题切换（不足以）     |
| **完全重建**       | 深层配置改变      | 中   | ⚠️ 需要手动 | 主题切换（颜色更新），根本配置改变 |

---

## 色彩配置层级

### Level 1: CSS 变量

```css
/* src/renderer/index.css */
:root {
  --alphatab-main-glyph: #0f172a;
  --alphatab-secondary-glyph: #0f172a99;
  /* ... */
}

.dark {
  --alphatab-main-glyph: #f1f5f9;
  --alphatab-secondary-glyph: #f1f5f999;
  /* ... */
}
```

**作用**：定义源真值，框架级别

### Level 2: ThemeManager 函数

```typescript
/* src/renderer/lib/themeManager.ts */
export function getAlphaTabColorsForTheme(): AlphaTabColors {
  const isDarkMode = document.documentElement.classList.contains("dark");
  return isDarkMode ? darkColors : lightColors;
}
```

**作用**：从 CSS 变量动态读取，提供类型安全的颜色对象

### Level 3: API 初始化配置

```typescript
const settings = {
  display: {
    resources: {
      mainGlyphColor: colors.mainGlyphColor,
      // ...
    },
  },
};
const api = new alphaTab.AlphaTabApi(el, settings);
```

**作用**：在 Worker 初始化时将颜色传递给 Worker，建立缓存副本

### Level 4: Worker 内部状态

```
Worker 进程内部维护的颜色缓存副本（黑盒，无法直接访问）
```

**问题**：这个副本不会自动更新

### 更新流程

```
CSS 变量改变
    ↓
getAlphaTabColorsForTheme() 读取新值
    ↓
创建新的 settings 对象
    ↓
destroy() 旧 API + destroy 旧 Worker
    ↓
new AlphaTabApi() 创建新 Worker，传递新颜色
    ↓
新 Worker 初始化时缓存新颜色
    ↓
tex() 重新渲染使用新颜色
```

---

## 实际应用示例

### 例1：用户切换 TAB 显示 ✅ 轻量级

```typescript
// 在 Preview 组件中
const handleToggleTablature = () => {
  const track = apiRef.current.score.tracks[0];
  track.staves[0].showTablature = !track.staves[0].showTablature;
  apiRef.current.renderTracks([track]); // ← 仅这一层级
};
```

### 例2：用户打开新乐谱 ✅ 中等

```typescript
// content props 改变时，useEffect 触发
useEffect(() => {
  if (apiRef.current && content) {
    apiRef.current.tex(content); // ← 第三层级
  }
}, [content]);
```

### 例3：用户切换暗黑模式 ✅ 完整重建

```typescript
// 在 setupThemeObserver 回调中
setupThemeObserver(() => {
  // 保存状态
  const currentContent = apiRef.current?.tex.toString();

  // 销毁并重建
  apiRef.current.destroy();
  apiRef.current = new alphaTab.AlphaTabApi(el, newSettingsWithNewColors);

  // 恢复内容
  await loadSoundFontFromUrl(apiRef.current, soundFontUrl);
  apiRef.current.tex(currentContent); // ← 第四层级（完全重建）
});
```

---

## 故障排查指南

### 症状：改变颜色后看不到效果

**原因**：只调用了 `api.render()`
**解决**：需要完全重建（销毁+重新创建 API）

### 症状：主题切换后乐谱消失

**原因**：可能 `destroy()` 后没有正确重新加载内容
**排查**：

1. 检查是否 `apiRef.current.tex(content)` 被调用
2. 检查 `content` 变量是否正确保存
3. 检查浏览器控制台错误日志

### 症状：主题切换时音乐播放中断

**原因**：现在的实现没有保留播放状态
**改进**：见第五层"播放状态保留"

### 症状：多次切换主题后内存泄漏

**原因**：`destroy()` 不完整或事件监听未清理
**排查**：

1. 检查 Chrome DevTools Memory 标签
2. 确认 Worker 线程被正确关闭
3. 检查事件监听是否在 `destroy()` 中清理

---

## 性能优化建议

### 1. 防止快速切换

```typescript
let rebuildTimeout: number | null = null;

const debouncedRebuild = () => {
  if (rebuildTimeout) clearTimeout(rebuildTimeout);
  rebuildTimeout = setTimeout(() => {
    // 执行重建
  }, 300);
};
```

### 2. 条件重建

```typescript
if (apiRef.current && content) {
  // 仅在有内容时才重建
}
```

### 3. 异步加载

```typescript
// 使用 void 操作符，允许后台完成
void (async () => {
  await loadSoundFontFromUrl(...);
})();
```

### 4. 监控重建性能

```typescript
console.time("[Preview] API rebuild");
// ... 重建代码 ...
console.timeEnd("[Preview] API rebuild");
```

---

## 总结

| 层级 | 操作             | 何时使用                 | 代价         |
| ---- | ---------------- | ------------------------ | ------------ |
| 1️⃣   | `render()`       | ❌ 不适用（Worker 缓存） | 极低         |
| 2️⃣   | `renderTracks()` | 单个音轨显示切换         | 低           |
| 3️⃣   | `tex()`          | 重新加载乐谱内容         | 中           |
| 4️⃣   | 完全重建         | 主题切换、深层配置改变   | 中           |
| 5️⃣   | 状态保留         | 播放中主题切换           | 高（未实现） |

**关键洞察**：alphaTab 的 Worker 架构决定了颜色配置必须在初始化时设置。运行时修改需要完全重建来强制 Worker 重新初始化。
