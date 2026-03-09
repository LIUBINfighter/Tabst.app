# SRC SUBTREE KNOWLEDGE BASE

## OVERVIEW
`src/` is the renderer/runtime boundary for the React application layer. The desktop shell now lives in `src-tauri/`.

## STRUCTURE
```text
src/
└── renderer/  # React UI, worker/LSP, shared stores and libs
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| UI/runtime behavior | `src/renderer/` | components, hooks, lib, store |
| Desktop bridge contracts | `src/renderer/types/`, `src/renderer/lib/desktop-api.ts` | browser + Tauri runtime surface |

## CONVENTIONS
- Keep UI/browser-only code in `src/renderer`.
- Keep the desktop bridge contract centralized around `window.desktopAPI`.
- Prefer shared type definitions from `src/renderer/types` for desktop payload consistency.

## BOUNDARY CHECKLIST
- New desktop method: add in the Tauri command layer, `desktop-api` runtime adapter, and renderer caller typing.
- New shared payload shape: define/update in `src/renderer/types` first.
- New runtime concern: decide owner (`src-tauri` vs `renderer`) before implementation.

## ANTI-PATTERNS
- Reintroducing platform-specific code directly into unrelated renderer components.
- Duplicating IPC payload types in multiple places.
- Mixing direct filesystem/process logic into renderer modules.
