# 修复完成总结

## ✅ 修复已应用

已在 `src/renderer/components/Preview.tsx` 中应用了 **方案 A（轻量级修复）**。

---

## 📝 修改内容

### 1. 添加 trackConfigRef

```typescript
// 第 47-52 行
const trackConfigRef = useRef<{
  showNumbered?: boolean;
  showSlash?: boolean;
  showTablature?: boolean;
  showStandardNotation?: boolean;
} | null>(null);
```

### 2. 在 toggleFirstStaffOpt 中保存配置

```typescript
// 第 113-118 行
trackConfigRef.current = {
  ...trackConfigRef.current,
  [key]: newValue,
};
```

### 3. 创建统一的 applyTracksConfig 函数

```typescript
// 第 120-158 行
const applyTracksConfig = (api: alphaTab.AlphaTabApi) => {
  // 从 trackConfigRef 恢复配置
  // 应用到所有 staff
  // 更新 UI state
  // 重新渲染
};
```

### 4. 更新 scoreLoaded 事件处理

```typescript
// 第 356-365 行（初始化）和 287-300 行（主题重建）
apiRef.current.scoreLoaded.on((score) => {
  try {
    if (score?.tracks && score.tracks.length > 0) {
      applyTracksConfig(apiRef.current!);
    }
  } catch (e) {
    console.error("[Preview] Failed to apply tracks config", e);
  }
});
```

### 5. 在主题切换时保存配置

```typescript
// 第 227-241 行
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
      trackConfigRef.current
    );
  }
}
```

---

## 🔄 工作流程

### 初次加载

1. ✅ 创建 API（含初始化颜色）
2. ✅ 加载乐谱内容（tex）
3. ✅ scoreLoaded 触发 → 调用 applyTracksConfig
4. ✅ 应用默认 tracks 配置（showTablature=true 等）
5. ✅ 更新 UI state 和 trackConfigRef

### 用户切换 TAB/标准五线谱

1. ✅ toggleFirstStaffOpt 修改 API 内的 staff 配置
2. ✅ 保存到 trackConfigRef
3. ✅ 更新 UI state
4. ✅ renderTracks 重新显示

### 主题切换

1. ✅ 保存当前 tracks 配置到 trackConfigRef
2. ✅ destroy 旧 API
3. ✅ 创建新 API（新颜色）
4. ✅ 设置新 scoreLoaded 回调
5. ✅ 加载乐谱内容（tex）
6. ✅ scoreLoaded 触发 → applyTracksConfig **恢复保存的配置** ⭐
7. ✅ 显示正确（颜色+tracks 都正确）

---

## 🧪 验证步骤

### 测试 1：初次加载

- [ ] 打开应用
- [ ] 加载乐谱
- [ ] ✅ 应该显示 TAB（showTablature=true）

### 测试 2：切换显示选项

- [ ] 切换 TAB ↔ 标准五线谱
- [ ] ✅ 配置立即改变且保留在 trackConfigRef

### 测试 3：主题切换（暗 → 亮）

- [ ] 切换到亮色模式
- [ ] ✅ 颜色改变（新 settings 应用）
- [ ] ✅ **TAB/标准五线谱 选项保留** ⭐ （从 trackConfigRef 恢复）

### 测试 4：快速切换主题

- [ ] 快速切换主题多次
- [ ] ✅ 没有状态混乱
- [ ] ✅ 最终显示正确

### 测试 5：修改显示选项后切换主题

- [ ] 将 TAB 改为标准五线谱
- [ ] 切换主题
- [ ] ✅ 显示应该保持为标准五线谱（不是重置为 TAB）

---

## 📊 改动统计

- **新增代码行数**：~60 行
- **删除代码行数**：~35 行
- **修改文件**：1 个（Preview.tsx）
- **构建结果**：✅ 成功（无错误）

---

## 🎯 关键改进

| 问题                 | 之前                               | 现在                              |
| -------------------- | ---------------------------------- | --------------------------------- |
| **Tracks 配置保存**  | ❌ 只在 React state（销毁时丢失）  | ✅ 在 trackConfigRef 中持久化     |
| **主题切换时恢复**   | ❌ 重置为硬编码初始值              | ✅ 从 trackConfigRef 恢复用户选择 |
| **scoreLoaded 逻辑** | ❌ 分散在两个地方（初始化 + 重建） | ✅ 统一为 applyTracksConfig 函数  |
| **代码复用性**       | ❌ 初始化和重建代码路径不同        | ✅ 使用相同的 applyTracksConfig   |
| **调试便利性**       | ❌ 看不到 tracks 配置何时保存/恢复 | ✅ 添加了 console.log 日志        |

---

## 🚀 下一步（可选升级）

### 可选：添加 localStorage 持久化

这样用户选择可以在刷新页面后保留：

```typescript
// 在 toggleFirstStaffOpt 中
localStorage.setItem(
  "alphaTab:trackConfig",
  JSON.stringify(trackConfigRef.current)
);

// 在初始化时
const saved = localStorage.getItem("alphaTab:trackConfig");
if (saved) {
  trackConfigRef.current = JSON.parse(saved);
}
```

### 可选：升级到方案 B

后续如果需要更清晰的代码结构，可以将初始化逻辑提取为独立函数 `initializeAlphaTabInstance()`。

---

## ✨ 现在可以测试了！

修复已完成，代码已构建成功。可以：

1. **运行开发模式**：`pnpm dev`
2. **打包应用**：`pnpm make`
3. **测试验证**：按上述 5 个测试步骤验证

---

**祝测试顺利！** 🎉
