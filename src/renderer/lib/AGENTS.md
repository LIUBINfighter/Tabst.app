# RENDERER LIB KNOWLEDGE BASE

## OVERVIEW
`src/renderer/lib` holds reusable engine logic: AlphaTex parsing, completion/LSP glue, command registries, theme system, export/print helpers.

## SUBDOMAINS
- `alphatex-*`: parser/completion/highlight/diagnostic/sync logic.
- `theme-system/*`: theme registry/types/hooks.
- `*-command-events.ts` + `ui-command-registry.ts`: command bus and execution.
- `print-utils.ts` + `pagination.ts`: print sizing/pagination helpers.
- `desktop-api.ts`: web runtime fallback bridge + runtime detection.

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Beat/selection position mapping | `alphatex-parse-positions.ts`, `alphatex-selection-sync.ts` | AST-first + fallback parser |
| Completion and layered ATDOC | `alphatex-completion.ts` | domain/key/value completion logic |
| Worker-facing command data | `../workers/alphatex.worker.ts`, `../data/alphatex-commands.json` | local-first fallback model |
| Command dispatch and availability | `command-registry.ts`, `ui-command-registry.ts` | global + inline command paths |
| Theme registry and hooks | `theme-system/*` | UI/editor theme catalogs and mapping |
| Print and pagination helpers | `print-utils.ts`, `pagination.ts` | page dimensions and splitting |

## CONVENTIONS
- Prefer AST parser (`AlphaTexParser`) for structural AlphaTex semantics.
- Keep completion data precedence local JSON first, upstream docs second.
- Use explicit event constants (`*-command-events.ts`) for command bus traffic.
- Keep theme changes centralized in `theme-system` + CSS variable assignment path.
- Keep hot paths allocation-aware (registry build once, reuse at request time).

## PERFORMANCE RULES
- Avoid recomputing static registries inside completion/hover request handlers.
- Keep command lookup maps prebuilt when possible.
- Minimize per-keystroke allocations in editor-facing utilities.

## ANTI-PATTERNS
- Regex-only AlphaTex structure parsing.
- Rebuilding command/property registries on every completion request.
- Introducing renderer-global side effects inside utility modules.
- Skipping command availability checks before dispatching UI commands.
