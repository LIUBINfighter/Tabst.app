# RENDERER HOOKS KNOWLEDGE BASE

## OVERVIEW
`src/renderer/hooks` encapsulates alphaTab lifecycle, preview event binding, playback synchronization, and editor integration hooks.

## LIFECYCLE ORDER (PREVIEW PATH)
1. Create API and bind listeners.
2. Apply playback/theme/staff configuration.
3. Handle render/error callbacks and telemetry.
4. Unbind listeners and destroy API on teardown/reinit.

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Production live Preview lifecycle | `../components/Preview.tsx` + `usePreview*` | Preview owns orchestration; hooks own focused lifecycle responsibilities |
| Unused lifecycle abstraction | `useAlphaTab.ts` | currently has no production importer; do not treat as the live Preview contract |
| Print-preview lifecycle split | `usePreviewApiLifecycle.ts` | destroy/reinit around print mode |
| Listener ownership | `usePreviewEventBindings.ts` | bind token + teardown discipline |
| Recovery path | `usePreviewErrorRecovery.ts` | parse timeout + fallback restore |
| LSP/editor hook | `useEditorLSP.ts` | language extension loading |

## CONVENTIONS
- Store `AlphaTabApi` in refs; treat hooks as API lifecycle owners.
- Pair every listener/timer with teardown in cleanup.
- Use shared destroy helper paths (`destroyPreviewApi`) for consistent cleanup.
- Gate store writes to changed values where possible to reduce churn.
- Keep current lifecycle documentation aligned with
  `docs/dev/architecture/PREVIEW_LIFECYCLE.md`.

## INTER-HOOK CONTRACTS
- `usePreviewApiLifecycle` controls destroy/reinit around print mode.
- `usePreviewEventBindings` owns bind-token and listener teardown discipline.
- `usePreviewErrorRecovery` owns timeout/recovery signaling for parse failures.

## ANTI-PATTERNS
- Binding duplicate listeners without unbind guards.
- Leaving background timers active after component unmount.
- Replacing hook lifecycle flows with ad-hoc logic in component bodies.
