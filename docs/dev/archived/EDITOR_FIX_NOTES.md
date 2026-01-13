# CodeMirror 6 编辑器 Bug 修复说明

## 问题描述

在之前的实现中，编辑器极少时候会出现**光标和复制混乱**的恶性 bug，导致仅仅是移动光标就会改变内部内容。

## 根本原因分析

### 1. **编辑器完全重建导致的竞态条件**

之前的实现中，每次 `activeFileId` 改变时，编辑器都会被完全销毁并重建：

```typescript
// 旧代码中的问题
useEffect(() => {
  (async () => {
    // 保存旧状态
    let prevSelection = viewRef.current.state.selection;
    
    // 销毁旧编辑器
    viewRef.current.destroy();
    viewRef.current = null;
    
    // 异步加载语言支持
    const alphaTexHighlight = await getAlphaTexHighlight();
    
    // 创建新编辑器
    viewRef.current = new EditorView({ state, parent: editorRef.current });
    
    // 恢复 selection（此时可能已经不对应当前文档状态）
    // ...
  })();
}, [activeFileId]);
```

**问题点：**

- 编辑器销毁和重建之间存在**异步间隙**
- 在这个间隙中，用户输入可能被缓存或丢失
- 保存的 `prevSelection` 可能不再对应新文档的正确位置
- 恢复 selection 时，位置可能指向错误的文本位置
- 用户移动光标时，操作会应用在错误的位置上，导致内容被意外修改

### 2. **Selection 恢复错位**

异步重建过程中，文档状态可能已经改变：
- 如果 `updateFileContent` 在重建期间被调用
- 恢复的 selection 位置可能与实际文本不匹配
- 导致光标移动触发意外的编辑操作

### 3. **依赖项不完整**

```typescript
}, [activeFileId]);  // 只依赖 activeFileId
```

useEffect 只依赖 `activeFileId`，但内部使用了 `useAppStore.getState().files`，可能导致闭包陷阱。

## 修复方案：使用 Compartment 避免重建

### 核心思路

使用 CodeMirror 6 的 **Compartment API** 来动态更新编辑器配置，而不是每次都销毁重建整个编辑器。

### 实现细节

#### 1. **初始化 Compartment**

```typescript
const themeCompartmentRef = useRef<Compartment | null>(null);
const languageCompartmentRef = useRef<Compartment | null>(null);

if (!themeCompartmentRef.current) {
  themeCompartmentRef.current = new Compartment();
}
if (!languageCompartmentRef.current) {
  languageCompartmentRef.current = new Compartment();
}
```

#### 2. **首次创建编辑器时使用 Compartment**

```typescript
const extensions: Extension[] = [
  basicSetup,
  updateListener,
  themeCompartmentRef.current!.of(themeExtension),
  languageCompartmentRef.current!.of(languageExtensions),
];

const state = EditorState.create({
  doc: content,
  extensions,
});

viewRef.current = new EditorView({
  state,
  parent: editorRef.current,
});
```

#### 3. **更新时使用 reconfigure 而非重建**

```typescript
// 编辑器已存在，更新而非重建
if (viewRef.current) {
  const effects = [];
  let changes = undefined;
  
  // 更新文档内容
  if (currentDoc !== content) {
    changes = {
      from: 0,
      to: viewRef.current.state.doc.length,
      insert: content,
    };
  }
  
  // 更新语言扩展
  if (needsLanguageChange) {
    const languageExtensions = await loadLanguageExtensions(language, filePath);
    effects.push(
      languageCompartmentRef.current!.reconfigure(languageExtensions)
    );
  }
  
  // 原子性地应用所有更新
  viewRef.current.dispatch({
    changes,
    effects: effects.length > 0 ? effects : undefined,
  });
}
```

#### 4. **添加更新保护**

```typescript
// 防止递归更新
const isUpdatingRef = useRef(false);

// 在 updateListener 中检查
if (update.docChanged && !isUpdatingRef.current) {
  // 处理文档变更
}
```

## 修复效果

### ✅ **解决的问题**

1. **消除竞态条件**：不再有编辑器销毁和重建之间的异步间隙
2. **保持状态连续性**：光标位置、滚动位置、焦点状态自动保持
3. **原子性更新**：文档内容和配置的更新是原子性的，不会出现中间状态
4. **性能提升**：避免了不必要的完全重建，切换文件更快更流畅

### 🎯 **关键优势**

- **不再破坏编辑器实例**：编辑器实例在组件生命周期内保持稳定
- **无缝更新**：用户在编辑过程中切换文件不会感觉到任何中断
- **状态自然保留**：CodeMirror 自动管理内部状态，无需手动保存和恢复
- **类型安全**：正确分离 `changes` 和 `effects`，避免类型错误

## 测试建议

### 测试场景

1. **快速切换文件**：在多个文件之间快速切换，确保不会出现内容混乱
2. **编辑中切换**：在输入过程中切换文件，确保输入不会丢失
3. **光标移动**：切换文件后移动光标，确保不会意外修改内容
4. **选择文本**：确保选择文本后的操作（复制、粘贴）正常工作
5. **不同语言切换**：在 `.atex`、`.md` 和纯文本文件之间切换
6. **主题切换**：在编辑过程中切换深色/浅色主题

### 边界情况

- 切换到不存在的文件
- 切换到空文件
- 在自动保存期间切换文件
- LSP 初始化期间切换文件

## 代码变更总结

### 主要变更

1. 引入 `languageCompartmentRef` 用于动态管理语言扩展
2. 添加 `currentFilePathRef` 追踪当前文件路径，检测语言变化
3. 添加 `isUpdatingRef` 防止递归更新
4. 重构 useEffect 逻辑：首次创建 vs 后续更新
5. 使用 `dispatch()` 而非重建来更新编辑器
6. 正确分离 `changes` 和 `effects` 参数

### 删除的代码

- 移除了 `EditorSelection` 的手动保存和恢复逻辑
- 移除了滚动位置和焦点的手动管理
- 移除了不必要的异步包装器

### 新增的辅助函数

- `createThemeExtension()`: 创建主题扩展
- `loadLanguageExtensions()`: 异步加载语言扩展
- `createUpdateListener()`: 创建文档更新监听器

## 后续改进建议

1. **添加调试日志**：在关键操作处添加日志，便于追踪问题
2. **性能监控**：监控编辑器更新的性能
3. **错误边界**：添加错误边界组件捕获潜在错误
4. **单元测试**：为编辑器组件添加单元测试
5. **E2E 测试**：添加端到端测试覆盖关键用户场景

## 相关资源

- [CodeMirror 6 Compartment API](https://codemirror.net/docs/ref/#state.Compartment)
- [CodeMirror 6 Transactions](https://codemirror.net/docs/guide/#transactions)
- [CodeMirror 6 State Management](https://codemirror.net/docs/guide/#state-management)

---

**修复日期**: 2024
**修复人员**: AI Assistant
**影响范围**: `src/renderer/components/Editor.tsx`
