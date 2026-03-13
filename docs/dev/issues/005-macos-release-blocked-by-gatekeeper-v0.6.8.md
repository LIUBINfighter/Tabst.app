# v0.6.8 macOS 发布产物被 Gatekeeper 以“已损坏”拦截

## 定位记录

### 现象
已下载的 `v0.6.8` macOS 安装包在安装或打开后，被系统以“已损坏，应移到废纸篓”之类的提示拦截，无法正常启动。

### 初步判断
这不是“下载文件本身损坏”，而是 macOS Gatekeeper 将该发布产物判定为不可信或签名状态异常后使用的拦截文案。

### 检查范围
- 仓库内 macOS release workflow 是否接入 Apple 分发签名与 notarization
- 已下载的 `0.6.8` DMG 是否可通过镜像校验
- 挂载后 `.app` 本体的 `codesign` / `spctl` 状态
- 下载产物是否带有 quarantine 扩展属性

### 已核验事实

#### 1. 下载的 DMG 文件不是明显损坏文件
- 本地存在 `0.6.8` 的 macOS DMG 下载产物
- `hdiutil verify` 返回校验通过，说明镜像本体可以通过完整性校验

结论：
DMG 不是一个下载残缺或校验失败的损坏文件。

#### 2. 下载产物带有 quarantine 标记
- 下载文件带有 `com.apple.quarantine`

结论：
该产物处于 Gatekeeper 正常接管的下载路径中，系统会对其来源与签名状态进行校验。

#### 3. DMG 挂载后，应用本体可被读取
- 挂载后可见 `Tabst.app`

结论：
镜像结构本身可读，问题不在“无法挂载应用内容”这一层。

#### 4. `codesign` 显示应用为 ad-hoc 签名
对挂载后的 `Tabst.app` 执行签名检查后，关键结果包括：

- `Signature=adhoc`
- `TeamIdentifier=not set`
- `Info.plist=not bound`
- `Sealed Resources=none`

结论：
这不是可对外分发的 Apple Developer ID 应用签名状态，也看不到有效的团队签名身份。

#### 5. `spctl` 直接拒绝该 `.app`
对挂载后的 `Tabst.app` 执行 Gatekeeper assessment，返回错误：

```text
code has no resources but signature indicates they must be present
```

结论：
系统并不是单纯“因为没有 notarization 而提示未知开发者”，而是看到了一个异常的签名/资源状态，并直接拒绝通过 Gatekeeper 校验。

### 与仓库发布流程的对照
当前仓库中的 macOS 发布工作流只明确接入了：
- Tauri updater 公钥注入
- updater 私钥签名
- Tauri build
- updater manifest 生成

但未见明确接入 Apple 分发相关流程，例如：
- Developer ID Application / Installer 签名
- Apple notarization
- stapling

对应文件：
- `src-tauri/tauri.conf.json`
- `.github/workflows/release-mac.yml`

### 当前结论
`v0.6.8` 的 macOS 发布产物存在分发签名问题。

更准确地说：
- DMG 本体校验正常，不是下载损坏
- 但其中的 `Tabst.app` 呈现为 ad-hoc 签名
- Gatekeeper 对该 `.app` 的评估直接失败
- 因此用户侧会看到“已损坏”这类误导性但常见的系统拦截提示

### 敏感信息处理说明
本记录已去除以下内容：
- 本机用户名
- 完整下载来源 URL
- 本地绝对下载路径
- 任何可能关联个人环境的浏览器或系统细节

保留的信息仅限：
- 版本号
- 产物类型
- 与问题定位直接相关的签名状态和系统校验结果

## Issue 草案

### 标题
```md
修复 v0.6.8 macOS 发布产物被 Gatekeeper 以“已损坏”拦截的问题
```

### 正文
```md
## 背景
当前 `v0.6.8` 的 macOS 下载产物在用户安装或打开时，会被系统以“已损坏，应移到废纸篓”之类的提示拦截。

该提示容易被误认为是下载损坏，但实际更可能是 Gatekeeper 对应用签名状态的拒绝。

## 复现方式
1. 下载 `v0.6.8` 的 macOS DMG 产物
2. 挂载并尝试打开其中的 `Tabst.app`
3. 观察系统拦截提示

## 实际结果
- 系统阻止应用启动
- 用户侧表现为“已损坏”或类似提示

## 期望结果
- 用户下载后可正常打开安装产物
- `Tabst.app` 能通过 macOS Gatekeeper 的基础校验
- 发布产物具备可对外分发的有效签名状态

## 已核验证据
- DMG 本体校验通过，不是下载损坏文件
- 下载产物带有 `com.apple.quarantine`
- 挂载后的 `Tabst.app` 经 `codesign` 检查显示为 `adhoc` 签名
- `TeamIdentifier=not set`
- `spctl` 对该 `.app` 返回：

  `code has no resources but signature indicates they must be present`

## 初步判断
当前 macOS 发布流程已接入 Tauri updater 签名，但未形成完整的 Apple 分发签名链路。

至少需要检查：
- 是否缺少 Developer ID 签名
- 是否缺少 notarization
- 是否存在打包后又修改 bundle 内容导致签名失效的问题
- 是否需要在 CI 中显式增加 macOS 发布产物的 `codesign` / `spctl` 验证步骤

## 建议产出
- 明确 macOS 发布所需的 Apple 签名与 notarization 流程
- 修复 `v0.6.8` 或后续版本的 macOS 发布产物签名状态
- 在 release workflow 中加入发布后校验步骤，避免再次发布不可安装产物

## 验收标准
- [ ] 新生成的 macOS 发布产物可被 Gatekeeper 正常评估
- [ ] `codesign` 显示为有效分发签名，而非 ad-hoc
- [ ] `spctl` 不再拒绝应用
- [ ] 用户下载后不再遇到“已损坏”拦截提示

## 相关文件
- `.github/workflows/release-mac.yml`
- `src-tauri/tauri.conf.json`
```
