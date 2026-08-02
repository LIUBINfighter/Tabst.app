# alphaTab Preview Lifecycle

> **Status:** Current
>
> Scope: live Preview, print Preview, tutorial playground, lifecycle operations,
> state restoration, and failure recovery
>
> **Last verified:** 2026-07-15

## Purpose

Tabst embeds alphaTab in several UI surfaces. They share settings and resource
helpers, but they do not share one `AlphaTabApi` instance or one lifecycle.
This document describes the current ownership boundaries and the operations that
are safe for each kind of change.

The code is the final source of truth. In particular, the production live
Preview is currently coordinated by
`src/renderer/components/Preview.tsx` together with `usePreview*` hooks and
renderer library helpers.

`src/renderer/hooks/useAlphaTab.ts` contains an alternative lifecycle
abstraction, but no production component currently imports it. Treat it as an
unused/legacy abstraction, not as the live Preview contract.

## alphaTab hosts

| Host | Lifecycle owner | API relationship | Player |
| --- | --- | --- | --- |
| Live workspace Preview | `components/Preview.tsx` | Long-lived session; content usually reloads through `tex()` | Enabled when the editor focus policy permits it |
| Print Preview | `components/PrintPreview.tsx` | Dedicated API; never borrows the live Preview instance | Disabled |
| Tutorial playground | `components/tutorial/TutorialPlaygroundPreview.tsx` | Simplified API recreated when playground content changes | Enabled |

These hosts intentionally have different behavior:

- opening Print Preview destroys and suspends the live Preview API;
- Print Preview uses print-only layout, fonts, tracks, and pagination;
- closing Print Preview destroys the print API and schedules a fresh live API;
- tutorial rendering does not own the production playback, selection, recovery,
  or telemetry pipeline.

## Live Preview ownership

The live `AlphaTabApi` is stored in a React ref. It is an external resource with
explicit creation, event binding, configuration, and destruction.

The main owners are:

| Responsibility | Owner |
| --- | --- |
| API creation and orchestration | `components/Preview.tsx` |
| Base live/print settings | `lib/alphatab-config.ts` |
| Runtime assets | `lib/resourceLoaderService.ts` and `lib/assets.ts` |
| Event bind-token and teardown discipline | `hooks/usePreviewEventBindings.ts` |
| Shared destroy and print suspension/resume | `hooks/usePreviewApiLifecycle.ts` |
| Parse timeout and last-valid-score recovery | `hooks/usePreviewErrorRecovery.ts` |
| Lifecycle counters and state transitions | `hooks/usePreviewLifecycleTelemetry.ts` |
| Theme palette lookup | `lib/themeManager.ts` |
| Staff display mutation | `lib/staff-config.ts` |
| Editor-to-score synchronization | `hooks/usePreviewSelectionSync.ts` |
| Bar-number highlighting | `hooks/usePreviewBarHighlight.ts` |
| Theme rebuild guard and track snapshot | `hooks/preview-session-controller.ts` |

## Live initialization sequence

The production sequence is:

```text
parse ATDOC and synchronize store-facing settings
    → resolve worker, Bravura, and SoundFont URLs
    → load Bravura aliases
    → read current score colors from CSS variables
    → create preview settings
    → create AlphaTabApi
    → announce the new API instance
    → apply global playback preferences
    → bind all alphaTab listeners
    → load SoundFont
    → strip ATDOC and call tex(cleanContent)
    → scoreLoaded applies document/session configuration
    → render and playback become available
```

Creation increments `apiInstanceId`. Each accepted `scoreLoaded` increments
`scoreVersion`. Consumers that cache API- or score-derived state should use
these lifecycle identifiers instead of assuming an object remains valid.

### `scoreLoaded` application order

When a valid score is loaded, Preview:

1. increments the score version;
2. clears selection state and stale selection-loop guards;
3. sanitizes invalid bar color values;
4. matches the loaded score against the pending AlphaTex request and updates
   last-valid-score recovery state;
5. applies ATDOC warm display/player settings;
6. applies ATDOC hot settings;
7. applies ATDOC track mix settings;
8. applies ATDOC score coloring;
9. applies ATDOC or session staff display configuration;
10. reapplies metronome-only muting when enabled;
11. completes any pending editor bar-number highlight.

Do not add another `scoreLoaded` listener that independently repeats these
steps. Extend the existing listener or extract a shared helper while preserving
the order.

## Choosing a refresh operation

`render()` is not globally deprecated. It is insufficient for some
construction-time resources, but it remains the correct operation for several
live and print changes.

| Change | Operation | Notes |
| --- | --- | --- |
| AlphaTex source content | `api.tex(cleanContent)` | Reuses the same API and reparses the score |
| Staff/track model flags | `api.renderTracks(affectedTracks)` | Used for tablature, standard, slash, and numbered display |
| Scale or warm layout/player settings | mutate settings → `updateSettings()` → `render()` | Used by ATDOC and print layout controls |
| Bar colors or transient model styling | `api.render()` | Repaints the current score |
| Numbered-notation safety rollback | mutate score → `api.render()` | Keeps the current API |
| Theme/resource values treated as construction-time | destroy → create → bind → SoundFont → `tex()` | Required by the production Preview contract |
| Explicit Preview Refresh | stop/clear → destroy → reinitialize | Resets playback and selection state |
| Enter/leave Print Preview | destroy live API → create print API → destroy print API → recreate live API | Live and print instances never coexist intentionally |

Calling `tex()` does not update construction-time Worker resources. Conversely,
a full rebuild is unnecessary for ordinary content editing or a local staff
display toggle.

## Content updates

Normal editor changes use `tex()` without destroying the API:

1. queue the content if the API is not ready;
2. parse and remove ATDOC directives;
3. synchronize store-facing ATDOC values;
4. clear score selection;
5. schedule a parse timeout;
6. call `tex(cleanContent)` only when the cleaned content differs from the last
   applied value.

An empty document calls `tex("")` and clears parse error state.

`scoreLoaded` creates a new score model. Any settings stored only on the old
score must therefore be reapplied after the event.

## Theme and deep rebuilds

### Authoritative application path

`lib/theme-system/use-theme.ts` owns effective UI theme application. It writes
semantic and score-palette CSS variables to `document.documentElement` and then
invokes the registered Preview `refresh()` control.

That refresh:

- stops playback;
- clears selection and playback highlights;
- resets playback progress;
- destroys the live API;
- clears pending parse timers;
- increments the reinitialization trigger.

This explicit theme-system refresh is the production path for palette changes,
including switching between two themes that use the same light/dark mode.

### Class observer fallback (removed)

An earlier implementation installed a `MutationObserver` on the root `class`
attribute (`setupThemeObserver`) as a second rebuild path. It was removed
because it created dual ownership: palette switches (inline CSS variables only)
never reached it, light/dark switches could rebuild twice, and a rebuilt API
never reinstalled the observer ("works only once"). Theme changes now have a
single authoritative path: theme-store change → `use-theme` writes variables →
explicit Preview `refresh()`.

## Staff display contract

Staff display currently covers:

- `showTablature`;
- `showStandardNotation`;
- `showSlash`;
- `showNumbered`.

The live UI modifies all staves of the first track and renders that track. It
does not provide a general all-score track configuration abstraction.

The intended precedence is:

1. explicit ATDOC staff configuration, when present;
2. saved in-session user configuration;
3. a guarded first-load TAB preference probe;
4. alphaTab's own defaults if the probe is unsupported or fails.

For non-guitar material, the TAB probe may fail and must roll back silently.
`DEFAULT_STAFF_OPTIONS` is intentionally empty so that the default path respects
alphaTab's instrument adaptation.

### Intended persistence guarantee

Without ATDOC staff configuration, a user's staff display choice should survive
content reparses, theme changes, explicit Refresh, and a Print Preview
round-trip for the current session.

With ATDOC staff configuration, the document declaration is reapplied after
each score parse and is authoritative.

### Known implementation gap

The production toggle path updates the score and Zustand UI state but does not
currently update `trackConfigRef` directly. Some reparses or explicit rebuilds
can therefore restore an older ref value. The class-observer rebuild captures
the live first staff, but the theme system's explicit Refresh can destroy the
API before that fallback snapshot runs.

Until the runtime gap is fixed, do not describe all staff choices as
unconditionally preserved. A regression test should cover:

1. toggle a staff display option;
2. edit AlphaTex and wait for `scoreLoaded`;
3. switch palettes in the same light/dark mode;
4. switch light/dark mode;
5. open and close Print Preview;
6. invoke explicit Preview Refresh.

## State restoration matrix

| State | Content `tex()` | Theme/deep rebuild | Print round-trip / explicit Refresh |
| --- | --- | --- | --- |
| Latest AlphaTex content | Reparsed | Restored | Restored |
| Zoom | Kept on API | Reapplied from ref | Reapplied from ref |
| Playback speed | API remains | Reapplied from store/ref | Reapplied from store/ref |
| Master volume | API remains | Reapplied | Reapplied |
| Metronome volume | API remains | Reapplied | Reapplied |
| Count-in | API remains | Reapplied | Reapplied |
| Metronome-only track muting | Reapplied after score load | Reapplied after score load | Reapplied after score load |
| ATDOC warm/hot/mix/color | Reapplied after score load | Reapplied after score load | Reapplied after score load |
| First-track staff display | Reapplied from ATDOC/ref | Captured before destroy, then reapplied | Ref survives; kept in sync on UI toggle |
| Playback position | Not guaranteed across reparse | Not restored | Reset |
| Playing/paused state | Not guaranteed across reparse | Not restored | Stopped/reset |
| Score selection | Cleared | Cleared | Cleared |
| Playback highlight/progress | Render events may reset it | Not restored | Cleared/reset |
| Preview scroll position | Usually retained because the host DOM remains | Not explicitly restored | Not explicitly restored |
| API listeners | Existing instance | Rebound on new API | Rebound on new API |
| SoundFont | Existing instance | Reloaded | Reloaded |

## Listener lifecycle

Every new production API is passed through `usePreviewEventBindings`.

The hook:

- refuses to bind the same API twice;
- tears down a previously bound API before binding another;
- records an API/token pair so a stale cleanup cannot unbind a newer API;
- reports bind/unbind counters to lifecycle telemetry.

`destroyCurrentApi()` runs listener teardowns before calling the shared destroy
helper. The shared helper:

1. invokes optional pre-destroy cleanup;
2. disconnects the theme observer stored on the API;
3. unregisters global player controls;
4. calls `api.destroy()`;
5. clears the ref;
6. emits `onApiChange(null)`;
7. clears score selection.

Any new listener, timer, animation frame, or global control must have a teardown
path that participates in this sequence.

## Parse timeout and recovery

Before user content is sent to `tex()`, Preview starts a 3-second timeout.
Successful matching `scoreLoaded` events save the score as the last valid
version and clear the timeout.

On a normal alphaTab error:

- the pending timer is cleared;
- the full error is exposed to the Preview error UI;
- the most recent valid score is rendered through `renderScore()` once;
- a recovery guard prevents recursive restore attempts.

Two errors have narrower handling:

- a known non-guitar TAB probe failure silently rolls back the probe;
- a numbered-notation beat rendering failure disables numbered notation,
  rerenders, and avoids surfacing a fatal parse error when rollback succeeds.

## Audio output recovery

Playback audio recovery is owned by `lib/preview-audio-refresh.ts`
(`createPlaybackAudioRefreshCoordinator`). `window.focus` and
`visibilitychange` funnel into a single-flight `refresh()` so one window
return runs recovery exactly once.

Recovery is cascading:

1. `prepareAlphaTabAudioForPlayback` (`lib/player-audio-recovery.ts`) inspects
   the AudioContext state:
   - `running` → return immediately (alphaTab's `activate()` only invokes its
     callback after resuming a suspended context, so calling it while running
     just burns a timeout);
   - `suspended`/`interrupted`/missing context → `activate()` + direct
     `resume()`;
   - `closed` → report unrecoverable, do not attempt in place.
2. The soundfont is reloaded (`append=false`, per-URL in-flight dedup) only
   when the context is `closed`, an activation attempt did not end in
   `running`, or playback is stalled (tick position not advancing while
   playing). Idle time alone never triggers a reload. The reloaded URL is the
   effective SoundFont URL: an external font configured in global settings is
   served through the Tauri asset protocol (`asset://localhost/...`), which
   the coordinator and `loadSoundFontFromUrl` treat like any other URL —
   the raw bytes never cross IPC and the file remains user-managed.
3. After a reload, playback is checked again. If it is still stalled, the
   coordinator reports `audioStalled` and Preview shows a user-facing notice
   with a restart action.

`play()` additionally runs a self-healing check: if playback started but the
tick position does not advance within 2 seconds, the same cascade runs.

### Known platform limitation

After macOS display/system sleep the WKWebView audio subsystem can stop
working even though `AudioContext.state` reports `running` and
`api.play()` returns success. This is a WebView process-level fault that
cannot be repaired from inside the page (page reload, API rebuild, output-mode
switch, and soundfont reload all fail). The only working recovery is a fresh
WebView process, i.e. restarting the app; workspace state is restored through
the existing autosave and session-recovery mechanisms. See
`docs/dev/reports/WKWEBVIEW_AUDIO_SLEEP_DIAGNOSIS.md` for the full diagnosis.

## Lifecycle telemetry

Development builds log transitions among:

- `idle`;
- `initializing`;
- `ready`;
- `rebuilding`;
- `destroyed`;
- `error`.

Counters track:

- API created/destroyed;
- listeners bound/unbound;
- rebuild requested/completed;
- recovery triggered;
- parse timeout triggered.

For a stable session, created/destroyed and bound/unbound counts should converge
after teardown. A growing difference is evidence of duplicate lifecycle work
or missing cleanup.

## Print lifecycle

The live Preview and Print Preview APIs are intentionally separate.

Opening Print Preview:

1. marks the live API as suspended;
2. destroys the live API and unregisters its controls;
3. waits briefly for resources to be released;
4. creates a print-only API.

Print Preview:

- uses `createPrintSettings()`;
- disables the player;
- uses black print colors;
- loads Bravura through an absolute/resolved URL;
- preserves alphaTab's required `.at` font size of `34px`;
- applies print-specific tracks and staff flags;
- paginates after `renderFinished`;
- uses `renderTracks()` or `render()` for print parameter changes.

Closing Print Preview destroys the print API. After a 150 ms delay, the live
Preview increments its reinit trigger and creates a new live API.

Never pass the live API into print code or reuse the print API for playback.

## Tutorial lifecycle

Tutorial Playground is deliberately simpler:

- content changes recreate its API;
- it does not participate in live Preview store controls or recovery;
- success requires both `scoreLoaded` and `renderFinished`;
- it currently applies theme colors by mutating settings and calling
  `render()`.

That theme path differs from the production deep-rebuild contract and must be
validated independently when alphaTab or theme behavior changes. Do not infer
production lifecycle guarantees from tutorial behavior.

## Architectural invariants

- Keep `AlphaTabApi` in refs, never React state.
- Bind listeners once per API and tear them down before destruction.
- Use `tex()` for content; do not rebuild the API on every keystroke.
- Use `renderTracks()` for affected score tracks.
- Use `updateSettings()` + `render()` for supported warm settings.
- Rebuild for production theme/resource changes that require fresh construction
  settings.
- Reapply score-model configuration after `scoreLoaded`.
- Keep live, print, and tutorial APIs independent.
- Preserve the print font contract.
- Clear stale selection state when the score or API changes.
- Treat asynchronous callbacks as stale unless they still refer to the current
  API/session.

## Change checklist

When changing the live Preview lifecycle:

1. identify whether the change belongs to content, score model, warm settings,
   or construction-time settings;
2. verify listener and timer teardown;
3. check ATDOC application order;
4. verify state preservation using the matrix above;
5. test normal editing, theme changes, explicit Refresh, and Print Preview;
6. inspect lifecycle counters in development;
7. run renderer tests, build checks, `pnpm docs:check`, and `git diff --check`.

## Related documents

- [Architecture overview](./OVERVIEW.md)
- [Editor and Preview synchronization](./EDITOR_PREVIEW_SYNC.md)
- [alphaTab debugging runbook](../runbooks/DEBUG_ALPHATAB.md)
- [Historical staff configuration proposals](../archived/alphatab/TRACKS_CONFIGURATION_PROPOSALS.md)
