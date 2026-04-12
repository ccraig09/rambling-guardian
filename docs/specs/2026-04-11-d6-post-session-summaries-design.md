# D.6 v1 — Post-Session Summaries — Design Spec

## Purpose

Generate an AI summary of each session on demand, using the transcript, alert events, and session context to produce a context-aware coaching recap. Solo sessions get self-coaching feedback. With Others sessions get conversation balance recaps. Presenting sessions get talk performance recaps.

This builds on D.1 (transcript), D.2-D.3 (speaker identity), D.4 (context classification), and D.5 (coaching profiles).

## Scope

### In scope
- On-demand summary generation: user taps "Generate Summary" in session history
- Context-aware prompt templates: solo, with_others, presentation
- Summary stored in sessions table (new columns, migrateToV7)
- Summary displayed in expanded session card in history
- Retry on failure, no regenerate after success in v1
- Provider adapter pattern: service layer abstracts whether SDK or raw fetch is used
- Minimum session threshold: no summary for sessions under 30s or with no transcript

### Out of scope
- Automatic generation on session end
- "Catch me up" (live mid-session summary)
- "Draft a question" feature
- Cross-session improvement trends
- Action items as separate structured data (may appear naturally in summary text)
- Regenerate/re-run after successful generation (v1 generates once)
- Backend/edge function (client-side API key for prototyping, same pattern as Deepgram)

## API Key + Model

**API key:** `EXPO_PUBLIC_ANTHROPIC_API_KEY` env var, client-side. Same prototyping pattern as Deepgram's `EXPO_PUBLIC_DEEPGRAM_API_KEY`. Flagged for backend migration before production.

**Model:** Claude Haiku 4.5 (`claude-haiku-4-5-20251001`). Fast (~1-2s per summary), cheap (~$0.01/summary for a typical 5-minute transcript). If quality is insufficient after real-world testing, upgrade to Sonnet is a config constant change, not a code change.

**Token budget:** A 5-minute session produces ~700-1400 input tokens. A 30-minute meeting produces ~4000-8000 tokens. Haiku's 200K context handles all realistic cases. No truncation strategy needed for v1 unless sessions regularly exceed 45+ minutes. If a transcript exceeds 8000 tokens, truncate to the last 8000 tokens before sending.

## Provider Adapter

**Do not assume `@anthropic-ai/sdk` works in React Native.** The summary integration lives behind a small provider adapter so implementation can use the SDK if it works cleanly or fall back to raw `fetch` against the Anthropic Messages API.

**File:** `app/src/services/anthropicClient.ts`

```typescript
// Provider adapter — abstracts SDK vs raw fetch
async function createMessage(
  systemPrompt: string,
  userMessage: string,
): Promise<string>
```

This is the only function that touches the Anthropic API. `summaryService.ts` calls this function, never the API directly. If the SDK works in React Native, the implementation uses it. If not, it falls back to a raw `fetch` POST to `https://api.anthropic.com/v1/messages`. Either way, the interface is the same.

The model constant (`SUMMARY_MODEL`) lives in this file, making it a single-line change to upgrade from Haiku to Sonnet.

## Prompt Templates

Three context-aware system prompts in `app/src/services/summaryPrompts.ts`. All receive the same structured user message (see Input Assembly). The system prompt selects what to emphasize.

**Solo prompt focus:** Self-coaching recap. Emphasizes rambling patterns, alert moments, pacing awareness. Tone: supportive coach. "You spoke for X minutes. Here's what stood out..."

**With Others prompt focus:** Conversation balance recap. Emphasizes the user's talk-time share relative to others, whether they dominated or balanced well, key topics discussed. Tone: meeting debrief. "You were in a conversation with N people..."

**Presentation prompt focus:** Talk performance recap. Emphasizes pacing, whether alerts suggest the user needed to pause more, audience engagement signals (questions from others). Tone: presentation coach. "You presented for X minutes..."

**Fallback:** If `session_context` is null (classification never reached the floor), use the Solo template. Solo is the safe default — it applies generic self-coaching without assuming conversation dynamics.

**Prompt constraints (all templates):**
- Output: 3-5 sentences. Concise, not verbose.
- No markdown formatting (plain text for mobile display).
- Reference specific moments from the transcript when relevant.
- If no alerts fired, acknowledge it positively ("clean session").

## Input Assembly

A structured user message is assembled from session data and sent alongside the system prompt. This keeps the prompt templates clean and the data assembly in one place.

**Assembled from existing data (no new queries):**

| Field | Source | Notes |
|---|---|---|
| `session_context` | `sessions.session_context` | solo / with_others / presentation / null |
| `duration_ms` | `sessions.durationMs` | total session length |
| `alert_count` | `sessions.alertCount` | number of alerts fired |
| `max_alert_level` | `sessions.maxAlert` | highest alert reached |
| `speaker_count` | count from `sessions.speaker_map` | distinct speakers |
| `transcript_text` | `sessions.transcript` | full plain text (already persisted from D.1) |
| `alert_events` | `alert_events` table | timestamped alert log with duration-at-alert |

**Format:** Plain text block with labeled sections. No JSON — the model reads natural language better for this use case.

```
Session context: with_others
Duration: 12 minutes 34 seconds
Speakers: 3
Alerts: 4 (max level: moderate)

Alert timeline:
- 2:15 — Gentle alert (7s of continuous speech)
- 4:02 — Moderate alert (15s of continuous speech)
- 7:30 — Gentle alert (8s of continuous speech)
- 9:45 — Moderate alert (16s of continuous speech)

Transcript:
[full transcript text here]
```

## Data Model

### migrateToV7

Add to `sessions` table:

```sql
ALTER TABLE sessions ADD COLUMN summary TEXT;
ALTER TABLE sessions ADD COLUMN summary_status TEXT;
ALTER TABLE sessions ADD COLUMN summary_generated_at INTEGER;
```

All nullable. Same idempotent migration pattern as V2-V6 (catch "duplicate column" errors).

### Column semantics

| Column | Type | Values |
|---|---|---|
| `summary` | TEXT | null (not generated), or the summary text |
| `summary_status` | TEXT | null (not attempted), `generating`, `complete`, `failed` |
| `summary_generated_at` | INTEGER | null, or unix ms timestamp of successful generation |

### Session interface update

Add to `Session` interface in `types/index.ts`:

```typescript
summary: string | null;
summaryStatus: 'generating' | 'complete' | 'failed' | null;
summaryGeneratedAt: number | null;
```

Update `parseSession` to map the new columns.

## Trigger — On-Demand

User taps "Generate Summary" in the expanded session card in history. The button is visible when:
- `summary` is null (not yet generated)
- `summary_status` is not `generating` (not in progress)
- `transcript` exists and is non-empty
- `durationMs` >= 30000 (session at least 30 seconds)

**After successful generation:** Show the summary text. No "Regenerate" button in v1. The summary is generated once and persisted.

**After failed generation:** Show "Summary failed. Tap to retry." The retry button calls the same generation flow.

**During generation:** Show a spinner with "Generating summary..." The button is replaced by the spinner.

## UI

### History screen — expanded session card

The summary section goes inside the expanded card, after the Alert Timeline section. Three visual states:

**State: Not generated (button visible)**
```
[Alert Timeline section]
─────────────────────────
[Generate Summary]  ← button, theme.primary styled
```

**State: Generating**
```
[Alert Timeline section]
─────────────────────────
⟳ Generating summary...
```

**State: Complete**
```
[Alert Timeline section]
─────────────────────────
AI Summary
"You were in a 12-minute conversation with 2 others.
You triggered 4 alerts, mostly at the moderate level,
suggesting you held the floor longer than intended in
the middle of the session. The last 5 minutes were
notably cleaner — good recovery."
```

**State: Failed**
```
[Alert Timeline section]
─────────────────────────
Summary failed. Tap to retry.
```

No new screens. No new tabs. No modals.

## Service Architecture

### New files

| File | Purpose |
|---|---|
| `app/src/services/anthropicClient.ts` | Provider adapter: SDK or raw fetch to Anthropic Messages API |
| `app/src/services/summaryService.ts` | Orchestrates: load session data, assemble input, call API, persist result |
| `app/src/services/summaryPrompts.ts` | Three context-aware system prompt templates |
| `app/src/services/__tests__/summaryPrompts.test.ts` | Unit tests for prompt assembly |
| `app/src/services/__tests__/summaryService.test.ts` | Integration tests with mocked API |

### Modified files

| File | Change |
|---|---|
| `app/src/types/index.ts` | Add summary fields to Session interface |
| `app/src/db/schema.ts` | migrateToV7 |
| `app/src/db/database.ts` | Wire migrateToV7 |
| `app/src/db/sessions.ts` | `updateSummary()` function, update `parseSession` |
| `app/app/(tabs)/history.tsx` | Summary section in expanded card |

### No changes

- No firmware changes
- No new BLE characteristics
- No new screens or tabs
- No changes to session start/end flow
- No changes to transcript pipeline

## Error Handling

| Scenario | Behavior |
|---|---|
| API key missing | "Generate Summary" button hidden. No error shown. |
| API call fails (network, rate limit) | `summary_status = failed`. Show retry button. |
| No transcript | Button hidden. |
| Short session (<30s) | Button hidden. |
| Token limit exceeded | Truncate transcript to last ~8000 tokens before sending. |
| Generation in progress, user navigates away | Generation continues. On return, card reflects current status. |
| Session has no context (null) | Use Solo template as fallback. |

## Testing Strategy

### Unit tests (summaryPrompts)
- Solo prompt includes session duration and alert count
- With Others prompt includes speaker count
- Presentation prompt includes presentation-specific language
- Null context falls back to Solo template
- Input assembly formats alert events correctly

### Integration tests (summaryService, mocked API)
- Successful generation updates summary + status + timestamp
- Failed API call sets status to failed, summary stays null
- Retry after failure triggers new API call
- Button visibility logic: hidden when no transcript, hidden when short session, hidden when already generating

## What This Does NOT Include (Future)

- Automatic generation on session end
- Regenerate after successful summary
- Cross-session trends ("you've improved this week")
- Action items as structured data
- "Catch me up" or "Draft a question"
- Backend API proxy
