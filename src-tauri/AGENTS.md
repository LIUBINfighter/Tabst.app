# TAURI RUNTIME INSTRUCTIONS

## SCOPE

These instructions apply to `src-tauri/`. The Tauri runtime owns trusted
desktop capabilities: filesystem access, repository watching, Git, global and
workspace metadata, updater operations, keep-awake behavior, bundle resources,
and desktop security configuration.

Renderer code must access these capabilities through `window.desktopAPI`.
Read the root `AGENTS.md` and `docs/dev/architecture/OVERVIEW.md` for the shared
cross-runtime contracts.

## OWNERSHIP MAP

| File | Responsibility |
| --- | --- |
| `src/main.rs` | Minimal binary entry point that starts the library runtime |
| `src/lib.rs` | Tauri builder, managed state, plugin wiring, command registration, Rust integration tests |
| `src/fs_commands.rs` | Dialogs, open/read/write/create/rename/move/reveal, binary files and bundled assets |
| `src/repo_commands.rs` | Repository scan, persisted repository list, workspace metadata, delete behavior and watcher |
| `src/git_commands.rs` | Git CLI status, diff, stage, pull and commit operations |
| `src/settings_commands.rs` | Global settings persistence |
| `src/updater_commands.rs` | Version, release feed, update check and installation |
| `src/power_commands.rs` | Playback keep-awake behavior |
| `src/models.rs` | Serialized command/event payloads shared across Rust modules |
| `src/support.rs` | Path authorization, metadata paths, JSON helpers and common runtime utilities |
| `capabilities/` | Window-specific Tauri capability declarations |
| `tauri.conf.json` | Build, window, CSP, bundle resources, icons and updater endpoints |

## SECURITY INVARIANTS

- Treat every path, URL, Git pathspec, branch, commit message, and payload from
  the renderer as untrusted input.
- Canonicalize existing paths before authorization. Validate target paths
  against the authorized parent or workspace scope before creating or moving.
- Keep operations inside registered repository roots or explicitly authorized
  standalone files.
- Reject `..` escapes, absolute pathspecs, cross-workspace moves, and deletion
  targets outside the requested repository.
- Keep `.git` and `.tabst` internal to repository scanning and watch behavior.
- Do not replace Rust-side validation with renderer checks; renderer checks are
  usability guards, not the security boundary.
- Do not weaken CSP, updater signature requirements, or capabilities without a
  documented reason and a focused security review.
- Keep external URL opening on the established allow/validation path.
- Avoid shell command construction. Pass Git arguments as separate process
  arguments and validate repository/file scope first.

## COMMAND CONTRACT

New or changed desktop commands require coordinated updates:

1. Define typed request/response payloads in `models.rs` or the relevant shared
   renderer types.
2. Implement the command in the appropriate domain module.
3. Normalize and authorize every path or external input.
4. Register the command in `src/lib.rs`.
5. Update `src/renderer/lib/tauri-desktop-api.ts`.
6. Update `src/renderer/types/desktop.d.ts`.
7. Update the Web adapter when the method belongs to the shared runtime surface.
8. Add Rust behavior tests and renderer invoke-argument/adapter tests.

Keep serialized field names compatible with the renderer contract. Use the
existing invoke-argument helpers and tests when camelCase renderer names map to
Rust command parameters.

## FILESYSTEM AND REPOSITORY RULES

- Preserve path normalization and allowed-root registration when opening,
  restoring, renaming, or moving files.
- Repository scans return user-facing supported files and directories, with
  folders ordered before files where the current contract requires it.
- Watchers are owned by the active repository. Stop and replace the old watcher
  deterministically when the active repository changes.
- Watch events should carry the repository path, normalized changed path, and
  stable event type expected by the renderer debounce logic.
- Repository metadata lives in `.tabst/workspace.json`; the known-repository
  index and global settings live in the application metadata directory.
- Preserve temporarily unavailable repository entries instead of silently
  deleting them during save/load normalization.
- Deletion modes must preserve their current scope guarantees for system trash,
  repository trash, and permanent deletion.

## GIT RULES

- Git is optional workspace functionality, not the repository storage backend.
- Run Git with the authorized repository as the working directory.
- Validate pathspecs and reject parent-directory or absolute-path escapes.
- Keep porcelain parsing and typed result mapping stable for staged, unstaged,
  untracked and renamed entries.
- Return command failures as typed error results instead of panicking.
- Do not include `.git` watcher churn in renderer file-tree refresh behavior.

## UPDATER AND BUILD RULES

- The updater plugin is release-only; debug builds install the MCP bridge used
  for development diagnostics.
- Product version values in `package.json`, `Cargo.toml`, and
  `tauri.conf.json` must remain identical.
- MPL-2.0 applies to the Rust package, and the Tauri bundle must include the root
  `LICENSE` resource.
- Updater endpoint, signature, artifact and workflow changes must be reviewed as
  one release contract.
- Workflow files are the source of truth for platforms with active automated
  publishing; the presence of a local build alias is not proof of release
  support.

## TESTING EXPECTATIONS

Add focused Rust tests for:

- path normalization and scope rejection;
- file/repository metadata round trips;
- watcher event mapping and lifecycle;
- Git pathspec validation and porcelain parsing;
- updater support matrices and manifest behavior;
- compatibility of serialized payloads used by the renderer.

Avoid tests that depend on a developer's real home directory, Git global
configuration, or permanent filesystem state. Use isolated temporary roots and
restore modified environment variables.

## VALIDATION

Run the checks relevant to the change:

```powershell
cargo fmt --manifest-path src-tauri/Cargo.toml --check
cargo check --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml
pnpm check:tauri:config
pnpm build:web
pnpm bundle:assert
```

For cross-boundary changes, also run Renderer type checks, adapter tests and the
full `pnpm test` suite. If a local platform cannot execute the Rust test binary,
record the compile result separately and rely on the matching remote CI runner
for execution rather than treating `--no-run` as a passed test suite.

## ANTI-PATTERNS

- Trusting renderer-provided paths because the UI already validated them.
- Registering a Rust command without updating the renderer adapter and types.
- Returning loosely shaped JSON when a shared model already exists.
- Building shell command strings for Git operations.
- Letting watcher threads, channels or keep-awake state outlive their owner.
- Reading or writing repository-internal metadata through general file-tree
  paths without explicit intent.
- Adding release-only plugins to debug tests without checking Windows runtime
  and dynamic-library behavior.
- Reintroducing Electron compatibility assumptions into the Tauri runtime.
