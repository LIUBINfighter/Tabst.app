# useEffect 依赖项回归问题：节拍器音量变化触发 Score 刷新

## 问题描述

### 现象

点击节拍器音量按钮后，乐谱预览（score）会意外地**重新加载/刷新**，导致：
- 乐谱闪烁
- 用户操作被中断
- 性能下降

### 预期行为

点击节拍器音量按钮应该**只更新节拍器音量**，不应该触发 score 的重新加载或重建。

## 根本原因分析

### 问题发生的时机

在修复 `pnpm lint` 中的 `useExhaustiveDependencies` 警告时，为了满足 React Hook 依赖项完整性的要求，将 `metronomeVolume` 和 `playbackSpeed` 添加到了会**重建 alphaTab API** 的 `useEffect` 依赖数组中。

### 关键代码位置

**文件**：`src/renderer/components/Preview.tsx`

**问题代码**（第 275-807 行）：

```typescript
useEffect(() => {
    if (!containerRef.current) return;

    // 这个 effect 会完全重建 alphaTab API
    const initAlphaTab = async () => {
        // ... 大量初始化代码 ...
        
        // 在初始化时设置播放速度和节拍器音量
        try {
            apiRef.current.playbackSpeed = playbackSpeed;  // ❌ 使用了 store 值
            apiRef.current.metronomeVolume = metronomeVolume;  // ❌ 使用了 store 值
        } catch (err) {
            console.debug("Failed to apply initial speed/metronome:", err);
        }
        
        // ... 更多初始化代码 ...
    };

    initAlphaTab();

    return () => {
        // Cleanup: 销毁 API
        if (apiRef.current) {
            apiRef.current.destroy();
            apiRef.current = null;
        }
    };
}, [
    applyTracksConfig,
    reinitTrigger,
    applyZoom,
    playbackSpeed,      // ❌ 问题：当音量变化时触发整个 effect 重新执行
    metronomeVolume,    // ❌ 问题：当速度变化时触发整个 effect 重新执行
]);
```

### 问题机制

1. **用户点击节拍器音量按钮** → `metronomeVolume` store 值发生变化
2. **React 检测到依赖项变化** → 触发 `useEffect` 重新执行
3. **useEffect 重新执行** → 调用 `initAlphaTab()` 函数
4. **initAlphaTab 执行流程**：
   - 销毁旧的 `apiRef.current`（调用 `destroy()`）
   - 创建新的 `AlphaTabApi` 实例
   - 加载音频字体（`loadSoundFontFromUrl`）
   - 重新加载乐谱内容（`api.tex(currentContent)`）
5. **结果**：乐谱被完全重新加载，用户看到闪烁

### 为什么这是错误的？

`metronomeVolume` 和 `playbackSpeed` 是**运行时参数**，应该在已初始化的 API 上直接修改，而不应该触发 API 的**重建**。

- ✅ **正确做法**：`api.metronomeVolume = newValue`（直接修改属性）
- ❌ **错误做法**：将值添加到会导致重建的 useEffect 依赖数组

## 修复方案

### 方案概述

使用 `useRef` 保存最新的播放速度和节拍器音量值，然后：

1. **独立的效果（Effect）**：当 `playbackSpeed` 或 `metronomeVolume` 变化时，只更新已存在的 API 实例的属性
2. **初始化时使用 ref**：初始化 API 时从 ref 读取值，而不是直接从 store 读取
3. **移除依赖项**：从会重建 API 的 useEffect 依赖数组中移除这两个值

### 完整修复代码

#### 1. 添加 Ref 保存最新值

```typescript
const playbackSpeed = useAppStore((s) => s.playbackSpeed);
const metronomeVolume = useAppStore((s) => s.metronomeVolume);

// ✅ 使用 ref 保存最新的播放速度/节拍器音量，避免它们变化时触发「重建 alphaTab API」的 useEffect
const playbackSpeedRef = useRef(playbackSpeed);
const metronomeVolumeRef = useRef(metronomeVolume);
```

#### 2. 添加独立的效果同步运行时参数

```typescript
// ✅ 同步全局状态到已初始化的 alphaTab（不重建 score）
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
```

#### 3. 修改初始化代码使用 Ref

**初始化时**（第 571-572 行）：

```typescript
// ✅ 初始应用全局状态的播放速度与节拍器音量
try {
    apiRef.current.playbackSpeed = playbackSpeedRef.current;  // ✅ 使用 ref
    apiRef.current.metronomeVolume = metronomeVolumeRef.current;  // ✅ 使用 ref
} catch (err) {
    console.debug("Failed to apply initial speed/metronome:", err);
}
```

**主题重建时**（第 635-636 行）：

```typescript
// ✅ 重新应用全局状态的播放速度与节拍器音量
try {
    apiRef.current.playbackSpeed = playbackSpeedRef.current;  // ✅ 使用 ref
    apiRef.current.metronomeVolume = metronomeVolumeRef.current;  // ✅ 使用 ref
} catch (err) {
    console.debug(
        "Failed to reapply speed/metronome after rebuild:",
        err,
    );
}
```

#### 4. 从依赖数组中移除

```typescript
}, [
    applyTracksConfig,
    reinitTrigger,
    applyZoom,
    // ✅ 已移除：playbackSpeed, metronomeVolume
]);
```

## 经验教训

### 1. React Hook 依赖项的陷阱

`useExhaustiveDependencies` 规则是正确的，但**不是所有在 effect 内部使用的值都应该添加到依赖数组**。需要区分：

- **应该添加的依赖**：会改变 effect 行为的值（配置、触发条件等）
- **不应该添加的依赖**：运行时参数（应该在单独的 effect 中更新）

### 2. 架构设计的重要性

如果一个 effect 会执行**重量级操作**（如重建整个 API 实例），那么它的依赖数组应该尽可能**小**，只包含真正需要触发重建的值。

### 3. Ref 模式的适用场景

`useRef` 非常适合用于：
- 保存不需要触发重新渲染的值
- 在多个 effect 之间共享最新状态
- 避免不必要的依赖项

### 4. 测试的重要性

修复 lint 警告后，应该**手动测试相关功能**，确保没有引入回归问题。在这个案例中，如果测试了节拍器音量按钮，就能立即发现问题。

## 相关文件

- `src/renderer/components/Preview.tsx` - 主要修改位置
- `package.json` - `lint` 和 `check` 脚本配置

## 验证

修复后，可以通过以下方式验证：

1. ✅ `pnpm check` 通过（lint、format、type-check 全部通过）
2. ✅ 点击节拍器音量按钮，只更新音量，不触发 score 刷新
3. ✅ 调整播放速度，只更新速度，不触发 score 刷新
4. ✅ 初始加载和主题切换时，速度和音量仍然正确应用

## 总结

这是一个典型的**过度依赖导致的性能回归**问题。虽然修复 lint 警告是好的实践，但需要考虑：

- **依赖项的语义**：这个值变化时，是否真的需要执行整个 effect？
- **性能影响**：effect 的执行成本有多大？
- **用户体验**：频繁执行是否会导致明显的性能问题或闪烁？

通过使用 ref + 独立 effect 的模式，我们既满足了 lint 规则，又保持了正确的行为和高性能。

---

**日期**：2025-01-XX  
**发现者**：开发团队  
**修复者**：开发团队  
**相关 Issue**：无
