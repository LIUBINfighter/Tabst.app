# llama.cpp sidecar binaries

This directory is populated by `scripts/fetch-llama-server.sh` and should not
store downloaded binaries in git.

The Tauri bundle config references these files through `bundle.externalBin`, and
the fetch/build wrappers create the platform-suffixed files that Tauri expects:

- `llama-server-<target-triple>`
- `libggml*.dylib-<target-triple>`
- `libllama*.dylib-<target-triple>`
- `libmtmd*.dylib-<target-triple>`

Supported target triples for the current macOS-only OMR Lab build are:

- `aarch64-apple-darwin`
- `x86_64-apple-darwin`

To repopulate the directory locally, run:

```sh
pnpm prepare:llama-server
```

The development and build wrappers also run the fetch step automatically:

```sh
pnpm dev:tauri
pnpm build:tauri
pnpm build:tauri:ci
```

Do not commit the generated `llama-server` or `.dylib` files. If the expected
runtime payload changes, update `scripts/fetch-llama-server.sh`,
`src-tauri/tauri.conf.json`, and this README together.
