# 自动更新功能实现日志

**日期**: 2026-01-22  
**功能**: Windows 应用自动更新（基于 electron-builder + electron-updater）  
**状态**: ✅ 已完成并测试通过（0.1.2 → 0.1.3）

---

## 目标

实现 Windows 桌面应用的自动更新功能，让用户无需手动下载新版本，应用启动时自动检测并下载更新，提示用户安装。

---

## 技术选型

### 初始状态

- 使用 **electron-forge** 进行打包
- 只能生成 ZIP 便携版和 DMG（macOS）
- 无自动更新机制

### 最终方案

- **electron-builder**: 构建工具（生成 NSIS 安装器）
- **electron-updater**: 自动更新客户端（从 GitHub Releases 获取更新）
- **GitHub Releases**: 更新服务器（发布 artifacts 和元数据）

---

## 实现步骤

### 1. 迁移到 electron-builder

**修改文件**: `package.json`

添加依赖：

```json
{
  "dependencies": {
    "electron-log": "^5.4.3",
    "electron-updater": "^6.7.3"
  },
  "devDependencies": {
    "electron-builder": "^24.9.0"
  }
}
```

添加构建配置：

```json
{
  "build": {
    "appId": "com.liubin.tabst",
    "productName": "Tabst",
    "directories": {
      "output": "dist"
    },
    "win": {
      "target": [
        { "target": "nsis", "arch": ["x64"] },
        { "target": "zip", "arch": ["x64"] }
      ],
      "artifactName": "${productName}-${version}-win-${arch}.${ext}"
    },
    "nsis": {
      "oneClick": false,
      "perMachine": false,
      "allowToChangeInstallationDirectory": true
    },
    "publish": [
      {
        "provider": "github",
        "owner": "LIUBINfighter",
        "repo": "Tabst.app"
      }
    ]
  }
}
```

> **注意**: 示例中不要使用 `${name}` 作为 artifact 模板占位符（例如 `Tabst-${version}-windows-${arch}-${name}.${ext}`），因为 `${name}` 来自 `package.json` 的 `name` 字段（通常是小写的 `tabst`），会导致类似 `Tabst-0.1.3-win-x64-tabst.exe` 的重复命名。建议使用 `${productName}` 或直接移除 `${name}` 来获得更简洁的文件名。

添加脚本：

```json
{
  "scripts": {
    "dist": "electron-builder --publish never",
    "dist:win": "electron-builder --win --x64 --publish never"
  }
}
```

### 2. 创建自动更新模块

**新增文件**: `src/main/autoUpdater.ts`

核心逻辑：

- 仅在 Windows 打包环境启用
- 自动下载更新（支持增量下载）
- 允许 prerelease 版本更新（`allowPrerelease: true`）
- 详细日志记录（electron-log）
- 下载完成后弹窗提示用户

关键配置：

```typescript
autoUpdater.autoDownload = true;
autoUpdater.allowPrerelease = true;
```

事件监听：

- `checking-for-update`: 检查更新
- `update-available`: 发现更新
- `download-progress`: 下载进度
- `update-downloaded`: 下载完成 → 弹窗提示用户
- `error`: 错误处理

### 3. 集成到主进程

**修改文件**: `src/main/main.ts`

```typescript
import { initAutoUpdater } from "./autoUpdater";

app.whenReady().then(() => {
  createWindow();
  initAutoUpdater();
});
```

### 4. 更新 CI/CD 工作流

**修改文件**: `.github/workflows/release.yml`

```yaml
- name: Run electron-builder for Windows (NSIS)
  run: pnpm dist:win

- name: Create Draft Release and upload Windows artifacts
  uses: softprops/action-gh-release@v2
  with:
    files: |
      dist/*.exe
      dist/*.zip
      dist/*.blockmap
      dist/latest.yml
    draft: true
```

关键产物：

- `*.exe`: NSIS 安装器
- `*.exe.blockmap`: 增量更新映射文件
- `latest.yml`: electron-updater 元数据

### 5. 统一发布产物命名规范

**命名格式**: `{AppName}-{Version}-{Platform}-{Arch}-{Type}.{ext}`

示例：

- Windows 安装器: `Tabst-0.1.3-windows-x64-nsis.exe`
- Windows 便携版: `Tabst-0.1.3-windows-x64-zip.zip`
- macOS 安装器: `Tabst-0.1.3-macos-arm64.dmg`
- macOS 便携版: `Tabst-0.1.3-macos-arm64-portable.zip`

---

## 遇到的问题与解决方案

### 问题 1: 依赖版本不匹配

**现象**: `electron-log@^6.4.0` 在 npmmirror 找不到  
**解决**: 降级到可用版本 `electron-log@^5.4.3`

### 问题 2: electron-updater 版本过低

**现象**: `electron-updater@^5.4.0` 不存在  
**解决**: 升级到最新版本 `electron-updater@^6.7.3`

### 问题 3: Release 产物过多（92 个文件）

**现象**: 初次配置时上传了所有 unpacked 文件（.pak, .dll 等）  
**解决**: 修改 workflow，只上传必要文件（.exe, .blockmap, latest.yml, .zip）

### 问题 4: Draft Release 导致更新检测失败

**现象**: electron-updater 无法从 draft release 读取更新  
**解决**: 手动发布 release 为 published（或修改 workflow 为 `draft: false`）

### 问题 5: 自动更新下载后无提示

**现象**: 日志显示下载开始但没有完成记录  
**解决**: 添加完整的事件监听（`download-progress`, `update-downloaded`, `error`）和详细日志

### 问题 6: macOS 产物命名不一致

**现象**: `Tabst-darwin-arm64-0.1.1-dev-4.zip` 与其他平台格式不同  
**解决**: 在 CI 中添加重命名步骤，统一为 `Tabst-{version}-macos-{arch}-portable.zip`

---

## 测试验证

### 测试场景

- **起始版本**: 0.1.2
- **目标版本**: 0.1.3
- **平台**: Windows 10/11 x64

### 测试步骤

1. 安装 `Tabst-0.1.2-windows-x64-nsis.exe`
2. 发布 `0.1.3` release（published）
3. 启动应用，等待 2 秒
4. 观察日志：`%APPDATA%\Tabst\logs\main.log`

### 测试结果 ✅

```
[2026-01-22 01:58:33.422] [info] Checking for update
[2026-01-22 01:58:38.949] [info] Found version 0.1.3
[2026-01-22 01:58:38.949] [info] Downloading update from Tabst-0.1.3-windows-x64-nsis.exe
[2026-01-22 01:58:42.376] [info] Full: 205,444.08 KB, To download: 109,279.58 KB (53%)
[2026-01-22 01:58:42.379] [info] Differential download: ...
[成功] 下载完成，弹窗提示用户安装
[成功] 用户确认后，应用重启并安装 0.1.3
```

**关键特性验证**：

- ✅ 自动检测更新（启动后 2 秒）
- ✅ 增量下载（只下载 53% 的数据）
- ✅ 下载完成提示弹窗
- ✅ 用户确认后静默安装并重启
- ✅ 详细日志记录完整流程

---

## 代码架构

```
src/main/
├── main.ts              # 主进程入口，调用 initAutoUpdater()
└── autoUpdater.ts       # 自动更新逻辑封装
    ├── 平台检测
    ├── 配置初始化
    ├── 事件监听
    ├── 日志记录
    └── 用户交互（弹窗）
```

---

## 发布流程

### 开发者操作

1. 更新 `package.json` 中的 `version`
2. 提交代码并打 tag：`git tag 0.1.x && git push origin --tags`
3. CI 自动构建并上传 artifacts 到 GitHub Release（draft）
4. 手动在 GitHub 发布 release（或配置 `draft: false` 自动发布）

### 用户体验

1. 启动应用
2. 后台自动检测更新（无感知）
3. 发现更新后自动下载（进度日志可查）
4. 下载完成弹窗提示："A new update has been downloaded. Install and restart now?"
5. 用户点击 "Install and Restart" → 自动安装并重启到新版本

---

## 配置文件清单

- ✅ `package.json` - electron-builder 配置
- ✅ `src/main/autoUpdater.ts` - 自动更新逻辑
- ✅ `src/main/main.ts` - 主进程集成
- ✅ `.github/workflows/release.yml` - Windows CI
- ✅ `.github/workflows/release-mac.yml` - macOS CI

---

## 后续优化建议

### 短期（可选）

1. **代码签名**: 购买 Windows 代码签名证书，提升安装器信任度，消除 SmartScreen 警告
2. **进度展示**: 在应用 UI 显示下载进度条（可通过 IPC 通信）
3. **自动发布**: 把 workflow 改为 `draft: false`，减少手动操作

### 长期（可选）

1. **macOS 自动更新**: 为 macOS 添加自动更新支持（需签名和 notarize）
2. **更新策略**: 添加"跳过此版本"、"稍后提醒"等选项
3. **增量更新优化**: 配置更细粒度的 blockmap 以减少下载量
4. **更新服务器**: 如需更高可控性，可迁移到自托管更新服务器（如 Nuts）

---

## 参考资料

- [electron-builder 官方文档](https://www.electron.build/)
- [electron-updater API](https://www.electron.build/auto-update)
- [GitHub Releases as Update Server](https://www.electron.build/configuration/publish#githuboptions)
- [NSIS Configuration](https://www.electron.build/configuration/nsis)
