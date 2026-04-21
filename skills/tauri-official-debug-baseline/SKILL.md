---
name: tauri-official-debug-baseline
description: Official Tauri 2 debugging baseline for desktop and mobile apps. Use when debugging any Tauri v2 issue before heavier tooling, especially for WebView errors, Rust panics, missing logs, devtools access, debug builds, LLDB/GDB workflows, or plugin-log setup.
---

# Tauri 2 official debugging baseline

Start here before reaching for heavier tooling. This workflow stays inside Tauri's documented support boundary.

## 1. Check the Rust side first

- Run the app with `tauri dev` and read the terminal output.
- If Rust crashes or exits unexpectedly, rerun with backtraces:
  - macOS/Linux: `RUST_BACKTRACE=1 tauri dev`
- Add temporary `println!` or `log` instrumentation only in debug-only code when needed.

## 2. Open the WebView inspector

- Right click the WebView and choose **Inspect**.
- Shortcuts:
  - macOS: `Cmd+Option+I`
  - Windows/Linux: `Ctrl+Shift+I`
- Platform inspector backend:
  - macOS: Safari inspector
  - Windows: Edge DevTools
  - Linux: WebKitGTK inspector

## 3. Open devtools programmatically in debug builds

Use this when the app UI makes manual opening awkward:

```rust
tauri::Builder::default().setup(|app| {
    #[cfg(debug_assertions)]
    {
        let window = app.get_webview_window("main").unwrap();
        window.open_devtools();
    }
    Ok(())
});
```

- Keep `open_devtools()` and `close_devtools()` behind `#[cfg(debug_assertions)]`.
- Do not enable production devtools on macOS unless you explicitly accept private API risk.

## 4. Build a debuggable packaged app when `tauri dev` is not enough

- Use `tauri build --debug`.
- Debug bundle output lands under `src-tauri/target/debug/bundle`.
- Run the built app from a terminal if you still need Rust stdout/stderr.

## 5. Use core-process debugging for Rust logic bugs

- Tauri officially supports LLDB/GDB for the Rust core process.
- Prefer LLDB on macOS.
- If using VS Code or JetBrains, remember these debugger setups usually invoke `cargo` directly, not all Tauri CLI lifecycle hooks.

## 6. Add the official log plugin when logs need to cross Rust and frontend

- Use `tauri-plugin-log` / `@tauri-apps/plugin-log` for persistent, filterable logs.
- Good default targets:
  - stdout/stderr for terminal capture
  - file logs for postmortem review
  - WebView forwarding when frontend + backend timing matters

## Escalation guide

- Use **CrabNebula DevTools** when you need Rust-side observability, IPC call timing, config inspection, or tracing spans.
- Use a **Tauri MCP bridge** when the agent must see the running UI, click/type, inspect DOM state, or monitor IPC while reproducing a bug.

## Guardrails

- Keep debug-only helpers behind `#[cfg(debug_assertions)]` or `cfg!(dev)`.
- Do not ship the `devtools` Cargo feature casually on macOS App Store targets.
- Start with official tools before blaming framework internals.
