# Tabst OMR Lab Technical Spec

Last updated: 2026-05-11

## 1. Goal

OMR Lab is the desktop-only experimental entry point for converting guitar-tab images into editable alphaTex. The current goal is to validate the application integration path, not to optimize recognition accuracy for a specific model.

The validated path is:

```text
image input -> Tauri command -> external HTTP OMR provider -> alphaTex -> alphaTab parser/preview -> editor insertion
```

## 2. Scope

| Item | Current decision |
|------|------------------|
| Runtime | Tauri desktop only; web shows desktop-only fallback |
| Provider | External HTTP server managed outside Tabst |
| Model ownership | Outside the app; models can be swapped without changing Tabst packaging |
| Output | Non-streaming final alphaTex result |
| Job UX | Keep async job/polling/cancel flow because local and remote providers can be slow |
| Model quality | Out of scope while the model is temporary |

## 3. Functional requirements

- Accept image input via paste, file chooser, or drag-and-drop.
- Resize/encode image in the renderer before sending it through the desktop bridge.
- Check provider readiness before recognition.
- Submit recognition as a Tauri job and poll for status.
- Display editable alphaTex output.
- Validate output through the existing alphaTab parser/preview pipeline.
- Allow copy and insert-to-editor actions.

## 4. Provider adapters

Provider selection is environment-driven:

| Variable | Default | Meaning |
|----------|---------|---------|
| `TABST_OMR_ENDPOINT` | `http://127.0.0.1:18089` | Provider base URL |
| `TABST_OMR_API_KIND` | `tabst` | `tabst`, `openai`/`lm-studio`, or `llamacpp` |
| `TABST_OMR_MODEL` | `tabst-omr` | OpenAI-compatible model name |
| `TABST_OMR_PROMPT` | alphaTex transcription prompt | OpenAI-compatible user prompt |
| `TABST_OMR_REQUEST_TIMEOUT_SECS` | `300` | Recognition timeout; must be >= 30 |

Adapters:

- `tabst`: native test contract with `GET /health` and `POST /transcribe`.
- `openai`: OpenAI-compatible `GET /v1/models` and `POST /v1/chat/completions`, useful for LM Studio.
- `llamacpp`: an already-running llama.cpp HTTP server using `GET /health` and `POST /completions`.

## 5. Native `tabst` provider contract

Request:

```json
{
  "imageBase64": "<raw base64 image>",
  "options": {
    "maxNewTokens": 160,
    "preprocess": "fit-pad-800x320",
    "invert": false
  }
}
```

Response:

```json
{
  "alphaTex": "(2.3 1.4 1.5).2",
  "rawResponse": {},
  "tokensUsed": 49,
  "durationMs": 1883
}
```

## 6. Current architecture

```text
Renderer
  LabPage.tsx
  useOmrJob.ts
  labStore.ts
        |
        v
window.desktopAPI.ai
        |
        v
Tauri commands
  ai_ocr_commands.rs
  ai_job_manager.rs
  ai_provider.rs
        |
        v
External HTTP provider
  scripts/omr_onnx_provider.py for local ONNX smoke testing
  LM Studio / OpenAI-compatible servers
  already-running llama.cpp HTTP servers
```

## 7. Implementation notes

- `get_model_status` now means provider health status, not local model-cache status.
- `download_model` is retained as a compatibility shim that checks provider health and emits a completed progress event.
- `get_sidecar_status`, `restart_sidecar`, and `stop_sidecar` remain bridge-compatible names for now, but their behavior is provider-oriented:
  - status -> provider health
  - restart -> provider health check
  - stop -> `provider-managed-externally`
- `src-tauri/binaries/` is not used for OMR runtime packaging.
- Tauri no longer requests shell sidecar permissions for OMR.

## 8. Verification strategy

Automated gates:

```bash
pnpm check
pnpm verify:tauri
```

Provider smoke gate:

```bash
python scripts/omr_onnx_provider.py --onnx-export-dir tmp/onnx_export --port 18089
curl http://127.0.0.1:18089/health
```

Manual UI gate:

1. Start a provider.
2. Launch Tabst with `TABST_OMR_ENDPOINT` and `TABST_OMR_API_KIND`.
3. Open Settings -> Lab.
4. Check provider status.
5. Submit a tab image.
6. Confirm alphaTex appears and parser validation runs.

## 9. Known limitations

- The temporary ONNX model currently repeats and often does not emit EOS.
- Provider cancellation is local to Tabst's job state; external providers are not yet sent cancellation requests.
- Renderer/store naming still contains compatibility terms such as `sidecar` while UI copy has moved to provider/runtime language.
