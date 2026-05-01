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
| **模型质量** | 不追求识别精度。当前 SmolVLM 500M GGUF 仅用于跑通端到端流程，后续会替换为专用 OMR 模型 |
| **平台范围** | 仅支持 macOS（当前开发环境）。其他平台（Windows/Linux）不在本次 scope |
| **产品定位** | Lab 是**开发/测试页签**，不是面向用户的产品功能。UI 以实用为主，不需要精致打磨 |
| **流式输出** | MVP 不实现流式 token 输出，返回最终结果即可 |
| **Web 构建** | Lab 功能在 web 运行时下显示"桌面端专属功能"提示，不可用 |

### 1.4 长期愿景
Lab 页签将成为 OMR 功能的孵化场，验证通过后逐步提升为一级功能。

### 1.5 当前实现状态（2026-05-01）

本规格已经落地为 macOS-only OMR Lab MVP，并通过端到端手动测试。与早期设计草案相比，当前实现有几处关键调整：

- 默认模型使用公开可下载的 `ggml-org/SmolVLM-500M-Instruct-GGUF`，而不是早期草案中的 Qwen3.5 0.6B 占位模型。
- llama.cpp sidecar 使用 release `b8989`，因为旧 `b4720` 的 `llama-server` 不支持服务端 `--mmproj`。
- `src-tauri/binaries/` 不提交生成的 sidecar 二进制；脚本会自动下载 `llama-server` 以及 `libggml` / `libllama` / `libmtmd` 动态库。
- Rust 运行时调用 `.sidecar("llama-server")`，权限名也是 `llama-server`。不要写成 `binaries/llama-server`，Tauri 会在运行时相对可执行文件目录解析 sidecar。
- OMR 请求使用 llama.cpp `/completions`，并通过 `LLAMA_MEDIA_MARKER=<__media__>` + `prompt.multimodal_data` 传图；不要在未重新验证 marker 行为前切回 `/v1/chat/completions`。

操作手册见 [OMR_LAB_RUNBOOK.md](./OMR_LAB_RUNBOOK.md)。

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
- 开发/构建脚本自动下载 `llama-server` 及其 macOS `.dylib` 依赖，生成文件不入库
- 安装包包含当前架构的推理引擎与动态库依赖
- 模型文件首次运行时从 CDN 下载并缓存

### 3.2 测试模型：SmolVLM 500M GGUF

**选择理由**：
- 500M 级别参数量较小，推理速度适合桌面端验证
- `ggml-org/SmolVLM-500M-Instruct-GGUF` 已提供 llama.cpp 可直接下载的 GGUF 与 mmproj 文件
- **不追求识别精度**，仅用于验证端到端流程跑通
- 后续会替换为专用 OMR 模型（更大、更精确的 VLM）

**模型规格**：
- Base Model: SmolVLM-500M-Instruct
- Format: GGUF Q8_0（当前公开测试模型）
- Expected Size: 约 500MB 级别（以 manifest 为准）
- Context Length: 4096
- Vision Resolution: 448x448

**重要**：llama.cpp VLM 通常需要 **vision projector / mmproj** 文件配合主模型使用。模型产物清单：

| 文件 | 说明 | 大小（估算） |
|------|------|-------------|
| `SmolVLM-500M-Instruct-Q8_0.gguf` | 主模型（text + vision tower） | 以 manifest 为准 |
| `mmproj-SmolVLM-500M-Instruct-Q8_0.gguf` | 多模态投影层（mmproj） | 以 manifest 为准 |
| `model-manifest.json` | 模型清单文件（含文件名、SHA256、大小） | ~1KB |

启动参数需同时指定两者：
```bash
llama-server \
  -m SmolVLM-500M-Instruct-Q8_0.gguf \
  --mmproj mmproj-SmolVLM-500M-Instruct-Q8_0.gguf \
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
- 主模型：manifest 中 `type: "main"` 的 GGUF 文件
- mmproj：manifest 中 `type: "mmproj"` 的 GGUF 文件
- 清单文件：`model-manifest.json`（含所有文件的 SHA256 校验值）
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
│  │  ai_ocr_commands.rs (Tauri Commands)                   │  │
│  │  ├── omr_transcribe(image_base64, opts) -> Result     │  │
│  │  ├── get_model_status() -> ModelStatus                │  │
│  │  ├── download_model(version) -> Stream<Progress>      │  │
│  │  └── cancel_omr() -> Result                           │  │
│  └───────────────────────────────────────────────────────┘  │
│                          │ sidecar spawn                     │
│  ┌───────────────────────┴───────────────────────────────┐  │
│  │  ai_sidecar.rs                                         │  │
│  │  ├── ensure_server_running(model_path) -> port        │  │
│  │  ├── stop_server()                                    │  │
│  │  └── health_check(port) -> bool                       │  │
│  └───────────────────────────────────────────────────────┘  │
│                          │ HTTP (localhost)                  │
│  ┌───────────────────────┴───────────────────────────────┐  │
│  │  ai_model_manager.rs                                   │  │
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

Tabst 使用 flat 模块结构（所有模块文件平铺在 `src-tauri/src/` 下，不使用子目录）：

```
src-tauri/src/
├── lib.rs                      # 注册 ai 模块 + LlamaServerState
├── ai_sidecar.rs               # llama-server 进程生命周期管理
├── ai_model_manager.rs         # 模型下载/缓存/校验
├── ai_ocr_commands.rs          # OMR Tauri command handlers
└── ai_job_manager.rs           # 任务状态管理（单并发）
```

**注册方式**（在 `lib.rs` 中遵循现有模式）：
```rust
// 1. 声明模块
mod ai_sidecar;
mod ai_model_manager;
mod ai_ocr_commands;
mod ai_job_manager;

// 2. 导入命令
use ai_ocr_commands::{
    get_model_status,
    download_model,
    omr_transcribe,
    get_omr_result,
    cancel_omr_job,
    get_sidecar_status,
    restart_sidecar,
};

// 3. 注册 State 和 Commands
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(RepoWatchManager::default())
        .manage(KeepAwakeManager::default())
        .manage(LlamaServerState::default())  // 新增
        .invoke_handler(tauri::generate_handler![
            // ... 现有命令
            get_model_status,
            download_model,
            omr_transcribe,
            get_omr_result,
            cancel_omr_job,
            get_sidecar_status,
            restart_sidecar,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**新增 Dependencies** (`Cargo.toml`)：
```toml
[dependencies]
reqwest = { version = "0.12", features = ["stream", "rustls-tls"] }
tokio = { version = "1", features = ["fs", "io-util"] }
serde_json = "1.0"
sha2 = "0.10"
hex = "0.4"
tauri-plugin-shell = "2"
```

**前端依赖** (`package.json`)：
```json
{
  "dependencies": {
    "@tauri-apps/plugin-shell": "^2.0.0"
  }
}
```

**Shell 插件注册** (`src-tauri/src/lib.rs`)：
```rust
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())  // 新增
        .manage(RepoWatchManager::default())
        .manage(KeepAwakeManager::default())
        .manage(LlamaServerState::default())  // 新增
        // ... 现有配置
}
```

**权限配置** (`src-tauri/capabilities/default.json`)：

Tauri 2.0 使用 `tauri-plugin-shell` 插件管理 sidecar 权限。需要在 `Cargo.toml` 和 `package.json` 中添加该插件依赖。

```json
{
  "permissions": [
    "core:default",
    {
      "identifier": "shell:allow-execute",
      "allow": [
        {
          "name": "llama-server",
          "sidecar": true
        }
      ]
    }
  ]
}
```

**注意**：
- `shell:allow-execute` 是 Tauri 2.0 shell 插件的正确权限标识符（非 `shell:allow-spawn`）
- 权限 `name` 必须与运行时 `.sidecar("llama-server")` 对齐，不要使用 `binaries/llama-server`
- 需要同时添加 `tauri-plugin-shell = "2"` 到 `Cargo.toml`
- 前端需要安装 `@tauri-apps/plugin-shell` 包

#### 4.2.2 前端模块

```
src/renderer/
├── components/
│   ├── settings/
│   │   └── LabPage.tsx         # 实验室主页面
│   └── ui/
│       └── image-dropzone.tsx  # 可复用的图片拖放组件
├── lib/
│   └── desktop-api.ts          # 扩展 ai.* API
└── types/
    ├── ai.ts                   # AI 相关类型定义
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
- **单例**：全局只有一个 sidecar 进程
- **单并发**：已有识别任务运行时，新请求返回 `sidecar-busy` 错误（MVP 不实现排队）
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

### 5.1 llama-server HTTP 契约

Rust 后端通过 HTTP 与 llama-server 通信：

**健康检查**：
```
GET /health
Response: { "status": "ok" }
Timeout: 5s
```

**识别请求**：
```
POST /completions
Content-Type: application/json

{
  "prompt": {
    "prompt_string": "<__media__>",
    "multimodal_data": ["{{BASE64_IMAGE}}"]
  },
  "temperature": 0.1,
  "n_predict": 2048,
  "stream": false
}
```

运行 sidecar 时设置 `LLAMA_MEDIA_MARKER=<__media__>`，并确保 `prompt_string` 中包含同一个 marker。当前本地训练模型使用 image-only 输入环境，不发送 system prompt、任务文本、tuning、instrument 或 language hints。该形状已经验证可避免 llama.cpp 报错 `number of bitmaps (1) does not match number of markers (0)`。

**响应格式**：
```json
{
  "content": "\\title \"Song\"\n\\tempo 120\n.\n:4 0.5 1.5...",
  "tokens_predicted": 456,
  "tokens_evaluated": 123
}
```

**错误映射**：
- HTTP 200 + valid JSON → 解析 `content` 字段
- HTTP 4xx/5xx → 返回 `omr-request-failed` + status code + llama-server error message
- 连接超时 (> 30s) → 返回 `omr-timeout`
- 无效 JSON 响应 → 返回 `omr-invalid-response`

### 5.2 Tauri Commands

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
) -> Result<OmrJob, String>

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

### 5.3 类型定义

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

// 后端返回的原始结果（Rust 生成）
export interface OmrRawResult {
  alphaTex: string;
  rawResponse: string;
  tokensUsed: number;
  durationMs: number;
}

// 前端验证后的完整结果（添加诊断信息）
export interface OmrResult extends OmrRawResult {
  diagnosticErrors?: DiagnosticError[];  // 前端 parser 生成的错误列表
  isValidAlphaTex: boolean;              // 是否通过前端 parser 验证
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
  result?: OmrRawResult;  // 后端返回的原始结果
  error?: string;
}
```

### 5.4 DesktopAPI 扩展

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

### 5.5 输出验证流程

**验证位置**：前端（Renderer）

原因：现有 alphaTex parser/diagnostic 工具链位于前端（`src/renderer/lib/alphatex-diagnostics.ts` 等），复用成本最低。

```typescript
function validateAlphaTex(rawResult: OmrRawResult): OmrResult {
  const cleaned = postProcessAlphaTex(rawResult.alphaTex);

  // 使用现有的 AlphaTex parser 进行验证
  const diagnostics = runAlphaTexDiagnostics(cleaned);

  return {
    ...rawResult,
    alphaTex: cleaned,
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

当前本地训练模型不使用 system prompt。保持为空。

### 6.2 User Prompt

当前本地训练模型不使用 user prompt。`prompt_string` 仅保留 llama.cpp 图片占位符 `<__media__>`。

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

### 7.1 Sidecar 二进制准备（macOS only）

```bash
#!/bin/bash
# scripts/fetch-llama-server.sh
# 仅支持 macOS（本次 scope）

VERSION="b8989"

# macOS ARM64 (Apple Silicon)
curl -L "https://github.com/ggml-org/llama.cpp/releases/download/${VERSION}/llama-${VERSION}-bin-macos-arm64.tar.gz" \
  -o "/tmp/llama-macos-arm64.tar.gz"
# extract llama-server and required libggml/libllama/libmtmd dylibs
mv "<extracted>/llama-server" "src-tauri/binaries/llama-server-aarch64-apple-darwin"
chmod +x "src-tauri/binaries/llama-server-aarch64-apple-darwin"

# macOS x64 (Intel，备用)
curl -L "https://github.com/ggml-org/llama.cpp/releases/download/${VERSION}/llama-${VERSION}-bin-macos-x64.tar.gz" \
  -o "/tmp/llama-macos-x64.tar.gz"
# extract llama-server and required libggml/libllama/libmtmd dylibs
mv "<extracted>/llama-server" "src-tauri/binaries/llama-server-x86_64-apple-darwin"
chmod +x "src-tauri/binaries/llama-server-x86_64-apple-darwin"

# 验证
ls -la src-tauri/binaries/llama-server-*
file src-tauri/binaries/llama-server-*
```

实际脚本还会复制 `.dylib` 依赖并保留 Tauri 需要的 target-triple 后缀；详见 `scripts/fetch-llama-server.sh` 和 `src-tauri/binaries/README.md`。

### 7.2 `tauri.conf.json` 配置

Tauri 2 的 external binary 命名约定：`{name}-{target-triple}`，运行时通过 `Command::new_sidecar("llama-server")` 自动解析。

```json
{
  "bundle": {
    "externalBin": [
      "binaries/llama-server",
      "binaries/libggml-base.dylib",
      "binaries/libggml-blas.dylib",
      "binaries/libggml-cpu.dylib",
      "binaries/libggml-metal.dylib",
      "binaries/libggml-rpc.dylib",
      "binaries/libggml.dylib",
      "binaries/libllama-common.dylib",
      "binaries/libllama.dylib",
      "binaries/libmtmd.dylib"
    ]
  }
}
```

**文件放置**：
```
src-tauri/binaries/
├── README.md                           # 入库：说明生成内容
├── .gitignore                          # 入库：忽略生成二进制
├── llama-server-aarch64-apple-darwin   # 生成：macOS ARM64
├── llama-server-x86_64-apple-darwin    # 生成：macOS Intel
└── lib*.dylib-<target-triple>          # 生成：llama.cpp 动态库依赖
```

**运行时解析**：
```rust
let sidecar = app.shell()
    .sidecar("llama-server")  // Tauri 自动按 target triple 匹配
    .map_err(|e| e.to_string())?;
```

### 7.3 CI 集成

当前 CI 和构建命令通过 wrapper 自动准备 sidecar：

- `pnpm dev:tauri` → `scripts/dev-tauri-with-sidecar.sh`
- `pnpm build:tauri` → `scripts/build-tauri-with-sidecar.sh`
- `pnpm build:tauri:ci` → `scripts/build-tauri-with-sidecar.sh --no-sign`

Linux/Windows release commands 当前主动失败，直到设计好非 macOS sidecar 打包流程。

---

## 8. 性能与资源预算

| 指标 | 预算 | 说明 |
|------|------|------|
| 安装包增量 | 以 b8989 `llama-server` + `.dylib` 实测为准 | llama.cpp runtime（macOS） |
| 模型大小 | 以 `model-manifest.json` 为准 | SmolVLM 500M GGUF + mmproj |
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
- [ ] 创建 flat `ai_*.rs` 模块（ai_sidecar + ai_model_manager）
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
    version: '',
    downloaded: false, 
    downloadedBytes: 0,
    totalBytes: 0,
    checksumVerified: false
  }),
  downloadModel: async () => { 
    throw new Error('OMR Lab is only available in desktop app'); 
  },
  transcribe: async () => { 
    throw new Error('OMR Lab is only available in desktop app'); 
  },
  getOmrResult: async () => { 
    throw new Error('OMR Lab is only available in desktop app'); 
  },
  cancelOmrJob: async () => { 
    throw new Error('OMR Lab is only available in desktop app'); 
  },
  getSidecarStatus: async () => ({ 
    state: 'stopped' as const 
  }),
  restartSidecar: async () => { 
    throw new Error('OMR Lab is only available in desktop app'); 
  }
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
- [llama.cpp releases](https://github.com/ggml-org/llama.cpp/releases)
- [SmolVLM-500M-Instruct-GGUF](https://huggingface.co/ggml-org/SmolVLM-500M-Instruct-GGUF)
- [hf-mirror.com](https://hf-mirror.com/)

### B. 模型信息

**当前 Model ID**: `ggml-org/SmolVLM-500M-Instruct-GGUF`

> **注意**：该模型用于端到端流程验证，不代表最终 OMR 识别质量。后续可以替换为任意支持 vision + mmproj 的专用 OMR GGUF 模型。

**模型替换准备（Phase 0 Gate）**：

替换默认模型前，必须完成以下准备工作并生成**模型清单文件（Model Manifest）**：

### Phase 0 必须完成的事项

1. **确认模型可用性**：验证所选模型在 Hugging Face 上存在且可下载
2. **GGUF 转换**：将模型转换为 llama.cpp GGUF 格式（使用 `convert_hf_to_gguf.py`）
3. **mmproj 提取**：提取 vision projector 为单独的 mmproj GGUF 文件
4. **生成模型清单**：计算所有产物文件的 SHA256，生成 `model-manifest.json`
5. **上传模型**：将产物上传至 Hugging Face repo（建议创建专用 repo，如 `your-org/omr-model-v1`）
6. **验证启动**：使用 llama-server 本地验证模型可正常加载和推理

### 模型清单格式（Model Manifest）

实现时必须提供以下清单文件（`model-manifest.json`），作为下载和校验的唯一依据：

```json
{
  "version": "v1",
  "model_repo": "your-org/omr-model-v1",
  "files": [
    {
      "filename": "omr-model-v1-q4_k_m.gguf",
      "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      "size": 450000000,
      "required": true,
      "type": "main"
    },
    {
      "filename": "mmproj-omr-model-v1-q4_k_m.gguf",
      "sha256": "a3f5c8d2e1b0a4f7c9d6e3b2a1f4c7d9e6b3a2f1c4d7e9b6a3f2c1d4e7b9a6f3",
      "size": 80000000,
      "required": true,
      "type": "mmproj"
    }
  ],
  "llama_server_args": {
    "ctx_size": 4096,
    "np": 1,
    "host": "127.0.0.1"
  }
}
```

> **示例说明**：以上 SHA256 值为格式示例（64 位十六进制字符串），实际值由文件内容计算得出。文件名中的 `q4_k_m` 表示量化类型，实际文件名由转换参数决定。

**清单文件放置位置**：与模型文件一同上传至 Hugging Face repo root 目录，文件名固定为 `model-manifest.json`。

**下载 URL 格式**：
- 主源：`https://huggingface.co/{model_repo}/resolve/main/{filename}`
- 镜像：`https://hf-mirror.com/{model_repo}/resolve/main/{filename}`
- 清单文件 URL：`https://huggingface.co/{model_repo}/resolve/main/model-manifest.json`

**校验流程**：
1. 首次下载前，先下载 `model-manifest.json`
2. 按清单逐个下载文件
3. 每个文件下载完成后校验 SHA256
4. 所有文件校验通过后，标记模型为可用

**配置建议**：
- 以上 `model-manifest.json` 为**示例模板**，实现时需替换为实际的模型 repo 和文件信息
- 模型 repo 和版本应配置在代码常量或配置文件中（如 `src-tauri/src/ai/model_config.rs`），便于后续更新
- 建议支持多版本模型清单，实现模型热切换能力（未来扩展）

**GGUF 转换流程**：
```bash
# 1. 从 Hugging Face 下载候选模型
huggingface-cli download <vision-model-repo>

# 2. 转换为 GGUF
python convert_hf_to_gguf.py ./<vision-model-dir> \
  --outfile tabst-omr-v1.gguf \
  --outtype q4_k_m

# 3. mmproj 文件（如有单独提供）
# 某些 VLM 模型需要单独转换 vision encoder
```

**启动参数**：
```bash
llama-server \
  -m SmolVLM-500M-Instruct-Q8_0.gguf \
  --mmproj mmproj-SmolVLM-500M-Instruct-Q8_0.gguf \
  --port $RANDOM_PORT \
  --host 127.0.0.1 \
  -np 1 \
  --ctx-size 4096
```

### C. 文件变更清单

```
# 新增文件
src-tauri/src/ai_sidecar.rs                    # Sidecar 进程管理（含状态机）
src-tauri/src/ai_model_manager.rs              # 模型下载/缓存/校验（双源下载）
src-tauri/src/ai_ocr_commands.rs               # OMR Tauri commands（job-scoped）
src-tauri/src/ai_job_manager.rs                # 任务状态管理（单并发）
src-tauri/binaries/README.md                  # sidecar 生成目录说明
src-tauri/binaries/.gitignore                 # 忽略生成 sidecar/dylib 文件
src/renderer/components/settings/LabPage.tsx   # 实验室主页面
src/renderer/components/ui/image-dropzone.tsx  # 图片拖放组件（可复用）
src/renderer/hooks/useOmrJob.ts                # OMR 任务状态管理 hook
src/renderer/types/ai.ts                       # AI 类型定义
scripts/fetch-llama-server.sh                  # 下载 llama-server 脚本（macOS only）
scripts/dev-tauri-with-sidecar.sh              # 开发态自动准备 sidecar
scripts/build-tauri-with-sidecar.sh            # 构建态自动准备 sidecar

# 修改文件
src-tauri/Cargo.toml                           # 添加 reqwest, tokio, sha2, hex
src-tauri/tauri.conf.json                      # 添加 externalBin
src-tauri/src/lib.rs                           # 注册 ai 模块 + LlamaServerState
src-tauri/capabilities/default.json            # 添加 shell:allow-execute (sidecar)
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

## 12. 前端状态管理

### 12.1 Zustand Store 设计

Lab 页面使用独立的 Zustand store（不放入全局 appStore，避免持久化 base64 图片数据）：

```typescript
// src/renderer/store/labStore.ts

import { create } from 'zustand';

interface LabState {
  // 图片输入
  currentImage: string | null;  // base64 preview
  
  // Sidecar 状态
  sidecarState: 'stopped' | 'starting' | 'ready' | 'busy' | 'stopping' | 'failed';
  sidecarError: string | null;
  
  // 模型状态
  modelVersion: string;
  modelDownloaded: boolean;
  downloadProgress: DownloadProgress | null;
  
  // OMR 任务
  currentJobId: string | null;
  jobStatus: 'idle' | 'pending' | 'running' | 'completed' | 'cancelled' | 'failed';
  omrResult: OmrResult | null;
  omrError: string | null;
  
  // Actions
  setCurrentImage: (image: string | null) => void;
  setSidecarState: (state: LabState['sidecarState'], error?: string) => void;
  setModelStatus: (downloaded: boolean, progress?: DownloadProgress) => void;
  startOmr: (jobId: string) => void;
  completeOmr: (result: OmrResult) => void;
  failOmr: (error: string) => void;
  cancelOmr: () => void;
  reset: () => void;
}

export const useLabStore = create<LabState>((set) => ({
  currentImage: null,
  sidecarState: 'stopped',
  sidecarError: null,
  modelVersion: 'v1',
  modelDownloaded: false,
  downloadProgress: null,
  currentJobId: null,
  jobStatus: 'idle',
  omrResult: null,
  omrError: null,
  
  setCurrentImage: (image) => set({ currentImage: image }),
  setSidecarState: (state, error) => set({ sidecarState: state, sidecarError: error || null }),
  setModelStatus: (downloaded, progress) => set({ modelDownloaded: downloaded, downloadProgress: progress || null }),
  startOmr: (jobId) => set({ currentJobId: jobId, jobStatus: 'running', omrResult: null, omrError: null }),
  completeOmr: (result) => set({ jobStatus: 'completed', omrResult: result }),
  failOmr: (error) => set({ jobStatus: 'failed', omrError: error }),
  cancelOmr: () => set({ jobStatus: 'cancelled', currentJobId: null }),
  reset: () => set({
    currentImage: null,
    jobStatus: 'idle',
    currentJobId: null,
    omrResult: null,
    omrError: null,
  }),
}));
```

### 12.2 组件状态流转

```
LabPage 初始化
  ├── 调用 get_model_status() 
  │     ├── 未下载 → 显示下载按钮
  │     └── 已下载 → 显示图片输入区
  │
  ├── 用户输入图片
  │     ├── 显示图片预览
  │     ├── 调用 get_sidecar_status()
  │     │     ├── stopped → 调用 restart_sidecar()
  │     │     ├── ready → 启用"开始识别"按钮
  │     │     └── failed → 显示错误 + 重试按钮
  │     │
  │     └── 点击"开始识别"
  │           ├── 调用 transcribe(image) → 获取 jobId
  │           ├── 轮询 getOmrResult(jobId) 每 2s
  │           ├── 显示进度/取消按钮
  │           └── 完成 → 显示结果 + 操作按钮
  │
  └── 用户操作
        ├── 重新识别 → 复用当前图片，重新发起任务
        ├── 插入编辑器 → 调用编辑器 API 插入 alphaTex
        └── 复制 → 写入剪贴板
```

### 12.3 "插入编辑器"集成路径

Lab 页面位于 Settings 路由内，与主编辑器不在同一组件树。集成路径如下：

**方案：使用全局状态（Zustand）+ Editor 监听**

1. **LabPage 写入待插入内容**：
   ```typescript
   // LabPage.tsx
   import { useAppStore } from '@/store/appStore';
   
   const handleInsertToEditor = () => {
     const { omrResult } = useLabStore.getState();
     if (omrResult?.alphaTex) {
       // 写入全局状态，标记为"待插入"
       useAppStore.getState().setPendingOmrInsert(omrResult.alphaTex);
       // 关闭设置页，返回主界面
       useAppStore.getState().setShowSettings(false);
     }
   };
   ```

2. **Editor 组件监听待插入内容**：
   ```typescript
   // Editor.tsx (伪代码)
   useEffect(() => {
     const pending = useAppStore.getState().pendingOmrInsert;
     if (pending && editorRef.current) {
       // 在当前光标位置插入
       editorRef.current.replaceSelection(pending);
       // 清空待插入状态
       useAppStore.getState().setPendingOmrInsert(null);
     }
   }, [showSettings]); // 当设置页关闭时触发
   ```

3. **appStore 扩展**：
   ```typescript
   // src/renderer/store/appStore.ts
   interface AppState {
     // ... 现有状态
     pendingOmrInsert: string | null;
     setPendingOmrInsert: (text: string | null) => void;
   }
   ```

**备选方案：使用事件总线（如果项目已有）**

```typescript
// LabPage.tsx
window.dispatchEvent(new CustomEvent('omr:insert', { 
  detail: { alphaTex: omrResult.alphaTex } 
}));

// Editor.tsx
useEffect(() => {
  const handler = (e: CustomEvent) => {
    editorRef.current?.replaceSelection(e.detail.alphaTex);
  };
  window.addEventListener('omr:insert', handler);
  return () => window.removeEventListener('omr:insert', handler);
}, []);
```

**实现建议**：优先使用全局状态方案（与现有 Zustand 模式一致），若存在技术阻碍可降级为事件总线。

---

## 13. 错误码定义

| 错误码 | 场景 | 用户提示 |
|--------|------|---------|
| `model-not-found` | 模型文件不存在 | "模型未下载，请先下载模型" |
| `model-download-failed` | 双源下载均失败 | "模型下载失败，请检查网络或手动导入" |
| `model-checksum-mismatch` | SHA256 校验失败 | "模型文件损坏，请重新下载" |
| `sidecar-start-failed` | llama-server 启动失败 | "推理服务启动失败: {具体错误}" |
| `sidecar-crashed` | 进程意外退出 | "推理服务异常退出，请重新启动" |
| `sidecar-timeout` | 健康检查超时 | "推理服务响应超时，请重试" |
| `sidecar-busy` | 已有任务在运行 | "已有识别任务进行中，请等待或取消" |
| `omr-timeout` | 推理超过 60s | "识别超时，请重试或取消" |
| `omr-cancelled` | 用户主动取消 | "识别已取消" |
| `clipboard-no-image` | 剪贴板无图片数据 | "剪贴板中没有图片" |
| `image-format-unsupported` | 图片格式不支持 | "仅支持 PNG/JPG/JPEG/WEBP 格式" |
| `image-too-large` | 图片超过 10MB | "图片过大，请压缩后重试" |
| `invalid-alphatex` | 输出无法通过 parser 验证 | "识别结果包含语法错误，请检查" |
| `desktop-only` | Web 运行时调用 | "实验室功能仅在桌面端可用" |
| `insufficient-disk-space` | 磁盘空间不足 | "磁盘空间不足，需要 {size} 可用空间" |
| `network-error` | 网络请求失败 | "网络连接失败，请检查网络设置" |

---

## 14. 测试策略

### 14.1 单元测试（Rust 后端）

| 测试项 | 覆盖内容 |
|--------|---------|
| `sidecar::ensure_server_running` | 启动成功/失败/重复启动/崩溃检测 |
| `sidecar::stop_server` | 正常停止/已停止/强制 kill |
| `model_manager::download_with_fallback` | 主源成功/镜像 fallback/双源失败/断点续传 |
| `model_manager::verify_checksum` | 校验通过/失败 |
| `ocr_commands::omr_transcribe` | 返回 jobId/参数校验/单并发限制 |

### 14.2 集成测试

| 测试项 | 步骤 |
|--------|------|
| 端到端识别流程 | 输入图片 → 下载模型 → 启动 sidecar → 识别 → 返回结果 |
| 错误恢复 | Sidecar 崩溃 → 检测失败 → 重启 → 恢复识别 |
| 并发安全 | 两个识别请求 → 第二个返回 busy |
| Web fallback | 在浏览器环境打开 Lab → 显示 desktop-only 提示 |

### 14.3 手动 QA 清单

- [ ] macOS ARM64: 安装包包含 llama-server 二进制
- [ ] 首次进入 Lab: 显示模型下载 UI
- [ ] 模型下载: 进度条正常更新，速度显示合理
- [ ] 下载完成: 自动进入图片输入界面
- [ ] 粘贴图片: 从剪贴板读取图片成功
- [ ] 文件选择: 打开文件选择器，选中图片后显示预览
- [ ] 拖拽图片: 拖拽到区域后显示预览
- [ ] 开始识别: 显示进度状态，"取消"按钮可用
- [ ] 识别完成: 显示 alphaTex 结果，"插入编辑器"按钮可用
- [ ] 插入编辑器: 结果正确插入当前编辑器光标位置
- [ ] 重新识别: 复用同一张图片重新发起识别
- [ ] Sidecar 崩溃: 显示错误，重启按钮可用
- [ ] App 退出: sidecar 进程被正确清理
- [ ] Web 模式: 显示"桌面端专属功能"提示

---

**文档版本**: v1.7 (Oracle Approved)
**创建日期**: 2025-05-01
**更新日期**: 2025-05-01
**作者**: Sisyphus (AI Agent)
**状态**: ✅ 已通过 Oracle 最终审核，实现就绪
