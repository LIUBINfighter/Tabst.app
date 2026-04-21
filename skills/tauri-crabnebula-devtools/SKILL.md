---
name: tauri-crabnebula-devtools
description: Use CrabNebula DevTools for Tauri 2 Rust-side debugging, IPC analysis, tracing spans, config inspection, and command/event timing. Trigger when browser devtools are insufficient because the issue involves Rust commands, permissions, capability bundles, spans, logs, or backend performance.
---

# CrabNebula DevTools for Tauri 2

Use this when the bug is not purely frontend. CrabNebula fills the visibility gap that browser devtools leave open.

## Install and register

```bash
cargo add tauri-plugin-devtools
```

Register as early as possible and keep it debug-only:

```rust
fn main() {
    #[cfg(debug_assertions)]
    let devtools = tauri_plugin_devtools::init();

    let mut builder = tauri::Builder::default();

    #[cfg(debug_assertions)]
    {
        builder = builder.plugin(devtools);
    }

    builder
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

## Open modes

- **Standalone desktop app**: connect the CrabNebula DevTools app to the running Tauri app.
- **Embedded drawer**: requires Tauri v2 multi-WebView support and `tauri-plugin-devtools-app`.

## What each area is best for

- **Console**: structured Rust logs, dependency logs, tracing context.
- **Calls**: IPC invocation timing, payloads, responses, slow commands, inner logs.
- **Tauri / Config views**: permissions, capability bundles, live config inspection.
- **Sources**: correlate emitted code and runtime behavior when source mapping matters.

## Recommended workflow

1. Reproduce the bug once with minimal noise.
2. Keep the **Console** and **Calls** views open.
3. Perform the exact UI action that fails.
4. Identify:
   - which command/event fired
   - payload values
   - response or error payload
   - slow spans or nested logs
5. If permissions/capabilities are suspect, inspect config/capability data before changing app code.

## Use CrabNebula when

- frontend shows a generic failure but you need the Rust cause
- IPC commands are slow, duplicated, or returning malformed payloads
- a permission/capability misconfiguration is likely
- tracing spans or dependency logs matter

## Do not overuse it

- If the bug is obviously DOM/CSS-only, start with standard WebView inspector instead.
- Keep instrumentation debug-only; it can conflict with production logging expectations.
