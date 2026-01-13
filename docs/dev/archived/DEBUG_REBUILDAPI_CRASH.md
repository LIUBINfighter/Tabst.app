# Debug 记录：rebuildApi 崩溃问题修复

## 问题描述

在 DebugBar 中修改某些设置（如下拉框选择滚动模式、谱表模式等）时，应用会崩溃，报错：

```text
[PlayerController #1] Failed to rebuild API: TypeError: Cannot read properties of null (reading 'classList')
    at new BrowserUiFacade (alphaTab.core.mjs:44765:21)
    at new AlphaTabApi (alphaTab.core.mjs:45517:15)
    at PlayerController.rebuildApi (PlayerController.ts:371:15)
```

## 问题分析

### 1. 直接原因

AlphaTab 的 `BrowserUiFacade` 构造函数在初始化时尝试访问容器元素的 `classList` 属性，但此时容器可能为 `null` 或已从 DOM 中移除。

### 2. 根本原因：过度重建

原来的 `getCurrentConfigHash()` 实现：

```typescript
private getCurrentConfigHash(): string {
    const globalConfig = this.stores.globalConfig.getState();

    // ❌ 问题：包含了整个 alphaTabSettings
    const relevantConfig = {
        alphaTabSettings: globalConfig.alphaTabSettings,
        playerExtensions: {
            masterVolume: globalConfig.playerExtensions.masterVolume,
        },
    };

    return JSON.stringify(relevantConfig);
}
```

这导致**任何配置变化**都会触发完全的 API 重建，包括：

- `scrollMode`（滚动模式）
- `staveProfile`（谱表模式）
- `scale`（缩放比例）
- `layoutMode`（布局模式）
- 等等...

### 3. 时序问题

当配置变化触发 `rebuildApi()` 时：

1. `destroyApi()` 销毁旧 API 并清空容器内容
2. 在创建新 API 之前，React 可能已经重新渲染组件
3. 容器引用可能已失效或从 DOM 中移除
4. `new AlphaTabApi(this.container, settings)` 时容器无效，导致崩溃

## 修复方案

### 修复 1：减少不必要的重建

修改 `getCurrentConfigHash()` 只包含**真正需要重建 API 的核心配置**：

```typescript
private getCurrentConfigHash(): string {
    const globalConfig = this.stores.globalConfig.getState();

    // ✅ 只包含真正需要重建 API 的核心配置
    const relevantConfig = {
        core: {
            engine: globalConfig.alphaTabSettings.core.engine,
            useWorkers: globalConfig.alphaTabSettings.core.useWorkers,
        },
    };

    return JSON.stringify(relevantConfig);
}
```

**只有以下配置变化才需要重建：**

- `core.engine`: 渲染引擎（svg/html5）
- `core.useWorkers`: Worker 模式开关

### 修复 2：增强容器有效性检查

在 `rebuildApi()` 中添加多层防护：

```typescript
public async rebuildApi(): Promise<void> {
    // 检查 1：容器引用是否存在
    if (!this.container) {
        console.warn(`[PlayerController] No container, skipping rebuild`);
        return;
    }

    // 检查 2：容器是否仍在 DOM 中
    if (!document.body.contains(this.container)) {
        console.warn(`[PlayerController] Container is not in DOM, skipping rebuild`);
        return;
    }

    // ... destroyApi() ...

    // 检查 3：销毁后再次验证容器有效性
    if (!this.container || !document.body.contains(this.container)) {
        console.warn(`[PlayerController] Container became invalid after destroy`);
        return;
    }

    this.api = new alphaTab.AlphaTabApi(this.container, settings);
}
```

## 正确的配置更新方式

大多数设置应该通过 `api.updateSettings()` + `api.render()` 动态更新，而不是重建 API：

| 设置                   | 更新方式                        | 需要重建? |
| ---------------------- | ------------------------------- | --------- |
| `core.engine`          | 重建 API                        | ✅ 是     |
| `core.useWorkers`      | 重建 API                        | ✅ 是     |
| `display.scale`        | `updateSettings()` + `render()` | ❌ 否     |
| `display.staveProfile` | `updateSettings()` + `render()` | ❌ 否     |
| `display.layoutMode`   | `updateSettings()` + `render()` | ❌ 否     |
| `player.scrollMode`    | `updateSettings()`              | ❌ 否     |
| `player.scrollSpeed`   | `updateSettings()`              | ❌ 否     |

## 相关文件

- `src/renderer/player/PlayerController.ts` - 主要修复位置
- `src/renderer/player/components/ScrollModeControl.tsx` - 滚动模式控件
- `src/renderer/player/components/StaveProfileControl.tsx` - 谱表模式控件
- `src/renderer/player/components/ZoomControl.tsx` - 缩放控件

## 经验总结

1. **最小化重建范围**：不要因为配置变化就完全重建 API，只有核心配置变化才需要重建
2. **防御性编程**：在操作 DOM 之前始终验证元素有效性
3. **理解库的行为**：AlphaTab 的 `destroy()` 会清空容器内容，`new AlphaTabApi()` 期望一个有效的容器
4. **时序敏感**：在异步操作中，DOM 状态可能随时改变，需要在关键点重新验证

## 日期

2025-12-04
