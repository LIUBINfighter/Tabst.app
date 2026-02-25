# ATDOC Hierarchical Autocomplete Spec

## Goal

Provide metadata-focused layered autocomplete for ATDOC fragments and guide users through `domain -> key -> value` completion.

## Target Interaction

Inside an editable AlphaTex line (comment or non-comment):

1. User types: `* at.`
   - Dropdown shows domains: `meta`, `display`, `player`, `coloring`, `staff`, `print`
   - Enter on `meta` inserts `at.meta.`

2. User types/selects: `* at.meta.`
   - Dropdown shows keys in `meta` domain (e.g. `status`, `tag`, `license`, `title`...)
   - Enter on `status` inserts `at.meta.status=`

3. User types/selects: `* at.meta.status=`
   - Dropdown shows value candidates: `draft`, `active`, `done`, `released`
   - Enter on `draft` completes to `* at.meta.status=draft`

4. User types/selects: `* at.meta.status =` (with spaces)
   - Dropdown still shows value candidates for `status`
   - User can continue typing prefix (`dr`) and keep value suggestions filtered

## Scope (v1)

- Works for `at...` ATDOC fragments in both comment and non-comment contexts.
- Layered completion is driven by `ATDOC_KEY_DEFINITIONS`.
- Value dropdown provided for:
  - enums (`status`, `license`, `layoutMode`, `scrollMode`)
  - booleans (`true`, `false`)
- Non-enum values (`number`, `string`, `color`) keep existing free-typing behavior.
- `=` stage value completion accepts compact and spaced forms:
  - `at.meta.status=`
  - `at.meta.status =`
  - `at.meta.status = dr`

## Out of Scope (v1)

- Auto-inserting surrounding `/** */` block.
- Validation/fixups for malformed syntax spacing.
- Rich value snippets for numeric/color ranges.

## Implementation Notes

- Primary implementation in `src/renderer/lib/alphatex-completion.ts`.
- Keep existing LSP completion path for non-ATDOC contexts.
- Detect ATDOC context by fragment pattern starting with `at`/`at.` (not comment-prefix bound).
- Compute replacement ranges by stage:
  - domain stage: replace after `at.`
  - key stage: replace after `at.<domain>.`
  - value stage: replace after `at.<domain>.<key>=`
- For layered ATDOC completions, use `filter: false` in CodeMirror completion results
  to prevent default label-prefix filtering from dropping valid options (e.g. `at.` with `meta`).
- Keep a domain fallback set (`meta/display/player/coloring/staff/print`) so `at.` always has candidates
  even before all keys are present in runtime data.

## Acceptance Criteria

- `at.` suggests domains in both comment and non-comment contexts.
- `at.meta.` suggests `meta` keys only.
- `at.meta.status=` suggests status values only.
- `at.meta.status =` also suggests status values.
- Enter accepts highlighted option and inserts expected text.
- Non-ATDOC body completion behavior remains unchanged.

## Regression Notes (2026-02)

- Fixed `at.` no-dropdown regression caused by default CodeMirror filtering
  when replacement range contained `at.` but option labels were short tokens (`meta`, `display`).
- Fixed value completion trigger for spaced `=` inputs by expanding parser and trigger regex
  from strict `key=value` to tolerant `key\s*=\s*value` matching.
