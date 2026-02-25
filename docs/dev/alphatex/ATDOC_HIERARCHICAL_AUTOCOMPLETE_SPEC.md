# ATDOC Hierarchical Autocomplete Spec

## Goal

Provide metadata-focused layered autocomplete inside ATDOC comment lines to reduce noise and guide users through `domain -> key -> value` completion.

## Target Interaction

Inside an ATDOC line (`* ...`):

1. User types: `* at.`
   - Dropdown shows domains: `meta`, `display`, `player`, `coloring`, `staff`, `print`
   - Enter on `meta` inserts `at.meta.`

2. User types/selects: `* at.meta.`
   - Dropdown shows keys in `meta` domain (e.g. `status`, `tag`, `license`, `title`...)
   - Enter on `status` inserts `at.meta.status=`

3. User types/selects: `* at.meta.status=`
   - Dropdown shows value candidates: `draft`, `active`, `done`, `released`
   - Enter on `draft` completes to `* at.meta.status=draft`

## Scope (v1)

- Works only in ATDOC-style lines (leading `*` and `at.` fragment).
- Layered completion is driven by `ATDOC_KEY_DEFINITIONS`.
- Value dropdown provided for:
  - enums (`status`, `license`, `layoutMode`, `scrollMode`)
  - booleans (`true`, `false`)
- Non-enum values (`number`, `string`, `color`) keep existing free-typing behavior.

## Out of Scope (v1)

- Auto-inserting surrounding `/** */` block.
- Validation/fixups for malformed syntax spacing.
- Rich value snippets for numeric/color ranges.

## Implementation Notes

- Primary implementation in `src/renderer/lib/alphatex-completion.ts`.
- Keep existing LSP completion path for non-ATDOC contexts.
- Detect ATDOC context by current line prefix (`*`) and fragment starting with `at.`.
- Compute replacement ranges by stage:
  - domain stage: replace after `at.`
  - key stage: replace after `at.<domain>.`
  - value stage: replace after `at.<domain>.<key>=`

## Acceptance Criteria

- `* at.` suggests domains only.
- `* at.meta.` suggests `meta` keys only.
- `* at.meta.status=` suggests status values only.
- Enter accepts highlighted option and inserts expected text.
- Non-ATDOC body completion behavior remains unchanged.
