---
name: tauri-hypothesi-mcp-bridge
description: Use the Hypothesi Tauri MCP server and tauri-plugin-mcp-bridge to let an agent inspect and drive a live Tauri 2 app. Trigger when debugging needs screenshots, DOM snapshots, clicks, typing, JS execution, window management, logs, or real-time IPC monitoring.
---

# Hypothesi MCP bridge for Tauri 2

This is the best fit when the agent must see and operate the running app instead of guessing from code.

## Install the bridge into the Tauri app

```bash
cargo add tauri-plugin-mcp-bridge
```

Register it only in debug builds:

```rust
fn main() {
    let mut builder = tauri::Builder::default();

    #[cfg(debug_assertions)]
    {
        builder = builder.plugin(tauri_plugin_mcp_bridge::init());
    }

    builder
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

## Server/client expectation

- MCP server side: `@hypothesi/tauri-mcp-server`
- Optional CLI: `@hypothesi/tauri-mcp-cli`
- Default driver session port is typically `9223`

## Highest-value tools

- `driver_session`: start/stop/status the automation bridge
- `manage_window`: list and target windows
- `webview_screenshot`: capture current UI state
- `webview_dom_snapshot`: inspect structured UI state
- `webview_execute_js`: verify runtime assumptions
- `read_logs`: inspect console, Android, iOS, or system logs
- `ipc_monitor`: start or stop IPC capture during reproduction
- `ipc_get_captured`: review what commands/events actually happened
- `ipc_execute_command`: directly call backend commands when isolating behavior

## Recommended debugging sequence

1. Start the app in debug mode.
2. Start `driver_session` and confirm connection.
3. Use `manage_window` to list windows if the app is multi-window.
4. Take a screenshot and DOM snapshot before interacting.
5. Start `ipc_monitor` if the bug may cross the frontend/backend boundary.
6. Reproduce with clicks, typing, scrolling, or JS.
7. Read logs and captured IPC immediately after the failure.

## Use this bridge when

- the bug is visual or interaction-dependent
- reproducing the issue requires clicking through real UI state
- frontend state and backend IPC must be observed together
- browser-only automation does not work because the app is Tauri-native

## Common failure points

- bridge plugin not registered in the Tauri app
- app not started in a debug build that includes the plugin
- MCP server started but no driver session running
- wrong target window in multi-window apps

## Safety notes

- keep the bridge debug-only
- prefer a local-only setup
- treat screenshots, DOM snapshots, and logs as sensitive runtime artifacts
