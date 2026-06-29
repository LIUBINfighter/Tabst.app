# COMPONENTS KNOWLEDGE BASE

## OVERVIEW
`src/renderer/components` contains user-facing surfaces for editor, preview/print, settings, tutorial, git, and shared UI primitives.

## DOMAIN SPLIT
- `Preview*` + `Tracks*`: alphaTab playback/render interaction.
- `Print*`: print-only API lifecycle and pagination.
- `Cloud*`: public cloud score browsing surfaces; sidebar object list + read-only workspace reuse.
- `settings/*`: settings pages (appearance/playback/commands/templates/updates/etc.).
- `tutorial/*`: tutorial rendering + playground components.
- `ui/*`: reusable visual primitives.

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Preview core lifecycle | `Preview.tsx` | alphaTab API ownership + command events |
| Cloud list/detail surfaces | `CloudSidebar.tsx`, `CloudView.tsx` | desktop cloud object list + read-only workspace reuse |
| Print rendering/export | `PrintPreview.tsx`, `PrintTracksPanel.tsx` | dedicated print API + pagination |
| Bottom control system | `GlobalBottomBar.tsx`, `StaffControls.tsx`, `BpmStepper.tsx` | right-aligned cascade |
| Editor UI shell | `Editor.tsx`, `InlineEditorCommandBar.tsx` | CodeMirror-facing UI layer |
| Settings area | `SettingsView.tsx`, `settings/*` | page routing and settings panels |
| Tutorial area | `TutorialView.tsx`, `tutorial/*` | markdown/MDX + playground UI |

## CONVENTIONS
- Keep preview and print APIs separate; print preview must not reuse live preview instance.
- Keep Cloud loaded-state UI aligned with the normal workspace editor/preview structure; avoid introducing extra card/playground wrappers around the reused editor.
- Preserve print font contract: absolute Bravura URL + `.at` font-size 34.
- Keep global transport/staff/display controls in bottom bar order.
- Reuse `ui/*` primitives (`IconButton`, `Tooltip`, `Select`, `Button`) for consistency.
- Ensure global/window listeners are paired with cleanup in `useEffect` teardown.

## CROSS-FILE CONTRACTS
- `GlobalBottomBar` ordering is intentional UX contract; update cautiously.
- Preview command execution should flow through command events/registry, not bespoke handlers.
- Print track controls and preview surface must stay in sync on staff/zoom/layout parameters.

## ANTI-PATTERNS
- Moving high-frequency playback/file actions away from right-side bottom controls.
- Re-implementing AlphaTex parse/selection logic inside components (belongs in `lib/`).
- Touching alphaTab internals without guard checks around `apiRef.current` availability.
