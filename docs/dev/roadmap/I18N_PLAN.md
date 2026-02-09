# i18n 适配建议方案

## 一、当前代码库分析

### 1.1 现状
- ✅ **教程系统已支持多语言**：`src/renderer/data/tutorials/` 下有 `en/` 和 `zh-cn/` 目录
- ❌ **UI 文本全部硬编码为中文**：分布在各个组件中
- ❌ **未使用任何 i18n 库**：`package.json` 中无 i18n 相关依赖
- ⚠️ **部分日期本地化**：`UpdatesPage.tsx` 中使用了 `toLocaleDateString("zh-CN")`

### 1.2 需要国际化的文本类型

#### 核心 UI 文本（约 100+ 处）
- **底部工具栏** (`GlobalBottomBar.tsx`)：
  - 播放控制：播放、暂停、停止、刷新
  - 缩放控制：缩小、放大、缩放百分比
  - 节拍器：开启节拍器、关闭节拍器
  - 播放速度：播放速度
  - 教程导航：前一页、后一页、使用 ← → 键翻页

- **侧边栏** (`Sidebar.tsx`)：
  - 操作按钮：打开文件、新建 .atex、新建 .md、切换主题
  - 文件列表：暂无文件、重命名、在文件管理器中显示
  - 底部按钮：教程、设置、进入教程、退出教程

- **设置页面** (`SettingsView.tsx`, `settings-pages.ts`)：
  - 页面标题：外观、播放、更新、路线图、关于
  - 页面描述：主题与界面显示相关设置、播放速度与模式相关设置等

- **打印预览** (`PrintPreview.tsx`, `PrintTracksPanel.tsx`)：
  - 打印控制：打印、关闭、打开音轨选择、关闭音轨选择
  - 音轨配置：五线、六线谱、标准记谱法、斜线记谱法、简谱
  - 布局控制：自动、调整曲谱缩放比例、重置为自动、重置为标准、全选、仅第一个

- **错误消息** (`alphatab-error.ts`)：
  - 未知错误、Lexer diagnostics、Parser diagnostics、Semantic diagnostics

- **其他组件**：
  - 教程相关：快速开始、编辑器基础、AlphaTeX 教程
  - 更新页面：检查中...、检查更新、加载中...、刷新、当前环境不支持更新检查
  - 更新提示：更新已下载完成、当前已是最新版本

## 二、推荐方案

### 2.1 技术选型

**推荐使用 `react-i18next` + `i18next`**

**理由：**
1. ✅ **成熟稳定**：React 生态中最流行的 i18n 解决方案
2. ✅ **TypeScript 支持好**：有完整的类型定义
3. ✅ **功能完整**：支持命名空间、复数、插值、上下文等高级特性
4. ✅ **性能优秀**：支持懒加载、代码分割
5. ✅ **社区活跃**：文档完善，问题容易解决
6. ✅ **与现有架构兼容**：可与 Zustand 配合使用

**替代方案：**
- `next-intl`：仅适用于 Next.js
- `react-intl`：功能类似，但 API 较复杂
- 自建方案：维护成本高，不推荐

### 2.2 安装依赖

```bash
pnpm add i18next react-i18next
pnpm add -D @types/i18next
```

## 三、实施步骤

### 3.1 目录结构

```
src/renderer/
├── i18n/
│   ├── index.ts              # i18n 初始化配置
│   ├── locales/
│   │   ├── en/
│   │   │   ├── common.json      # 通用文本
│   │   │   ├── sidebar.json     # 侧边栏
│   │   │   ├── toolbar.json     # 底部工具栏
│   │   │   ├── settings.json    # 设置页面
│   │   │   ├── print.json       # 打印相关
│   │   │   ├── errors.json      # 错误消息
│   │   │   └── tutorials.json   # 教程元数据
│   │   └── zh-cn/
│   │       ├── common.json
│   │       ├── sidebar.json
│   │       ├── toolbar.json
│   │       ├── settings.json
│   │       ├── print.json
│   │       ├── errors.json
│   │       └── tutorials.json
│   └── types.ts             # TypeScript 类型定义（可选）
```

### 3.2 初始化 i18n

**`src/renderer/i18n/index.ts`**

```typescript
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enCommon from './locales/en/common.json';
import enSidebar from './locales/en/sidebar.json';
import enToolbar from './locales/en/toolbar.json';
import enSettings from './locales/en/settings.json';
import enPrint from './locales/en/print.json';
import enErrors from './locales/en/errors.json';
import enTutorials from './locales/en/tutorials.json';
import zhCnCommon from './locales/zh-cn/common.json';
import zhCnSidebar from './locales/zh-cn/sidebar.json';
import zhCnToolbar from './locales/zh-cn/toolbar.json';
import zhCnSettings from './locales/zh-cn/settings.json';
import zhCnPrint from './locales/zh-cn/print.json';
import zhCnErrors from './locales/zh-cn/errors.json';
import zhCnTutorials from './locales/zh-cn/tutorials.json';

const resources = {
  en: {
    common: enCommon,
    sidebar: enSidebar,
    toolbar: enToolbar,
    settings: enSettings,
    print: enPrint,
    errors: enErrors,
    tutorials: enTutorials,
  },
  'zh-cn': {
    common: zhCnCommon,
    sidebar: zhCnSidebar,
    toolbar: zhCnToolbar,
    settings: zhCnSettings,
    print: zhCnPrint,
    errors: zhCnErrors,
    tutorials: zhCnTutorials,
  },
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'zh-cn', // 默认语言
    fallbackLng: 'en', // 回退语言
    defaultNS: 'common', // 默认命名空间
    interpolation: {
      escapeValue: false, // React 已经转义
    },
    // 开发模式下输出调试信息
    debug: import.meta.env.DEV,
  });

export default i18n;
```

### 3.3 在 App 中初始化

**`src/renderer/main.tsx`**

```typescript
import './i18n'; // 在 React 应用启动前初始化 i18n
import { StrictMode } from 'react';
// ... 其他导入
```

### 3.4 语言切换功能

**在 Zustand Store 中添加语言状态**

```typescript
// src/renderer/store/appStore.ts
interface AppState {
  // ... 现有状态
  locale: 'en' | 'zh-cn';
  setLocale: (locale: 'en' | 'zh-cn') => void;
}

// 实现
setLocale: (locale) => {
  set({ locale });
  i18n.changeLanguage(locale);
  // 持久化到 localStorage
  try {
    localStorage.setItem('locale', locale);
  } catch {}
},
```

**在应用启动时恢复语言设置**

```typescript
// src/renderer/App.tsx
useEffect(() => {
  const savedLocale = localStorage.getItem('locale') as 'en' | 'zh-cn' | null;
  if (savedLocale && (savedLocale === 'en' || savedLocale === 'zh-cn')) {
    useAppStore.getState().setLocale(savedLocale);
  }
}, []);
```

### 3.5 翻译文件示例

**`src/renderer/i18n/locales/zh-cn/toolbar.json`**

```json
{
  "play": "播放",
  "pause": "暂停",
  "stop": "停止",
  "refresh": "刷新",
  "zoomIn": "放大",
  "zoomOut": "缩小",
  "zoomPercent": "缩放百分比",
  "playbackSpeed": "播放速度",
  "metronome": {
    "label": "节拍器",
    "enable": "开启节拍器",
    "disable": "关闭节拍器"
  },
  "tutorial": {
    "prev": "前一页",
    "next": "后一页",
    "keyboardHint": "使用 ← → 键翻页"
  }
}
```

**`src/renderer/i18n/locales/en/toolbar.json`**

```json
{
  "play": "Play",
  "pause": "Pause",
  "stop": "Stop",
  "refresh": "Refresh",
  "zoomIn": "Zoom In",
  "zoomOut": "Zoom Out",
  "zoomPercent": "Zoom Percentage",
  "playbackSpeed": "Playback Speed",
  "metronome": {
    "label": "Metronome",
    "enable": "Enable Metronome",
    "disable": "Disable Metronome"
  },
  "tutorial": {
    "prev": "Previous",
    "next": "Next",
    "keyboardHint": "Use ← → keys to navigate"
  }
}
```

### 3.6 组件中使用示例

**改造前（`GlobalBottomBar.tsx`）：**

```tsx
<TooltipContent side="top">
  <p>播放</p>
</TooltipContent>
```

**改造后：**

```tsx
import { useTranslation } from 'react-i18next';

function GlobalBottomBar() {
  const { t } = useTranslation('toolbar');
  
  return (
    <TooltipContent side="top">
      <p>{t('play')}</p>
    </TooltipContent>
  );
}
```

**带插值的示例：**

```tsx
// 翻译文件
{
  "tutorialPrev": "前一页：{{title}} (← 键)"
}

// 组件中
<p>{t('tutorialPrev', { title: prevTutorial.title })}</p>
```

## 四、迁移策略

### 4.1 分阶段迁移（推荐）

**阶段 1：基础设施搭建（1-2 天）**
1. 安装依赖
2. 创建 i18n 配置和目录结构
3. 创建基础翻译文件（先只创建结构，内容可先用中文占位）
4. 在 App 中初始化 i18n

**阶段 2：核心组件迁移（3-5 天）**
1. 迁移 `GlobalBottomBar.tsx`（底部工具栏）
2. 迁移 `Sidebar.tsx`（侧边栏）
3. 迁移 `SettingsView.tsx` 和 `settings-pages.ts`（设置页面）
4. 添加语言切换 UI（可在设置页面添加）

**阶段 3：其他组件迁移（2-3 天）**
1. 迁移 `PrintPreview.tsx` 和 `PrintTracksPanel.tsx`
2. 迁移错误处理 `alphatab-error.ts`
3. 迁移其他小组件

**阶段 4：完善和测试（1-2 天）**
1. 完善英文翻译
2. 测试所有功能
3. 处理边界情况（如动态文本、日期格式化等）

### 4.2 迁移工具脚本（可选）

可以创建一个脚本来自动提取硬编码的中文文本：

```typescript
// scripts/extract-i18n-strings.ts
// 使用 AST 解析器（如 @babel/parser）扫描组件文件
// 提取字符串字面量中的中文文本
// 生成翻译文件的骨架
```

## 五、注意事项

### 5.1 与现有架构的集成

1. **Zustand Store**：
   - 语言设置应存储在 Zustand 中，便于全局访问
   - 语言切换时调用 `i18n.changeLanguage()`

2. **教程系统**：
   - 教程元数据（`tutorials/index.ts`）需要国际化
   - 教程内容本身（MDX 文件）已经按语言目录组织，无需改动

3. **日期格式化**：
   - 使用 `i18next` 的日期格式化功能或 `Intl.DateTimeFormat`
   - 根据当前语言设置日期格式

### 5.2 性能考虑

1. **懒加载**：对于大型应用，可以使用 `i18next` 的懒加载功能
2. **代码分割**：按命名空间分割，减少初始加载体积
3. **缓存**：翻译文件可以缓存到 localStorage

### 5.3 类型安全（可选）

可以使用 `i18next-resources-for-ts` 或手动创建类型定义：

```typescript
// src/renderer/i18n/types.ts
export type TranslationKeys = 
  | 'toolbar.play'
  | 'toolbar.pause'
  | 'sidebar.openFile'
  // ... 其他键
```

### 5.4 测试

1. **单元测试**：测试翻译键是否存在
2. **E2E 测试**：测试语言切换功能
3. **视觉回归测试**：确保不同语言下 UI 布局正常

## 六、实施优先级

### 高优先级（必须）
1. ✅ 底部工具栏（`GlobalBottomBar.tsx`）
2. ✅ 侧边栏（`Sidebar.tsx`）
3. ✅ 设置页面（`SettingsView.tsx`）
4. ✅ 语言切换功能

### 中优先级（重要）
1. ⚠️ 打印预览（`PrintPreview.tsx`）
2. ⚠️ 错误消息（`alphatab-error.ts`）
3. ⚠️ 更新页面（`UpdatesPage.tsx`）

### 低优先级（可选）
1. ⚪ 教程元数据（已有英文版本）
2. ⚪ 其他小组件

## 七、预期工作量

- **总工作量**：约 7-12 个工作日
- **代码量**：约 50-80 个文件需要修改
- **翻译条目**：约 150-200 条

## 八、后续维护

1. **新增文本**：统一使用 `t()` 函数，禁止硬编码
2. **翻译审查**：英文翻译需要母语者审查
3. **CI/CD**：可以添加检查，确保所有翻译键都有对应的翻译

## 九、参考资源

- [react-i18next 官方文档](https://react.i18next.com/)
- [i18next 官方文档](https://www.i18next.com/)
- [TypeScript 类型支持](https://github.com/i18next/i18next-http-backend)
