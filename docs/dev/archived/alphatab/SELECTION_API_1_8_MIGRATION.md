# Historical alphaTab 1.8 Selection API Migration

> **Status:** Historical / Superseded
>
> **Current alphaTab version:** 1.8.3
>
> Current replacement:
> [Editor and Preview synchronization](../../architecture/EDITOR_PREVIEW_SYNC.md)
>
> **Archived:** 2026-07-15

## Why this note is preserved

The original `docs/dev/alphatab/SELECTION_SYNC.md` began as a migration note for
the public Selection API introduced in alphaTab 1.8. It was later expanded with
current synchronization architecture, parser details, troubleshooting, and
future ideas.

The migration remains useful for understanding why Tabst avoids private
alphaTab selection fields, but it should not be read as the current end-to-end
implementation.

## Migration principle

Before the public Selection API, integrations sometimes reached into private
fields or methods such as:

- `_selectionStart`;
- `_cursorSelectRange`.

The 1.8 API provided public event and command surfaces:

| Intent | Public API |
| --- | --- |
| Observe highlighted range changes | `playbackRangeHighlightChanged` |
| Set a highlighted range | `highlightPlaybackRange(start, end)` |
| Commit a highlighted range as playback range | `applyPlaybackRangeFromHighlight()` |
| Read selection geometry | bounds supplied by Selection API event data |

The durable lesson is to use public events and commands instead of patching or
reading private alphaTab fields.

## What Tabst currently uses

The production live Preview currently uses:

- `playbackRangeHighlightChanged` to convert a user score selection into
  `scoreSelection`;
- `highlightPlaybackRange(firstBeat, lastBeat)` for editor-driven Bar-level
  visual highlighting;
- explicit `playbackRange` assignment for the editor-selected bar.

The repository does not currently:

- render custom selection handles;
- implement handle dragging;
- call `applyPlaybackRangeFromHighlight()`.

Those examples appeared in the original migration document as an API usage
pattern, not as verified production behavior.

## Geometry example from the migration period

The 1.8 event model made it possible to derive custom handle geometry from
public bounds:

```ts
api.playbackRangeHighlightChanged.on((event) => {
  if (!event.startBeat || !event.endBeat) {
    hideHandles();
    return;
  }

  const startX = event.startBeatBounds.realBounds.x;
  const endX =
    event.endBeatBounds.realBounds.x +
    event.endBeatBounds.realBounds.w;

  updateSelectionHandles(startX, endX);
});
```

This remains an illustrative upstream-style pattern only. A future Tabst
selection-handle feature would need:

- an interaction design;
- pointer capture and drag semantics;
- score/API lifecycle invalidation;
- editor synchronization loop guards;
- accessibility behavior;
- automated and manual tests.

## Current divergence from the old document

The original document also became inaccurate in several places:

- the project now resolves alphaTab 1.8.3 rather than 1.8.0;
- Selection decoration dispatch uses `setTimeout(0)` rather than
  `requestAnimationFrame`;
- Editor cursor broadcast is configurable and defaults to off;
- Editor → Preview visual highlighting is Bar-level;
- cursor tracking currently deduplicates by Bar, so same-Bar Beat movement does
  not always rebroadcast;
- playback highlighting uses a separate cached and frame-coalesced pipeline;
- the listed parser examples did not have matching automated tests in the
  repository.

See the Current architecture document for the authoritative behavior.

## Source-of-truth files

- `src/renderer/components/Preview.tsx`
- `src/renderer/hooks/usePreviewSelectionSync.ts`
- `src/renderer/lib/alphatex-selection-sync.ts`
- `src/renderer/lib/alphatex-cursor-tracking.ts`
- `src/renderer/lib/alphatex-playback-sync.ts`
- `src/renderer/store/appStore.ts`

Do not restore private alphaTab field access from historical implementations.
