# OMR Provider Debug Notes

Last updated: 2026-05-12

This document records the current OMR debugging workflow for Tabst's desktop Lab. The app now talks to an external HTTP provider; it no longer manages model downloads, model manifests, or local inference processes.

## Current temporary model under test

The active smoke-test runtime is the ONNX export in:

```text
tmp/onnx_export/
```

The current model under test is the nested weights directory:

```text
tmp/onnx_export/weights/omr-stage2-815-93x-r03-seq768-frozen-from-top2/
```

Important files:

```text
tmp/onnx_export/runtime.py
tmp/onnx_export/tokenizer_wrapper.py
tmp/onnx_export/weights/omr-stage2-815-93x-r03-seq768-frozen-from-top2/encoder.onnx
tmp/onnx_export/weights/omr-stage2-815-93x-r03-seq768-frozen-from-top2/decoder.onnx
tmp/onnx_export/weights/omr-stage2-815-93x-r03-seq768-frozen-from-top2/metadata.json
tmp/onnx_export/weights/omr-stage2-815-93x-r03-seq768-frozen-from-top2/vocab_v2.json
```

This model is temporary and is only used to validate the application path. Model quality is still evaluated through manual smoke tests; repeated or empty output should be treated as a model/preprocessing issue unless the HTTP contract itself fails.

## Temporary Python environment

The first smoke test used a uv-managed environment:

```bash
uv venv "/var/folders/93/5ny43nm923ddw1v5tpt8fxc80000gn/T/opencode/tabst-onnx-venv" --python 3.12
uv pip install --python "/var/folders/93/5ny43nm923ddw1v5tpt8fxc80000gn/T/opencode/tabst-onnx-venv/bin/python" -r "tmp/onnx_export/requirements.txt" pillow
```

Installed runtime packages included `onnxruntime`, `onnx`, `numpy`, and `pillow`.

## ONNX provider smoke server

Start the development provider:

```bash
/var/folders/93/5ny43nm923ddw1v5tpt8fxc80000gn/T/opencode/tabst-onnx-venv/bin/python \
  scripts/omr_onnx_provider.py \
  --onnx-export-dir tmp/onnx_export \
  --weights-dir tmp/onnx_export/weights/omr-stage2-815-93x-r03-seq768-frozen-from-top2 \
  --port 18089
```

Check health:

```bash
curl http://127.0.0.1:18089/health
```

Expected response:

```json
{"status":"ok","runtime":"onnx","ready":true,"activeModel":"omr-stage2-815-93x-r03-seq768-frozen-from-top2"}
```

`activeModel` is derived from the `--weights-dir` directory name and is displayed in Settings -> Lab after **Check status**. Older compatible providers may omit it; Tabst then falls back to the configured provider model label.

Run Tabst against it:

```bash
TABST_OMR_ENDPOINT=http://127.0.0.1:18089 TABST_OMR_API_KIND=tabst pnpm dev
```

## Provider debug options

The `tabst` provider accepts `options`:

| Option | Meaning |
|--------|---------|
| `maxNewTokens` | Autoregressive decode budget |
| `preprocess` | `native`, `fit-pad-800x320`, or `stretch-800x320` |
| `invert` | Invert normalized image pixels before inference |

The smoke provider composites alpha images over white, emits NCHW float32 tensors, and returns preprocessing metadata in `rawResponse.preprocess`.

## Model-output behavior

Historical `fit-pad-800x320` output from the previous default weights for `tmp/测试图片.png`:

```alphatex
(2.3 1.4 1.5).2
 (2.3{t} 1.4{t} 1.5{t}).4
 1.5.4
 1.5.4
 1.5.4
```

That result parsed as alphaTex but repeated. Use it only as a reminder of the failure mode; the current nested model should be judged with fresh smoke images.

## Standalone request shape

```json
{
  "imageBase64": "<raw base64 image>",
  "options": {
    "maxNewTokens": 48,
    "preprocess": "fit-pad-800x320",
    "invert": false
  }
}
```

Expected response includes:

```json
{
  "alphaTex": "...",
  "tokensUsed": 49,
  "durationMs": 1883,
  "rawResponse": {
    "eos": false,
    "preprocess": {}
  }
}
```

## Troubleshooting

| Symptom | Likely cause | Check/fix |
|---------|--------------|-----------|
| `provider-unavailable` in Tabst | Server is not running or endpoint mismatch | Start provider and check `TABST_OMR_ENDPOINT` |
| `provider-invalid-response` | Provider response is missing `alphaTex` | Inspect provider logs and JSON response |
| Empty or repeated alphaTex | Model/preprocessing mismatch | Try `native`, `fit-pad-800x320`, `stretch-800x320`, and `invert` variants |
| Active model is not shown in Lab | `/health` omitted `activeModel` or the status check failed | Verify `curl http://127.0.0.1:18089/health`; the ONNX smoke provider should report the `--weights-dir` name |
| `ONNX Runtime` text appears before JSON in scripts | Runtime printed to stdout | Suppress runtime stdout when producing machine-readable output |
