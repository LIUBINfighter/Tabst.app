---
name: tauri-unified-debug-workflow
description: Tauri 2 end-to-end debugging workflow that chooses between official baseline tools, CrabNebula DevTools, and a live MCP bridge. Use when debugging is ambiguous or spans frontend UI, Rust commands, IPC, logs, and runtime state together.
---

# Unified Tauri 2 debug workflow

Use this skill to choose the right tool instead of jumping straight into random instrumentation.

## Decision tree

### Start with official baseline when

- the issue is not yet localized
- you need first-pass WebView or Rust console visibility
- you suspect a simple frontend/runtime error

### Move to CrabNebula DevTools when

- browser devtools are not enough
- the problem involves Rust command handlers, spans, capabilities, or IPC timing
- you need to inspect backend logs and payloads without adding ad-hoc prints everywhere

### Move to the MCP bridge when

- the agent must click, type, inspect DOM state, or take screenshots
- reproduction depends on real UI state
- you want to monitor IPC while driving the live app

## Recommended escalation path

1. **Baseline**
   - `tauri dev`
   - `RUST_BACKTRACE=1 tauri dev` if Rust crashes
   - open WebView inspector
2. **CrabNebula**
   - instrument the app in debug mode
   - inspect Console + Calls during reproduction
3. **MCP bridge**
   - connect the running app to the MCP server
   - capture screenshot + DOM snapshot
   - start IPC monitoring
   - reproduce via agent-driven interaction

## Symptom-to-tool mapping

- **UI looks wrong** → baseline inspector first, MCP bridge second
- **Frontend says generic error** → CrabNebula Console/Calls
- **Backend command slow or flaky** → CrabNebula Calls + spans
- **Can only reproduce by clicking through the app** → MCP bridge
- **Permissions/capabilities suspect** → CrabNebula config/capability views

## Working style

- prefer evidence from logs, spans, screenshots, DOM snapshots, and captured IPC
- change only one thing at a time
- keep all debug-only instrumentation behind debug gates
- after fixing, verify in the lightest tool that proves the issue is gone

## Output expectation

When using this workflow, always summarize:

1. where the failure was observed
2. which tool provided the decisive evidence
3. what the root cause was
4. what changed to fix it
