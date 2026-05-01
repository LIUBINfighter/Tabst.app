# OMR Model Debug Notes

Last updated: 2026-05-02

This document records the local OMR model debugging workflow for the Tauri desktop Lab. It focuses on development-machine validation, not packaging or distribution.

## Current local model under test

The local model archive used for the 2026-05-02 debug session is in the project `tmp/` directory, not the system `/tmp` root:

```text
tmp/round3_ministral3_3b_20260427T102707Z_artifacts.tar.zst
```

The archive contains both quantized and BF16 artifacts. For full-precision local validation, extract only the BF16 GGUF pair:

```text
artifacts/round3_ministral3_3b_merged-BF16.gguf
artifacts/round3_ministral3_3b_mmproj-BF16.gguf
```

Extraction target used by the app:

```bash
rm -rf /tmp/tabst-local-omr-model
mkdir -p /tmp/tabst-local-omr-model
tar -xf tmp/round3_ministral3_3b_20260427T102707Z_artifacts.tar.zst \
  -C /tmp/tabst-local-omr-model \
  --strip-components=1 \
  artifacts/round3_ministral3_3b_merged-BF16.gguf \
  artifacts/round3_ministral3_3b_mmproj-BF16.gguf
```

Expected files:

```text
/tmp/tabst-local-omr-model/round3_ministral3_3b_merged-BF16.gguf
/tmp/tabst-local-omr-model/round3_ministral3_3b_mmproj-BF16.gguf
```

Both files must start with GGUF magic bytes. The current sizes are approximately:

| File | Size |
|------|------|
| `round3_ministral3_3b_merged-BF16.gguf` | 6.86 GB |
| `round3_ministral3_3b_mmproj-BF16.gguf` | 850 MB |

## Local override contract

The backend resolves local OMR models before falling back to the default downloaded manifest.

Preferred directory mode:

```bash
TABST_OMR_MODEL_DIR=/tmp/tabst-local-omr-model \
TABST_OMR_CTX_SIZE=8192 \
pnpm dev
```

Directory discovery requires exactly one main `.gguf` and exactly one `.gguf` whose filename contains `mmproj`.

Explicit file mode:

```bash
TABST_OMR_MODEL_PATH=/tmp/tabst-local-omr-model/round3_ministral3_3b_merged-BF16.gguf \
TABST_OMR_MMPROJ_PATH=/tmp/tabst-local-omr-model/round3_ministral3_3b_mmproj-BF16.gguf \
TABST_OMR_CTX_SIZE=8192 \
pnpm dev
```

Optional knobs:

| Variable | Meaning | Validation |
|----------|---------|------------|
| `TABST_OMR_CTX_SIZE` | llama.cpp context size | integer >= 1024 |
| `TABST_OMR_NP` | llama.cpp parallel slots | integer >= 1 |

Invalid local overrides are surfaced through `ModelStatus.error` and the Lab runtime health panel. Examples include `local-model-dir-not-found`, `local-model-dir-ambiguous`, `local-model-not-gguf`, and `local-ctx-size-invalid`.

## Request payload

The custom model was trained without an instruction/system-text environment. Do not send task text, system prompts, tuning hints, language hints, or any other natural-language instruction.

The only text in `prompt_string` is the llama.cpp image marker:

```json
{
  "prompt": {
    "prompt_string": "<__media__>",
    "multimodal_data": ["<raw base64 image>"]
  },
  "temperature": 0.1,
  "n_predict": 2048,
  "stream": false
}
```

`<__media__>` is still required because llama.cpp maps each marker to one `multimodal_data` entry. Removing it causes marker/bitmap count errors.

## Standalone smoke test

Before debugging the UI, validate the sidecar and model outside Tauri:

```bash
LLAMA_MEDIA_MARKER='<__media__>' \
src-tauri/target/debug/llama-server \
  -m /tmp/tabst-local-omr-model/round3_ministral3_3b_merged-BF16.gguf \
  --mmproj /tmp/tabst-local-omr-model/round3_ministral3_3b_mmproj-BF16.gguf \
  --host 127.0.0.1 \
  --port 18088 \
  -np 1 \
  --ctx-size 8192
```

Expected startup evidence:

```text
srv    load_model: loaded multimodal model, '/tmp/tabst-local-omr-model/round3_ministral3_3b_mmproj-BF16.gguf'
main: server is listening on http://127.0.0.1:<port>
```

The 2026-05-02 standalone check reached `/health` in about 2.5 seconds and returned HTTP 200 for a minimal image-only `/completions` request.

## Sidecar runtime pitfalls

### Placeholder dylibs

`src-tauri/target/debug/libllama.dylib`, `libmtmd.dylib`, and `libggml*.dylib` must be Mach-O dynamic libraries. If they are 139-byte shell placeholders, `llama-server` exits immediately with dyld errors such as:

```text
Library not loaded: @rpath/libllama.dylib
Reason: ... libllama.dylib (slice is not valid mach-o file)
```

Fix:

```bash
pnpm prepare:llama-server
bash scripts/dev-tauri-with-sidecar.sh --help
```

The fetch script now validates prepared runtime files with `file ... | grep Mach-O`, so placeholder scripts are no longer treated as ready.

### Residual processes

Old `llama-server` processes can remain from earlier dev runs if the app exits through paths that bypassed explicit cleanup. The Tauri app now stops the sidecar on `RunEvent::ExitRequested` and `RunEvent::Exit`.

Check for leftovers:

```bash
ps -axo pid,etime,command | grep llama-server | grep -v grep
```

Kill stale test processes only after confirming they are not owned by the current app session.

## Troubleshooting table

| Symptom | Cause | Fix |
|---------|-------|-----|
| `local-model-dir-not-found` | `TABST_OMR_MODEL_DIR` points to a missing directory | Extract the BF16 GGUF pair to `/tmp/tabst-local-omr-model` or use explicit file env vars |
| `local-model-dir-ambiguous` | Directory discovery does not find exactly one main model and one `mmproj` GGUF | Keep only the intended main `.gguf` plus the matching `mmproj` `.gguf`, or use explicit file env vars |
| App loads SmolVLM unexpectedly | `/tmp/tabst-local-omr-model` contains old SmolVLM symlinks or env vars are not exported into `pnpm dev` | Remove stale symlinks and restart with `TABST_OMR_MODEL_DIR=/tmp/tabst-local-omr-model` |
| `sidecar-timeout` | Sidecar failed before `/health`, often due to bad dylibs | Run standalone smoke test and inspect dyld/log output |
| `number of bitmaps ... does not match number of markers` | `prompt_string` marker count does not match `multimodal_data` count | Keep exactly one `<__media__>` for one image |

## Verification gates

After changing this path, run:

```bash
pnpm check
cargo fmt --check --manifest-path src-tauri/Cargo.toml
cargo check --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml
```

For runtime behavior, prefer the standalone smoke test first, then run the full desktop flow via `pnpm dev`.
