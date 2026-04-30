# OMR Lab Runbook

Last updated: 2026-05-01

This runbook explains how to run, build, and troubleshoot the experimental OMR Lab. It reflects the current implementation, not the original design draft.

## Scope

- Runtime: Tauri desktop only.
- Platform: macOS only for the current sidecar bundle.
- Web behavior: Lab shows a desktop-only fallback and does not run inference.
- Output mode: non-streaming MVP; the backend returns a final alphaTex result per job.

## Key files

| Area | Files |
|------|-------|
| Lab UI | `src/renderer/components/settings/LabPage.tsx` |
| Image input | `src/renderer/components/ui/image-dropzone.tsx` |
| Renderer job state | `src/renderer/hooks/useOmrJob.ts`, `src/renderer/store/labStore.ts` |
| Desktop bridge | `src/renderer/types/ai.ts`, `src/renderer/lib/desktop-api.ts`, `src/renderer/lib/tauri-desktop-api.ts` |
| Tauri commands | `src-tauri/src/ai_ocr_commands.rs`, `src-tauri/src/lib.rs` |
| Model cache/download | `src-tauri/src/ai_model_manager.rs` |
| Sidecar lifecycle | `src-tauri/src/ai_sidecar.rs` |
| Sidecar scripts | `scripts/fetch-llama-server.sh`, `scripts/dev-tauri-with-sidecar.sh`, `scripts/build-tauri-with-sidecar.sh` |
| Generated sidecar directory | `src-tauri/binaries/README.md` |

## Local development

Install dependencies first:

```bash
pnpm install
```

Run the desktop app:

```bash
pnpm dev
```

`pnpm dev` delegates to `pnpm dev:tauri`, which runs `scripts/dev-tauri-with-sidecar.sh`. The wrapper fetches the macOS llama.cpp runtime files and installs the current-architecture files into `src-tauri/target/debug` before launching Tauri.

If you only want to refresh sidecar files:

```bash
pnpm prepare:llama-server
```

## Build and release

```bash
pnpm build:tauri
pnpm build:tauri:ci
pnpm release:mac
```

The build wrapper copies the current-architecture `llama-server` and required dylibs into:

- `src-tauri/target/release/`
- `src-tauri/target/release/bundle/macos/Tabst.app/Contents/MacOS/`

`release:linux` and `release:win` intentionally fail while OMR sidecar packaging is macOS-only.

## Binary policy

Do not commit generated sidecar binaries.

`src-tauri/binaries/` is a generated staging directory. Git tracks only:

- `src-tauri/binaries/.gitignore`
- `src-tauri/binaries/README.md`

The fetch script populates files with Tauri target triples, such as:

- `llama-server-aarch64-apple-darwin`
- `llama-server-x86_64-apple-darwin`
- `libggml*.dylib-<target-triple>`
- `libllama*.dylib-<target-triple>`
- `libmtmd*.dylib-<target-triple>`

If the expected runtime payload changes, update all three places together:

1. `scripts/fetch-llama-server.sh`
2. `src-tauri/tauri.conf.json`
3. `src-tauri/binaries/README.md`

## Model cache

The current default model repo is `ggml-org/SmolVLM-500M-Instruct-GGUF`.

Models are downloaded to `app_local_data_dir/models/` with a required `model-manifest.json`. The manifest must include one required main GGUF and one required `mmproj` file; filenames are basename-validated and each file is SHA256-checked.

Download behavior:

- Primary source: `https://huggingface.co/<repo>/resolve/main/<filename>`
- Mirror source: `https://hf-mirror.com/<repo>/resolve/main/<filename>`
- Connection timeout: 5 seconds
- Read timeout: 30 seconds per request
- Resume support: HTTP `Range` requests and `.tmp` partial files

## llama-server request contract

The backend starts llama.cpp with:

- `.sidecar("llama-server")`
- `--host 127.0.0.1`
- random local port
- `--mmproj <mmproj path>`
- `LLAMA_MEDIA_MARKER=<__media__>`

Runtime sidecar name matters: do not call `.sidecar("binaries/llama-server")`. Tauri resolves sidecars relative to the executable directory at runtime.

Inference uses llama.cpp `/completions`, not `/v1/chat/completions`:

```json
{
  "prompt": {
    "prompt_string": "<system prompt>\n\n<__media__>\nConvert this guitar tab image to alphaTex format.",
    "multimodal_data": ["<raw base64 image>"]
  },
  "temperature": 0.1,
  "n_predict": 2048,
  "stream": false
}
```

This shape avoids llama.cpp marker mismatches such as `number of bitmaps (1) does not match number of markers (0)`.

## Verification checklist

Run the standard gates after changing OMR code or sidecar scripts:

```bash
pnpm check
pnpm verify:tauri
pnpm build:tauri:ci
```

Manual smoke test:

1. Open the desktop app.
2. Go to Settings → Lab.
3. Ensure the model is downloaded.
4. Paste, choose, or drag a PNG/JPG/JPEG/WEBP tab image.
5. Click recognition.
6. Confirm an alphaTex result appears and can be copied or inserted into the editor.

Packaged sidecar smoke checks:

```bash
src-tauri/target/release/bundle/macos/Tabst.app/Contents/MacOS/llama-server --help | grep -- --mmproj
```

## Troubleshooting

| Symptom | Likely cause | Check/fix |
|---------|--------------|-----------|
| `sidecar-start-failed: No such file or directory` | Runtime used the wrong sidecar name or files were not copied beside the app executable | Ensure code uses `.sidecar("llama-server")`; rerun `pnpm dev:tauri` or `pnpm build:tauri` |
| `sidecar-crashed` / `dyld: Library not loaded` | Missing llama.cpp dylib dependencies | Rerun `pnpm prepare:llama-server`; confirm `libggml*`, `libllama*`, and `libmtmd*` are in the runtime directory |
| `error: invalid argument: --mmproj` | Old llama.cpp server build | Regenerate sidecar files; current scripts fetch llama.cpp `b8989` |
| `omr-request-failed: 400: Failed to tokenize prompt` | Multimodal marker mismatch | Keep `/completions`, `LLAMA_MEDIA_MARKER=<__media__>`, and `<__media__>` inside `prompt_string` |
| Web Lab shows desktop-only message | Expected web fallback | Use the Tauri desktop app for OMR |
