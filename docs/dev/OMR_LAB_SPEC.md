# Tabst OMR Lab 功能技术规格书

## 1. 项目背景与目标

### 1.1 项目现状
Tabst 是一款基于 Tauri 2 的桌面应用，用于编写和播放 alphaTex 吉他谱。项目已明确将 OMR（光学乐谱识别）列为长期愿景——将 PDF/图片格式的吉他谱转换为可编辑的 alphaTex。

当前 AI/ML 依赖为零，补全系统为纯规则式（静态 JSON + LSP Worker）。

### 1.2 本次目标
在设置界面添加 **实验室（Lab）** 页签，作为 OMR 功能的实验和测试入口，允许用户：
- 粘贴剪贴板图片进行识别
- 从文件系统选择图片
- 拖拽图片到识别区域
- 获取识别后的 alphaTex 文本

### 1.3 本次约束条件（Scope 边界）

| 约束项 | 说明 |
|--------|------|
| **模型质量** | 不追求识别精度。Qwen3.5 0.6B 仅用于跑通端到端流程，后续会替换为专用 OMR 模型 |
| **平台范围** | 仅支持 macOS（当前开发环境）。其他平台（Windows/Linux）不在本次 scope |
| **产品定位** | Lab 是**开发/测试页签**，不是面向用户的产品功能。UI 以实用为主，不需要精致打磨 |
| **流式输出** | MVP 不实现流式 token 输出，返回最终结果即可 |
| **Web 构建** | Lab 功能在 web 运行时下显示"桌面端专属功能"提示，不可用 |

### 1.4 长期愿景
Lab 页签将成为 OMR 功能的孵化场，验证通过后逐步提升为一级功能。

---

## 2. 功能需求

### 2.1 Lab 页签入口
- **位置**：设置界面最后一个页签，在"关于"下方
- **名称**：实验室（Lab）
- **图标**：Flask / Beaker（lucide-react）
- **i18n**：`settings:lab` / `settings:labDesc`

### 2.2 图片输入方式（优先级 P0）
| 方式 | 交互描述 |
|------|---------|
| **粘贴按钮** | 点击"粘贴"按钮，读取系统剪贴板中的图片数据 |
| **文件选择** | 点击"选择图片"按钮，打开文件选择器（支持 png/jpg/jpeg/webp） |
| **拖拽** | 直接拖拽图片到识别区域 |

### 2.3 识别流程（优先级 P0）
```
用户输入图片
    ↓
图片预处理（缩放至模型输入分辨率，base64 编码）
    ↓
调用本地推理服务（llama-server sidecar）
    ↓
返回识别结果（MVP 非流式，直接返回最终结果）
    ↓
alphaTex 输出验证（通过现有 parser/diagnostic 检查）
    ↓
前端渲染 alphaTex 文本（可编辑 + 一键插入编辑器）
```

**注意**：MVP 阶段不实现流式 token 输出。识别结果一次性返回。

### 2.4 UI 组件（优先级 P0）
- **图片预览区**：显示已输入的图片缩略图
- **识别状态**：未开始/处理中/完成/错误
- **结果展示区**：CodeMirror 或 textarea 显示识别出的 alphaTex
- **操作按钮**：
  - "重新识别"（使用同一张图片）
  - "插入编辑器"（将结果插入当前编辑器光标位置）
  - "复制"（复制结果到剪贴板）

### 2.5 模型管理（优先级 P1）
- 首次使用 Lab 功能时检测本地模型是否存在
- 未下载时显示下载按钮，支持显示下载进度
- 支持模型版本切换（未来扩展）

---

## 3. 技术选型

### 3.1 推理引擎：llama.cpp Sidecar

**决策依据**：
- VLM 生态最成熟（LLaVA、Qwen-VL、MiniCPM-V 等已原生支持）
- 崩溃隔离（推理进程崩溃不拖垮主应用）
- 零 FFI 维护负担
- 与 Tauri Sidecar 机制天然契合

**具体方案**：
- 将 `llama-server` 预编译二进制作为 Tauri External Binary
- 安装包仅包含推理引擎（~40MB per platform）
- 模型文件首次运行时从 CDN 下载并缓存

### 3.2 测试模型：Qwen3.5 0.6B GGUF

**选择理由**：
- 0.6B 参数量极小，推理速度快，适合桌面端验证
- **不追求识别精度**，仅用于验证端到端流程跑通
- 后续会替换为专用 OMR 模型（更大、更精确的 VLM）

**模型规格**：
- Base Model: Qwen3.5-VL (0.6B)
- Format: GGUF Q4_K_M
- Expected Size: ~400-500MB
- Context Length: 4096
- Vision Resolution: 448x448

**重要**：llama.cpp VLM 通常需要 **vision projector / mmproj** 文件配合主模型使用。模型产物清单：

| 文件 | 说明 | 大小（估算） |
|------|------|-------------|
| `tabst-omr-v1.gguf` | 主模型（text + vision tower） | ~400-500MB |
| `mmproj-tabst-omr-v1.gguf` | 多模态投影层（mmproj） | ~50-100MB |
| `checksums.sha256` | SHA256 校验文件 | ~200B |

启动参数需同时指定两者：
```bash
llama-server \
  -m tabst-omr-v1.gguf \
  --mmproj mmproj-tabst-omr-v1.gguf \
  --port 18080 --host 127.0.0.1
```

### 3.3 模型下载策略

**双源下载（高可用）**：
1. 主源：`https://huggingface.co/{model_id}/resolve/main/{filename}`
2. 镜像：`https://hf-mirror.com/{model_id}/resolve/main/{filename}`

**策略**：
- 主源超时（5s 连接超时 + 30s 读取超时）自动切换到镜像源
- 支持断点续传（HTTP Range 请求）
- 下载进度通过 Tauri Channel 流式推送到前端

**模型缓存**：
- 路径：`app_local_data_dir/models/`
- 主模型：`tabst-omr-{version}.gguf`
- mmproj：`mmproj-tabst-omr-{version}.gguf`
- 校验文件：`checksums-{version}.sha256`
- 临时下载文件：`tabst-omr-{version}.gguf.tmp`（断点续传）
- 校验：SHA256 校验文件完整性，三者缺一不可

---

## 4. 架构设计

### 4.1 系统架构图

```
┌─────────────────────────────────────────────────────────────┐
│  Renderer (React + TypeScript)                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  LabPage.tsx                                        │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │    │
│  │  │ ImageInput  │  │ StatusPanel │  │ ResultView  │ │    │
│  │  │ - Paste     │  │ - Progress  │  │ - Editor    │ │    │
│  │  │ - Select    │  │ - Error     │  │ - Actions   │ │    │
│  │  │ - DragDrop  │  │             │  │             │ │    │
│  │  └─────────────┘  └─────────────┘  └─────────────┘ │    │
│  └─────────────────────────────────────────────────────┘    │
│                          │ invoke                            │
├──────────────────────────┼───────────────────────────────────┤
│  Tauri Rust Backend       │                                   │
│  ┌───────────────────────┴───────────────────────────────┐  │
│  │  ai_commands.rs (Tauri Commands)                       │  │
│  │  ├── omr_transcribe(image_base64, opts) -> Result     │  │
│  │  ├── get_model_status() -> ModelStatus                │  │
│  │  ├── download_model(version) -> Stream<Progress>      │  │
│  │  └── cancel_omr() -> Result                           │  │
│  └───────────────────────────────────────────────────────┘  │
│                          │ sidecar spawn                     │
│  ┌───────────────────────┴───────────────────────────────┐  │
│  │  ai/sidecar.rs                                         │  │
│  │  ├── ensure_server_running(model_path) -> port        │  │
│  │  ├── stop_server()                                    │  │
│  │  └── health_check(port) -> bool                       │  │
│  └───────────────────────────────────────────────────────┘  │
│                          │ HTTP (localhost)                  │
│  ┌───────────────────────┴───────────────────────────────┐  │
│  │  ai/model_manager.rs                                   │  │
│  │  ├── ensure_model_cached(version) -> PathBuf          │  │
│  │  ├── download_with_fallback(urls) -> Result           │  │
│  │  └── verify_checksum(path, expected) -> bool          │  │
│  └───────────────────────────────────────────────────────┘  │
├──────────────────────────┼───────────────────────────────────┤
│  External Process         │                                   │
│  ┌───────────────────────┴───────────────────────────────┐  │
│  │  llama-server (Sidecar Binary)                         │  │
│  │  └── -m tabst-omr-v1.gguf --mmproj mmproj-*.gguf      │  │
│  │      --port $RANDOM --host 127.0.0.1                   │  │
│  └───────────────────────────────────────────────────────┘  │
└──────────────────────────┴───────────────────────────────────┘
```

### 4.2 模块设计

#### 4.2.1 Rust 后端模块

```
src-tauri/src/
├── lib.rs                      # 注册 ai_commands + LlamaServerState
├── ai/
│   ├── mod.rs                  # pub use ocr_commands, sidecar, model_manager
│   ├── sidecar.rs              # llama-server 进程生命周期管理
│   ├── model_manager.rs        # 模型下载/缓存/校验
│   └── ocr_commands.rs         # Tauri command handlers
```

**新增 Dependencies** (`Cargo.toml`)：
```toml
[dependencies]
reqwest = { version = "0.12", features = ["stream", "rustls-tls"] }
tokio = { version = "1", features = ["fs", "io-util"] }
serde_json = "1.0"
sha2 = "0.10"
hex = "0.4"
```

#### 4.2.2 前端模块

```
src/renderer/
├── components/
│   ├── settings/
│   │   └── LabPage.tsx         # 实验室主页面
│   └── ui/
│       └── image-dropzone.tsx  # 可复用的图片拖放组件
├── lib/
│   ├── desktop-api.ts          # 扩展 ai.* API
│   └── ai-types.ts             # AI 相关类型定义
└── types/
    └── desktop.d.ts            # 扩展 DesktopAPI 接口
```

### 4.3 进程生命周期管理

**Sidecar 状态机**：

```
Stopped
  │ (用户首次进入 Lab 或点击"启动服务")
  ▼
Starting ──► (启动超时 > 30s) ──► Failed
  │ (启动成功)
  ▼
Ready ──► (收到识别请求) ──► Busy(job_id)
  │                        │
  │                        ▼
  │                   (识别完成/取消)
  │                        │
  │                        ▼
  │◄────────────────────── Ready
  │
  │ (用户关闭 Lab 且无活跃任务)
  ▼
Stopping ──► (进程退出) ──► Stopped
```

**关键规则**：
- **懒启动**：用户首次进入 Lab 页面时才启动 sidecar
- **单例**：全局只有一个 sidecar 进程，所有识别请求排队处理
- **随机端口**：使用 `bind(0)` 获取随机空闲端口，避免端口冲突
- **Keep-alive**：Lab 页面关闭后，sidecar 保持运行 5 分钟（idle timeout），期间重新打开 Lab 可立即使用
- **强制退出**：App 退出时无条件 kill sidecar 进程（通过 `tauri::AppHandle` 的 `run` callback）
- **崩溃恢复**：sidecar 崩溃后状态变为 `Failed`，前端显示"服务异常"，提供"重新启动"按钮

**安全设计**：
- Rust 是**唯一**与 llama-server HTTP 通信的实体
- Renderer 只能通过 `invoke` 调用 Tauri commands，无法直接访问 localhost
- 使用随机端口 + 127.0.0.1 绑定，降低被本地其他进程发现的风险

### 4.4 错误处理策略

| 错误场景 | 处理方式 |
|---------|---------|
| 模型下载失败（双源均超时） | 显示错误提示，提供手动导入路径 |
| Sidecar 启动失败（端口占用） | 自动尝试下一个可用端口（随机端口机制） |
| 推理超时（> 60s） | 显示超时提示，允许取消 |
| 模型文件损坏（SHA256 不匹配） | 自动删除并重新下载 |
| 剪贴板无图片 | 显示"剪贴板中没有图片"提示 |
| 图片格式不支持 | 显示支持的格式列表 |
| 磁盘空间不足（下载/缓存时） | 检测可用空间，提前报错 |
| 下载中断（应用退出/网络断开） | 使用 `.tmp` 文件，支持断点续传 |
| 下载中用户取消 | 删除 `.tmp` 文件，清理状态 |
| 识别结果不是有效 alphaTex | 通过 parser/diagnostic 检查，显示错误数量和位置 |
| Sidecar 进程崩溃 | 状态置为 `Failed`，提供"重新启动"按钮 |
| 识别进行中用户关闭 Lab | 识别继续后台运行，下次打开 Lab 可查看结果 |
| 代理/防火墙阻止下载 | 显示网络错误，提供手动导入指引 |

---

## 5. 接口设计

### 5.1 Tauri Commands

```rust
// 获取模型状态
#[tauri::command]
async fn get_model_status(app: AppHandle) -> Result<ModelStatus, String>

// 下载模型（流式进度）
#[tauri::command]
async fn download_model(
    app: AppHandle,
    version: String,
    on_progress: Channel<DownloadProgress>,
) -> Result<(), String>

// OMR 识别（返回 job_id，支持任务级取消）
#[tauri::command]
async fn omr_transcribe(
    app: AppHandle,
    image_base64: String,
    options: Option<OmrOptions>,
) -> Result<String, String>  // 返回 job_id

// 获取识别结果（轮询或 Channel）
#[tauri::command]
async fn get_omr_result(
    app: AppHandle,
    job_id: String,
) -> Result<OmrResult, String>

// 取消指定识别任务
#[tauri::command]
async fn cancel_omr_job(
    app: AppHandle,
    job_id: String,
) -> Result<(), String>

// 获取当前 Sidecar 状态
#[tauri::command]
async fn get_sidecar_status(app: AppHandle) -> Result<SidecarStatus, String>

// 手动重启 Sidecar
#[tauri::command]
async fn restart_sidecar(app: AppHandle) -> Result<(), String>
```

**任务管理设计**：
- `omr_transcribe` 返回 `job_id`，立即返回不阻塞
- 前端轮询 `get_omr_result(job_id)` 获取结果
- 支持 `cancel_omr_job(job_id)` 取消指定任务
- **单并发，拒绝新任务**：已有任务在运行时，新请求返回 `busy` 错误（MVP 不实现排队）
- 任务结果缓存 5 分钟，期间可以重新获取

### 5.2 类型定义

```typescript
// src/renderer/types/ai.ts

export interface ModelStatus {
  version: string;
  downloaded: boolean;
  downloadedBytes: number;
  totalBytes: number;
  checksumVerified: boolean;
}

export interface DownloadProgress {
  phase: 'connecting' | 'downloading' | 'verifying' | 'complete';
  downloadedBytes: number;
  totalBytes: number;
  speedBps?: number;
}

export interface OmrOptions {
  tuning?: string;        // 如 "E4 B3 G3 D3 A2 E2"
  instrument?: string;    // 如 "guitar"
  language?: string;      // 提示词语言
}

export interface OmrResult {
  alphaTex: string;
  rawResponse: string;
  tokensUsed: number;
  durationMs: number;
  diagnosticErrors?: DiagnosticError[];  // 解析错误列表
  isValidAlphaTex: boolean;              // 是否通过 parser 验证
}

export interface DiagnosticError {
  line: number;
  column: number;
  message: string;
  severity: 'error' | 'warning';
}

export interface SidecarStatus {
  state: 'stopped' | 'starting' | 'ready' | 'busy' | 'stopping' | 'failed';
  currentJobId?: string;
  lastError?: string;
}

export interface OmrJob {
  jobId: string;
  status: 'pending' | 'running' | 'completed' | 'cancelled' | 'failed';
  createdAt: number;
  result?: OmrResult;
  error?: string;
}
```

### 5.3 DesktopAPI 扩展

```typescript
// 在 DesktopAPI 中新增
interface DesktopAPI {
  // ... 现有接口
  
  ai: {
    getModelStatus: () => Promise<ModelStatus>;
    downloadModel: (version: string, onProgress: (p: DownloadProgress) => void) => Promise<void>;
    transcribe: (imageBase64: string, options?: OmrOptions) => Promise<string>;  // 返回 job_id
    getOmrResult: (jobId: string) => Promise<OmrJob>;
    cancelOmrJob: (jobId: string) => Promise<void>;
    getSidecarStatus: () => Promise<SidecarStatus>;
    restartSidecar: () => Promise<void>;
  }
}
```

### 5.4 输出验证流程

**验证位置**：前端（Renderer）

原因：现有 alphaTex parser/diagnostic 工具链位于前端（`src/renderer/lib/alphatex-diagnostics.ts` 等），复用成本最低。

```typescript
function validateAlphaTex(raw: string): OmrResult {
  const cleaned = postProcessAlphaTex(raw);
  
  // 使用现有的 AlphaTex parser 进行验证
  const diagnostics = runAlphaTexDiagnostics(cleaned);
  
  return {
    alphaTex: cleaned,
    rawResponse: raw,
    tokensUsed: 0,  // 由后端填充
    durationMs: 0,  // 由后端填充
    diagnosticErrors: diagnostics.errors,
    isValidAlphaTex: diagnostics.errors.length === 0,
  };
}
```

**UI 行为**：
- `isValidAlphaTex === true`：显示"插入编辑器"按钮
- `isValidAlphaTex === false`：显示警告"识别结果包含 X 个语法错误"，仍然允许插入但需要用户确认

---

## 6. Prompt 工程

### 6.1 System Prompt

```
You are an Optical Music Recognition (OMR) engine specialized in guitar tabs.
Convert the provided sheet music image to alphaTex format.

Rules:
1. Output ONLY valid alphaTex syntax, no markdown, no explanations
2. Use standard notation: \title, \artist, \tempo, \instrument
3. Use correct barline syntax: | for measure boundaries
4. Use appropriate note durations: 1 2 4 8 16 s (s for dotted)
5. For guitar: default tuning is E4 B3 G3 D3 A2 E2
6. Use . for dotted notes, : for beat duration prefix
7. Maintain rhythmic accuracy from the source image

Example output:
\title "Example Song"
\tempo 120
.
:4 0.5 1.5 2.5 3.5 4.5 5.5 | 3.3 3.4 3.5 2.5 0.4 1.4 |
```

### 6.2 User Prompt

```
Convert this guitar tab image to alphaTex format.
```

### 6.3 后处理

```typescript
function postProcessAlphaTex(raw: string): string {
  return raw
    .replace(/```alphatex\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();
}
```

---

## 7. 构建与发布

### 7.1 Sidecar 二进制准备

```bash
# scripts/fetch-llama-server.sh
VERSION="b4720"
PLATFORMS=(
  "macos-arm64:aarch64-apple-darwin"
  "macos-x64:x86_64-apple-darwin"
  "linux-x64:x86_64-unknown-linux-gnu"
  "windows-x64:x86_64-pc-windows-msvc"
)

for platform in "${PLATFORMS[@]}"; do
  IFS=':' read -r name target <<< "$platform"
  curl -L "https://github.com/ggml-org/llama.cpp/releases/download/${VERSION}/llama-${VERSION}-bin-${name}.zip" \
    -o "/tmp/llama-${name}.zip"
  unzip "/tmp/llama-${name}.zip" -d "src-tauri/binaries/"
  mv "src-tauri/binaries/llama-server" "src-tauri/binaries/llama-server-${target}"
  chmod +x "src-tauri/binaries/llama-server-${target}"
done
```

### 7.2 `tauri.conf.json` 配置

Tauri 2 的 external binary 命名约定：`{name}-{target-triple}`，运行时通过 `Command::new_sidecar("llama-server")` 自动解析。

```json
{
  "bundle": {
    "externalBin": [
      "binaries/llama-server"
    ]
  }
}
```

**文件放置**：
```
src-tauri/binaries/
├── llama-server-aarch64-apple-darwin   # macOS ARM64 (Apple Silicon)
└── llama-server-x86_64-apple-darwin    # macOS Intel (备用)
```

**运行时解析**：
```rust
let sidecar = app.shell()
    .sidecar("llama-server")  // Tauri 自动按 target triple 匹配
    .map_err(|e| e.to_string())?;
```

### 7.3 CI 集成

在 `.github/workflows/ci.yml` 和 `release.yml` 中：
1. 新增 `fetch-llama-server` 步骤
2. 验证 sidecar 二进制存在且可执行

---

## 8. 性能与资源预算

| 指标 | 预算 | 说明 |
|------|------|------|
| 安装包增量 | ~40MB | llama-server CPU 二进制（macOS） |
| 模型大小 | ~400-500MB（主模型）+ ~50-100MB（mmproj） | Qwen3.5 0.6B Q4_K_M |
| 内存峰值 | ~1.5-2GB | 模型加载 + KV cache + 图像编码 |
| 首次识别延迟 | 目标 < 30s | 含模型加载时间。实验性功能，以实际测量为准 |
| 后续识别延迟 | 目标 < 15s | 模型已在内存 |
| 并发 | 1 | MVP 单并发，新任务返回 busy |

**注意**：以上延迟为观察目标，不是验收标准。Lab 页面会显示进度和取消按钮，用户可接受较长等待。

---

## 9. 安全考量

1. **本地服务绑定**：llama-server 仅绑定 `127.0.0.1`，拒绝外部连接
2. **随机端口**：使用 `bind(0)` 获取随机端口，降低被扫描/发现的风险
3. **Renderer 隔离**：Renderer 无法直接访问 llama-server HTTP 接口。所有 AI 请求必须通过 Tauri `invoke` → Rust 后端代理
4. **模型来源校验**：下载后校验 SHA256，防止中间人攻击
5. **图片数据安全**：base64 图片数据仅在内存中处理，不落盘
6. **进程隔离**：Sidecar 崩溃不影响主应用，防止推理引擎漏洞利用
7. **手动导入校验**：用户手动导入的模型文件必须提供正确的 SHA256 校验值，否则拒绝加载

---

## 10. 实现计划

### Phase 1：基础架构（3-4 天）
- [ ] 创建 `ai/` 模块（sidecar + model_manager）
- [ ] 添加 `tauri.conf.json` externalBin 配置
- [ ] 实现 llama-server 启动/停止/健康检查
- [ ] 实现模型下载（双源 + 断点续传）
- [ ] 添加 i18n 翻译键

### Phase 2：Lab 页面（2-3 天）
- [ ] 扩展 `settings-pages.ts` 添加 lab 页签
- [ ] 扩展 `SettingsSidebar` 添加 lab 图标
- [ ] 创建 `LabPage.tsx`
- [ ] 实现图片输入（粘贴/选择/拖拽）
- [ ] 实现识别状态展示
- [ ] 实现结果展示和操作

### Phase 3：OMR 集成（2-3 天）
- [ ] 实现 `omr_transcribe` Tauri command（返回 job_id）
- [ ] 实现 `get_omr_result` / `cancel_omr_job` / `get_sidecar_status`
- [ ] 扩展 `desktop-api.ts` 添加 ai.* 接口（含 web fallback）
- [ ] Prompt 工程与后处理
- [ ] 输出验证（集成现有 alphaTex parser/diagnostic）

### Phase 4：构建与测试（1 天）
- [ ] 创建 `fetch-llama-server.sh`（仅 macOS ARM64/x64）
- [ ] CI 集成（验证 sidecar 二进制存在）
- [ ] macOS 本地测试（启动/识别/崩溃恢复）
- [ ] Web 运行时 fallback 验证

**总计：7-10 天**

### Web 运行时 Fallback

Lab 功能在 web 运行时下不可用。`desktop-api.ts` 中需要实现：

```typescript
ai: {
  getModelStatus: async () => ({ 
    downloaded: false, 
    error: 'desktop-only' 
  }),
  transcribe: async () => { 
    throw new Error('OMR Lab is only available in desktop app'); 
  },
  // ... 其他方法同样返回 desktop-only 错误
}
```

前端 `LabPage.tsx` 在 web 环境下显示：
> "实验室功能仅在桌面端可用。请下载 Tabst 桌面应用以体验 OMR 功能。"

---

## 11. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| **模型识别效果差** | 低 | 本次不追求精度，仅验证流程。0.6B 模型跑通后替换为专用模型 |
| **llama-server 在 macOS 启动失败** | 中 | 提供详细错误日志；随机端口避免冲突；提供手动重启按钮 |
| **模型下载在中国大陆地区慢/失败** | 中 | hf-mirror.com 镜像；支持用户手动导入模型文件 |
| **内存不足导致推理失败** | 中 | 检测可用内存，小于 2GB 时提示用户关闭其他应用 |
| **Sidecar 进程泄漏** | 低 | App 退出时强制 kill；idle timeout 5 分钟后自动停止 |
| **mmproj/vision encoder 文件缺失** | 高 | 模型清单明确定义所有必需文件，下载时校验完整性 |
| **识别结果不是有效 alphaTex** | 中 | 通过 parser/diagnostic 验证，显示错误数量和位置 |
| **Web 运行时功能不可用** | 低 | 已设计 fallback，显示 desktop-only 提示 |

---

## 附录

### A. 参考链接
- [Tauri Sidecar 文档](https://tauri.app/develop/sidecar/)
- [llama.cpp  releases](https://github.com/ggml-org/llama.cpp/releases)
- [Qwen-VL 文档](https://qwen.readthedocs.io/en/latest/)
- [hf-mirror.com](https://hf-mirror.com/)

### B. 模型信息

**Model ID**: `Qwen/Qwen3.5-VL-0.6B-Instruct`（待确认 Hugging Face 实际 ID）

**模型产物清单**：

| 文件 | 说明 | 大小（估算） | 必需 |
|------|------|-------------|------|
| `tabst-omr-v1.gguf` | 主模型（text + vision tower） | ~400-500MB | ✅ |
| `mmproj-tabst-omr-v1.gguf` | 多模态投影层（mmproj） | ~50-100MB | ✅ |
| `checksums.sha256` | SHA256 校验文件 | ~200B | ✅ |

**GGUF 转换流程**：
```bash
# 1. 从 Hugging Face 下载原始模型
huggingface-cli download Qwen/Qwen3.5-VL-0.6B-Instruct

# 2. 转换为 GGUF
python convert_hf_to_gguf.py ./Qwen3.5-VL-0.6B-Instruct \
  --outfile tabst-omr-v1.gguf \
  --outtype q4_k_m

# 3. mmproj 文件（如有单独提供）
# 某些 VLM 模型需要单独转换 vision encoder
```

**启动参数**：
```bash
llama-server \
  -m tabst-omr-v1.gguf \
  --mmproj mmproj-tabst-omr-v1.gguf \
  --port $RANDOM_PORT \
  --host 127.0.0.1 \
  -np 1 \
  --ctx-size 4096
```

### C. 文件变更清单

```
# 新增文件
src-tauri/src/ai/mod.rs                        # AI 模块入口
src-tauri/src/ai/sidecar.rs                    # Sidecar 进程管理（含状态机）
src-tauri/src/ai/model_manager.rs              # 模型下载/缓存/校验（双源下载）
src-tauri/src/ai/ocr_commands.rs               # OMR Tauri commands（job-scoped）
src-tauri/src/ai/job_manager.rs                # 任务队列管理（单并发）
src-tauri/binaries/llama-server-aarch64-apple-darwin  # macOS ARM64 sidecar
src-tauri/binaries/llama-server-x86_64-apple-darwin   # macOS x64 sidecar
src/renderer/components/settings/LabPage.tsx   # 实验室主页面
src/renderer/components/ui/image-dropzone.tsx  # 图片拖放组件（可复用）
src/renderer/hooks/useOmrJob.ts                # OMR 任务状态管理 hook
src/renderer/lib/ai-types.ts                   # AI 类型定义
src/renderer/types/ai.ts                       # 共享 AI 类型
scripts/fetch-llama-server.sh                  # 下载 llama-server 脚本（macOS only）

# 修改文件
src-tauri/Cargo.toml                           # 添加 reqwest, tokio, sha2, hex
src-tauri/tauri.conf.json                      # 添加 externalBin
src-tauri/src/lib.rs                           # 注册 ai 模块 + LlamaServerState
src-tauri/capabilities/default.json            # 添加 shell:allow-execute
src/renderer/components/SettingsView.tsx       # 添加 lab case
src/renderer/components/SettingsSidebar.tsx    # 添加 lab 图标
src/renderer/components/settings-pages.ts      # 添加 lab 页签配置
src/renderer/lib/desktop-api.ts                # 扩展 ai.* API + web fallback
src/renderer/lib/tauri-desktop-api.ts          # 添加 ai Tauri commands
src/renderer/types/desktop.d.ts                # 扩展 DesktopAPI 接口
src/renderer/i18n/locales/en/settings.json     # 添加 lab 翻译键
src/renderer/i18n/locales/zh-cn/settings.json  # 添加 lab 翻译键
```

---

**文档版本**: v1.2 (Implementation Ready)  
**创建日期**: 2025-05-01  
**更新日期**: 2025-05-01  
**作者**: Sisyphus (AI Agent)  
**状态**: ✅ 已通过 Oracle 二审，实现就绪
