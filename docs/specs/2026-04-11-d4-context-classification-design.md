# D.4 Context Classification — Design Spec

## Purpose

Classify the shape of each conversation (solo dictation, conversation with others, presenting to a group) from speaker count and speech distribution. This is the prerequisite for D.5 mode-aware coaching — the system needs to know what kind of conversation is happening before deciding what coaching rules apply.

## Categories

Three session context types for v1:

| Context (stored value) | UI label | Rule | Coaching implication (D.5) |
|---|---|---|---|
| `solo` | Solo | 1 speaker only | Full coaching — rambling alerts, pacing, fillers |
| `with_others` | With Others | 2+ speakers, no presentation dominance | Coach YOUR speech only, softer on duration |
| `presentation` | Presenting | 1 speaker has 85%+ of segments AND 2+ other speakers AND minimum segment floor met | Softest coaching — you're expected to talk a lot |

**Naming rule:** stored/internal values are lowercase snake_case (`solo`, `with_others`, `presentation`). UI labels are title-case display strings (`Solo`, `With Others`, `Presenting`). The mapping lives in the UI component, not the service or store.

## Classification Logic

### Inputs (already available from D.2/D.3)

- Speaker count from `speakerStore.mappings` (number of distinct diarized labels)
- Segment count per speaker from `transcriptStore.segments` (count of final segments per `segment.speaker`)

### Algorithm

1. Count total final segments. If below `MIN_SEGMENTS_FOR_CLASSIFICATION` → return `null` (undetermined).
2. Count distinct speakers that have at least 1 final segment.
3. If only 1 speaker → `solo`.
4. If 2+ speakers, compute dominant speaker's segment share (segments by dominant / total segments):
   - If share >= `PRESENTATION_DOMINANCE` AND total distinct speakers >= 3 (dominant + 2 others) AND total segments >= `MIN_SEGMENTS_FOR_CLASSIFICATION` → `presentation`.
   - Otherwise → `with_others`.
5. If user has overridden, skip auto-classification entirely — the override is sticky for the rest of the session.

**Important:** The minimum segment floor applies only to auto-classification. If the user manually selects a context before the floor is met (e.g. taps the pill area and picks "With Others" in the first 30 seconds), that manual context is stored immediately in the session store, persists normally at session end, and is never overwritten by auto-classification.

### Thresholds

Named constants in the service file, easy to tune:

```
PRESENTATION_DOMINANCE = 0.85
PRESENTATION_MIN_SPEAKERS = 3   // dominant + at least 2 others
MIN_SEGMENTS_FOR_CLASSIFICATION = 15
```

## Data Model

### New type

```typescript
type SessionContext = 'solo' | 'with_others' | 'presentation';
type SessionContextSource = 'auto' | 'manual';
```

Added to `app/src/types/index.ts`.

### New columns (migrateToV6)

On the `sessions` table:

- `session_context TEXT` — nullable. Values: `'solo'`, `'with_others'`, `'presentation'`, or NULL (not enough data).
- `session_context_source TEXT` — nullable. Values: `'auto'`, `'manual'`, or NULL (no classification occurred).

### Store additions

`sessionStore` gets two new fields:

- `sessionContext: SessionContext | null` — current live classification (null = undetermined)
- `sessionContextOverride: boolean` — true if user manually selected a context this session

### Reset behavior

On every new session start, `transcriptService.startTranscription()` must reset:

- `sessionStore.sessionContext` → `null`
- `sessionStore.sessionContextOverride` → `false`

This prevents stale context from a previous session leaking into a new one.

## Service

### `contextClassificationService.ts`

Stateless pure-logic module. Not a class — just exported functions.

**Primary function:**

```typescript
function classifyContext(
  speakerSegmentCounts: Map<string, number>,
  totalSegments: number,
): SessionContext | null
```

Returns `null` if `totalSegments < MIN_SEGMENTS_FOR_CLASSIFICATION`. Otherwise returns the classification per the algorithm above.

No state, no store access, no side effects. Pure function — easy to unit test.

This service contains classification logic only — no display labels. The internal→UI label mapping (`presentation` → `Presenting`, etc.) lives in the `SessionContextPill` component where it is consumed.

## Wiring

### Live classification

In `transcriptService.ts`, each time a final segment is added:

1. Build a `Map<string, number>` of speaker → segment count from `transcriptStore.segments`.
2. Call `classifyContext(speakerSegmentCounts, totalSegments)`.
3. If `sessionStore.sessionContextOverride` is `true` → do nothing (override is sticky).
4. If result differs from current `sessionStore.sessionContext` → update the store.

This runs on every final segment. The function is cheap (iterates segments once), and the store update only fires when the classification actually changes.

### Session end

In `transcriptService.stopTranscription()`, after persisting the transcript:

1. Read `sessionStore.sessionContext` and `sessionStore.sessionContextOverride`.
2. Persist to sessions table:
   - `session_context` = the current context value (auto or overridden)
   - `session_context_source` = `'manual'` if override is true, `'auto'` otherwise
   - If context is still `null`, persist NULL for both columns.

### DB persistence

New function in `app/src/db/sessions.ts`:

```typescript
async function updateSessionContext(
  sessionId: string,
  context: SessionContext | null,
  source: SessionContextSource | null,
): Promise<void>
```

Simple UPDATE on the two new columns.

## UI

### SessionContextPill

Small presentational component: `app/src/components/SessionContextPill.tsx`.

**Props:** `{ context: SessionContext | null; isOverride: boolean; onPress: () => void }`

**Display label map** lives in this component (not in the classification service):

```
solo → "Solo"
with_others → "With Others"
presentation → "Presenting"
```

**Behavior:**
- `context === null` → render nothing (auto-classification hasn't reached the floor yet and user hasn't manually selected)
- Otherwise → render a tappable pill showing the display label
- If `isOverride` is true, show a small visual indicator (e.g. slightly different border or a "·" suffix) so the user knows they set it manually

**Visual style:** Same pattern as the existing status pill in the session screen — `theme.colors.card` background, `theme.type.small` text, `theme.radius.full` border radius. Placed between the status pill row and the speech duration hero.

### Override picker

Tapping the pill opens a simple 3-option action — not a full modal. Use `Alert.alert` with 3 buttons (Solo / With Others / Presenting) plus Cancel. On selection:

1. Set `sessionStore.sessionContext` to the selected value.
2. Set `sessionStore.sessionContextOverride` to `true`.
3. Auto-classification stops updating for the rest of this session.

## Testing

### Unit tests for `classifyContext()` (pure function)

- 0 segments → `null`
- 14 segments, 1 speaker → `null` (below floor)
- 15 segments, 1 speaker → `solo`
- 15 segments, 2 speakers (even split) → `with_others`
- 20 segments, 3 speakers, speaker 0 has 17 (85%) → `presentation`
- 20 segments, 3 speakers, speaker 0 has 16 (80%) → `with_others` (below threshold)
- 20 segments, 2 speakers, speaker 0 has 18 (90%) → `with_others` (only 2 speakers, need 3)
- Exactly at 85% boundary: 100 segments, 3 speakers, dominant has 85 → `presentation`
- Exactly below: 100 segments, 3 speakers, dominant has 84 → `with_others`

### Override stickiness test (integration-level)

One test that verifies the key behavioral rule:

1. Start with `sessionContextOverride = false`.
2. Auto-classify → `solo`.
3. User overrides to `with_others` → store updates, `sessionContextOverride = true`.
4. Simulate more segments arriving with 1 speaker → auto-classification would return `solo`.
5. Assert: `sessionStore.sessionContext` is still `with_others` (override was sticky).

This test uses the store directly (not the pure function) to verify the wiring respects the override flag.

## Files

| File | Change |
|---|---|
| `app/src/types/index.ts` | Add `SessionContext`, `SessionContextSource` types |
| `app/src/db/schema.ts` | `migrateToV6` — add `session_context`, `session_context_source` columns |
| `app/src/db/database.ts` | Wire `migrateToV6` into migration chain |
| `app/src/db/sessions.ts` | Add `updateSessionContext()` function |
| `app/src/services/contextClassificationService.ts` | New — pure classification function + thresholds + label helper |
| `app/src/services/__tests__/contextClassificationService.test.ts` | New — unit tests for pure function |
| `app/src/stores/sessionStore.ts` | Add `sessionContext`, `sessionContextOverride` fields + setters |
| `app/src/services/transcriptService.ts` | Wire live classification + reset on start + persist on end |
| `app/src/services/__tests__/contextClassification.integration.test.ts` | New — override stickiness test |
| `app/src/components/SessionContextPill.tsx` | New — presentational pill |
| `app/app/(tabs)/session.tsx` | Render `SessionContextPill` in active session view |

## What this does NOT include

- D.5 coaching engine (filler detection, pacing, nudges)
- Background noise detection (needs audio-level analysis, not just speaker count)
- Automatic mid-session context downgrades (solo → with_others is natural; with_others → solo doesn't happen)
- Post-session context editing in history (v1 override is during-session only)
- More than 3 categories (expandable later if real usage shows a need)
