# Tauri Migration Status

> **Status:** Historical — completed Tauri migration report. The branch,
> commit, and verification details below describe the migration snapshot, not
> the current repository. See the [current architecture overview](../../architecture/OVERVIEW.md).

Last updated: 2026-05-11
Current branch: `vibe`
Reference commit: `cfc9fbe`

## Summary

The repository has completed the Phase 1 platform cutover to a Tauri-first desktop runtime.

The product build, desktop release entrypoints, renderer desktop bridge naming, and CI desktop build path now assume Tauri as the only supported desktop shell.

## Completed In Phase 1

- Default desktop commands now point to Tauri:
  - `pnpm dev`
  - `pnpm build`
  - `pnpm release`
- Legacy desktop runtime code has been removed from `src/main`.
- Legacy desktop dependencies and packaging config have been removed from `package.json`.
- Renderer desktop integration is now standardized on `window.desktopAPI`.
- Runtime adapters now live in:
  - `src/renderer/lib/desktop-api.ts`
  - `src/renderer/lib/tauri-desktop-api.ts`
- CI desktop build validation now runs the Tauri build path only.
- Tauri security and runtime verification now has a shared baseline command:
  - `pnpm verify:tauri`
- CI now runs the shared Tauri verification baseline before bundling.

## Intentionally Deferred

- Documentation cleanup outside the highest-signal files
- Provider-specific production deployment remains deferred; the app validates the HTTP integration path only.

## Verification Performed

- `pnpm check`
- `pnpm verify:tauri`
- `pnpm build:tauri:ci`

## Current Repository Shape

- Desktop shell: `src-tauri/`
- Renderer app: `src/renderer/`
- Desktop bridge contract: `src/renderer/types/desktop.d.ts`
- Browser/Tauri runtime detection and fallback: `src/renderer/lib/desktop-api.ts`
- Tauri invoke adapter: `src/renderer/lib/tauri-desktop-api.ts`

## Open Risks

- Some historical engineering docs still describe pre-cutover architecture and need systematic review.
- CI now has a Tauri-first build-performance baseline, but we still do not sample interactive runtime metrics such as preview lifecycle churn or long-session listener growth.

## Recommended Next Phase

The next phase should focus on Tauri normalization.

Suggested order:

1. Extend the Tauri performance baseline beyond build metrics if runtime-interaction sampling is needed again.
2. Extend `pnpm verify:tauri` with additional desktop-safety assertions if the command surface grows.
3. Incrementally update historical engineering docs to reflect the current Tauri-first architecture.

## Collaboration Notes

If another agent or session continues this migration, start by checking:

- `git log --oneline --decorate --max-count=20`
- `pnpm check`
- this file

Do not reintroduce compatibility shims for the pre-cutover desktop runtime unless there is a narrowly scoped rollback requirement.
