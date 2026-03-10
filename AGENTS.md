# PROJECT KNOWLEDGE BASE

**Generated:** 2026-03-10 00:40:00 +0800
**Commit:** 6892d6d
**Branch:** refactor/tauri

## OVERVIEW
Tabst is a Tauri desktop app for writing and playing AlphaTex guitar tabs.
Runtime is split across the Tauri Rust shell (`src-tauri`), React renderer (`src/renderer`), and a worker-based AlphaTex LSP pipeline.

## STRUCTURE
```text
Tabst.app/
├── src/                     # product renderer/runtime code
│   └── renderer/            # React UI, alphaTab integration, worker/LSP
├── src-tauri/               # Tauri shell, commands, updater, desktop capabilities
├── scripts/                 # codemix, vendor sync tooling
├── docs/dev/                # active engineering docs (alphatab/alphatex/ops)
├── .github/workflows/       # CI, release, mac release, pages deploy
├── public/assets/           # Bravura, soundfont, alphaTab runtime assets
└── .tmp/notebook-navigator/ # unrelated sandbox project (exclude from product work)
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Desktop boot and command wiring | `src-tauri/src/lib.rs` | registers Tauri commands and plugins |
| Renderer bootstrap | `src/renderer/main.tsx` | mounts App + i18n + ThemeProvider |
| Shared app state | `src/renderer/store/appStore.ts` | highest fan-in module in renderer |
| Theme logic | `src/renderer/lib/theme-system/`, `src/renderer/store/themeStore.ts` | CSS variables + persisted preferences |
| AlphaTex parsing/positions | `src/renderer/lib/alphatex-parse-positions.ts` | AST-first parser with fallback path |
| Completion and hover | `src/renderer/lib/alphatex-completion.ts`, `src/renderer/workers/alphatex.worker.ts` | local command JSON first, upstream fallback |
| Preview lifecycle | `src/renderer/components/Preview.tsx`, `src/renderer/hooks/usePreview*` | API init/destroy/reinit and telemetry |
| Print pipeline | `src/renderer/components/PrintPreview.tsx` | dedicated API instance + print CSS/font rules |
| Git integration | `src-tauri/src/lib.rs`, `src/renderer/components/GitWorkspace.tsx` | porcelain parse + unified diff display |

## CONVENTIONS
- Formatter/linter is **Biome** (`biome.json`): tab indentation, double quotes, organize imports enabled.
- Package manager is **pnpm** (`packageManager: pnpm@10.28.0`).
- Shared playback/file/selection/UI state belongs in Zustand (`useAppStore`), not scattered component state.
- Deep alphaTab config changes (theme/colors) require API destroy + recreate; `render()` alone is insufficient.
- Completion/hover source precedence: `src/renderer/data/alphatex-commands.json` first, upstream docs second.
- Desktop bridge surface in the renderer is `window.desktopAPI`.

## ANTI-PATTERNS (THIS PROJECT)
- Parsing AlphaTex structure with regex when AST parser is available.
- Storing `AlphaTabApi` in React state.
- Theme switching without track-config save/restore around API rebuild.
- Changing print rendering without preserving `.at` font-size `34px` and absolute Bravura URL loading.
- Reintroducing legacy desktop-runtime assumptions into renderer code or scripts.
- Treating `.tmp/notebook-navigator` as part of Tabst runtime.

## UNIQUE STYLES
- Interaction zoning: top/left for navigation context; bottom/right for command actions.
- Global bottom bar is right-aligned with strict cascade: staff → display → playback params → transport.
- Tauri-first desktop packaging and updater flow with per-platform release workflows.
- Ops docs are weekly/report style under `docs/dev/ops/`.

## COMMANDS
```bash
pnpm dev
pnpm format
pnpm check
pnpm build
pnpm release
pnpm release:mac
pnpm release:linux
pnpm release:win
pnpm mix
pnpm mix:main
pnpm mix:render
pnpm mix:doc
pnpm mix:config
```

## NOTES
- CI/release workflows: `.github/workflows/{ci,release,release-linux,release-mac,website-pages}.yml`.
- Migration state and next steps are tracked in `docs/dev/TAURI_MIGRATION_STATUS.md`.
- Read nearest child `AGENTS.md` before editing deeper directories.
