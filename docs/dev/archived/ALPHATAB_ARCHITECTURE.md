# alphaTab 架构分析：主题切换完整流程

## 系统架构概览

```
┌────────────────────────────────────────────────────────────────────┐
│                     React 应用层（JavaScript）                      │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ┌─────────────────┐         ┌──────────────────┐                │
│  │  index.css      │         │  themeManager.ts │                │
│  │  (CSS 变量)      │         │  (颜色获取)       │                │
│  └────────┬────────┘         └─────────┬────────┘                │
│           │                            │                         │
│      定义主题颜色              读取 CSS 变量                      │
│      --alphatab-*              getAlphaTabColorsForTheme()       │
│                                                                   │
│  ┌──────────────────────────────────────────────┐                │
│  │  Preview.tsx - AlphaTabApi 管理               │                │
│  │  ┌─────────────────────────────────────────┐ │                │
│  │  │ 1️⃣ 初始化阶段                             │ │                │
│  │  │  ├─ new AlphaTabApi(el, settings)      │ │                │
│  │  │  ├─ settings.display.resources.color=X│ │                │
│  │  │  └─ api.tex(content)                  │ │                │
│  │  └─────────────────────────────────────────┘ │                │
│  │  ┌─────────────────────────────────────────┐ │                │
│  │  │ 2️⃣ setupThemeObserver 回调               │ │                │
│  │  │  ├─ 监听 DOM class 变化                 │ │                │
│  │  │  ├─ 触发：重建 API                      │ │                │
│  │  │  │   ├─ api.destroy()                │ │                │
│  │  │  │   ├─ new AlphaTabApi(...new colors)│ │                │
│  │  │  │   └─ api.tex(content)             │ │                │
│  │  │  └─ 异步执行：await loadSoundFont()   │ │                │
│  │  └─────────────────────────────────────────┘ │                │
│  └──────────────────────────────────────────────┘                │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
                              ▼ IPC / postMessage
┌────────────────────────────────────────────────────────────────────┐
│                   Worker 线程（独立进程）                           │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  alphatab.worker.ts                                              │
│  ├─ 收到 tex() 命令：解析 AlphaTex 文本                           │
│  ├─ 构建音乐数据模型                                              │
│  ├─ ⚠️ 缓存颜色配置（在初始化时从 settings 读取）                 │
│  ├─ 计算布局（考虑缓存的颜色）                                    │
│  └─ 渲染到 Canvas：使用缓存的颜色                                 │
│                                                                    │
│  问题 ❌：JavaScript 侧修改颜色后 render()                        │
│           Worker 仍使用初始化时缓存的旧颜色                        │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

---

## 颜色更新流程对比

### 方案 A：简单修改 + render()（❌ 不工作）

```
JavaScript 侧：
┌─────────────────────────────────────┐
│ 获取新颜色                           │
│ colors = getAlphaTabColorsForTheme() │
│                                      │
│ 尝试修改 API 配置                    │
│ api.settings.display.resources... = │
│   { mainGlyphColor: '#f1f5f9' }      │
│                                      │
│ 调用 render()                        │
│ api.render()                         │
└────────────────────────┬─────────────┘
                         │
                    postMessage
                    "render"
                         │
                         ▼
Worker 侧：
┌─────────────────────────────────────┐
│ 收到 render 命令                    │
│ 使用缓存的颜色（仍是旧颜色！）     │
│ 重新绘制 Canvas                     │
└────────────────────────────────────┘
                         │
                    Canvas 更新
                         │
                         ▼
结果：❌ 乐谱颜色不变（Worker 用了旧缓存）
```

### 方案 B：完全重建（✅ 工作）

```
JavaScript 侧：
┌────────────────────────────────────────────┐
│ 1️⃣ 销毁旧 API                              │
│ apiRef.current.destroy()                   │
│   ├─ Worker 进程被杀死                     │
│   ├─ 资源释放                              │
│   └─ 事件监听器清理                        │
└────────────────────┬───────────────────────┘
                     │
         (旧 Worker 完全销毁)
                     │
┌────────────────────▼───────────────────────┐
│ 2️⃣ 获取新颜色                              │
│ colors = getAlphaTabColorsForTheme()       │
│   (监测到 .dark class 存在)                │
│   → 返回暗色颜色对象                       │
└────────────────────┬───────────────────────┘
                     │
┌────────────────────▼───────────────────────┐
│ 3️⃣ 创建新的 settings 对象                  │
│ settings = {                               │
│   display: {                               │
│     resources: {                           │
│       mainGlyphColor: '#f1f5f9' (新！)    │
│       /* ... 其他新颜色 ... */             │
│     }                                      │
│   }                                        │
│ }                                          │
└────────────────────┬───────────────────────┘
                     │
┌────────────────────▼───────────────────────┐
│ 4️⃣ 创建新 API 和新 Worker                  │
│ apiRef.current = new AlphaTabApi(          │
│   el, settings  // 包含新颜色               │
│ )                                          │
│   ├─ 启动新 Worker 线程                    │
│   └─ Worker 初始化时读取并缓存新颜色！     │
└────────────────────┬───────────────────────┘
                     │
                    (新 Worker 生成，
                  新颜色已缓存在内部)
                     │
┌────────────────────▼───────────────────────┐
│ 5️⃣ 重新加载乐谱                            │
│ apiRef.current.tex(currentContent)        │
│   (内容未变，但用新 Worker 新颜色渲染)    │
└────────────────────┬───────────────────────┘
                     │
                postMessage
                 "tex parse"
                    + 新颜色缓存
                     │
                     ▼
Worker 侧（新进程）：
┌────────────────────────────────────────────┐
│ 收到 tex() 命令                             │
│ 使用初始化时缓存的新颜色 (#f1f5f9)       │
│ 解析 AlphaTex，计算布局，绘制 Canvas      │
└────────────────────┬───────────────────────┘
                     │
                Canvas 更新
                     │
                     ▼
结果：✅ 乐谱颜色正确更新（Worker 用了新缓存）
```

---

## 时序图：主题切换完整过程

```
时间轴：
0ms   用户点击黑暗模式按钮
      │
      ▼
      JS: document.documentElement.classList.toggle('dark')
      │
      ▼
10ms  MutationObserver 检测到 class 变化
      │
      ▼
      setupThemeObserver 回调触发
      │
      ├─ 同步代码：
      │  └─ console.log("[Preview] Theme changed...")
      │
      └─ 异步 IIFE 启动（不阻塞回调）
         │
         ▼
15ms  保存当前乐谱内容
      currentContent = content
      │
      ▼
      销毁旧 API
      apiRef.current.destroy()
      │
      ├─ Worker 关闭
      ├─ Canvas 清空
      └─ 事件监听器清理
      │
      ▼
20ms  获取新颜色配置
      colors = getAlphaTabColorsForTheme()
      │
      ├─ 读取 document.documentElement.classList
      ├─ 创建新的 AlphaTabColors 对象
      └─ 返回新颜色
      │
      ▼
      创建新 settings 对象（包含新颜色）
      │
      ▼
25ms  创建新 API 实例
      apiRef.current = new AlphaTabApi(el, settings)
      │
      ├─ 创建新 Worker 线程
      ├─ Worker 初始化
      ├─ Worker 读取 settings.display.resources
      └─ Worker 缓存新颜色（关键！）
      │
      ▼
30ms  异步等待：加载音频字体
      await loadSoundFontFromUrl(...)
      │
      ├─ 获取 soundfont 文件
      ├─ 解码为 ArrayBuffer
      └─ 传输给 Worker
      │
      ▼
50ms  重新加载乐谱
      apiRef.current.tex(currentContent)
      │
      ├─ postMessage 发送到 Worker
      └─ Worker 使用新缓存的颜色渲染
      │
      ▼
100ms Canvas 更新显示
      │
      ▼
      ✅ 用户看到新颜色的乐谱
```

---

## 关键设计决策

### 1. 为什么用 MutationObserver？

```typescript
// 选项 A：手动切换函数（不好）
function toggleDarkMode() {
  document.documentElement.classList.toggle("dark");
  // 必须手动调用更新逻辑
  rebuildAlphaTab(); // 容易忘记
}

// ✅ 选项 B：MutationObserver（好）
setupThemeObserver(() => {
  rebuildAlphaTab();
});
// 任何修改 .dark class 的方式都会自动触发
```

**优势**：

- 自动检测所有 class 变化，不需要手动协调
- 与 Tailwind CSS 的 `.dark` 约定配合完美
- 解耦：可以从任何地方改变主题

### 2. 为什么用 CSS 变量作为颜色源？

```css
/* ✅ 单一源真值 */
:root {
  --alphatab-main-glyph: #0f172a;
}

.dark {
  --alphatab-main-glyph: #f1f5f9;
}
```

```typescript
/* TypeScript 中读取 */
export function getAlphaTabColorsForTheme(): AlphaTabColors {
  const isDark = document.documentElement.classList.contains("dark");
  // 返回对应的颜色对象
}
```

**优势**：

- CSS 和 JavaScript 使用同一源
- 设计系统一致性
- 易于维护和扩展

### 3. 为什么完全重建而不是简单修改？

| 方案            | 优点    | 缺点                     |
| --------------- | ------- | ------------------------ |
| 修改 + render() | ✅ 快速 | ❌ 不工作（Worker 缓存） |
| 完全重建        | ✅ 有效 | ⚠️ 稍慢（但必要）        |

**决策**：选择完全重建，因为功能正确性 > 微小性能损失

---

## 数据流追踪

### CSS 变量 → JavaScript → Worker

```
1. 用户设置：document.documentElement.classList.add('dark')

2. CSS 应用：
   .dark { --alphatab-main-glyph: #f1f5f9; }

3. JavaScript 读取：
   getComputedStyle(document.documentElement)
     .getPropertyValue('--alphatab-main-glyph')
   → "#f1f5f9"

4. 创建对象：
   colors: AlphaTabColors = {
     mainGlyphColor: '#f1f5f9',
     // ...
   }

5. 传递给 Worker：
   settings = {
     display: {
       resources: colors
     }
   }
   new AlphaTabApi(el, settings)

6. Worker 初始化缓存：
   this.resources = settings.display.resources
   → 缓存 mainGlyphColor = '#f1f5f9'

7. 渲染时使用：
   context.fillStyle = this.resources.mainGlyphColor
   context.fillText(glyph, x, y)
```

---

## 潜在改进方向

### 1. 播放状态保留

```typescript
// 目前：切换主题时停止播放
// 改进：保留并恢复播放位置

const wasPlaying = apiRef.current.isPlaying;
const currentBeat = apiRef.current.playbackBeat;

// ... 重建 ...

if (wasPlaying && currentBeat) {
  apiRef.current.playBeat(currentBeat);
}
```

### 2. 滚动位置保留

```typescript
// 保存当前滚动位置
const scrollTop = scrollEl.scrollTop;

// ... 重建 ...

// 恢复滚动位置
setTimeout(() => {
  scrollEl.scrollTop = scrollTop;
}, 100);
```

### 3. 性能优化

```typescript
// 防止快速切换导致重建多次
let rebuildScheduled = false;

setupThemeObserver(() => {
  if (rebuildScheduled) return;
  rebuildScheduled = true;

  setTimeout(() => {
    performRebuild();
    rebuildScheduled = false;
  }, 100);
});
```

---

## 总结

**核心问题**：alphaTab Worker 缓存颜色，运行时修改 JS 侧颜色无法同步

**解决方案**：完全重建（destroy + 新 AlphaTabApi）来强制 Worker 重新初始化新颜色

**实现位置**：`Preview.tsx` - `setupThemeObserver` 回调

**关键步骤**：

1. 销毁旧 API（包括 Worker）
2. 创建新 settings（含新颜色）
3. 创建新 API（新 Worker 初始化新颜色）
4. 重新加载乐谱（用新颜色渲染）

**性能**：合理的折衷（~50-100ms 重建时间 vs 完整的功能正确性）
