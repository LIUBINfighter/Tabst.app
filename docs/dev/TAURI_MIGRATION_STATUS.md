# Tauri Migration Status

Last updated: 2026-03-10
Current branch: `refactor/tauri`
Reference commit: `6892d6d`

## Summary

The repository has completed the Phase 1 platform cutover from Electron to Tauri-first desktop runtime.

The product build, desktop release entrypoints, renderer desktop bridge naming, and CI desktop build path now assume Tauri as the only supported desktop shell.

## Completed In Phase 1

- Default desktop commands now point to Tauri:
  - `pnpm dev`
  - `pnpm build`
  - `pnpm release`
- Electron runtime code has been removed from `src/main`.
- Electron dependencies and packaging config have been removed from `package.json`.
- Renderer desktop integration has been renamed from `window.electronAPI` to `window.desktopAPI`.
- Runtime adapters now live in:
  - `src/renderer/lib/desktop-api.ts`
  - `src/renderer/lib/tauri-desktop-api.ts`
- CI desktop build validation now runs the Tauri build path only.

## Intentionally Deferred

- Documentation cleanup outside the highest-signal files
- Tauri capability tightening and CSP hardening
- Rust command-layer modularization inside `src-tauri/src/lib.rs`
- Tauri-first performance instrumentation and CI gates

## Verification Performed

- `pnpm check`
- `pnpm exec vitest run src/renderer/lib/desktop-api.test.ts src/renderer/lib/tauri-invoke-args.test.ts src/renderer/lib/global-settings.test.ts src/renderer/lib/print-window.test.ts src/renderer/lib/workspace-metadata-store.test.ts`

Both passed after the Phase 1 cutover.

## Current Repository Shape

- Desktop shell: `src-tauri/`
- Renderer app: `src/renderer/`
- Desktop bridge contract: `src/renderer/types/desktop.d.ts`
- Browser/Tauri runtime detection and fallback: `src/renderer/lib/desktop-api.ts`
- Tauri invoke adapter: `src/renderer/lib/tauri-desktop-api.ts`

## Open Risks

- Some historical engineering docs still describe Electron-era architecture and need systematic review.
- Tauri security posture is not tightened yet:
  - capabilities are still broad
  - CSP is still permissive
- Performance automation was removed with the Electron scripts and has not yet been replaced with Tauri-native measurement.
- `src-tauri/src/lib.rs` still carries a large, centralized command surface and should be split by domain.

## Recommended Next Phase

Phase 2 should focus on Tauri normalization rather than more feature work.

Suggested order:

1. Split `src-tauri/src/lib.rs` into domain modules such as `fs`, `git`, `repo`, `settings`, `updater`, and `print`.
2. Review `src-tauri/capabilities/default.json` and reduce permissions to the minimum required by each window.
3. Audit `src-tauri/tauri.conf.json` and move away from permissive CSP settings.
4. Rebuild performance scripts as Tauri-first desktop benchmarks, then reconnect them to CI.

## Collaboration Notes

If another agent or session continues this migration, start by checking:

- `git log --oneline --decorate --max-count=20`
- `pnpm check`
- this file

Do not reintroduce compatibility shims for Electron unless there is a narrowly scoped rollback requirement.
