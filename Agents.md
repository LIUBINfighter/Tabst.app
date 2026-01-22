# AGENTS.md

## 1. Project Overview

Tabst is a guitar tab editor/player based on Electron + React. It treats sheet music as Markdown code (AlphaTex) and uses the **alphaTab** engine for rendering and playback.

### Core Tech Stack

- Runtime: Electron (Main Process), React 19 (Renderer).
- Language: TypeScript (Strict mode).
- Package Manager: pnpm.
- Sheet Music Engine: alphaTab (and `@coderline/alphatab`).
- Editor: CodeMirror 6 (Custom LSP, Highlighting, Autocomplete).
- UI: Tailwind CSS v3, Shadcn/UI, Lucide React.
- State Management: Zustand.
- Toolchain: Vite, Biome (for Lint/Format).

## 2. Code Standards and Guidelines

### General Rules

- Code Style: Must follow Biome standards (see `biome.json`). Do not use Prettier or ESLint rule suggestions.
- Components: Use functional components + Hooks.
- Imports: Prefer absolute paths (e.g., `@/renderer/...`) or keep relative paths clear.
- UI Components: Reuse components under `src/renderer/components/ui/` whenever possible.

### State Management (Zustand)

- Global state (file list, playback state, selection, zoom) must be managed via `useAppStore` (`src/renderer/store/appStore.ts`).
- **Do not** use `useState` inside components to manage data that should be shared across components (e.g., playback progress).

### AlphaTab Integration

This is a highly complex integration point. Please strictly follow the rules below:

1. API Instance: `AlphaTabApi` is usually held via `useRef` (`apiRef.current`), do not place it in React State.
2. Worker Communication: Rendering and audio decoding run in Web Workers.
3. Configuration Updates:
   - Lightweight Updates: For example, switching between single-track display (TAB/Staff), use `api.renderTracks()`.
   - Content Updates: Use `api.tex(content)`.
   - Theme/Deep Configuration Updates: You must destroy and recreate the API (`destroy()` -> `new AlphaTabApi()`). Simply calling `render()` is ineffective because the Worker caches the color configuration during initialization.

## 3. Known Issues and Architectural Decisions (Memory Bank)

> Please read this section before modifying related logic to avoid regressions of known bugs.

### A. Theme Switching and API Rebuilding

- Context: `src/renderer/components/Preview.tsx`
- Rule: When switching from light to dark theme, you must completely destroy the old API and create a new one to pass the new color configuration to the Worker.
- Note: During rebuilding, **you must** save and restore the user's Tracks display configuration (e.g., whether to show TAB/Staff). Refer to `docs/dev/TRACKS_PARAMETER_FIX.md`.

### B. Editor and Sheet Music Synchronization (Selection Sync)

- Context: `src/renderer/lib/alphatex-selection-sync.ts`
- Rules:
  - Use alphaTab's built-in `AlphaTexParser` (AST) to calculate the position of Beats in the source code. **Do not** attempt to manually parse the complex AlphaTex syntax with regex.
  - CodeMirror Scrolling: Use `view.visibleRanges` instead of `coordsAtPos` to detect visibility, as CodeMirror uses virtual scrolling, and coordinates cannot be obtained for unrendered areas.

### C. Printing Functionality

- Context: `src/renderer/components/PrintPreview.tsx`
- Rules:
  - The print preview uses a separate `AlphaTabApi` instance.
  - Font Loading: Fonts like `Bravura` must be loaded via absolute URLs.
  - Style Injection: Explicitly inject the CSS rule `.at-surface .at { font-size: 34px !important; }`, otherwise notes will render very small at Scale=1.0.

### D. LSP and Worker

- Context: `src/renderer/workers/alphatex.worker.ts`
- Rules:
  - Completion and Hover should first read from the local `src/renderer/data/alphatex-commands.json`, and fallback to upstream documentation.
  - All LSP message handling is completed within the Worker and communicates with the main thread via `postMessage`.

## 4. Common Commands

### Usage

- After completing a Feat/Fix, run `pnpm format` and `pnpm check` to ensure code quality gates are passed.
- Add packages and dev dependencies using `pnpm add`.
- When technical context or API usage is needed, prioritize using #context7 (MCP server) or web browsers to fetch accurate information about alphaTab.js or other packages, and update promptly.

## 5. Directory Structure Explanation

- `src/main`: Electron main process code (File I/O, Window Management).
- `src/renderer`: React frontend code.
  - `components/Editor.tsx`: CodeMirror editor integration.
  - `components/Preview.tsx`: alphaTab rendering core container.
  - `lib/`: Core logic libraries (LSP, Parsers, Theme Managers).
  - `store/`: Zustand store.
  - `workers/`: AlphaTex LSP Worker.
  - `data/`: Static data (command definitions, chord libraries).

## 6. UI/UX Terminology and Design Guidelines

### Core Interaction Philosophy

1. **View-Action Separation**
   - **Top/Left Quadrant** = **View Navigation**: Determines "Where am I/What am I looking at" (e.g., switching pages, opening settings, collapsing sidebars).
   - **Bottom/Right Quadrant** = **Command Operations**: Determines "What am I doing/What am I changing" (e.g., creating files, playback controls, zooming).
2. **Right-Hand Bias**
   - High-frequency interactive controls (Play, Stop, Create File) are prioritized in the bottom-right corner to align with right-hand mouse movement inertia.

### Component Area Terminology

#### 1. Sidebar

- **View Entries (Top)**: Command area, such as light/dark theme toggle buttons.
- **File Tree (Middle)**: Flat file list.
- **Command Area (Bottom)**: View entry points.

#### 2. Workspace

- **Editor Pane**: Left-side code editor.
- **Preview Pane**: Right-side sheet music interaction (alphaTab).
- **Workspace Top Bar**:
  - Left: Breadcrumb/File name.
  - Right: **View Exists** (e.g., entering `PrintPreview`).

#### 3. Global Bottom Bar

- **Layout**: **Right-Aligned**.
- **Logical Cascade**: Strictly follows left-to-right order:
  1. **Content** (Staff Controls: TAB/Staff)
  2. **Display** (Zoom, Scroll)
  3. **Playback Params** (Speed, Metronome)
  4. **Transport** (Play, Stop - **Rightmost**)

#### 4. Print Preview

- **Print Toolbar (Top)**:
  - Left: Paper/Pagination (Global Layout).
  - Right: `Toggle Settings`, `Print`, `Close`.
- **Print Settings Panel (Right)**:
  - **Global Config**: Layout density.
  - **Track Config**: Single-track visibility and staff mode.

#### Principles

- Interaction Zoning: Top and left are responsible for view modifications (navigation/context), while bottom and right handle command modifications (actions/state changes).
- Sidebar Layout: View entry buttons at the top, new command buttons at the bottom to minimize mouse movement distance after creating a file.
- Bottom Bar Positioning: Control areas are forced to align to the right, leveraging right-hand dominance to optimize interaction experience in unconscious resting zones.
- Bottom Bar Logical Order: Control arrangement strictly follows "What to display (staff) → How to display (zoom) → How to play (speed) → Playback control (start/stop)" in a left-to-right cascading logic.

## 7.Versioning

1. package.json L4
2. SettingsView.tsx L105
