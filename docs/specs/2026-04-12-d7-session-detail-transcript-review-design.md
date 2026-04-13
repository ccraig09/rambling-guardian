# D.7 v1 — Session Detail & Transcript Review — Design Spec

## Purpose

Give users a dedicated screen to review a completed session in full: the transcript with speaker attribution, the AI summary, and the alert timeline — all in one scrollable surface.

The history tab today shows a collapsed card that expands to reveal stats, alert timeline, and AI summary. That card is getting full. Transcript review needs more space than a card can provide. D.7 adds a Session Detail screen as a modal route, navigated from a persistent "View Details →" link on every expanded card.

This builds on D.1 (transcript pipeline), D.2–D.3 (speaker attribution + library), D.4 (context classification), D.5 (coaching profiles), and D.6 (AI summaries).

---

## Scope

### In scope

- New Session Detail modal screen (`app/session/[id].tsx`)
- "View Details →" text link in every expanded history card
- Transcript display: speaker-attributed turns if `transcriptTimestamps` is available; flat text fallback; "No transcript" fallback
- Speaker name resolution: diarized labels → display names via `speakerMap`
- AI Summary section: reuse D.6 `generateSummary()` + `summaryEligibilityReason()` — no new summary logic
- Alert Timeline section: collapsed accordion, expand to show timeline entries
- Graceful fallbacks for null/missing data at every section

### Out of scope

- Editing speaker names from the detail screen (use history card SpeakerPicker for that)
- Editing or regenerating the transcript
- Sharing or exporting sessions
- Word-level tap-to-seek (no audio playback in v1)
- Search within transcript
- Any history list redesign

---

## Route Structure

**New file:** `app/app/session/[id].tsx`

**Registration in root layout (`app/app/_layout.tsx`):**
```tsx
<Stack.Screen name="session/[id]" options={{ presentation: 'modal' }} />
```

The root layout already uses this pattern for `onboarding`. One additional `Stack.Screen` is the only layout change needed.

**Navigation from history:**
```tsx
import { useRouter } from 'expo-router';
const router = useRouter();
// Inside expanded card:
router.push(`/session/${session.id}`);
```

**Back:** iOS swipe-down or a back chevron in the detail screen header. The history list is not re-fetched on return — the detail screen is read-only.

**Dynamic param access inside detail screen:**
```tsx
import { useLocalSearchParams } from 'expo-router';
const { id } = useLocalSearchParams<{ id: string }>();
```

---

## "View Details →" Entry Point

- **Location:** Bottom of the expanded session card in `history.tsx`, below the AI Summary section
- **Always shown:** Not gated by transcript existence. Even sessions without a transcript have useful detail (stats, alert timeline, summary)
- **Style:** Text link (not a button) — avoids visual competition with the "Generate Summary" button
- **Tap action:** `router.push('/session/' + session.id)`

```
[expanded card content]
...
[Generate Summary] or [AI Summary text]

View Details →             ← text link, right-aligned or inline
```

---

## Session Detail Screen

### Header (non-scrolling)

A compact row pinned at the top, always visible while scrolling:

```
[← Back]        Session Details

[date]  [duration]  [context badge]  [alert count badge]
```

- Date: `formatSessionDate(session.startedAt)`
- Duration: `formatDuration(session.durationMs)`
- Context badge: same indigo pill used on history card
- Alert count badge: same red/orange pill as history card

### Scrollable Body

Section order (top → bottom):

1. **Transcript** (dominant — appears first)
2. **AI Summary** (secondary — below transcript)
3. **Alert Timeline** (accordion — at bottom)

---

## Transcript Section

This is the primary value of D.7. It occupies the top of the scrollable body and has the most vertical space.

### Data sources

| Field | DB column | Notes |
|---|---|---|
| `session.transcriptTimestamps` | `transcript_timestamps` | `TranscriptSegment[]` JSON, nullable |
| `session.transcript` | `transcript` | Flat plain text, nullable |
| `session.speakerMap` | `speaker_map` | `SpeakerMapping[]` JSON, nullable |

Both are already mapped in `parseSession` (gap closed in D.6 fix ee88117).

### Rendering priority

1. **If `transcriptTimestamps` is present and parseable** → speaker-attributed turns (see below)
2. **Else if `transcript` is present** → plain text block, no speaker attribution
3. **Else** → empty state: `"No transcript was recorded for this session."`

### Speaker-attributed turns

Parse `transcriptTimestamps` → `TranscriptSegment[]`. Parse `speakerMap` → `SpeakerMapping[]`.

Build a name-resolution lookup:
```typescript
const nameFor = (label: string | null): string => {
  if (!label) return 'Unknown';
  return mappings.find(m => m.diarizedLabel === label)?.displayName ?? label;
};
```

Filter to `isFinal === true` segments only (interim segments are noise).

Group consecutive segments from the same speaker into **turns** to reduce visual clutter:

```typescript
type Turn = {
  displayName: string;
  startMs: number;      // timestamp of first segment in turn
  text: string;         // joined segment texts
};
```

Render each turn as:
```
Me · 0:03
"So I wanted to go over the Q3 numbers and talk through what we saw..."

Speaker 1 · 1:14
"Yeah, that makes sense. What stood out to you?"

Me · 1:22
"The retention drop in week three was the big one..."
```

- Speaker name: bold or semibold, indigo tint for "Me", secondary color for others
- Timestamp: small, tertiary color, right of speaker name
- Text: body size, secondary color, normal weight, line-height 22
- Vertical gap between turns

### Parse safety

Both `JSON.parse` calls must be wrapped in `try/catch`. On parse failure, fall back gracefully:
- `transcriptTimestamps` parse fails → use flat `transcript` fallback
- `speakerMap` parse fails → use raw diarized labels as display names

---

## AI Summary Section

Appears below the transcript. Secondary — user scrolls to it.

**Reuse D.6 logic exactly.** No new summary code.

Three states (same as history card):
1. **Complete:** "AI Summary" header + summary text
2. **Eligible (not yet generated):** "Generate Summary" button — calls `generateSummary(session.id)`, re-reads session on complete
3. **Generating:** dimmed "Generating summary…" pill
4. **Failed:** "Summary failed. Tap to retry." in alert color

**Stale generating recovery:** same `useEffect` on mount that clears stale `generating` DB status (already in history card — reuse the same pattern).

**Hidden if:** `ANTHROPIC_API_KEY` is not set.

---

## Alert Timeline Section

Appears at the very bottom. Collapsed by default — it's reference data, not the primary review content.

```
▶  Alert Timeline  (3 alerts)      ← tappable header, expands/collapses

[when expanded:]
0:45  ●  Gentle alert — 32s of speech
1:58  ●  Moderate alert — 47s of speech
3:22  ●  Urgent alert — 61s of speech
```

- Uses `getAlertEvents(session.id)` — already exists, same call as history card
- Loaded on screen mount (not deferred to expand — fast enough, keeps expand instant)
- Toggle state: `const [timelineOpen, setTimelineOpen] = useState(false)`
- Alert dot colors: same `alertBadgeColor()` helper from history

---

## File Structure

### New file

**`app/app/session/[id].tsx`** (~200 lines)
- Loads session via `getSessionById(id)` on mount
- Loads alert events via `getAlertEvents(id)` on mount
- Renders: header, transcript section, summary section, alert timeline accordion
- All pure render logic — no new services

### Modified files

**`app/app/_layout.tsx`** (+1 line)
```tsx
<Stack.Screen name="session/[id]" options={{ presentation: 'modal' }} />
```

**`app/app/(tabs)/history.tsx`** (~15 lines)
- Import `useRouter` from `expo-router`
- Add `router.push` handler
- Add "View Details →" `Pressable` at bottom of expanded card content

---

## Data Flow

```
history.tsx
  └─ expanded card
       └─ "View Details →" tap
            └─ router.push('/session/SESSION_ID')
                  └─ app/session/[id].tsx
                       ├─ getSessionById(id) → Session (with transcript, speakerMap, summary)
                       └─ getAlertEvents(id) → AlertEvent[]
```

No new DB functions. No new services. No new types.

---

## Fallback Matrix

| Data available | Transcript section shows |
|---|---|
| `transcriptTimestamps` + `speakerMap` | Speaker-attributed turns |
| `transcriptTimestamps` only (no speakerMap) | Turns with raw diarized labels |
| `transcript` only (no timestamps) | Plain text block |
| Neither | "No transcript recorded for this session." |

| Summary state | Summary section shows |
|---|---|
| `summaryStatus = 'complete'` | Summary text |
| Eligible (transcript ≥ 30s, no summary) | Generate button |
| `summaryStatus = 'generating'` | Generating pill |
| `summaryStatus = 'failed'` | Tap to retry |
| No API key | Section hidden |

---

## Non-Negotiables

- JSON parse must never crash the screen — always `try/catch` with fallback
- "View Details →" appears for all sessions, not just transcript-bearing ones
- Transcript is the first thing visible on scroll (above summary, above timeline)
- No new summary logic — reuse D.6 exactly
- Alert timeline is collapsed by default — it's reference data

---

## Open Questions (deferred to implementation)

- Should "Me" turns be visually distinguished (right-aligned bubble vs left-aligned) or kept as a flat list? Flat list is simpler for v1 and avoids iMessage-style design debt.
- Should the detail screen header show a "Generate Summary" button or only show it in the scrollable body? Keep it in the body only for v1.
