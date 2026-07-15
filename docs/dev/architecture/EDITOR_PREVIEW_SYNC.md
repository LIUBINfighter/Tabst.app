# Editor and Preview Synchronization

> **Status:** Current
>
> **Scope:** AlphaTex source positions, Preview selection, editor cursor
> broadcast, playback highlighting, loop prevention, and known limitations
>
> **Last verified:** 2026-07-15

## Purpose

Tabst connects CodeMirror source positions to alphaTab score objects through
bar/beat coordinates. The synchronization system has three related but distinct
flows:

1. Preview selection to editor source highlight;
2. editor cursor to Preview navigation and score highlight;
3. playback position to editor playback highlight.

These flows share parsing helpers and Zustand state, but they have different
feature flags, visual granularity, and clearing rules.

## State model

`src/renderer/store/appStore.ts` owns the shared synchronization state.

| State | Producer | Consumer | Meaning |
| --- | --- | --- | --- |
| `scoreSelection` | alphaTab `playbackRangeHighlightChanged` | Editor selection decoration and Preview Delete handler | User-selected start/end bar and beat |
| `editorCursor` | CodeMirror cursor tracking extension | Preview synchronization hooks | Source cursor mapped to a bar and beat |
| `playbackBeat` | alphaTab `playedBeatChanged` | Editor playback decoration | Beat currently playing |
| `playerCursorPosition` | score clicks, editor navigation, playback events | Editor paused-position decoration | Retained player cursor even while not playing |
| `playerIsPlaying` | alphaTab player events and count-in resolution | Playback UI and highlight selection | Whether playback should be treated as active |
| `apiInstanceId` | live Preview API creation | API-derived consumers | Invalidates state tied to an old API |
| `scoreVersion` | successful score load | Score-derived consumers | Invalidates state tied to an old score model |

Do not merge `scoreSelection`, `playbackBeat`, and `playerCursorPosition`.
They represent different user intents and use different editor colors.

## Feature flags

Two workspace preferences affect synchronization:

| Preference | Default | Effect |
| --- | --- | --- |
| `enableCursorBroadcast` | `false` | Enables editor cursor → Preview bar/beat navigation and bar-number highlighting |
| `enableSyncScroll` | Workspace preference | Enables editor auto-scroll while playback or paused-bar highlights move |

Preview selection → Editor highlighting is not gated by
`enableCursorBroadcast`. The flag controls the reverse editor → Preview path.

## Source position parsing

The canonical implementation is
`src/renderer/lib/alphatex-parse-positions.ts`.

### AST-first path

`parseBeatPositionsAST()`:

1. constructs alphaTab's `AlphaTexParser`;
2. uses `AlphaTexParseMode.Full`;
3. reads bars and beats from the parsed nodes;
4. extracts source offsets and line/column positions from note, rest, or beat
   nodes;
5. records a zero-based `barIndex` and `beatIndex` for each source range.

The result is:

```ts
interface BeatCodePosition {
  barIndex: number;
  beatIndex: number;
  startOffset: number;
  endOffset: number;
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}
```

### Guarded fallback

If AST parsing throws or returns no usable beats,
`parseBeatPositionsLegacy()` performs a compatibility parse. It understands the
content separator, metadata, comments, strings, durations, chords, rests, and
barlines well enough to recover common source ranges.

The fallback is not a second AlphaTex specification. New structural semantics
must be implemented through the AST path first. Extend the fallback only for
well-defined recovery cases.

### Mapping behavior

`mapSelectionToCodeRange()` first seeks exact bar/beat matches. If one endpoint
cannot be found, it falls back to the first beat in that bar and finally to a
nearby beat. Invalid or reversed source ranges return `null`.

`findBeatAtPosition()`:

- returns the containing beat when possible;
- otherwise accepts a nearby beat within 50 source characters;
- returns bar/beat `-1` when the cursor is outside usable AlphaTex content.

Fallback matching is intentionally tolerant for interactive editing, but it
means a highlight near invalid syntax may be approximate.

## Preview selection → Editor

The live Preview subscribes to alphaTab
`playbackRangeHighlightChanged`.

```text
alphaTab selection event
    → validate start/end beats belong to the current score
    → reject editor-originated highlight events
    → write scoreSelection to Zustand
    → Editor maps bar/beat endpoints to source offsets
    → CodeMirror shows a blue selection decoration
```

The event handler clears `scoreSelection` when:

- alphaTab reports no start or end beat;
- the event contains beats from a stale score;
- the range was produced by editor cursor synchronization.

The Preview sets `isEditorCursorFromScoreRef` before writing a user selection so
the reverse cursor path does not immediately feed the same change back into the
score.

### Source deletion

When Preview, rather than CodeMirror, owns keyboard focus and a valid
`scoreSelection` exists, pressing Delete:

1. maps the selection to a source range;
2. removes that range from the active `.atex` document;
3. updates the store;
4. clears `scoreSelection`;
5. saves the new file content.

Changes to mapping behavior therefore affect both visual selection and source
editing. Add tests before making fallback selection wider or more aggressive.

## Editor cursor → Preview

CodeMirror's cursor tracking extension:

1. listens to selection or document changes;
2. schedules mapping on the next animation frame;
3. converts the cursor head to line/column;
4. maps the source position to a bar and beat;
5. writes `EditorCursorInfo` to Zustand.

When `enableCursorBroadcast` is enabled,
`usePreviewSelectionSync`:

1. rejects invalid positions and score-originated updates;
2. finds the corresponding alphaTab beat;
3. clears user score selection;
4. colors the Preview bar number;
5. moves `api.tickPosition` to the beat when playback is stopped;
6. updates `playerCursorPosition`;
7. highlights the whole containing bar through
   `highlightPlaybackRange(firstBeat, lastBeat)`;
8. assigns an alphaTab playback range for that bar;
9. scrolls Preview when the beat is outside the visible area and the cursor
   movement was not caused by a document edit.

### Current granularity

The long-term contract is:

- navigation position: Beat-level;
- visual Preview range: Bar-level.

The current cursor tracking extension deduplicates emitted positions by
`barIndex` only. Moving between beats inside the same bar therefore does not
always emit another update. This is a known implementation gap relative to the
Beat-level navigation contract.

A future fix should compare both `barIndex` and `beatIndex` while preserving
frame throttling and loop guards.

## Playback → Editor

alphaTab's `playedBeatChanged` updates:

- `playbackBeat` for the green current-beat decoration;
- `playerCursorPosition` for the retained paused/stopped position.

The Editor chooses one presentation:

| Player state | Editor presentation |
| --- | --- |
| Playing with a current beat | Green Beat-level highlight |
| Not playing with a retained player cursor | Yellow Bar-level highlight |
| No playback or cursor state | No playback decoration |

Playback range lookup is cached by source text to avoid reparsing the entire
document for every playback callback.

Editor auto-scroll:

- is gated by `enableSyncScroll`;
- schedules at most one task of each kind per frame;
- throttles playback scrolling and paused-bar scrolling independently;
- advances in page-like steps when the highlight crosses the comfortable
  viewport range.

## Visual layers

| Layer | Class | Color intent |
| --- | --- | --- |
| User score selection | `cm-score-selection-highlight` | Blue/primary |
| Active playback beat | `cm-playback-highlight` | Green |
| Paused/stopped player bar | `cm-playback-bar-highlight` | Yellow |
| Preview editor-cursor bar number | alphaTab bar model color | Theme-aware accent |

Selection and playback decorations are separate CodeMirror state fields. A
selection update must not overwrite playback state and vice versa.

## Dispatch and scheduling

Selection decoration dispatch uses `setTimeout(..., 0)` after validating that
the EditorView DOM is still mounted. It revalidates immediately before
`view.dispatch()`.

Playback decoration dispatch uses frame-coalesced tasks:

- an existing task with the same key is cancelled;
- the latest task runs on the next animation frame;
- per-view WeakMaps avoid retaining destroyed editor instances.

Do not call `view.dispatch()` synchronously from high-frequency alphaTab or
CodeMirror callbacks without checking whether the view is still mounted.

## Loop prevention

The reverse synchronization path uses two directions of guard state:

- `isEditorCursorFromScoreRef` prevents a Preview-originated selection from
  immediately navigating the Preview again through Editor cursor state;
- `isHighlightFromEditorCursorRef` marks alphaTab highlight events generated by
  editor navigation;
- `lastEditorCursorSelectionRef` remembers the last bar range because
  `highlightPlaybackRange()` may emit multiple events after the immediate flag
  changes.

The editor-origin flag is held for 200 ms, and the remembered bar range is
cleared 100 ms later. These delays are compatibility guards for alphaTab's
event timing, not general scheduling primitives.

If Selection API behavior changes in a future alphaTab version, validate the
actual event sequence before changing these timers.

## Clearing rules

`scoreSelection` is cleared when:

- the current score changes;
- a new API is created or destroyed;
- content is sent through `tex()`;
- playback starts;
- playback stops or explicit Refresh runs;
- a score beat is clicked;
- editor navigation produces a Preview highlight;
- the mapped editor position is invalid;
- alphaTab reports an empty or stale range.

Playback highlights are cleared or reset when:

- playback finishes;
- the player reports a stopped state;
- Preview render completes;
- explicit Stop or Refresh runs;
- an empty/no-beat playback event arrives.

Clearing behavior is intentional. Preserving a stale highlight across a new
score risks dereferencing score objects owned by an old API.

## Selection API compatibility

The project currently resolves alphaTab 1.8.3.

The integration uses the public Selection API introduced in the 1.8 line:

- `playbackRangeHighlightChanged`;
- `highlightPlaybackRange(start, end)`.

The repository does not currently implement custom selection handles or call
`applyPlaybackRangeFromHighlight()`. Do not copy historical handle examples
into production code without a new interaction design and tests.

See the historical migration note for the previous private-field approach.

## Known limitations

- Editor cursor broadcast defaults to off.
- Editor → Preview navigation does not reliably emit a new position for a
  different beat in the same bar.
- The visual editor → Preview highlight is intentionally Bar-level.
- Source mapping falls back to approximate matches during invalid/incomplete
  editing.
- Position mapping currently does not provide Note-level selection.
- The live staff and navigation model focuses on the first track in several
  paths.
- The documented parser examples do not yet have dedicated automated tests in
  the repository.

## Required regression coverage

Add focused tests for:

1. notes, rests, duration prefixes, chords, comments, and compact notation;
2. AST failure followed by legacy fallback;
3. selection endpoints across multiple bars;
4. cursor movement between two beats in one bar;
5. invalid source during active editing;
6. stale alphaTab beats from a previous score;
7. editor-originated highlight events emitted more than once;
8. selection Delete source mutation;
9. playback beat and paused-bar decoration coexistence;
10. mounted/unmounted EditorView scheduling.

## Change checklist

When changing synchronization:

1. state whether the change is selection, cursor, player cursor, or playback;
2. preserve the AST-first parser path;
3. define Beat- versus Bar-level behavior explicitly;
4. check `enableCursorBroadcast` and `enableSyncScroll`;
5. preserve stale-score validation and loop guards;
6. ensure EditorView tasks are cancelled or harmless after unmount;
7. test content edits, file changes, playback, and Preview rebuilds;
8. update this document if state ownership or granularity changes.

## Source-of-truth files

- `src/renderer/lib/alphatex-parse-positions.ts`
- `src/renderer/lib/alphatex-selection-sync.ts`
- `src/renderer/lib/alphatex-cursor-tracking.ts`
- `src/renderer/lib/alphatex-playback-sync.ts`
- `src/renderer/hooks/usePreviewSelectionSync.ts`
- `src/renderer/components/Preview.tsx`
- `src/renderer/components/Editor.tsx`
- `src/renderer/store/appStore.ts`

## Related documents

- [Preview lifecycle](./PREVIEW_LIFECYCLE.md)
- [Architecture overview](./OVERVIEW.md)
- [alphaTab debugging runbook](../runbooks/DEBUG_ALPHATAB.md)
- [Historical alphaTab 1.8 Selection migration](../archived/alphatab/SELECTION_API_1_8_MIGRATION.md)
