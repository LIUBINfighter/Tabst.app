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
├── scripts/                 # codemix, vendor sync, OMR provider smoke tooling
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
| Cloud public score browsing | `src/renderer/components/CloudSidebar.tsx`, `src/renderer/components/CloudView.tsx`, `src/renderer/lib/cloud-public-scores.ts` | desktop read-only cloud workspace + web public score import path |
| Print pipeline | `src/renderer/components/PrintPreview.tsx` | dedicated API instance + print CSS/font rules |
| Git integration | `src-tauri/src/lib.rs`, `src/renderer/components/GitWorkspace.tsx` | porcelain parse + unified diff display |
| OMR Lab UI | `src/renderer/components/settings/LabPage.tsx`, `src/renderer/hooks/useOmrJob.ts`, `src/renderer/store/labStore.ts` | desktop-only image-to-alphaTex experiment |
| OMR desktop bridge | `src/renderer/types/ai.ts`, `src/renderer/lib/tauri-desktop-api.ts`, `src/renderer/lib/desktop-api.ts` | all renderer AI calls go through `window.desktopAPI.ai` |
| OMR Tauri backend | `src-tauri/src/ai_ocr_commands.rs`, `src-tauri/src/ai_provider.rs`, `src-tauri/src/ai_job_manager.rs`, `src-tauri/src/lib.rs` | HTTP provider client, job state, command handlers |
| OMR provider smoke tooling | `scripts/omr_onnx_provider.py`, `src-tauri/binaries/README.md` | temporary ONNX HTTP provider; no bundled inference runtime |
| OMR model/provider debugging | `docs/dev/OMR_MODEL_DEBUG.md`, `docs/dev/OMR_LAB_RUNBOOK.md` | ONNX provider setup, provider env vars, smoke tests |

## CONVENTIONS
- Formatter/linter is **Biome** (`biome.json`): tab indentation, double quotes, organize imports enabled.
- Package manager is **pnpm** (`packageManager: pnpm@10.28.0`).
- Shared playback/file/selection/UI state belongs in Zustand (`useAppStore`), not scattered component state.
- Deep alphaTab config changes (theme/colors) require API destroy + recreate; `render()` alone is insufficient.
- Completion/hover source precedence: `src/renderer/data/alphatex-commands.json` first, upstream docs second.
- Desktop bridge surface in the renderer is `window.desktopAPI`.
- Desktop Cloud mode is intentionally public-only and read-only. The selected cloud score should reuse the normal `Editor` / `Preview` workspace experience instead of a parallel viewer stack.
- Web runtime keeps Sandbox as the primary repo; public Tabst DB scores are appended/imported into that repo and refreshed by `at.meta.source` on initialization.
- OMR Lab is desktop-only; web shows a desktop-only fallback. Inference is handled by an external HTTP provider configured with `TABST_OMR_ENDPOINT` and `TABST_OMR_API_KIND`.
- `src-tauri/binaries/` keeps only `.gitignore` and `README.md` in git. Do not commit generated model files or provider binaries unless the product explicitly returns to a bundled-runtime design.
- OMR provider adapters are `tabst` (`/health` with `activeModel` + `/transcribe`), `openai` / `lm-studio` (`/v1/chat/completions`), and `llamacpp` (`/completions` against an already-running server).
- The temporary ONNX smoke provider lives at `scripts/omr_onnx_provider.py`; use `--weights-dir` to select the active ONNX weights directory, and see `docs/dev/OMR_MODEL_DEBUG.md` before changing provider preprocessing or request contracts.

## ANTI-PATTERNS (THIS PROJECT)
- Parsing AlphaTex structure with regex when AST parser is available.
- Storing `AlphaTabApi` in React state.
- Theme switching without track-config save/restore around API rebuild.
- Changing print rendering without preserving `.at` font-size `34px` and absolute Bravura URL loading.
- Reintroducing legacy desktop-runtime assumptions into renderer code or scripts.
- Treating `.tmp/notebook-navigator` as part of Tabst runtime.
- Committing generated model files or provider binaries from `src-tauri/binaries/`.
- Reintroducing bundled inference process management before the HTTP provider path has been intentionally redesigned.
- Hard-coding provider-specific preprocessing in the renderer; keep provider/runtime details behind the HTTP provider contract.

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
