# Debugging alphaTab in Tabst

> **Status:** Current
>
> Scope: live Preview, print Preview, tutorial playground, rendering, playback,
> staff configuration, and Editor/Preview synchronization
>
> **Last verified:** 2026-07-15

## Start with the host

Before debugging, identify which `AlphaTabApi` owns the symptom.

| Surface | Owner | Important distinction |
| --- | --- | --- |
| Workspace Preview | `components/Preview.tsx` | Full playback, ATDOC, recovery, selection, and lifecycle telemetry |
| Print Preview | `components/PrintPreview.tsx` | Separate no-player API with print-only fonts and pagination |
| Tutorial playground | `components/tutorial/TutorialPlaygroundPreview.tsx` | Simplified API recreated on content changes |

Do not assume a fix in one host applies to the other two.

## Choose the smallest correct operation

| Symptom source | First operation to expect |
| --- | --- |
| AlphaTex content changed | `tex(cleanContent)` |
| Staff/track flags changed | `renderTracks(affectedTracks)` |
| Supported scale/layout setting changed | `updateSettings()` then `render()` |
| Bar/model color changed | `render()` |
| Production theme/resource construction settings changed | destroy and recreate API |
| Print settings changed | update print settings and rerender selected tracks or score |

`render()` is valid. It is only insufficient when the value is effectively
captured at API/Worker construction time.

## Quick triage

1. Confirm the failing host.
2. Check whether there is a live `apiRef.current`.
3. Check whether the API and event listeners were created more than once.
4. Check whether the current content reached `tex()` after ATDOC was removed.
5. Check `scoreLoaded`, `renderFinished`, and `error` ordering.
6. Check whether the event contains score objects from the current API.
7. Check whether a deep rebuild restored the state that matters.
8. For playback, check `isReadyForPlayback` and SoundFont loading.
9. For print, check Bravura URL, font readiness, and pagination timing.
10. Inspect Preview lifecycle counters in a development build.

## Preview is blank after initialization or rebuild

Expected sequence:

```text
create API
    → bind listeners
    → load SoundFont
    → schedule tex timeout
    → tex(cleanContent)
    → scoreLoaded
    → renderFinished
```

Check:

- `getResourceUrls()` returned valid Worker, Bravura, and SoundFont URLs;
- the container still exists when async resource loading completes;
- the content was not reduced to an empty string by ATDOC parsing;
- `tex()` was called on the current API, not a destroyed instance;
- `scoreLoaded` belongs to the current score;
- the parse timeout was cleared after a matching score load;
- there is no numbered-notation rollback or TAB-probe error hiding the first
  render attempt.

Relevant files:

- `components/Preview.tsx`
- `lib/resourceLoaderService.ts`
- `lib/assets.ts`
- `hooks/usePreviewErrorRecovery.ts`

## Theme changed but score colors did not

The production theme system should:

1. write the alphaTab CSS variables;
2. invoke the registered Preview `refresh()`;
3. destroy and recreate the live API;
4. read the new colors into fresh settings.

Check:

- `--alphatab-main-glyph` and related variables on
  `document.documentElement`;
- whether `playerControls.refresh` is registered;
- whether explicit Refresh destroyed the old API and incremented the reinit
  trigger;
- whether the new API used `getAlphaTabColorsForTheme()`;
- whether the new API received content after SoundFont loading;
- whether the symptom is actually in Tutorial Playground, which currently uses
  settings mutation plus `render()` instead of the production rebuild path.

Do not debug palette changes only through the root-class
`MutationObserver`. It observes light/dark class changes, not same-mode inline
palette changes.

## Theme changes only work once

Inspect the class-observer fallback:

- `setupThemeObserver()` stores its unsubscribe function on the API;
- `destroyPreviewApi()` invokes that unsubscribe before destruction;
- the observer callback creates a replacement API but does not currently attach
  a new observer to that replacement.

Normal theme changes should still use explicit Preview Refresh. If a feature
relies on direct external manipulation of the `dark` class, this one-shot
observer behavior is a known implementation risk.

When fixing it, avoid installing two authoritative rebuild mechanisms. Prefer a
single explicit theme notification path and retain an observer only as a
well-scoped fallback.

## Staff display resets after editing or Refresh

Symptoms include:

- tablature returns after being disabled;
- standard notation disappears after `tex()`;
- theme switching restores an older staff combination;
- closing Print Preview does not restore the latest UI choice.

Check precedence:

1. does the document contain ATDOC staff configuration?
2. what is in `trackConfigRef`?
3. what is currently on the first score track/staff?
4. did the class-observer path run `captureTrackConfigForRebuild()`?
5. did explicit Refresh destroy the API before a current snapshot was saved?
6. did `scoreLoaded` reapply an older ref value?

Known gap: the production UI toggle updates the score and Zustand display state
but does not directly update `trackConfigRef`. The intended contract is
documented in `architecture/PREVIEW_LIFECYCLE.md`.

Do not work around this by blindly forcing tablature on. Non-guitar tracks must
retain alphaTab's own adaptation when the guarded TAB probe fails.

## Duplicate events or growing memory use

Use development lifecycle counters:

- `apiCreated` versus `apiDestroyed`;
- `listenerBound` versus `listenerUnbound`;
- `rebuildRequested` versus `rebuildCompleted`.

After a complete mount/unmount or rebuild cycle, created/destroyed and
bound/unbound counts should converge.

Check:

- every new API goes through `bindPreviewEvents`;
- `runListenerTeardowns()` runs before API destruction;
- alphaTab event `on()` calls return teardown functions and those functions are
  retained;
- old theme observers are disconnected;
- player controls are unregistered;
- parse timers, animation frames, and global window listeners are cleared;
- stale cleanup tokens cannot unbind a newer API.

Do not attach another free-standing `scoreLoaded`, `error`, or playback listener
without integrating it into the bind-token lifecycle.

## AlphaTex parse timeout or stale score restored

The live Preview starts a 3-second timer before user `tex()` calls.

If no matching `scoreLoaded` arrives:

- the UI may show a timeout message;
- lifecycle telemetry increments `timeoutTriggered`.

If alphaTab emits an error:

- the current pending request is cleared;
- the last valid score may be restored through `renderScore()`;
- lifecycle telemetry increments `recoveryTriggered`;
- a restore guard prevents recursive recovery.

Check:

- the pending content matches the clean content used in `scoreLoaded` matching;
- a theme rebuild scheduled its timeout with `setErrorOnTimeout: false`;
- the error is not the guarded TAB-probe failure;
- the error is not the numbered-notation failure that can be rolled back;
- `lastValidScoreRef` belongs to the intended active document.

## Numbered notation fails

The live Preview detects the known numbered-notation beat error.

On a recognized error it:

1. disables numbered notation across the score;
2. updates the saved first-staff options;
3. calls `render()`;
4. clears the parse error if rollback succeeds.

If the error still surfaces:

- verify it matches `isNumberedNotationBeatError()`;
- verify the score contains mutable staffs;
- inspect the rollback render error;
- check whether ATDOC immediately reapplies numbered notation on the next score
  load.

## TAB preference fails on non-guitar content

First load uses a guarded TAB preference probe:

- save alphaTab's current first-staff display;
- try tablature on and standard notation off;
- wait briefly for asynchronous Worker errors;
- accept the result after `renderFinished` plus a grace period;
- roll back silently for the known undefined-staves failure.

Do not expose the internal probe failure as a user parse error. Other alphaTab
errors must continue through normal recovery.

## Selection remains blue after editor navigation

The blue decoration represents `scoreSelection`, not playback.

Check:

- `usePreviewSelectionSync` clears `scoreSelection` before editor-driven
  navigation;
- `isHighlightFromEditorCursorRef` remains true long enough for repeated
  `playbackRangeHighlightChanged` events;
- `lastEditorCursorSelectionRef` matches the generated bar range;
- stale score beats are rejected;
- `scoreLoaded` and API creation clear the old selection;
- the CodeMirror view is still mounted when the asynchronous clear effect
  dispatches.

Selection dispatch uses `setTimeout(0)`. Playback dispatch uses frame-coalesced
tasks; do not assume they share one scheduler.

## Editor cursor does not move Preview

Check:

- `enableCursorBroadcast` is enabled;
- the active language is AlphaTex;
- the parser returned a valid bar/beat rather than `-1`;
- the event was not marked as score-originated;
- the current score contains the mapped beat;
- the player is stopped if the expected effect is a `tickPosition` change;
- the cursor moved into a different bar.

Known limitation: cursor tracking currently suppresses another event when only
the Beat changes inside the same Bar. The intended navigation contract is
Beat-level even though the visual range remains Bar-level.

## Preview selection does not highlight source

Check:

- alphaTab emits `playbackRangeHighlightChanged` with both endpoints;
- endpoints belong to `api.score`;
- the event was not generated by editor navigation;
- `scoreSelection` reached the Editor;
- the active file is recognized as AlphaTex;
- `mapSelectionToCodeRange()` found valid source offsets;
- the CodeMirror selection state field is installed;
- the delayed dispatch still sees a mounted view.

The repository does not currently implement custom selection handles or
`applyPlaybackRangeFromHighlight()`.

## Playback does not start

Check:

- `api.isReadyForPlayback`;
- the current SoundFont URL;
- whether user-gesture audio priming ran;
- whether the audio pipeline refresh was required after a long idle period;
- whether `loadSoundFontFromUrl()` completed;
- whether count-in state is delaying the apparent start;
- whether the editor focus policy created the API with the player disabled;
- whether a print-only API was mistaken for the live player API.

The play path waits for readiness, retries SoundFont loading, and retries
`api.play()` once. Log:

- `isReadyForPlayback`;
- `tickPosition`;
- whether the first `play()` returned true;
- whether the retry ran.

## Playback highlight or progress is stale

Check:

- `playedBeatChanged` and `playerPositionChanged` are bound to the current API;
- playback frame gates are active and not disposed;
- `playerFinished` or a stopped state clears highlights;
- count-in is not intentionally suppressing early beat/position events;
- `renderFinished` did not reset progress immediately before inspection;
- `enableSyncScroll` controls scrolling but not highlight state itself.

Green highlighting is Beat-level while playing. Yellow highlighting is
Bar-level when a player cursor remains but playback is not active.

## Print Preview is blank or paginates incorrectly

Check:

- the live API was destroyed before print initialization;
- the 200 ms print initialization delay completed;
- `loadBravuraFont()` and `document.fonts.ready` completed;
- the print font URL is valid in the independent print document;
- injected CSS keeps `.at` at `34px`;
- `createPrintSettings()` disables lazy loading and the player;
- the alphaTab container width matches the printable content width;
- `renderFinished` schedules pagination after the score DOM/SVG is available;
- print track configuration returns the expected selected tracks.

For zoom, bars-per-row, stretch, or page-size changes, Print Preview updates
settings and rerenders. It does not recreate the live Preview API.

## Tutorial playground differs from live Preview

Tutorial Playground:

- recreates its API whenever content changes;
- reports success only after both `scoreLoaded` and `renderFinished`;
- does not load the live Preview recovery/control pipeline;
- currently uses `updateAlphaTabColorsForTheme()` followed by `render()`.

If a bug occurs only in tutorials, reproduce it there before changing the
production lifecycle. If a bug occurs only in the live Preview, avoid replacing
its lifecycle with the simpler tutorial pattern.

## Useful source files

| Area | Files |
| --- | --- |
| Live lifecycle | `components/Preview.tsx`, `hooks/usePreviewApiLifecycle.ts` |
| Event ownership | `hooks/usePreviewEventBindings.ts` |
| Telemetry | `hooks/usePreviewLifecycleTelemetry.ts` |
| Error recovery | `hooks/usePreviewErrorRecovery.ts` |
| Theme | `lib/themeManager.ts`, `lib/theme-system/use-theme.ts` |
| Settings | `lib/alphatab-config.ts` |
| Staff | `lib/staff-config.ts`, `hooks/preview-session-controller.ts` |
| Selection | `hooks/usePreviewSelectionSync.ts`, `lib/alphatex-selection-sync.ts` |
| Playback sync | `lib/alphatex-playback-sync.ts` |
| Print | `components/PrintPreview.tsx`, `lib/print-*.ts` |
| Tutorial | `components/tutorial/TutorialPlaygroundPreview.tsx` |

## Verification

For documentation-only changes:

```powershell
pnpm docs:check
git diff --check
```

For runtime alphaTab changes, also run:

```powershell
pnpm check
pnpm test
pnpm build:web
```

Then manually exercise, in proportion to the change:

1. load a valid score;
2. edit valid and temporarily invalid AlphaTex;
3. toggle each staff display option;
4. switch palettes and light/dark mode;
5. use Stop and Refresh;
6. open and close Print Preview;
7. enable cursor broadcast and move across bars and beats;
8. create a Preview selection;
9. start, pause, seek, and stop playback;
10. inspect lifecycle counters for balanced teardown.

## Related documents

- [Preview lifecycle](../architecture/PREVIEW_LIFECYCLE.md)
- [Editor and Preview synchronization](../architecture/EDITOR_PREVIEW_SYNC.md)
- [Architecture overview](../architecture/OVERVIEW.md)
