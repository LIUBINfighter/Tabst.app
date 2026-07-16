# TABST REPOSITORY INSTRUCTIONS

## SCOPE

These instructions apply to the whole repository. Before editing a deeper
source directory, read the nearest child `AGENTS.md`; child instructions refine
this file for their subtree.

Tabst is a Tauri-first workspace for writing and playing AlphaTex guitar tabs.
AlphaTex files are the product source of truth. The React renderer owns the
editor, preview, commands, and shared session state; the Rust runtime owns
filesystem, Git, updater, settings, and operating-system capabilities.

## SOURCES OF TRUTH

Do not copy dynamic repository facts into this file. Verify them at their
authoritative source:

| Fact | Source of truth |
| --- | --- |
| Package manager, scripts, JS dependencies | `package.json` |
| Product version | `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml` |
| Rust dependencies | `src-tauri/Cargo.toml` |
| Desktop command registration | `src-tauri/src/lib.rs` |
| Renderer desktop contract | `src/renderer/types/desktop.d.ts` |
| CI and release availability | `.github/workflows/` |
| Current architecture | `docs/dev/architecture/OVERVIEW.md` and implementation |

Branch names, commits, generated timestamps, exact dependency versions, and
recent verification results become stale quickly and should not be maintained
manually in `AGENTS.md`.

## REPOSITORY BOUNDARIES

```text
Tabst.app/
├── src/renderer/       # React UI, CodeMirror, alphaTab, worker/LSP, stores
├── src-tauri/          # Tauri shell, commands, security checks, updater
├── public/assets/      # Bravura, soundfonts, and alphaTab runtime assets
├── docs/dev/           # Active engineering documentation and historical notes
├── scripts/            # Verification, release, codemix, and vendor-sync tools
├── .github/workflows/  # CI, Web deployment, desktop release workflows
└── .tmp/               # Local/sandbox work; not part of the product runtime
```

Do not treat `.tmp/notebook-navigator` as Tabst product code.

## OWNERSHIP MAP

| Concern | Primary owner | Important collaborators |
| --- | --- | --- |
| Renderer bootstrap | `src/renderer/main.tsx` | i18n, `ThemeProvider`, desktop API installation |
| App shell and workspace modes | `src/renderer/App.tsx` | `store/appStore.ts`, Sidebar, bottom bar |
| Shared workspace/session state | `src/renderer/store/appStore.ts` | persistence helpers and desktop bridge |
| Theme preferences | `src/renderer/store/themeStore.ts` | `lib/theme-system/`, CSS variables |
| Editor workspace | `src/renderer/components/Editor.tsx` | CodeMirror extensions, autosave, LSP hook |
| Live score and playback | `src/renderer/components/Preview.tsx` | `hooks/usePreview*`, alphaTab helpers |
| AlphaTex language worker | `src/renderer/workers/alphatex.worker.ts` | `lib/alphatex-lsp.ts`, local command data |
| AlphaTex positions and selection | `src/renderer/lib/alphatex-parse-positions.ts` | cursor/playback/selection sync modules |
| Commands and palettes | `src/renderer/lib/command-registry.ts` | `ui-command-registry.ts`, command events |
| Print pipeline | `src/renderer/components/PrintPreview.tsx` | PrintWindow, print helpers, print track panel |
| Desktop renderer bridge | `src/renderer/lib/desktop-api.ts` | `tauri-desktop-api.ts`, `types/desktop.d.ts` |
| Desktop command wiring | `src-tauri/src/lib.rs` | domain-specific Rust command modules |
| Cloud public scores | `src/renderer/lib/cloud-public-scores.ts` | CloudSidebar, CloudView, appStore Web import |
| Git integration | `src-tauri/src/git_commands.rs` | appStore Git actions, GitWorkspace |

## CORE INVARIANTS

- Shared repository, file, selection, playback, command, and workspace-mode
  state belongs in Zustand. Component-local state is for local presentation and
  transient UI only.
- Store `AlphaTabApi` in refs. Do not put the mutable API instance in React
  state or Zustand.
- Deep alphaTab configuration changes, including theme resource colors, require
  API destroy and recreate. Calling `render()` alone is insufficient.
- Preserve and restore track, staff, mix, playback, and relevant selection
  state around preview rebuilds.
- Live preview and print preview own separate alphaTab API instances.
- Prefer `AlphaTexParser`/AST semantics for AlphaTex structure and source
  positions. Regex is a guarded fallback, not the primary parser.
- AlphaTex completion and hover use local command data first and upstream
  documentation second. Preserve this precedence.
- Build static registries once and reuse them in completion, hover, cursor, and
  playback hot paths.
- Renderer desktop access goes through `window.desktopAPI`. Do not call Tauri,
  filesystem, process, or platform APIs directly from unrelated components.
- Execute UI actions through the command registry and availability checks.
  Avoid bespoke command paths that bypass disabled-state and context rules.
- Pair every global, DOM, alphaTab, worker, watcher, timer, and async lifecycle
  registration with explicit cleanup and stale-instance guards.
- Desktop Cloud is public-only and read-only, and should reuse the normal
  Editor/Preview workspace. Web public scores are imported into Sandbox and
  refreshed by `at.meta.source`.
- Preserve the global bottom-bar interaction order: staff/display context,
  playback parameters, progress, then transport actions.
- Preserve the print font contract: the `.at` font size remains `34px`, and
  Bravura loading must work from the independent print context.
- Keep user-visible strings in the existing i18n system.

## CROSS-BOUNDARY CHANGE CHECKLISTS

### New or changed desktop API

1. Define or update shared payload types in `src/renderer/types/`.
2. Implement the Rust command in the appropriate `src-tauri/src/*_commands.rs`
   module.
3. Validate every renderer-provided path or external input in Rust.
4. Register the command in `src-tauri/src/lib.rs`.
5. Update `src/renderer/lib/tauri-desktop-api.ts`.
6. Update `src/renderer/types/desktop.d.ts`.
7. Update the Web fallback in `src/renderer/lib/desktop-api.ts` when the method
   is part of the shared runtime surface.
8. Add or update invoke-argument, adapter, and Rust behavior tests.

### Preview or playback lifecycle change

1. Identify which component or hook owns the API, listener, timer, or async
   operation.
2. Preserve track and playback configuration before any rebuild.
3. Guard callbacks against stale API instances and bind tokens.
4. Unbind listeners and clear timers before destroying the API.
5. Keep print-preview suspension/resume behavior intact.
6. Verify empty content, parse failure, audio recovery, theme switching, and
   repeated file changes as applicable.

### AlphaTex language or position change

1. Use the AST parser for structural semantics where available.
2. Preserve local-command-over-upstream precedence.
3. Avoid rebuilding lookup maps per completion or hover request.
4. Keep LSP ranges and CodeMirror offsets clamped and zero-based.
5. Check both Editor-to-Preview and Preview-to-Editor synchronization.
6. Add focused regression tests for the changed syntax or mapping.

### Workspace persistence change

1. Decide whether the value is global, repository-scoped, session-only, or
   derived.
2. Keep global preferences in global settings and repository state in
   `.tabst/workspace.json`.
3. Preserve migration and sanitization for existing settings.
4. Avoid introducing a second persistence backend for an existing domain.
5. Verify repository switching, unavailable repositories, and Web Sandbox
   initialization.

### Command or control change

1. Add or update the command registry definition.
2. Define availability and disabled reasons.
3. Route execution through `runUiCommand` or the established command event.
4. Keep shortcuts, command palette, inline commands, and buttons consistent.
5. Preserve the bottom-bar ordering contract for playback controls.

## VALIDATION

Select checks based on the touched area and confirm the current command
definitions in `package.json`:

```powershell
pnpm check             # Biome format/lint checks and TypeScript
pnpm test              # Renderer unit tests
pnpm build:web         # Type-check and static Web build
pnpm verify:tauri      # Web build, Rust checks/tests, bundle/config validation
```

For documentation-only work, at minimum verify Markdown links, referenced file
paths, command names, and `git diff --check`. Documentation changes must not
claim that a check passed unless it was run in the current worktree.

## PROJECT-SPECIFIC ANTI-PATTERNS

- Duplicating source-of-truth state across components and stores.
- Parsing AlphaTex structure with regex when AST data is available.
- Storing `AlphaTabApi` in React state.
- Applying deep theme changes without destroy/recreate and state restoration.
- Reusing the live Preview API for printing.
- Binding alphaTab or global events without deterministic teardown.
- Executing commands without registry availability checks.
- Rebuilding command/property registries on every editor request.
- Adding platform-specific filesystem or process logic directly to renderer UI.
- Trusting renderer-provided paths in Rust without normalization and scope
  authorization.
- Reintroducing assumptions from the archived Electron runtime.
- Describing historical reports or plans as the current architecture.

## DOCUMENTATION POLICY

- `README.md` is the product and contributor entry point.
- `docs/dev/architecture/` describes the current implementation.
- Guides and runbooks explain how to operate or debug the system.
- Plans, migration notes, and reports must state whether they are active,
  completed, superseded, or historical.
- Prefer links to source-of-truth files over copied versions, branch names,
  command lists, or workflow status.
- Update architecture documentation when a runtime boundary, state owner,
  lifecycle, persistence format, security rule, or operational procedure
  changes. Routine local refactors do not require a new architecture document.
