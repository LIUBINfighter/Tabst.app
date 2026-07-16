<h1 align="center">
  <samp>Tabst</samp>
</h1>

<h3 align="center">Write guitar tabs like Markdown.</h3>

<p align="center">
  <a href="./README.zh.md">中文 README</a>
  ·
  <a href="https://play.tabst.app">Web app</a>
  ·
  <a href="https://github.com/LIUBINfighter/Tabst.app/releases">Releases</a>
</p>

<p align="center">
  <a href="https://doi.org/10.5281/zenodo.18447447"><img alt="DOI" src="https://zenodo.org/badge/1133258569.svg" /></a>
  <img alt="CI" src="https://img.shields.io/github/actions/workflow/status/LIUBINfighter/Tabst.app/ci.yml?branch=main" />
  <img alt="Release" src="https://img.shields.io/github/v/release/LIUBINfighter/Tabst.app" />
  <img alt="Downloads" src="https://img.shields.io/github/downloads/LIUBINfighter/Tabst.app/total" />
</p>

<div align="center">
  <img width="1280" alt="Tabst editor and score preview" src="https://github.com/user-attachments/assets/d58323a0-44bb-4468-87c7-281c898a5ab6" />
</div>

## What is Tabst?

Tabst is a plain-text guitar-tab workspace built around
[AlphaTex](https://www.alphatab.net/docs/alphatex/introduction). Write a score
in CodeMirror, see it rendered by [alphaTab](https://www.alphatab.net/), play it
back, keep it in an ordinary folder, and use Git when you want version history.

The project follows a simple idea:

> Guitar-tab writing should feel as direct and portable as writing Markdown.

AlphaTex files remain the source of truth. Tabst adds the editor, language
assistance, workspace management, playback controls, printing, export, Git,
tutorials, and desktop integration around them.

## Highlights

- AlphaTex editing with syntax highlighting, completion, hover, diagnostics,
  abbreviations, and ATDOC assistance.
- Live score rendering and playback powered by alphaTab.
- Editor-to-score and score-to-editor selection synchronization.
- Local repository workspaces with a file tree, templates, autosave, and
  workspace restoration.
- Configurable staff, track, zoom, tempo, volume, metronome, count-in, progress,
  and transport controls.
- Dedicated print preview plus MIDI, WAV, GP, and PDF-oriented workflows.
- Optional Git status, diff, staging, pull, and commit support for local
  workspaces.
- Built-in bilingual tutorials and interactive AlphaTex playgrounds.
- Public Tabst DB browsing without requiring an account.
- Tauri desktop application and a static Web build from the same renderer.

## Runtime model

Tabst uses two related runtime modes:

- **Desktop:** Tauri provides filesystem, repository watching, Git, updater,
  settings, and operating-system capabilities. Public cloud scores are shown in
  a dedicated read-only Cloud workspace that reuses the normal Editor/Preview
  experience.
- **Web:** Sandbox remains the primary workspace. Public Tabst DB scores are
  imported into Sandbox as regular `.atex` files and refreshed by
  `at.meta.source` when the app initializes.

Cloud support is currently public-only. Sign-in, private libraries, and score
publishing are not part of the current runtime.

## Platform and delivery status

| Target | Local build | Repository automation |
| --- | --- | --- |
| Web | Supported | Deployed through GitHub Pages |
| macOS desktop | Supported | CI bundle validation and release workflow enabled |
| Windows desktop | Tauri build command available | Release workflow currently paused |
| Linux desktop | Tauri build command available | Release workflow currently paused |

The workflow files under `.github/workflows/` are the source of truth for
current CI and release availability.

## Technology

- [Tauri 2](https://tauri.app/) and Rust for the desktop runtime.
- [React 19](https://react.dev/), TypeScript, and Vite for the renderer.
- [CodeMirror 6](https://codemirror.net/) for text editing.
- [alphaTab](https://www.alphatab.net/) for score parsing, rendering, playback,
  and export.
- A Web Worker-based AlphaTex language pipeline for completion, hover, and
  diagnostics.
- Zustand for shared workspace and playback state.
- Tailwind CSS, Radix UI, and Lucide for the interface.
- Biome for formatting and linting, and Vitest for renderer unit tests.

Exact package versions and available scripts are defined in
[`package.json`](./package.json). Rust dependencies are defined in
[`src-tauri/Cargo.toml`](./src-tauri/Cargo.toml).

## Development

### Prerequisites

- Node.js 22 or a compatible current Node.js release.
- The pnpm version declared by `package.json#packageManager`.
- Rust stable and the platform prerequisites required by Tauri 2.
- Git for the optional in-app Git workspace and normal repository development.

### Install

```powershell
pnpm install
```

### Run

```powershell
pnpm dev        # Vite renderer plus the Tauri desktop shell
pnpm dev:react  # Renderer only, using the Web runtime adapter
```

The Vite development server listens on `127.0.0.1:7777` by default.

### Validate

```powershell
pnpm check             # Biome format/lint checks plus TypeScript
pnpm test              # Renderer unit tests
pnpm build:web         # Type-check and build the static Web target
pnpm verify:tauri      # Web build, Rust checks/tests, bundle and config checks
```

Run the checks relevant to the area you changed. `pnpm verify:tauri` includes
Rust validation but does not replace the renderer Vitest suite.

### Build

```powershell
pnpm build        # Default Tauri desktop build
pnpm build:web    # Static Web build in dist/
pnpm build:tauri  # Explicit Tauri desktop build
```

Local release aliases are defined in `package.json`; official publishing
availability is controlled by the workflows in `.github/workflows/`.

## Architecture and contributor guidance

- [Architecture overview](./docs/dev/architecture/OVERVIEW.md) — runtime
  boundaries, state ownership, editing and preview flows, persistence, Cloud,
  printing, Git, and build topology.
- [Development documentation](./docs/dev/README.md) — deeper AlphaTex,
  alphaTab, operations, roadmap, and historical notes.
- [Repository instructions](./AGENTS.md) — stable invariants, ownership maps,
  cross-boundary change checklists, and validation expectations.

Read the nearest `AGENTS.md` before editing a deeper source directory.

## Project layout

```text
Tabst.app/
├── src/renderer/       # React app, CodeMirror, alphaTab, stores, worker/LSP
├── src-tauri/          # Rust desktop runtime and Tauri commands
├── public/assets/      # Runtime fonts, soundfonts, and alphaTab assets
├── docs/dev/           # Engineering architecture, guides, plans, and reports
├── scripts/            # Build verification, vendor sync, and release helpers
└── .github/workflows/  # CI, Web deployment, and desktop release workflows
```

The `.tmp/notebook-navigator` directory is an unrelated sandbox and is not part
of the Tabst product runtime.

## License

Tabst is licensed under the
[Mozilla Public License 2.0](./LICENSE).
