# RENDERER KNOWLEDGE BASE

## OVERVIEW
`src/renderer` is the React application layer: editor, preview, command UI, worker/LSP integration, and global state orchestration.

## STRUCTURE
```text
src/renderer/
├── components/   # UI surfaces (editor/preview/settings/tutorial/git)
├── hooks/        # alphaTab + preview lifecycle hooks
├── lib/          # parsing, completion, commands, theme system
├── store/        # Zustand app/theme stores
├── workers/      # AlphaTex LSP worker
├── data/         # command JSON, tutorial content
├── i18n/         # localization bootstrap + locales
└── types/        # cross-process/shared types
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| App-level mode switching | `App.tsx`, `store/appStore.ts` | editor/enjoy/tutorial/settings/git/cloud |
| Renderer bootstrap | `main.tsx` | i18n + ThemeProvider + desktop API shim |
| Preview/render path | `components/Preview.tsx`, `hooks/usePreview*` | heavy alphaTab lifecycle |
| Editor/LSP path | `components/Editor.tsx`, `hooks/useEditorLSP.ts` | CodeMirror + worker client |
| Cloud public score browsing | `components/CloudSidebar.tsx`, `components/CloudView.tsx`, `lib/cloud-public-scores.ts` | desktop read-only cloud workspace; web public-score import feed |
| Commands and palette | `lib/command-registry.ts`, `lib/ui-command-registry.ts` | availability + dispatch |

## CONVENTIONS
- Keep shared state in Zustand stores; component-local state is for local UI only.
- Maintain command flow through registry + event dispatch, not ad-hoc window events.
- Keep alphaTab-heavy logic in hooks/lib; components coordinate UI and interaction.
- Preserve i18n usage in user-visible strings (`react-i18next`).
- Cloud mode should reuse the same `Editor` / `Preview` structure as local workspace wherever possible; only source/mutability differ.
- Web runtime may import public cloud scores into Sandbox for browsing, but desktop Cloud remains a separate read-only workspace mode.

## ANTI-PATTERNS
- Duplicating source-of-truth state in multiple components.
- Bypassing command availability checks for command execution.
- Coupling worker-specific logic directly into unrelated UI components.
