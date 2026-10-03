# 打印 PDF 多出空白页诊断报告

> **Status:** Fixed — 2026-10-03
>
> 现象：从桌面上的两份真实导出件确认，打印/导出 PDF 会多出一张**中间空白页**
> （3 页 = 乐谱第 1 页 + 空白 + 乐谱第 2 页），而 App 内的打印渲染界面看起来
> 完全正常。

## 证据

对桌面上的 `東方妖々夢～Ancient Temple.pdf` 与
`東方妖々夢～Ancient Temple 双谱线系统.pdf` 用 PyMuPDF 逐页统计非白像素：

| 页 | drawings | 文本长度 | 非白像素 |
| --- | --- | --- | --- |
| 1 | 799 | 732 | 25510 |
| 2 | 3 | 0 | **0** |
| 3 | 942 | 730 | 28380 |

两份文件都是同样的形态：只有 2 个乐谱页，但物理页是 3 张，中间那张全空。

## 为什么界面预览看不出来

界面预览（`PrintPreview.tsx`）每次只渲染**一个** `.print-page`，放在固定尺寸的
盒子里再用 `transform: scale(previewFitScale)` 缩放显示。它从不进入浏览器的
物理分页流程，所以任何分页错误在预览里都不可见。

## 根因

打印样式（`PrintWindow.tsx`）的分页契约**没有任何余量**，任何微小溢出都会被
`page-break-after: always` 放大成一张额外的纸：

1. **页边距用容器 padding 实现**
   `@page { margin: 0 }`（来自 #190，用于去掉浏览器页眉页脚）+
   `.print-shell { padding: <margin>mm }`。于是第一张纸的盒子从
   `margin` 处开始，其底部位置等于 `margin + contentHeight`。
   物理页只有 `pageHeight`，一旦内容/布局有任何放大，第一张纸就会跨过页边界。
2. **`.print-page` 高度 = 可打印高度，零容差**
   盒子高度被钉死为 `contentHeightPx`，没有任何安全余量。
3. **`page-break-after: always` + `page-break-inside: avoid`**
   当盒子哪怕只超出页边界一点点，强制分页会落在**下一张**物理页上，而盒子
   剩余部分留在上一页形成空白——这正是"中间空白页"的形态。
4. **打印流使用 flex 列布局 + `min-height: 100vh`**
   `@media print` 里 `.print-window-root` 仍是 `display:flex;
   min-height:100vh`。WKWebView 对 flex 容器的跨页分片不可靠，`100vh` 也会引入
   额外高度。
5. **`@page` 嵌套在 `@media print` 内**
   原实现把 `@page { margin: 0 }` 写在 `@media print` 块里（外层还有一个
   `@page { size; margin: 15mm }`），部分 WebKit 版本对嵌套 `@page` 处理不良。

## 修复（`PrintWindow.tsx` / `PrintPreview.tsx`）

把契约改成"一个 `.print-page` 正好等于一张物理纸"，不再依赖任何高度叠加：

1. 打印态改成纯 block 布局：`.print-window-root { display:block;
   min-height:0 }`、`.print-shell { display:block; flex:none; padding:0 }`、
   `.print-stack { display:block }`。
2. 页边距移进纸张自身的 padding：
   ```css
   .print-page {
     width: <pageWidth>mm;
     height: calc(<pageHeight>mm - 0.2mm); /* 吸收亚像素舍入 */
     padding: <margin>mm;
     box-sizing: border-box;
     overflow: hidden;
     break-after: page;        /* + page-break-after: always */
     break-inside: auto;       /* 不再用 avoid，避免卡死 WebKit 分页器 */
   }
   .print-page:last-child { break-after: auto; page-break-after: auto; }
   ```
3. `@page { size: <pageWidth>mm <pageHeight>mm; margin: 0 }` 只保留顶层一条。
4. `PrintPreview.tsx` 不再往生成的页面标记里写内联
   `page-break-after: always`（改由 CSS 统一控制，最后一张自动 `auto`）。

## 验证与限制

- **已做**：用 headless Chrome（Blink）对同一套 HTML/CSS 跑 `--print-to-pdf`，
  `v0_current` 与修复后的几种方案都稳定输出 `pages = .print-page 数量`，说明新
  契约在正常分页引擎下不会回归。
- **未做**：本机无法用 WKWebView 做自动分页验证。尝试过用 Swift 直接调用
  `WKWebView.printOperation(with:)` + `jobDisposition = .save` 落盘 PDF，
  但该路径在这个 CLI 宿主里会**无限输出空页**（1 秒内写出 >10MB 全是空内容流
  的 `/Type /Page`），连一页纯文本都如此，属于工具链问题，不能用于验证。
  因此 WebKit 侧的确认需要在 App 内实际导出一次 PDF。
- **已知副作用**：`overflow: hidden` 会裁掉 `.at-surface` 超出 padding 盒的
  极小部分（≤0.2mm，约 0.75px），肉眼不可见。

## 复现路径（回归验证用）

1. 打开任意多页乐谱，进入打印预览并导出/打印为 PDF。
2. 期望：PDF 页数 == 界面里的页数，没有任何空白页。
