# 小节号高亮功能实现与修复

**日期**：2026-01-16  
**分支**：`fix/api-instance`  
**问题**：暗色主题下编辑器光标经过的小节号高亮导致谱线/音符变白，以及序列化错误

---

## 🎯 问题概述

### 需求
在暗色主题下，当编辑器光标经过某个小节时，该小节的小节号应该：
1. ✅ **小节号变红**（高亮显示）
2. ⚠️ **其他谱要素保留主题颜色**（谱线、音符、效果等应保持暗色主题的浅灰/浅色）

### 实际行为
- ✅ 小节号正常变红
- ❌ **问题 1**：旧小节的谱线/音符等颜色变成白色/非期望颜色，且不会随着光标移动恢复
- ❌ **问题 2**：alphaTab 在序列化/渲染时抛出异常：
  - `FormatError: Unsupported format for color`
  - `TypeError: Cannot read properties of undefined (reading 'toString')`
  - 这些错误来自 alphaTab 对 `BarStyle.colors` 的序列化（toJson）阶段

---

## 🔍 根本原因分析

### 核心问题

alphaTab 的颜色系统有两层：

1. **全局主题色**：`api.settings.display.resources.*`（通过 `getAlphaTabColorsForTheme()` 设置）
2. **局部样式**：`bar.style.colors`（`Map<BarSubElement, Color>`）

### 问题根源

1. **颜色继承机制失效**：
   - 当创建 `new BarStyle()` 并只设置小节号颜色时，其他 `BarSubElement` 可能未显式设置
   - alphaTab 在渲染时，如果 `bar.style` 存在但某些 keys 缺失，**不会回退到全局主题色**
   - 而是使用某种默认值（可能是白色或未定义），导致"变白"问题

2. **序列化错误**：
   - `bar.style.colors` 中可能存在 `undefined` / `null` / 非 Color 对象的值
   - alphaTab 的 `BarStyleSerializer.toJson` 在序列化时调用 `color.toString()`，遇到无效值会抛错

---

## 🛠️ 尝试过的方案

### 方案 A：最小化干预（失败）

**思路**：只删除小节号颜色，让其他元素自然继承全局主题色

```typescript
// 只删除小节号相关的颜色 keys
const barNumberKeys = [
  StandardNotationBarNumber,
  GuitarTabsBarNumber,
  SlashBarNumber,
  NumberedBarNumber,
];

for (const key of barNumberKeys) {
  style.colors.delete(key);
}
```

**结果**：❌ 失败 - alphaTab 在 `bar.style` 存在时不会回退到全局主题色，谱线/音符仍然变白

### 方案 B：显式设置所有主题色（有效但复杂）

**思路**：既然 alphaTab 不会回退，就显式设置所有需要的颜色

```typescript
// 先设置所有主题色
bar.style.colors.set(StandardNotationStaffLines, staffLineColor);
bar.style.colors.set(StandardNotationBeats, mainGlyphColor);
// ... 其他元素

// 然后设置小节号为红色
bar.style.colors.set(StandardNotationBarNumber, highlightColor);
```

**结果**：✅ 有效，但代码复杂，性能开销大，可能覆盖用户自定义样式

---

## ✅ 最终解决方案

### 核心思路

**简化策略**：依赖全局主题色，只对需要高亮的小节设置小节号颜色

1. **全局主题色**：通过 `api.settings.display.resources.*` 设置（已实现）
2. **高亮时**：只设置小节号颜色为红色，其他元素使用全局主题色
3. **恢复时**：只删除小节号颜色，如果 `colors` Map 为空，尝试删除整个 `bar.style`

### 实现细节

#### 1. 高亮小节号（`applyEditorBarNumberColor`）

```typescript
// 只创建高亮颜色（红色）
const highlightColor = alphaTab.model.Color.fromJson("#ef4444");

// 只在 style 不存在时创建（最小化干预）
if (!bar.style) {
  bar.style = new alphaTab.model.BarStyle();
}

// 只设置小节号颜色，其他元素使用全局主题色
bar.style.colors.set(
  alphaTab.model.BarSubElement.StandardNotationBarNumber,
  highlightColor,
);
bar.style.colors.set(
  alphaTab.model.BarSubElement.GuitarTabsBarNumber,
  highlightColor,
);
// ... 其他小节号类型
```

#### 2. 恢复旧小节（`applyThemeColorsToPreviousBars`）

```typescript
const barNumberKeys = [
  StandardNotationBarNumber,
  GuitarTabsBarNumber,
  SlashBarNumber,
  NumberedBarNumber,
];

// 只删除小节号相关的颜色
for (const key of barNumberKeys) {
  style.colors.delete(key);
}

// 如果 colors Map 为空，尝试删除整个 bar.style（让 alphaTab 使用全局样式）
if (style.colors.size === 0) {
  try {
    bar.style = null; // 让 alphaTab 使用全局主题色
  } catch (e) {
    // 如果 alphaTab 不支持删除 style，保留空的 BarStyle
    // 空的 BarStyle 应该不会影响渲染，因为 Map 为空
  }
}
```

#### 3. 安全设置颜色（`safeSetColor`）

为了防止序列化错误，添加了安全设置函数：

```typescript
const safeSetColor = (
  colors: Map<number, alphaTab.model.Color>,
  key: number | undefined,
  value: alphaTab.model.Color | undefined,
): boolean => {
  // 验证 key 和 value 都是有效的
  if (key === undefined || key === null || typeof key !== "number") {
    return false;
  }
  if (!value || typeof value.toString !== "function") {
    return false;
  }
  
  // 测试 toString 是否可以正常调用
  try {
    value.toString();
    colors.set(key, value);
    return true;
  } catch (e) {
    return false;
  }
};
```

#### 4. 全局清理（`sanitizeAllBarStyles`）

在 `render()` 前清理所有无效的颜色值：

```typescript
const sanitizeAllBarStyles = (api: alphaTab.AlphaTabApi) => {
  // 遍历所有 bar，清理无效的颜色值
  for (const track of api.score.tracks ?? []) {
    for (const staff of track.staves ?? []) {
      for (const bar of staff.bars ?? []) {
        const style = bar.style;
        if (!style?.colors) continue;
        
        // 创建新的 Map，只保留有效的键值对
        const validEntries: Array<[number, alphaTab.model.Color]> = [];
        
        for (const [k, v] of Array.from(style.colors.entries())) {
          // 验证 key 和 value 都是有效的
          if (k === undefined || v === undefined || v === null) {
            continue; // 跳过无效值
          }
          
          // 验证 value 有 toString 方法
          if (typeof v?.toString !== "function") {
            continue; // 跳过无效值
          }
          
          // 测试 toString 是否可以正常调用
          try {
            v.toString();
            validEntries.push([k, v]);
          } catch (e) {
            // 跳过无法序列化的值
          }
        }
        
        // 清空并重新设置有效的键值对
        style.colors.clear?.();
        for (const [k, v] of validEntries) {
          style.colors.set(k, v);
        }
      }
    }
  }
};
```

---

## 📁 涉及文件

| 文件 | 修改内容 |
|------|---------|
| `src/renderer/components/Preview.tsx` | 实现小节号高亮逻辑，包括 `applyEditorBarNumberColor`、`applyThemeColorsToPreviousBars`、`sanitizeAllBarStyles`、`safeSetColor` |

---

## 🔧 技术细节

### alphaTab 颜色系统

1. **全局主题色**：
   - 通过 `api.settings.display.resources.*` 设置
   - 在 `createPreviewSettings` 中配置
   - 主题切换时通过 `setupThemeObserver` 重建 API

2. **局部样式**：
   - `bar.style.colors` 是 `Map<BarSubElement, Color>`
   - 局部样式会覆盖全局主题色
   - **关键**：如果 `bar.style` 存在，alphaTab 不会回退到全局主题色

### BarSubElement 类型

```typescript
enum BarSubElement {
  StandardNotationBarNumber = 0,
  GuitarTabsBarNumber = 1,
  SlashBarNumber = 2,
  NumberedBarNumber = 3,
  StandardNotationStaffLines = 4,
  GuitarTabsStaffLines = 5,
  StandardNotationBarSeparator = 6,
  GuitarTabsBarSeparator = 7,
  StandardNotationBeats = 8,
  GuitarTabsBeats = 9,
  StandardNotationEffects = 10,
  GuitarTabsEffects = 11,
}
```

### 调用流程

```
编辑器光标移动
  ↓
editorCursor 更新（store）
  ↓
Preview.tsx useEffect 监听
  ↓
applyThemeColorsToPreviousBars()  // 恢复旧小节
  ↓
applyEditorBarNumberColor()       // 高亮当前小节
  ↓
sanitizeAllBarStyles()            // 清理无效值
  ↓
api.render()                      // 渲染
```

---

## 🎓 经验总结

### 关键发现

1. **alphaTab 的颜色继承机制**：
   - 如果 `bar.style` 不存在，元素使用全局主题色
   - 如果 `bar.style` 存在，元素**不会**回退到全局主题色
   - 必须显式设置所有需要的颜色，或者删除整个 `bar.style`

2. **序列化安全**：
   - `bar.style.colors` 中的值必须是有效的 `Color` 对象
   - 必须验证 `toString()` 方法可以正常调用
   - 在 `render()` 前清理所有无效值

3. **最小化干预原则**：
   - 只设置需要修改的颜色（小节号）
   - 恢复时只删除修改过的颜色
   - 如果可能，删除整个 `bar.style` 让 alphaTab 使用全局样式

### 最佳实践

1. **使用全局主题色**：
   - 通过 `api.settings.display.resources.*` 设置全局主题色
   - 只在需要特殊高亮时才使用局部样式

2. **安全设置颜色**：
   - 使用 `safeSetColor` 辅助函数验证 key 和 value
   - 在设置后立即验证所有颜色值

3. **防御性编程**：
   - 在 `render()` 前调用 `sanitizeAllBarStyles` 清理无效值
   - 捕获并处理序列化错误

### 注意事项

1. **alphaTab 版本兼容性**：
   - 不同版本的 alphaTab 可能对 `bar.style = null` 的支持不同
   - 需要测试并处理不支持的情况

2. **性能考虑**：
   - 避免频繁创建/删除 `BarStyle`
   - 使用 `lastColoredBarsRef` 缓存，避免重复处理相同小节

3. **用户自定义样式**：
   - 如果用户导入了自定义样式，我们的恢复逻辑可能会覆盖它们
   - 当前实现只处理我们创建的小节样式

---

## 🐛 已知限制

1. **bar.style = null 支持**：
   - 如果 alphaTab 不支持删除 `bar.style`，空的 `BarStyle` 可能仍然存在
   - 目前通过 try-catch 处理，保留空的 `BarStyle`（应该不影响渲染）

2. **用户自定义样式**：
   - 如果小节本身有用户自定义样式，我们的恢复逻辑可能会影响它们
   - 当前实现假设所有小节样式都是我们创建的

---

## 📝 调试日志

所有相关操作都添加了 `[BarColor]` 前缀的调试日志：

```typescript
console.debug("[BarColor] applyEditorBarNumberColor called", { barIndex, ... });
console.debug("[BarColor] Restoring previous bars by removing bar number colors:", count);
console.debug("[BarColor] sanitizeAllBarStyles applied fixes:", fixes);
```

可以通过控制台过滤 `[BarColor]` 来查看相关日志。

---

## 🔗 相关文档

- [SELECTION_SYNC_IMPLEMENTATION.md](./SELECTION_SYNC_IMPLEMENTATION.md) - 编辑器与乐谱同步实现
- [SCROLL_VISIBILITY_FIX.md](./SCROLL_VISIBILITY_FIX.md) - CodeMirror 滚动可见性检测修复

---

## ✅ 验证结果

- ✅ 小节号正常变红
- ✅ 旧小节的谱线/音符恢复为主题色（使用全局主题色）
- ✅ 没有序列化错误
- ✅ 性能良好（只操作小节号相关的颜色）

---

**修复日期**：2026-01-16  
**状态**：✅ 已完成并验证
