# OMR Lab Runbook

Last updated: 2026-05-12

This runbook explains how to run, build, and troubleshoot the experimental OMR Lab after the HTTP-provider migration. Tabst no longer bundles or starts an inference sidecar; the desktop app sends images to an externally managed OMR HTTP provider.

## Scope

- Runtime: Tauri desktop only; web shows a desktop-only fallback.
- Provider ownership: external process, managed outside Tabst.
- Output mode: non-streaming MVP; the backend returns a final alphaTex result per job.
- Goal: validate the end-to-end path from image input to alphaTex validation/insertion. Model quality is intentionally out of scope while models are still being swapped.

## Key files

| Area | Files |
|------|-------|
| Lab UI | `src/renderer/components/settings/LabPage.tsx` |
| Image input | `src/renderer/components/ui/image-dropzone.tsx` |
| Renderer job state | `src/renderer/hooks/useOmrJob.ts`, `src/renderer/store/labStore.ts` |
| Desktop bridge | `src/renderer/types/ai.ts`, `src/renderer/lib/desktop-api.ts`, `src/renderer/lib/tauri-desktop-api.ts` |
| Tauri commands | `src-tauri/src/ai_ocr_commands.rs`, `src-tauri/src/lib.rs` |
| HTTP provider client | `src-tauri/src/ai_provider.rs` |
| ONNX smoke provider | `scripts/omr_onnx_provider.py` |
| Provider staging note | `src-tauri/binaries/README.md` |

## Provider configuration

Tabst reads provider settings from environment variables:

| Variable | Default | Meaning |
|----------|---------|---------|
| `TABST_OMR_ENDPOINT` | `http://127.0.0.1:18089` | Provider base URL |
| `TABST_OMR_API_KIND` | `tabst` | `tabst`, `openai`/`lm-studio`, or `llamacpp` |
| `TABST_OMR_MODEL` | `tabst-omr` | OpenAI-compatible model name |
| `TABST_OMR_PROMPT` | alphaTex transcription prompt | OpenAI-compatible user prompt |
| `TABST_OMR_REQUEST_TIMEOUT_SECS` | `300` | HTTP recognition timeout; must be >= 30 |

Supported adapters:

- `tabst`: `GET /health` with provider readiness and `activeModel`, plus `POST /transcribe` with `{ imageBase64, options }`.
- `openai` / `lm-studio`: `GET /v1/models`, `POST /v1/chat/completions` with image content.
- `llamacpp`: `GET /health`, `POST /completions` against an already-running llama.cpp HTTP server.

## Local development

Install dependencies first:

```bash
pnpm install
```

Start a provider. For the temporary ONNX export in `tmp/onnx_export` and the current nested weights directory:

```bash
python scripts/omr_onnx_provider.py \
  --onnx-export-dir tmp/onnx_export \
  --weights-dir tmp/onnx_export/weights/omr-stage2-815-93x-r03-seq768-frozen-from-top2 \
  --port 18089
```

Then start Tabst:

```bash
TABST_OMR_ENDPOINT=http://127.0.0.1:18089 TABST_OMR_API_KIND=tabst pnpm dev
```

For LM Studio or another OpenAI-compatible server:

```bash
TABST_OMR_ENDPOINT=http://127.0.0.1:1234 \
TABST_OMR_API_KIND=openai \
TABST_OMR_MODEL='<lm-studio-model-name>' \
pnpm dev
```

## Provider request contract

The native `tabst` provider health endpoint returns readiness and the active model name that the Lab UI displays after **Check status**:

```json
{
  "status": "ok",
  "runtime": "onnx",
  "ready": true,
  "activeModel": "omr-stage2-815-93x-r03-seq768-frozen-from-top2"
}
```

`activeModel` is additive. Older compatible providers may omit it; Tabst falls back to the configured model label.

The native `tabst` provider receives:

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

It returns:

```json
{
  "alphaTex": "(2.3 1.4 1.5).2",
  "rawResponse": {},
  "tokensUsed": 49,
  "durationMs": 1883
}
```

## Build and release

Tabst builds no longer fetch or package inference binaries:

```bash
pnpm build:tauri
pnpm build:tauri:ci
pnpm release:mac
pnpm release:linux
pnpm release:win
```

If OMR is needed in a packaged app, run the provider separately and set the same environment variables before launching Tabst.

## Verification checklist

Run the standard gates after changing OMR code or provider scripts:

```bash
pnpm check
pnpm verify:tauri
```

Manual smoke test:

1. Start an OMR provider.
2. Open the desktop app.
3. Go to Settings -> Lab.
4. Click **Check provider** and confirm the runtime health is ready and the active model name is shown.
5. Paste, choose, or drag a PNG/JPG/JPEG/WEBP tab image.
6. Click recognition.
7. Confirm an alphaTex result appears and can be copied or inserted into the editor.

Standalone ONNX provider smoke test:

```bash
python scripts/omr_onnx_provider.py \
  --onnx-export-dir tmp/onnx_export \
  --weights-dir tmp/onnx_export/weights/omr-stage2-815-93x-r03-seq768-frozen-from-top2 \
  --port 18089
curl http://127.0.0.1:18089/health
```

## Troubleshooting

| Symptom | Likely cause | Check/fix |
|---------|--------------|-----------|
| `provider-unavailable` | Provider is not running or endpoint is wrong | Start the provider and verify `TABST_OMR_ENDPOINT` |
| `provider-kind-invalid` | Unsupported adapter name | Use `tabst`, `openai`, or `llamacpp` |
| `provider-request-failed` | HTTP request failed or provider returned non-2xx | Check provider logs and response body |
| `provider-invalid-response` | Provider response did not contain usable `alphaTex`/content | Confirm the adapter contract and JSON shape |
| Active model shows `—` | Provider omitted `activeModel` or health failed before model status was stored | Check `/health`; old providers can omit the field, but the ONNX smoke provider should return it |
| `provider-managed-externally` | User tried to stop provider from Tabst | Stop it from its own terminal/app |
| `provider-busy` | A Tabst recognition job is already active | Wait for it to finish or cancel it |
| `omr-timeout` | Provider took longer than request timeout | Increase `TABST_OMR_REQUEST_TIMEOUT_SECS` or optimize provider runtime |
| Web Lab shows desktop-only message | Expected web fallback | Use the Tauri desktop app for OMR |
