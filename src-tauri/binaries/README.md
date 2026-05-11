# External OMR provider binaries

Tabst's OMR Lab now talks to an external HTTP provider instead of bundling a
local inference runtime. This directory is intentionally kept empty except for
this README and `.gitignore`.

Run an OMR provider separately and point Tabst at it with environment variables:

```sh
TABST_OMR_ENDPOINT=http://127.0.0.1:18089 TABST_OMR_API_KIND=tabst pnpm dev
```

Supported provider adapters:

- `TABST_OMR_API_KIND=tabst` for the lightweight `/health` + `/transcribe` API.
- `TABST_OMR_API_KIND=openai` for OpenAI-compatible `/v1/chat/completions`
  servers such as LM Studio.
- `TABST_OMR_API_KIND=llamacpp` for an already-running llama.cpp HTTP server.

Do not commit generated model files or provider binaries here unless the product
explicitly returns to a bundled-runtime design.
