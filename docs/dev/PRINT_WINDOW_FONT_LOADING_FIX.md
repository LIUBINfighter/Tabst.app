# 打印窗口字体加载问题修复记录

**日期**: 2026年1月14日  
**问题**: PrintPreview 打印功能中，iframe/新窗口无法加载 Bravura 音乐字体  
**状态**: ✅ 已解决

---

## 问题描述

### 症状

在 PrintPreview 组件中，预览界面显示正常，但执行打印操作时：

- 打印预览窗口（通过 `window.open()` 创建）中的音乐符号无法正确渲染
- 字体显示为浏览器默认字体，而非 Bravura 音乐字体
- 这是一个**回归问题** - 之前的版本可以正常工作

### 影响范围

- 打印功能
- PDF 导出功能
- 任何依赖 `window.open()` 创建新窗口并使用自定义字体的场景

---

## 技术背景

### alphaTab 字体渲染机制

1. **音乐符号使用 Bravura SMuFL 字体**（Standard Music Font Layout）
2. **alphaTab 内部常量**: `Fc.MusicFontSize = 34px`
3. **scale=1.0 时的特殊行为**: alphaTab 在渲染比例为 1:1 时，不在 SVG `<text>` 元素上添加内联 `font-size` 样式，而是依赖 CSS 规则

### PrintPreview 架构

```
PrintPreview Component
├── 主预览区域（containerRef）
│   └── 使用独立的 alphaTab API 实例
│       └── 加载 Bravura.woff2 字体
│
└── 打印窗口（window.open()）
    └── 动态生成的 HTML 文档
        └── 需要重新加载 Bravura 字体
```

### 字体隔离策略

为避免 Preview 和 PrintPreview 之间的字体缓存冲突：

- 使用不同的字体名称：`Bravura-Print` vs `Bravura`
- （之前尝试过时间戳 URL，现已移除）

---

## 问题根因分析

### 根本原因 1: 相对路径问题

**问题**: 字体 URL 在新窗口中解析失败

```typescript
// ❌ 原代码
printWindow.document.write(`
  @font-face {
    font-family: 'Bravura-Print';
    src: url('${printFontUrl}') format('woff2');
  }
`);
```

**原因**:

- `printFontUrl` 可能是相对路径（如 `../../assets/Bravura.woff2`）
- 通过 `document.write()` 创建的文档**没有正确的 base URL 上下文**
- 相对路径相对于新窗口的 URL（`about:blank`）解析，导致 404

**示例**:

```
主窗口: file:///C:/app/dist/src/renderer/index.html
字体路径: ../../assets/Bravura.woff2
→ 相对于主窗口解析: file:///C:/app/dist/assets/Bravura.woff2 ✓

新窗口: about:blank
字体路径: ../../assets/Bravura.woff2
→ 相对于新窗口解析: about:assets/Bravura.woff2 ✗
```

### 根本原因 2: 字体名称不一致

**问题**: CSS 规则中硬编码字体名称

```css
/* ❌ 原代码 */
.at-surface .at {
  font-family: "Bravura", "alphaTab", sans-serif;
}
```

但 `@font-face` 中定义的是：

```css
@font-face {
  font-family: "Bravura-Print"; /* 不匹配！ */
}
```

**结果**: 浏览器找不到 `'Bravura-Print'` 字体，降级使用 `'alphaTab'` 或 `sans-serif`

### 根本原因 3: 缺少字体加载等待

**问题**: 字体尚未加载完成就执行打印

```javascript
// ❌ 原代码
printWindow.onload = () => {
  printWindow.print(); // 立即打印，字体可能未加载
};
```

**原因**:

- `onload` 事件触发时，HTML 已解析完成
- 但 `@font-face` 定义的字体是**异步加载**的
- 打印操作可能在字体下载完成前执行

---

## 解决方案

### 修复 1: URL 绝对化

将相对 URL 转换为绝对 URL，确保在任何上下文中都能正确解析：

```typescript
const fontUrl = printFontUrl || bravuraFontUrl;
const absoluteFontUrl =
  fontUrl.startsWith("http") || fontUrl.startsWith("file:")
    ? fontUrl
    : new URL(fontUrl, window.location.href).toString();

console.log("[PrintPreview] Print window font URL:", absoluteFontUrl);
```

**工作原理**:

- `new URL(relativePath, baseURL)` 根据 base URL 解析相对路径
- 使用主窗口的 `window.location.href` 作为 base URL
- 生成的绝对 URL 可在任何窗口中使用

### 修复 2: 统一字体名称

在所有 CSS 规则中使用动态字体名称：

```typescript
// 生成打印文档时
printWindow.document.write(`
  <style>
    @font-face {
      font-family: '${printFontName || "Bravura"}';
      src: url('${absoluteFontUrl}') format('woff2');
      font-display: block; /* 阻塞渲染直到字体加载 */
    }
    
    body {
      font-family: '${printFontName || "Bravura"}', system-ui, sans-serif;
    }
    
    .at-surface .at {
      font-family: '${printFontName || "Bravura"}', 'Bravura', 'alphaTab', sans-serif !important;
      font-size: 34px;
    }
  </style>
`);
```

**关键点**:

- 所有 `font-family` 引用都使用 `${printFontName}` 模板变量
- 添加 `font-display: block` 确保字体加载时不显示降级字体
- 使用 `!important` 覆盖可能的冲突样式

### 修复 3: 字体加载等待机制

使用 Font Loading API 等待字体加载完成：

```typescript
printWindow.onload = () => {
  const fontName = printFontName || "Bravura";
  console.log("[PrintPreview] Checking font load status:", fontName);

  if (printWindow.document.fonts && printWindow.document.fonts.check) {
    const checkFontAndPrint = () => {
      // 检查字体是否已加载
      const fontLoaded = printWindow.document.fonts.check(`34px "${fontName}"`);
      console.log("[PrintPreview] Font loaded:", fontLoaded);

      if (fontLoaded) {
        // 字体已加载，延迟确保渲染完成
        setTimeout(() => {
          printWindow.focus();
          printWindow.print();
          printWindow.onafterprint = () => {
            printWindow.close();
          };
        }, 100);
      } else {
        // 等待字体加载完成
        printWindow.document.fonts.ready
          .then(() => {
            console.log("[PrintPreview] All fonts ready");
            setTimeout(() => {
              printWindow.focus();
              printWindow.print();
              printWindow.onafterprint = () => {
                printWindow.close();
              };
            }, 100);
          })
          .catch((err) => {
            console.warn("[PrintPreview] Font loading failed:", err);
            // 降级：即使字体失败也尝试打印
            printWindow.focus();
            printWindow.print();
          });
      }
    };

    checkFontAndPrint();
  } else {
    // 降级：不支持 Font Loading API，使用延迟
    console.warn("[PrintPreview] document.fonts API not available");
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 500);
  }
};
```

**工作原理**:

1. **立即检查**: 使用 `document.fonts.check()` 检查字体是否已在缓存中
2. **异步等待**: 如果未加载，使用 `document.fonts.ready` Promise 等待
3. **降级处理**: 不支持 API 时使用 500ms 延迟
4. **错误处理**: 字体加载失败时仍尝试打印（总比卡住好）

### 修复 4: 依赖数组完整性

确保 `useCallback` 包含所有外部变量：

```typescript
}, [
  pages,
  fileName,
  pageSize,
  contentWidthPx,
  contentHeightPx,
  bravuraFontUrl,
  printFontName,    // ✅ 新增
  printFontUrl,     // ✅ 新增
  marginMm,         // ✅ 新增
]);
```

---

## 技术上下文

### Font Loading API

现代浏览器提供了 [CSS Font Loading API](https://developer.mozilla.org/en-US/docs/Web/API/CSS_Font_Loading_API)：

```typescript
// 检查字体是否可用
document.fonts.check('34px "MyFont"'); // → boolean

// 等待所有字体加载完成
document.fonts.ready; // → Promise<FontFaceSet>

// 监听字体加载事件
document.fonts.addEventListener("loadingdone", handler);
```

### URL 解析规则

```typescript
// 相对路径解析
new URL("./path", "http://example.com/a/b");
// → http://example.com/a/path

new URL("../path", "http://example.com/a/b");
// → http://example.com/path

new URL("/path", "http://example.com/a/b");
// → http://example.com/path

// 绝对 URL 保持不变
new URL("file:///C:/path", "http://example.com");
// → file:///C:/path
```

### `window.open()` 和 `document.write()` 的陷阱

1. **新窗口的 URL**: 通常是 `about:blank`，没有有效的协议和主机
2. **`document.write()` 的限制**:
   - 创建的文档没有继承父窗口的 base URL
   - 相对路径解析基于 `about:blank`
   - CSS `@import` 和 `url()` 会失败（除非使用绝对路径）
3. **解决方案**:
   - 使用 `<base href="...">` 标签（不适用于 `file://` 协议）
   - 将所有资源 URL 转换为绝对路径 ✅
   - 将资源内联为 data URI

### Electron 环境的特殊性

在 Electron 中：

- 生产环境使用 `file://` 协议
- 开发环境使用 `http://localhost:5173`
- `resourceLoaderService.ts` 自动处理两种环境的 URL 生成
- 打印窗口需要能访问 `file://` URL（需要在 Electron 中配置 webSecurity）

---

## 验证方法

### 调试检查清单

在浏览器控制台查看：

```
[PrintPreview] Print window font URL: file:///C:/...Bravura.woff2
[PrintPreview] Checking font load status: Bravura-Print
[PrintPreview] Font loaded: true
[PrintPreview] All fonts ready
```

### 手动测试

1. 打开 PrintPreview
2. 点击打印按钮
3. 检查打印预览窗口中的音乐符号是否正确显示
4. 检查浏览器控制台是否有字体加载错误

### 自动化测试（建议）

```typescript
// 测试字体 URL 绝对化
test("converts relative font URL to absolute", () => {
  const relative = "../../assets/Bravura.woff2";
  const base = "file:///C:/app/dist/src/renderer/index.html";
  const absolute = new URL(relative, base).toString();
  expect(absolute).toBe("file:///C:/app/dist/assets/Bravura.woff2");
});

// 测试字体加载等待
test("waits for font loading before printing", async () => {
  const printWindow = { document: { fonts: mockFonts } };
  // ... 测试 document.fonts.ready Promise
});
```

---

## 相关问题

### 之前的字体缩放问题

参见: [音符字体缩放问题修复](./PREVIOUS_FONT_SCALING_FIX.md)（建议创建）

**问题**: 音符显示过小  
**原因**: 缺少 CSS `font-size: 34px` 规则  
**解决**: 手动注入 alphaTab 的 `MusicFontSize` 常量

两个问题的共同点：

- 都涉及 Bravura 字体加载
- 都需要精确匹配 alphaTab 的内部行为
- 都需要处理 scale=1.0 的特殊情况

---

## 未来改进建议

### 1. 使用 Data URI 内联字体

将字体转换为 base64 并内联到 HTML：

```typescript
const fontBase64 = await fetch(fontUrl)
  .then((r) => r.arrayBuffer())
  .then((buf) => btoa(String.fromCharCode(...new Uint8Array(buf))));

const dataUri = `data:font/woff2;base64,${fontBase64}`;
```

**优点**:

- 无需担心 URL 解析问题
- 字体立即可用，无需网络请求
- 适用于所有协议（http/https/file）

**缺点**:

- 增加 HTML 大小（Bravura.woff2 约 200KB → 270KB base64）
- 初始解析时间略长

### 2. 使用 Blob URL

```typescript
const blob = await fetch(fontUrl).then((r) => r.blob());
const blobUrl = URL.createObjectURL(blob);
// 使用后记得释放: URL.revokeObjectURL(blobUrl)
```

### 3. 预加载字体

在主窗口预加载字体到缓存：

```typescript
await document.fonts.load("34px Bravura");
// 打印窗口会使用缓存的字体
```

### 4. 使用 `<base>` 标签（仅限 HTTP）

```html
<head>
  <base href="http://localhost:5173/" />
  <!-- 相对路径现在相对于 base href 解析 -->
</head>
```

**注意**: 不适用于 `file://` 协议

---

## 参考资料

- [CSS Font Loading API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/CSS_Font_Loading_API)
- [URL API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/URL)
- [alphaTab Documentation](https://alphatab.net/)
- [SMuFL Standard](https://w3c.github.io/smufl/latest/)
- [window.open() - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Window/open)

---

## 总结

这次回归问题的修复涉及三个关键技术点：

1. **URL 解析机制** - 理解相对路径在不同上下文中的解析规则
2. **字体加载时序** - 处理异步字体加载与打印操作的竞态条件
3. **CSS 变量一致性** - 确保 `@font-face` 和使用处的字体名称匹配

修复后的代码更健壮，具有更好的错误处理和调试能力。通过添加详细的日志输出，未来如果再出现类似问题，可以快速定位原因。
