# Historical alphaTab Staff Configuration Proposals

> **Status:** Historical / Superseded
>
> **Original topic:** fixing staff display flags lost during theme rebuild
>
> Current replacement:
> [Preview lifecycle](../../architecture/PREVIEW_LIFECYCLE.md#staff-display-contract)
>
> **Archived:** 2026-07-15

## Why this note is preserved

The original `docs/dev/alphatab/TRACKS_CONFIGURATION.md` recorded three
candidate designs for preserving first-track staff display flags:

- store the flags in a ref and reapply them after `scoreLoaded`;
- create one reusable high-level alphaTab initializer;
- add explicit initialization/rebuild state management.

The document was useful during implementation, but it described proposals as
if they were all viable current paths. The production Preview later evolved
into a different combination of component orchestration, hooks, library
helpers, telemetry, ATDOC precedence, and recovery behavior.

This archive keeps the design history without presenting it as a current
contract.

## Original problem

Destroying and recreating `AlphaTabApi` creates a new score model. Staff flags
such as:

- `showTablature`;
- `showStandardNotation`;
- `showSlash`;
- `showNumbered`

belong to that score model rather than construction settings. If the current
flags are not saved before destruction and reapplied after `scoreLoaded`, the
new score uses document or alphaTab defaults.

The original document also observed that initial load and theme rebuild must
use equivalent listener and configuration steps.

Those observations remain valid.

## Proposal A: ref plus apply helper

The first proposal was:

1. keep staff flags in `trackConfigRef`;
2. update the ref whenever the user toggles a flag;
3. use one `applyTracksConfig()` helper;
4. invoke the helper after every `scoreLoaded`;
5. capture the current score flags before a deep rebuild.

### What was implemented

The current production Preview contains:

- `trackConfigRef`;
- `applyTracksConfig()`;
- shared `applyStaffConfig()` and `getFirstStaffOptions()` helpers;
- `captureTrackConfigForRebuild()` for the class-observer rebuild path;
- `scoreLoaded` reapplication;
- Zustand state for displaying the current first-staff options.

### How implementation evolved

The production behavior is more complex than the original proposal:

- ATDOC staff configuration has first precedence;
- first load performs a guarded TAB preference probe;
- non-guitar probe failures roll back to alphaTab defaults;
- numbered-notation rendering has a safety rollback;
- staff configuration applies to all staves of the first track;
- the theme system can trigger explicit Preview Refresh outside the observer
  snapshot path.

### Remaining gap

The current UI toggle path updates the score and Zustand state but does not
directly update `trackConfigRef`. A later `tex()` or explicit rebuild can
therefore reapply an older ref value.

The accepted intended contract is documented in
`architecture/PREVIEW_LIFECYCLE.md`. Fixing the runtime gap is a separate code
task and should include regression tests.

## Proposal B: reusable high-level initializer

The second proposal introduced a recursive `initializeAlphaTabInstance()` that
would:

- construct settings;
- create the API;
- bind all events;
- load SoundFont;
- load content;
- install a theme observer;
- recursively call itself after theme changes.

This design was not adopted.

The current Preview instead:

- keeps orchestration in `Preview.tsx`;
- extracts settings and score mutations into library helpers;
- extracts bind-token, recovery, telemetry, print lifecycle, selection, and
  session decisions into focused hooks;
- explicitly rebinds listeners for each new API.

The repository also contains `hooks/useAlphaTab.ts`, which resembles a
high-level initializer, but no production component currently imports it.

## Proposal C: React initialization state

The third proposal used component state:

```ts
type AlphaTabInitState =
  | "idle"
  | "initializing"
  | "ready"
  | "rebuilding";
```

This exact state-management design was not adopted.

The production Preview now uses:

- a ref-held lifecycle state;
- `usePreviewLifecycleTelemetry()`;
- states `idle`, `initializing`, `ready`, `rebuilding`, `destroyed`, and
  `error`;
- counters for API, listener, rebuild, recovery, and timeout events.

The lifecycle state is primarily diagnostic; it does not drive React rendering
or act as a lock for every async operation.

## Lessons retained

- Score-model flags must be reapplied after `scoreLoaded`.
- Initial creation and deep rebuild must bind equivalent listeners.
- UI state alone is not a safe persistence mechanism for an external score
  model.
- A ref used for restoration must be updated at every user mutation point.
- Recursive initialization can obscure ownership and create nested observers.
- Lifecycle state is useful for telemetry, but it does not replace stale API
  checks and teardown discipline.
- Instrument defaults and document-declared ATDOC configuration must be part of
  the precedence rule.

## Source-of-truth files

- `src/renderer/components/Preview.tsx`
- `src/renderer/lib/staff-config.ts`
- `src/renderer/hooks/preview-session-controller.ts`
- `src/renderer/hooks/usePreviewLifecycleTelemetry.ts`
- `src/renderer/store/appStore.ts`

Do not implement code from this archive without revalidating it against the
current lifecycle.
