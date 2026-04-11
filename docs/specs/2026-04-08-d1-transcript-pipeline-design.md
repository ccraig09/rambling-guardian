# Phase D.1 — Transcript Pipeline Foundation

Real-time speech-to-text during active sessions using the phone microphone and Deepgram Nova-3, with live transcript display and local persistence.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Audio source | Phone mic (not BLE streaming) | Avoids firmware codec/chunking complexity, better audio quality for STT |
| Session coupling | Session-active-driven, not VAD-gated | Simple first version; fine-grained VAD gating is a later optimization |
| STT transport | Real-time WebSocket streaming (primary), delayed transcription (fallback) | Live transcript is the core D.1 UX value |
| Persistence | Plain text transcript + structured segment JSON | Human-readable column + machine-readable timing data |
| Orchestration | Separate transcriptService, sessionTracker owns lifecycle | Clean responsibility split, no parallel session concepts |
| Mic capture | Validation-dependent — see Section 2 | Needs spike before committing to a specific package |

## Architecture Overview

```
Device (ESP32S3)          Phone (React Native)              Cloud
┌──────────────┐    BLE   ┌────────────────────────┐    WSS   ┌──────────┐
│ VAD + alerts │────────→│ sessionTracker          │         │ Deepgram │
│ SESSION_CTRL │  state  │   ↓ activeSessionId     │         │ Nova-3   │
│ (unchanged)  │  only   │ transcriptService       │────────→│          │
└──────────────┘         │   ↓ mic capture          │  audio  │          │
                         │   ↓ pipe to Deepgram     │←────────│          │
                         │   ↓ transcriptStore      │  events │          │
                         │   ↓ persist to SQLite    │         └──────────┘
                         └────────────────────────────┘
```

No firmware changes in D.1. Device continues to own VAD, speech timing, and alerts. Phone adds mic capture + transcription pipeline.

## Section 1: New Modules

### deepgramClient.ts

Thin WebSocket wrapper around Deepgram's live streaming API.

```typescript
// API surface
connect(apiKey: string, options: DeepgramOptions): void
sendAudio(chunk: ArrayBuffer): void
onTranscript(cb: (event: TranscriptEvent) => void): () => void
close(): void
keepAlive(): void
```

- Opens WebSocket to `wss://api.deepgram.com/v1/listen`
- Model: `nova-3`, language: `en`, `smart_format: true`, `interim_results: true`, `utterance_end_ms: 1000`
- Sends raw PCM audio chunks via `connection.send(chunk)`
- Emits transcript events with `is_final` flag, word timing, confidence
- Handles keepalive (every 8s when no audio), reconnection on transient errors
- Knows nothing about sessions, UI, or persistence

### transcriptService.ts

Orchestrates the transcript pipeline. Owns mic capture + Deepgram lifecycle.

- Watches `sessionStore.activeSession` via Zustand subscription
- **Starts only after** a valid `activeSessionId` exists in sessionStore
- Startup: initialize mic capture → open Deepgram WebSocket → pipe audio chunks → receive transcript events → update transcriptStore
- On session end: stop mic → close WebSocket → persist finalized transcript + segments to the session row → promote retention tier to TRANSCRIPT
- If session ends before startup completes: abort cleanly, do not write empty transcript
- Transcript writes target **only** the sessionId that was active when transcription started

### transcriptStore.ts

Zustand store for reactive transcript UI state.

```typescript
interface TranscriptStore {
  status: TranscriptStatus;
  segments: TranscriptSegment[];    // finalized segments only
  interimText: string;              // current partial (never persisted)
  streamError: string | null;

  addFinalSegment(seg: TranscriptSegment): void;
  setInterim(text: string): void;
  setStatus(status: TranscriptStatus): void;
  setError(error: string): void;
  reset(): void;
}
```

## Section 2: Phone Mic Audio Capture

D.1 real-time streaming depends on successful validation of a React Native-compatible PCM capture path that delivers audio chunks via callbacks (not file-based recording).

### Validation spike (Task 1 of implementation)

**Preferred first candidate:** `react-native-live-audio-stream`
- Emits base64-encoded PCM chunks via `data` event
- Supports 16kHz / mono / 16-bit (matches Deepgram expected input)
- Native module — requires EAS build (already required for react-native-ble-plx)

**Validation criteria:**
1. Package installs and builds with EAS on iOS
2. PCM chunks arrive via `data` event at expected rate and format
3. Chunks can be sent to a Deepgram WebSocket and transcripts return correctly
4. Runs alongside BLE (react-native-ble-plx) without conflicts
5. Works on physical iOS device

**If validation succeeds:** Proceed with `react-native-live-audio-stream` as the capture layer. `transcriptService` initializes it on session start, pipes chunks to `deepgramClient.sendAudio()`.

**If validation fails:** Narrow the D.1 implementation to file-based capture (expo-audio AudioRecorder → temporary file → post-session Deepgram REST transcription). The transcript pipeline (persistence, UI, session linking, transcriptStore) still gets built — just with delayed transcription instead of real-time. The architecture accommodates both paths.

**expo-audio stays for the voice trainer** (onboarding recording/playback). D.1 uses a separate capture path for streaming. These do not conflict — different use cases, different lifecycle.

### Deepgram SDK in React Native

The `@deepgram/sdk` uses WebSocket internally. React Native supports WebSocket natively. However, SDK compatibility with React Native is not guaranteed (may use Node.js-specific APIs). **Validation spike also tests this.** Fallback: use a raw WebSocket connection to `wss://api.deepgram.com/v1/listen` directly (documented API, no SDK dependency).

## Section 3: Transcript Persistence

### Storage model

**`transcript` column** (TEXT): Finalized plain-text transcript. Segments joined with spaces. Human-readable, searchable with LIKE, easy to export.

**`transcript_timestamps` column** (TEXT): JSON array of finalized segments:

```typescript
interface TranscriptSegment {
  text: string;           // finalized text for this segment
  start: number;          // ms offset from session start
  end: number;            // ms offset from session start
  isFinal: true;          // always true in DB (interims never persisted)
  speaker: string | null; // null in D.1, populated by D.2 speaker attribution
  words?: Array<{         // optional word-level timing from Deepgram
    word: string;
    start: number;
    end: number;
    confidence: number;
  }>;
}
```

### Persistence rules

- Only **finalized** segments are persisted. Interim text stays in `transcriptStore` only.
- On session end, `transcriptService` writes both columns in one update to the session row.
- `transcript` = `segments.map(s => s.text).join(' ')`
- After writing, calls `updateRetention(sessionId, RetentionTier.TRANSCRIPT, null)` to promote tier.
- If no segments were finalized (e.g., transcript failed before any speech), do not write empty string — leave columns NULL.

## Section 4: Lifecycle Coordination

### activeSessionId ownership

`sessionTracker` is the sole owner of `activeSessionId` in `sessionStore` — it sets the value when a session row is created and clears it when the session ends. `transcriptService` consumes this value as a read-only signal and never creates its own parallel session identity.

### Startup sequence

1. Device session state → ACTIVE (via BLE SESSION_CTRL)
2. `sessionTracker` creates/confirms session row → sets `activeSessionId` in `sessionStore`
3. `transcriptService` observes `activeSessionId` (non-null), begins startup:
   - Set status → `starting`
   - Initialize mic capture
   - Open Deepgram WebSocket
   - On both ready: set status → `streaming`, begin piping audio
4. If any step fails: set status → `failed`, set error message, do not block session

### Shutdown sequence

1. Device session state → NO_SESSION
2. `transcriptService` observes session ending:
   - Set status → `finalizing`
   - Stop mic capture
   - Close Deepgram WebSocket (graceful close to flush final transcript)
   - Persist finalized segments + plain text to session row
   - Promote retention tier
   - Set status → `complete`
3. `sessionTracker` finalizes session row with stats
4. `transcriptStore.reset()` on next session start

### Edge cases

- **Session ends before transcript startup completes:** Abort cleanly. Stop mic if started, close WebSocket if opened. Do not write empty transcript.
- **Session ends during active streaming:** Graceful close — Deepgram may send a final transcript after close. Wait briefly (1-2s) for any trailing events before persisting.
- **Multiple rapid session starts:** `transcriptService` resets on each new session. Previous transcript state is discarded if not yet persisted.

## Section 5: Transcript Status

```typescript
type TranscriptStatus =
  | 'idle'           // no active session
  | 'starting'       // mic + Deepgram initializing
  | 'streaming'      // actively receiving transcripts
  | 'interrupted'    // WebSocket dropped mid-session, partial transcript preserved
  | 'failed'         // attempted and could not start (mic denied, Deepgram error)
  | 'finalizing'     // session ended, persisting transcript
  | 'complete';      // transcript saved to DB
```

Note: a future refinement could distinguish `failed` (attempted and errored) from `unavailable` (not attempted — offline, disabled, unsupported). For D.1, `failed` covers both cases.

## Section 6: Degradation Behavior

- **No internet at session start:** Mic capture may or may not start (depends on whether we want local buffering). Deepgram connection fails. Status → `failed`. Session runs normally for VAD/alerts without transcript.
- **WebSocket drops mid-session:** Status → `interrupted`. Mic capture stops and finalized segments so far are preserved in `transcriptStore`. On session end, whatever was captured gets persisted. This is an intentional v1 simplification — stopping capture on disconnect keeps the implementation simple. Future phases may attempt WebSocket reconnection or local audio buffering for later transcription, but D.1 keeps this simple on purpose.
- **Mic permission denied:** Status → `failed`. Session runs without transcript.
- **App backgrounded:** iOS suspends mic capture. On foreground return, if session is still active, attempt to restart mic + Deepgram. Gap in transcript is implicit (no segment covers that time range).

## Section 7: Session Screen UI

### Live transcript component

Add below the existing session stats area when status is `streaming` or `interrupted`.

- Finalized segments: normal text, left-aligned
- Interim text: faded/italic, appended after last finalized segment
- Auto-scrolls to bottom as new text arrives
- Streaming indicator (subtle pulse or dot) when status is `streaming`

### Status-driven display

| TranscriptStatus | UI Behavior |
|-----------------|-------------|
| `idle` | No transcript region shown |
| `starting` | Compact "Starting transcript..." text |
| `streaming` | Live transcript area with text + streaming indicator |
| `interrupted` | "Transcript interrupted" banner above existing text |
| `failed` | Compact "Transcript unavailable" — no empty region |
| `finalizing` | Transcript area stays visible, streaming indicator stops |
| `complete` | Transcript area stays visible until session screen resets |

No awkward empty space when transcription isn't available. The session screen gracefully shows stats-only layout when transcript status is `idle` or `failed`.

## Section 8: Types

```typescript
// New types for D.1

interface TranscriptSegment {
  text: string;
  start: number;           // ms from session start
  end: number;
  isFinal: boolean;
  speaker: string | null;  // null in D.1
  words?: TranscriptWord[];
}

interface TranscriptWord {
  word: string;
  start: number;           // ms from session start
  end: number;
  confidence: number;
}

interface DeepgramOptions {
  model: string;
  language: string;
  interimResults: boolean;
  smartFormat: boolean;
  utteranceEndMs: number;
  encoding: string;
  sampleRate: number;
  channels: number;
}

type TranscriptStatus =
  | 'idle'
  | 'starting'
  | 'streaming'
  | 'interrupted'
  | 'failed'
  | 'finalizing'
  | 'complete';
```

## Section 9: Files to Create/Modify

| File | Action |
|------|--------|
| `app/src/services/deepgramClient.ts` | **New** — Deepgram WebSocket wrapper |
| `app/src/services/transcriptService.ts` | **New** — pipeline orchestrator |
| `app/src/stores/transcriptStore.ts` | **New** — reactive transcript state |
| `app/src/types/index.ts` | Add TranscriptSegment, TranscriptWord, TranscriptStatus, DeepgramOptions |
| `app/src/db/sessions.ts` | Add updateTranscript query |
| `app/src/components/LiveTranscript.tsx` | **New** — live transcript UI component |
| `app/app/(tabs)/session.tsx` | Integrate LiveTranscript component |
| `app/.env` | Add DEEPGRAM_API_KEY (prototyping only — see note below) |
| `app/package.json` | Add react-native-live-audio-stream (if validated), @deepgram/sdk (if compatible) |

## Section 10: Revised D.1 Ticket Breakdown

| Task | Description |
|------|-------------|
| D.1.0 | **Validation spike** — install react-native-live-audio-stream + @deepgram/sdk, build with EAS, test on device, confirm PCM→Deepgram→transcript roundtrip |
| D.1.1 | Types + deepgramClient.ts + tests |
| D.1.2 | transcriptStore.ts + transcriptService.ts + tests |
| D.1.3 | Session DB queries (updateTranscript) + retention tier promotion |
| D.1.4 | LiveTranscript component + session screen integration |
| D.1.5 | Degradation handling (interrupted/failed states) |
| D.1.6 | Docs update (PHASE_PLAN.md, CLAUDE.md) |

## API Key Security Note

D.1 stores `DEEPGRAM_API_KEY` directly in `app/.env` and uses it client-side. This is acceptable for D.1 prototyping only — it is not the intended long-term production security model. A future phase should move Deepgram authentication behind a backend token relay or server-mediated approach so the API key is never embedded in the app binary. Do not block D.1 on this, but do not ship to TestFlight with a raw client-side key without revisiting.

## Cost Estimate

| Service | Rate | Daily (1hr sessions) | Monthly |
|---------|------|---------------------|---------|
| Deepgram Nova-3 STT | $0.0043/min | ~$0.26/day | ~$8/month |

VAD-gating (future optimization) would reduce this by skipping silence. Not implemented in D.1.

## Testing

- **deepgramClient:** WebSocket lifecycle (connect, send, receive, close, reconnect, keepalive)
- **transcriptService:** Lifecycle coordination (start after sessionId, stop on session end, abort on early end)
- **transcriptStore:** State transitions, segment accumulation, reset
- **LiveTranscript:** Renders segments, shows interim, handles all status states
- **Integration:** Full flow from mic → Deepgram → store → UI → persistence
- **Validation spike:** Not unit-tested — manual on-device verification
