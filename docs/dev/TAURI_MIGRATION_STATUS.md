# Tauri Migration Status

Last updated: 2026-05-11
Current branch: `vibe`
Reference commit: `cfc9fbe`

## Summary

The repository has completed the Phase 1 platform cutover to a Tauri-first desktop runtime.

The product build, desktop release entrypoints, renderer desktop bridge naming, and CI desktop build path now assume Tauri as the only supported desktop shell.

The desktop runtime now also hosts the experimental OMR Lab through the Tauri command layer and an external HTTP OMR provider.

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
- OMR Lab desktop bridge is exposed as `window.desktopAPI.ai` with web fallback in `src/renderer/lib/desktop-api.ts`.
- OMR Tauri commands live in `src-tauri/src/ai_ocr_commands.rs`, with HTTP provider adapters in `ai_provider.rs` and async job state in `ai_job_manager.rs`.
- OMR inference is external-provider managed; dev/build no longer fetch or package inference binaries.

## Intentionally Deferred

- Documentation cleanup outside the highest-signal files
- Provider-specific production deployment remains deferred; the app validates the HTTP integration path only.

## Verification Performed

- `pnpm check`
- `pnpm verify:tauri`
- `pnpm build:tauri:ci`
- End-to-end OMR Lab manual test on macOS

These passed after the OMR Lab provider integration and request-shape fixes.

## Current Repository Shape

- Desktop shell: `src-tauri/`
- Renderer app: `src/renderer/`
- Desktop bridge contract: `src/renderer/types/desktop.d.ts`
- Browser/Tauri runtime detection and fallback: `src/renderer/lib/desktop-api.ts`
- Tauri invoke adapter: `src/renderer/lib/tauri-desktop-api.ts`
- OMR Lab UI: `src/renderer/components/settings/LabPage.tsx`
- OMR provider policy: `src-tauri/binaries/README.md`

## Open Risks

- Some historical engineering docs still describe pre-cutover architecture and need systematic review.
- CI now has a Tauri-first build-performance baseline, but we still do not sample interactive runtime metrics such as preview lifecycle churn or long-session listener growth.
- OMR Lab depends on an external provider process; deployment and lifecycle ownership for production providers still needs product design.

## Recommended Next Phase

The next phase should keep Tauri normalization and OMR provider productionization separate.

Suggested order:

1. Extend the Tauri performance baseline beyond build metrics if runtime-interaction sampling is needed again.
2. Extend `pnpm verify:tauri` with additional desktop-safety assertions if the command surface grows.
3. Decide whether the production OMR provider remains external, becomes bundled again, or moves to a hosted API.

## Collaboration Notes

If another agent or session continues this migration, start by checking:

- `git log --oneline --decorate --max-count=20`
- `pnpm check`
- this file

Do not reintroduce compatibility shims for the pre-cutover desktop runtime unless there is a narrowly scoped rollback requirement.
