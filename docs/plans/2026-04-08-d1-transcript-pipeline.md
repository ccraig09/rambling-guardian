# D.1 Transcript Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add real-time speech-to-text during active sessions using the phone mic and Deepgram Nova-3, with live transcript display and local persistence.

**Architecture:** Phone mic captures audio via `react-native-live-audio-stream` (pending validation). Audio chunks stream to Deepgram over a raw WebSocket. Transcript events flow to a Zustand store for live UI, then persist to SQLite on session end. `transcriptService` orchestrates the pipeline, consuming `activeSessionId` from `sessionStore` (set by `sessionTracker`). No firmware changes.

**Tech Stack:** react-native-live-audio-stream (validation candidate), raw WebSocket to Deepgram API, Zustand, expo-sqlite, React Native

**Spec:** `docs/specs/2026-04-08-d1-transcript-pipeline-design.md`

**IMPORTANT:** Task 0 is a validation spike that gates all subsequent tasks. If validation fails, narrow scope to delayed transcription (see spec Section 2).

---

## File Structure

| File | Responsibility |
|------|----------------|
| `app/src/types/index.ts` | Add TranscriptSegment, TranscriptWord, TranscriptStatus, DeepgramOptions |
| `app/src/stores/sessionStore.ts` | Add activeSessionId field |
| `app/src/services/sessionTracker.ts` | Set/clear activeSessionId in sessionStore |
| `app/src/stores/transcriptStore.ts` | **New** — reactive transcript state (segments, interim, status) |
| `app/src/services/deepgramClient.ts` | **New** — raw WebSocket wrapper for Deepgram streaming API |
| `app/src/services/transcriptService.ts` | **New** — pipeline orchestrator (mic → Deepgram → store → persist) |
| `app/src/db/sessions.ts` | Add updateTranscript query |
| `app/src/components/LiveTranscript.tsx` | **New** — live transcript UI component |
| `app/app/(tabs)/session.tsx` | Integrate LiveTranscript into active session view |
| `app/src/config/deepgram.ts` | **New** — API key + default options |
| `app/src/services/__tests__/deepgramClient.test.ts` | **New** |
| `app/src/services/__tests__/transcriptService.test.ts` | **New** |
| `app/src/stores/__tests__/transcriptStore.test.ts` | **New** |

---

### Task 0: Validation Spike — Real-Time Audio → Deepgram Roundtrip

**This is a manual, on-device validation. Not TDD. Gates all subsequent tasks.**

**Goal:** Confirm that `react-native-live-audio-stream` delivers PCM chunks on iOS, and that a raw WebSocket to Deepgram returns transcript events from those chunks.

**Files:**
- Modify: `app/package.json`
- Create: `app/src/spike/TranscriptSpike.tsx` (temporary — deleted after validation)

- [ ] **Step 1: Install dependencies**

```bash
cd app
npm install react-native-live-audio-stream buffer --legacy-peer-deps
```

`buffer` is needed because `react-native-live-audio-stream` emits base64-encoded chunks that need decoding.

- [ ] **Step 2: Create a minimal spike component**

Create `app/src/spike/TranscriptSpike.tsx`:

```typescript
/**
 * Temporary validation spike — delete after D.1 validation.
 * Tests: mic → PCM chunks → Deepgram WebSocket → transcript events.
 */
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Button, ScrollView, StyleSheet } from 'react-native';
import LiveAudioStream from 'react-native-live-audio-stream';
import { Buffer } from 'buffer';

const DEEPGRAM_API_KEY = 'YOUR_KEY_HERE'; // Replace with real key for testing

export default function TranscriptSpike() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcripts, setTranscripts] = useState<string[]>([]);
  const [chunkCount, setChunkCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    LiveAudioStream.init({
      sampleRate: 16000,
      channels: 1,
      bitsPerSample: 16,
      audioSource: 6, // VOICE_RECOGNITION (Android), ignored on iOS
      bufferSize: 4096,
    });

    LiveAudioStream.on('data', (base64: string) => {
      setChunkCount((c) => c + 1);
      const chunk = Buffer.from(base64, 'base64');
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(chunk);
      }
    });

    return () => {
      LiveAudioStream.stop();
      wsRef.current?.close();
    };
  }, []);

  function startTranscription() {
    setTranscripts([]);
    setChunkCount(0);
    setError(null);

    const params = new URLSearchParams({
      model: 'nova-3',
      language: 'en',
      smart_format: 'true',
      interim_results: 'true',
      utterance_end_ms: '1000',
      encoding: 'linear16',
      sample_rate: '16000',
      channels: '1',
    });

    const ws = new WebSocket(
      `wss://api.deepgram.com/v1/listen?${params.toString()}`,
      undefined,
      { headers: { Authorization: `Token ${DEEPGRAM_API_KEY}` } },
    );

    ws.onopen = () => {
      console.log('[Spike] WebSocket open — starting mic');
      LiveAudioStream.start();
      setIsRecording(true);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const transcript = data?.channel?.alternatives?.[0]?.transcript;
        if (transcript) {
          const prefix = data.is_final ? '[FINAL]' : '[interim]';
          setTranscripts((prev) => [...prev, `${prefix} ${transcript}`]);
        }
      } catch (e) {
        console.warn('[Spike] Parse error:', e);
      }
    };

    ws.onerror = (event: any) => {
      setError(`WebSocket error: ${event.message || 'unknown'}`);
      console.error('[Spike] WS error:', event);
    };

    ws.onclose = () => {
      console.log('[Spike] WebSocket closed');
      setIsRecording(false);
    };

    wsRef.current = ws;
  }

  function stopTranscription() {
    LiveAudioStream.stop();
    wsRef.current?.close();
    setIsRecording(false);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Transcript Spike</Text>
      <Text>Chunks sent: {chunkCount}</Text>
      {error && <Text style={styles.error}>{error}</Text>}
      <Button
        title={isRecording ? 'Stop' : 'Start Transcription'}
        onPress={isRecording ? stopTranscription : startTranscription}
      />
      <ScrollView style={styles.scroll}>
        {transcripts.map((t, i) => (
          <Text key={i} style={styles.transcript}>{t}</Text>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 60 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 10 },
  error: { color: 'red', marginVertical: 5 },
  scroll: { flex: 1, marginTop: 10 },
  transcript: { fontSize: 14, marginVertical: 2 },
});
```

- [ ] **Step 3: Temporarily wire the spike into the app**

Add a temporary route or replace a tab screen to render `TranscriptSpike`. The simplest approach: temporarily import and render it in the session screen behind a dev flag, or add a temporary route.

- [ ] **Step 4: Get a Deepgram API key**

1. Sign up at https://deepgram.com (free tier includes $200 credit)
2. Create an API key with "Listen" scope
3. Replace `YOUR_KEY_HERE` in the spike component

- [ ] **Step 5: Build and test on physical iOS device**

```bash
cd app && eas build --local --platform ios
```

Install on device. Open the spike screen. Tap "Start Transcription" and speak.

**Validation criteria (all must pass):**
1. `react-native-live-audio-stream` builds with EAS without errors
2. `chunkCount` increments steadily while speaking (confirms mic → PCM chunks)
3. `[interim]` transcripts appear within ~1-2 seconds of speaking
4. `[FINAL]` transcripts appear after utterance pauses
5. No crashes, no BLE interference (test alongside a BLE connection if possible)

- [ ] **Step 6: Record results and clean up**

If all criteria pass: delete the spike file, keep the dependency. Proceed to Task 1.
If any criteria fail: document what failed, consider alternatives (expo-audio file-based fallback), and narrow D.1 scope before proceeding.

**Note on WebSocket headers:** React Native's `WebSocket` constructor may not support custom headers on iOS. If the `Authorization` header doesn't work, try passing the API key as a query parameter instead: `wss://api.deepgram.com/v1/listen?token=YOUR_KEY&...`. Deepgram supports both patterns.

- [ ] **Step 7: Commit**

```bash
git add app/package.json app/package-lock.json
git commit -m "feat(app): add react-native-live-audio-stream for real-time mic capture (D.1.0)"
```

(Do NOT commit the spike file or the API key.)

---

### Task 1: Types

**Files:**
- Modify: `app/src/types/index.ts`

- [ ] **Step 1: Add D.1 types to `app/src/types/index.ts`**

Add after the `SessionSyncInfo` interface (end of the Sync Status + Retention section):

```typescript
// ============================================
// Transcript Types (D.1)
// ============================================

/** A finalized transcript segment from Deepgram. */
export interface TranscriptSegment {
  text: string;
  start: number;           // ms from session start
  end: number;             // ms from session start
  isFinal: boolean;
  speaker: string | null;  // null in D.1, populated by D.2
  words?: TranscriptWord[];
}

/** Word-level timing from Deepgram. */
export interface TranscriptWord {
  word: string;
  start: number;           // ms from session start
  end: number;             // ms from session start
  confidence: number;
}

/** Transcript pipeline status. */
export type TranscriptStatus =
  | 'idle'
  | 'starting'
  | 'streaming'
  | 'interrupted'
  | 'failed'
  | 'finalizing'
  | 'complete';
```

- [ ] **Step 2: Run TypeScript check**

Run: `cd app && node node_modules/typescript/bin/tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add app/src/types/index.ts
git commit -m "feat(app): add transcript types — TranscriptSegment, TranscriptWord, TranscriptStatus (D.1.1)"
```

---

### Task 2: Expose activeSessionId in sessionStore + sessionTracker

**Files:**
- Modify: `app/src/stores/sessionStore.ts`
- Modify: `app/src/services/sessionTracker.ts`

- [ ] **Step 1: Add activeSessionId to sessionStore**

In `app/src/stores/sessionStore.ts`, add to the `SessionStore` interface:

```typescript
activeSessionId: string | null;
setActiveSessionId: (id: string | null) => void;
```

Add defaults in the store:

```typescript
activeSessionId: null,
setActiveSessionId: (id) => set({ activeSessionId: id }),
```

- [ ] **Step 2: Set activeSessionId in sessionTracker**

In `app/src/services/sessionTracker.ts`, after `createSession` succeeds (line 39-45), add:

```typescript
useSessionStore.getState().setActiveSessionId(this.sessionId);
```

In the session finalization block (line 53-54), after `this.sessionId = null`, add:

```typescript
useSessionStore.getState().setActiveSessionId(null);
```

This makes sessionTracker the sole owner of activeSessionId. transcriptService will consume it read-only.

- [ ] **Step 3: Run TypeScript check**

Run: `cd app && node node_modules/typescript/bin/tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Run existing tests**

Run: `cd app && npx jest --no-coverage`
Expected: All existing tests pass (92+)

- [ ] **Step 5: Commit**

```bash
git add app/src/stores/sessionStore.ts app/src/services/sessionTracker.ts
git commit -m "feat(app): expose activeSessionId in sessionStore, set by sessionTracker (D.1.2)"
```

---

### Task 3: transcriptStore

**Files:**
- Create: `app/src/stores/transcriptStore.ts`
- Create: `app/src/stores/__tests__/transcriptStore.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
// app/src/stores/__tests__/transcriptStore.test.ts
import { useTranscriptStore } from '../transcriptStore';
import type { TranscriptSegment } from '../../types';

beforeEach(() => {
  useTranscriptStore.getState().reset();
});

describe('transcriptStore', () => {
  test('initial state is idle with empty segments', () => {
    const state = useTranscriptStore.getState();
    expect(state.status).toBe('idle');
    expect(state.segments).toEqual([]);
    expect(state.interimText).toBe('');
    expect(state.streamError).toBeNull();
  });

  test('setStatus updates status', () => {
    useTranscriptStore.getState().setStatus('streaming');
    expect(useTranscriptStore.getState().status).toBe('streaming');
  });

  test('addFinalSegment appends to segments', () => {
    const seg: TranscriptSegment = {
      text: 'Hello world',
      start: 100,
      end: 1200,
      isFinal: true,
      speaker: null,
    };
    useTranscriptStore.getState().addFinalSegment(seg);
    expect(useTranscriptStore.getState().segments).toEqual([seg]);
  });

  test('addFinalSegment clears interimText', () => {
    useTranscriptStore.getState().setInterim('Hello wor');
    const seg: TranscriptSegment = {
      text: 'Hello world',
      start: 100,
      end: 1200,
      isFinal: true,
      speaker: null,
    };
    useTranscriptStore.getState().addFinalSegment(seg);
    expect(useTranscriptStore.getState().interimText).toBe('');
  });

  test('setInterim updates interimText', () => {
    useTranscriptStore.getState().setInterim('Hello wor');
    expect(useTranscriptStore.getState().interimText).toBe('Hello wor');
  });

  test('setError sets error and status to failed', () => {
    useTranscriptStore.getState().setError('Connection refused');
    const state = useTranscriptStore.getState();
    expect(state.streamError).toBe('Connection refused');
    expect(state.status).toBe('failed');
  });

  test('reset clears all state', () => {
    useTranscriptStore.getState().setStatus('streaming');
    useTranscriptStore.getState().addFinalSegment({
      text: 'test', start: 0, end: 100, isFinal: true, speaker: null,
    });
    useTranscriptStore.getState().setInterim('partial');
    useTranscriptStore.getState().reset();

    const state = useTranscriptStore.getState();
    expect(state.status).toBe('idle');
    expect(state.segments).toEqual([]);
    expect(state.interimText).toBe('');
    expect(state.streamError).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx jest src/stores/__tests__/transcriptStore.test.ts --no-coverage`
Expected: FAIL — module not found

- [ ] **Step 3: Write `app/src/stores/transcriptStore.ts`**

```typescript
import { create } from 'zustand';
import type { TranscriptSegment, TranscriptStatus } from '../types';

interface TranscriptStore {
  status: TranscriptStatus;
  segments: TranscriptSegment[];
  interimText: string;
  streamError: string | null;

  setStatus: (status: TranscriptStatus) => void;
  addFinalSegment: (segment: TranscriptSegment) => void;
  setInterim: (text: string) => void;
  setError: (error: string) => void;
  reset: () => void;
}

export const useTranscriptStore = create<TranscriptStore>((set) => ({
  status: 'idle',
  segments: [],
  interimText: '',
  streamError: null,

  setStatus: (status) => set({ status }),

  addFinalSegment: (segment) =>
    set((state) => ({
      segments: [...state.segments, segment],
      interimText: '', // clear interim when final arrives
    })),

  setInterim: (text) => set({ interimText: text }),

  setError: (error) => set({ streamError: error, status: 'failed' }),

  reset: () =>
    set({
      status: 'idle',
      segments: [],
      interimText: '',
      streamError: null,
    }),
}));
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npx jest src/stores/__tests__/transcriptStore.test.ts --no-coverage`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add app/src/stores/transcriptStore.ts app/src/stores/__tests__/transcriptStore.test.ts
git commit -m "feat(app): transcriptStore — reactive transcript state with segments + status (D.1.2)"
```

---

### Task 4: deepgramClient

**Files:**
- Create: `app/src/services/deepgramClient.ts`
- Create: `app/src/config/deepgram.ts`
- Create: `app/src/services/__tests__/deepgramClient.test.ts`

- [ ] **Step 1: Create config file `app/src/config/deepgram.ts`**

```typescript
/**
 * Deepgram configuration.
 *
 * SECURITY NOTE: Client-side API key usage is for D.1 prototyping only.
 * A future phase should move authentication behind a backend token relay.
 * Do not ship to TestFlight with a raw client-side key without revisiting.
 */

// Set this before building. Not committed to git.
// For dev: create app/.env.local or set in eas.json build env.
export const DEEPGRAM_API_KEY = process.env.EXPO_PUBLIC_DEEPGRAM_API_KEY ?? '';

export const DEEPGRAM_DEFAULTS = {
  model: 'nova-3',
  language: 'en',
  smart_format: 'true',
  interim_results: 'true',
  utterance_end_ms: '1000',
  encoding: 'linear16',
  sample_rate: '16000',
  channels: '1',
} as const;
```

- [ ] **Step 2: Write the test file**

```typescript
// app/src/services/__tests__/deepgramClient.test.ts
import {
  createDeepgramConnection,
  type DeepgramConnection,
} from '../deepgramClient';

// Mock WebSocket
class MockWebSocket {
  static instances: MockWebSocket[] = [];
  url: string;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  onclose: (() => void) | null = null;
  readyState = 0; // CONNECTING
  sentData: any[] = [];

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  send(data: any) { this.sentData.push(data); }
  close() { this.readyState = 3; this.onclose?.(); }

  // Test helpers
  simulateOpen() { this.readyState = 1; this.onopen?.(); }
  simulateMessage(data: string) { this.onmessage?.({ data }); }
  simulateError(msg: string) { this.onerror?.({ message: msg }); }
}

(global as any).WebSocket = MockWebSocket;

beforeEach(() => {
  MockWebSocket.instances = [];
});

describe('deepgramClient', () => {
  test('createDeepgramConnection opens WebSocket with correct URL', () => {
    createDeepgramConnection('test-key');
    expect(MockWebSocket.instances).toHaveLength(1);
    expect(MockWebSocket.instances[0].url).toContain('api.deepgram.com');
    expect(MockWebSocket.instances[0].url).toContain('model=nova-3');
  });

  test('onTranscript fires for final transcript events', () => {
    const conn = createDeepgramConnection('test-key');
    const transcripts: any[] = [];
    conn.onTranscript((seg) => transcripts.push(seg));

    const ws = MockWebSocket.instances[0];
    ws.simulateOpen();
    ws.simulateMessage(JSON.stringify({
      type: 'Results',
      is_final: true,
      channel: {
        alternatives: [{
          transcript: 'Hello world',
          confidence: 0.98,
          words: [
            { word: 'Hello', start: 0.1, end: 0.4, confidence: 0.99 },
            { word: 'world', start: 0.5, end: 0.9, confidence: 0.97 },
          ],
        }],
      },
      start: 0.1,
      duration: 0.8,
    }));

    expect(transcripts).toHaveLength(1);
    expect(transcripts[0].text).toBe('Hello world');
    expect(transcripts[0].isFinal).toBe(true);
  });

  test('onTranscript fires for interim transcript events', () => {
    const conn = createDeepgramConnection('test-key');
    const transcripts: any[] = [];
    conn.onTranscript((seg) => transcripts.push(seg));

    const ws = MockWebSocket.instances[0];
    ws.simulateOpen();
    ws.simulateMessage(JSON.stringify({
      type: 'Results',
      is_final: false,
      channel: {
        alternatives: [{ transcript: 'Hello', confidence: 0.8, words: [] }],
      },
      start: 0.1,
      duration: 0.3,
    }));

    expect(transcripts).toHaveLength(1);
    expect(transcripts[0].isFinal).toBe(false);
  });

  test('empty transcripts are not emitted', () => {
    const conn = createDeepgramConnection('test-key');
    const transcripts: any[] = [];
    conn.onTranscript((seg) => transcripts.push(seg));

    const ws = MockWebSocket.instances[0];
    ws.simulateOpen();
    ws.simulateMessage(JSON.stringify({
      type: 'Results',
      is_final: true,
      channel: { alternatives: [{ transcript: '', confidence: 0, words: [] }] },
      start: 0, duration: 0,
    }));

    expect(transcripts).toHaveLength(0);
  });

  test('sendAudio sends data to WebSocket', () => {
    const conn = createDeepgramConnection('test-key');
    const ws = MockWebSocket.instances[0];
    ws.simulateOpen();

    const chunk = new ArrayBuffer(100);
    conn.sendAudio(chunk);
    expect(ws.sentData).toHaveLength(1);
  });

  test('close closes WebSocket', () => {
    const conn = createDeepgramConnection('test-key');
    const ws = MockWebSocket.instances[0];
    ws.simulateOpen();
    conn.close();
    expect(ws.readyState).toBe(3);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd app && npx jest src/services/__tests__/deepgramClient.test.ts --no-coverage`
Expected: FAIL — module not found

- [ ] **Step 4: Write `app/src/services/deepgramClient.ts`**

```typescript
/**
 * Deepgram Client — raw WebSocket wrapper for live streaming STT.
 *
 * Uses Deepgram's WebSocket API directly (no SDK) to avoid
 * Node.js compatibility issues in React Native.
 *
 * Usage:
 *   const conn = createDeepgramConnection(apiKey);
 *   conn.onTranscript((segment) => { ... });
 *   conn.onError((error) => { ... });
 *   conn.sendAudio(pcmChunk);
 *   conn.close();
 */
import { DEEPGRAM_DEFAULTS } from '../config/deepgram';
import type { TranscriptSegment, TranscriptWord } from '../types';

export interface DeepgramConnection {
  sendAudio(chunk: ArrayBuffer): void;
  onTranscript(cb: (segment: TranscriptSegment) => void): () => void;
  onError(cb: (error: string) => void): () => void;
  onOpen(cb: () => void): () => void;
  onClose(cb: () => void): () => void;
  close(): void;
  isOpen(): boolean;
}

export function createDeepgramConnection(
  apiKey: string,
  sessionStartMs?: number,
): DeepgramConnection {
  const transcriptListeners: Array<(seg: TranscriptSegment) => void> = [];
  const errorListeners: Array<(error: string) => void> = [];
  const openListeners: Array<() => void> = [];
  const closeListeners: Array<() => void> = [];

  const params = new URLSearchParams(DEEPGRAM_DEFAULTS);
  const url = `wss://api.deepgram.com/v1/listen?${params.toString()}`;

  const ws = new WebSocket(url, undefined, {
    headers: { Authorization: `Token ${apiKey}` },
  } as any);

  // Keepalive — Deepgram closes after 10s of silence
  let keepaliveInterval: ReturnType<typeof setInterval> | null = null;

  ws.onopen = () => {
    keepaliveInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        // Send empty buffer as keepalive
        ws.send(new ArrayBuffer(0));
      }
    }, 8000);
    openListeners.forEach((cb) => cb());
  };

  ws.onmessage = (event: MessageEvent) => {
    try {
      const data = JSON.parse(typeof event.data === 'string' ? event.data : '');
      if (data.type !== 'Results') return;

      const alt = data.channel?.alternatives?.[0];
      if (!alt?.transcript) return; // skip empty

      const offsetMs = sessionStartMs ?? 0;
      const startMs = Math.round((data.start ?? 0) * 1000) + offsetMs;
      const endMs = startMs + Math.round((data.duration ?? 0) * 1000);

      const words: TranscriptWord[] | undefined = alt.words?.length
        ? alt.words.map((w: any) => ({
            word: w.word,
            start: Math.round(w.start * 1000) + offsetMs,
            end: Math.round(w.end * 1000) + offsetMs,
            confidence: w.confidence,
          }))
        : undefined;

      const segment: TranscriptSegment = {
        text: alt.transcript,
        start: startMs,
        end: endMs,
        isFinal: data.is_final === true,
        speaker: null, // D.2 adds speaker attribution
        words,
      };

      transcriptListeners.forEach((cb) => cb(segment));
    } catch {
      // Ignore malformed messages
    }
  };

  ws.onerror = (event: any) => {
    const msg = event?.message || 'WebSocket error';
    errorListeners.forEach((cb) => cb(msg));
  };

  ws.onclose = () => {
    if (keepaliveInterval) clearInterval(keepaliveInterval);
    closeListeners.forEach((cb) => cb());
  };

  return {
    sendAudio(chunk: ArrayBuffer) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(chunk);
      }
    },

    onTranscript(cb) {
      transcriptListeners.push(cb);
      return () => {
        const i = transcriptListeners.indexOf(cb);
        if (i >= 0) transcriptListeners.splice(i, 1);
      };
    },

    onError(cb) {
      errorListeners.push(cb);
      return () => {
        const i = errorListeners.indexOf(cb);
        if (i >= 0) errorListeners.splice(i, 1);
      };
    },

    onOpen(cb) {
      openListeners.push(cb);
      return () => {
        const i = openListeners.indexOf(cb);
        if (i >= 0) openListeners.splice(i, 1);
      };
    },

    onClose(cb) {
      closeListeners.push(cb);
      return () => {
        const i = closeListeners.indexOf(cb);
        if (i >= 0) closeListeners.splice(i, 1);
      };
    },

    close() {
      if (keepaliveInterval) clearInterval(keepaliveInterval);
      ws.close();
    },

    isOpen() {
      return ws.readyState === WebSocket.OPEN;
    },
  };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd app && npx jest src/services/__tests__/deepgramClient.test.ts --no-coverage`
Expected: PASS (5 tests)

- [ ] **Step 6: Commit**

```bash
git add app/src/config/deepgram.ts app/src/services/deepgramClient.ts app/src/services/__tests__/deepgramClient.test.ts
git commit -m "feat(app): deepgramClient — raw WebSocket wrapper for Deepgram streaming STT (D.1.1)"
```

---

### Task 5: transcriptService

**Files:**
- Create: `app/src/services/transcriptService.ts`
- Create: `app/src/services/__tests__/transcriptService.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
// app/src/services/__tests__/transcriptService.test.ts
import { transcriptService } from '../transcriptService';
import { useTranscriptStore } from '../../stores/transcriptStore';
import { useSessionStore } from '../../stores/sessionStore';

// Mock dependencies
jest.mock('../deepgramClient', () => ({
  createDeepgramConnection: jest.fn(() => ({
    sendAudio: jest.fn(),
    onTranscript: jest.fn(() => () => {}),
    onError: jest.fn(() => () => {}),
    onOpen: jest.fn((cb: () => void) => { cb(); return () => {}; }),
    onClose: jest.fn(() => () => {}),
    close: jest.fn(),
    isOpen: jest.fn(() => true),
  })),
}));

jest.mock('react-native-live-audio-stream', () => ({
  init: jest.fn(),
  start: jest.fn(),
  stop: jest.fn(),
  on: jest.fn(),
}));

jest.mock('../../config/deepgram', () => ({
  DEEPGRAM_API_KEY: 'test-key',
  DEEPGRAM_DEFAULTS: {},
}));

jest.mock('../../db/sessions', () => ({
  updateTranscript: jest.fn(async () => {}),
  updateRetention: jest.fn(async () => {}),
}));

jest.mock('../../db/settings', () => ({
  saveSetting: jest.fn(async () => {}),
  loadAllSettings: jest.fn(async () => new Map()),
}));

beforeEach(() => {
  useTranscriptStore.getState().reset();
  useSessionStore.setState({ activeSessionId: null });
  transcriptService.stop();
});

describe('transcriptService', () => {
  test('start subscribes to sessionStore', () => {
    transcriptService.start();
    // Should not crash and should be running
    transcriptService.stop();
  });

  test('does not start transcription without activeSessionId', () => {
    transcriptService.start();
    expect(useTranscriptStore.getState().status).toBe('idle');
    transcriptService.stop();
  });

  test('sets status to starting when activeSessionId appears', async () => {
    transcriptService.start();
    useSessionStore.setState({ activeSessionId: 'session-123' });
    // Give subscription time to fire
    await new Promise((r) => setTimeout(r, 50));
    const status = useTranscriptStore.getState().status;
    expect(['starting', 'streaming']).toContain(status);
    transcriptService.stop();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx jest src/services/__tests__/transcriptService.test.ts --no-coverage`
Expected: FAIL — module not found

- [ ] **Step 3: Write `app/src/services/transcriptService.ts`**

```typescript
/**
 * Transcript Service — orchestrates mic capture → Deepgram → store → persistence.
 *
 * Watches sessionStore.activeSessionId (set by sessionTracker).
 * Starts phone mic capture + Deepgram WebSocket when session goes active.
 * Persists finalized transcript on session end.
 *
 * transcriptService is a consumer of the session lifecycle — it never
 * creates its own parallel session identity. sessionTracker owns that.
 */
import LiveAudioStream from 'react-native-live-audio-stream';
import { Buffer } from 'buffer';
import { useSessionStore } from '../stores/sessionStore';
import { useTranscriptStore } from '../stores/transcriptStore';
import { createDeepgramConnection, type DeepgramConnection } from './deepgramClient';
import { DEEPGRAM_API_KEY } from '../config/deepgram';
import { updateTranscript } from '../db/sessions';
import { updateRetention } from '../db/sessions';
import { RetentionTier } from '../types';
import type { TranscriptSegment } from '../types';

class TranscriptService {
  private unsubscribeStore: (() => void) | null = null;
  private connection: DeepgramConnection | null = null;
  private activeSessionId: string | null = null;
  private sessionStartMs: number = 0;
  private micInitialized = false;

  start() {
    if (this.unsubscribeStore) return; // already started

    this.unsubscribeStore = useSessionStore.subscribe((state) => {
      const sessionId = state.activeSessionId;

      // Session became active — start transcription
      if (sessionId && sessionId !== this.activeSessionId) {
        this.activeSessionId = sessionId;
        this.sessionStartMs = Date.now();
        this.startTranscription(sessionId);
      }

      // Session ended — stop and persist
      if (!sessionId && this.activeSessionId) {
        this.stopTranscription();
      }
    });
  }

  stop() {
    this.stopTranscription();
    this.unsubscribeStore?.();
    this.unsubscribeStore = null;
  }

  private async startTranscription(sessionId: string) {
    const store = useTranscriptStore.getState();
    store.reset();
    store.setStatus('starting');

    // Check API key
    if (!DEEPGRAM_API_KEY) {
      store.setError('Deepgram API key not configured');
      return;
    }

    try {
      // Initialize mic capture (once)
      if (!this.micInitialized) {
        await LiveAudioStream.init({
          sampleRate: 16000,
          channels: 1,
          bitsPerSample: 16,
          audioSource: 6, // VOICE_RECOGNITION (Android)
          bufferSize: 4096,
        });
        this.micInitialized = true;
      }

      // Open Deepgram connection
      this.connection = createDeepgramConnection(DEEPGRAM_API_KEY, this.sessionStartMs);

      // Wire transcript events to store
      this.connection.onTranscript((segment: TranscriptSegment) => {
        if (segment.isFinal) {
          useTranscriptStore.getState().addFinalSegment(segment);
        } else {
          useTranscriptStore.getState().setInterim(segment.text);
        }
      });

      this.connection.onError((error: string) => {
        console.warn('[TranscriptService] Deepgram error:', error);
        useTranscriptStore.getState().setStatus('interrupted');
        // Intentional v1 simplification: stop capture on disconnect.
        // Future phases may attempt reconnection or local buffering.
        LiveAudioStream.stop();
      });

      this.connection.onClose(() => {
        const currentStatus = useTranscriptStore.getState().status;
        // Only mark interrupted if we didn't initiate the close
        if (currentStatus === 'streaming') {
          useTranscriptStore.getState().setStatus('interrupted');
          LiveAudioStream.stop();
        }
      });

      // Wait for WebSocket to open, then start mic
      this.connection.onOpen(() => {
        useTranscriptStore.getState().setStatus('streaming');

        // Pipe mic audio to Deepgram
        LiveAudioStream.on('data', (base64: string) => {
          if (this.connection?.isOpen()) {
            const chunk = Buffer.from(base64, 'base64');
            this.connection.sendAudio(chunk.buffer);
          }
        });

        LiveAudioStream.start();
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to start transcription';
      useTranscriptStore.getState().setError(msg);
    }
  }

  private async stopTranscription() {
    const sessionId = this.activeSessionId;
    this.activeSessionId = null;

    // Stop mic
    try { LiveAudioStream.stop(); } catch { /* ignore */ }

    // Close Deepgram (graceful — may flush final transcript)
    if (this.connection) {
      this.connection.close();
      this.connection = null;
    }

    // Persist transcript if we have segments
    const { segments, status } = useTranscriptStore.getState();
    if (sessionId && segments.length > 0) {
      useTranscriptStore.getState().setStatus('finalizing');
      try {
        const plainText = segments.map((s) => s.text).join(' ');
        const segmentsJson = JSON.stringify(segments);
        await updateTranscript(sessionId, plainText, segmentsJson);
        await updateRetention(sessionId, RetentionTier.TRANSCRIPT, null);
        useTranscriptStore.getState().setStatus('complete');
      } catch (error) {
        console.warn('[TranscriptService] Failed to persist transcript:', error);
      }
    } else if (status !== 'idle') {
      // No segments captured — don't write empty transcript
      useTranscriptStore.getState().setStatus('complete');
    }
  }
}

export const transcriptService = new TranscriptService();
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npx jest src/services/__tests__/transcriptService.test.ts --no-coverage`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add app/src/services/transcriptService.ts app/src/services/__tests__/transcriptService.test.ts
git commit -m "feat(app): transcriptService — mic capture + Deepgram + persistence orchestrator (D.1.2)"
```

---

### Task 6: DB query — updateTranscript

**Files:**
- Modify: `app/src/db/sessions.ts`

- [ ] **Step 1: Add updateTranscript to `app/src/db/sessions.ts`**

Add after the existing retention queries section:

```typescript
// -------------------------------------------------------------------
// Transcript persistence (D.1)
// -------------------------------------------------------------------

/** Update transcript columns for a session. */
export async function updateTranscript(
  sessionId: string,
  transcript: string,
  transcriptTimestamps: string,
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE sessions SET transcript = ?, transcript_timestamps = ? WHERE id = ?`,
    [transcript, transcriptTimestamps, sessionId],
  );
}
```

- [ ] **Step 2: Run TypeScript check**

Run: `cd app && node node_modules/typescript/bin/tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add app/src/db/sessions.ts
git commit -m "feat(db): add updateTranscript query for transcript persistence (D.1.3)"
```

---

### Task 7: LiveTranscript Component + Session Screen Integration

**Files:**
- Create: `app/src/components/LiveTranscript.tsx`
- Modify: `app/app/(tabs)/session.tsx`

- [ ] **Step 1: Create `app/src/components/LiveTranscript.tsx`**

```typescript
/**
 * LiveTranscript — displays real-time transcript during active sessions.
 *
 * Shows finalized segments as normal text, interim text in faded italic,
 * and status-driven display for starting/interrupted/failed states.
 */
import { useRef, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useTheme } from '../theme/theme';
import { useTranscriptStore } from '../stores/transcriptStore';

export function LiveTranscript() {
  const theme = useTheme();
  const status = useTranscriptStore((s) => s.status);
  const segments = useTranscriptStore((s) => s.segments);
  const interimText = useTranscriptStore((s) => s.interimText);
  const streamError = useTranscriptStore((s) => s.streamError);
  const scrollRef = useRef<ScrollView>(null);

  // Auto-scroll to bottom on new content
  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [segments.length, interimText]);

  // Status-driven display
  if (status === 'idle') return null;

  if (status === 'failed') {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.card, borderRadius: theme.radius.xl }]}>
        <Text style={[theme.type.caption, { color: theme.text.muted }]}>
          Transcript unavailable
        </Text>
      </View>
    );
  }

  if (status === 'starting') {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.card, borderRadius: theme.radius.xl }]}>
        <Text style={[theme.type.caption, { color: theme.text.muted }]}>
          Starting transcript...
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.card, borderRadius: theme.radius.xl }]}>
      {/* Header */}
      <View style={styles.headerRow}>
        <Text style={[theme.type.subtitle, { color: theme.text.primary }]}>
          Live Transcript
        </Text>
        {status === 'streaming' && (
          <View style={[styles.streamingDot, { backgroundColor: theme.alert.safe }]} />
        )}
        {status === 'interrupted' && (
          <Text style={[theme.type.caption, { color: theme.semantic.error }]}>
            Interrupted
          </Text>
        )}
      </View>

      {/* Transcript content */}
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {segments.map((seg, i) => (
          <Text key={i} style={[theme.type.body, { color: theme.text.primary }]}>
            {seg.text}{' '}
          </Text>
        ))}
        {interimText ? (
          <Text style={[theme.type.body, { color: theme.text.muted, fontStyle: 'italic' }]}>
            {interimText}
          </Text>
        ) : null}
        {segments.length === 0 && !interimText && status === 'streaming' && (
          <Text style={[theme.type.body, { color: theme.text.muted }]}>
            Listening...
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    maxHeight: 240,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  streamingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  scroll: {
    flex: 1,
  },
});
```

- [ ] **Step 2: Integrate LiveTranscript into session screen**

In `app/app/(tabs)/session.tsx`, add the import:

```typescript
import { LiveTranscript } from '../../src/components/LiveTranscript';
```

In the ACTIVE session section (around line 400, after the Session Stats Card and before the Device Info Row), add:

```typescript
{/* -- Live Transcript -- */}
<View style={{ marginTop: theme.spacing.lg }}>
  <LiveTranscript />
</View>
```

- [ ] **Step 3: Run TypeScript check**

Run: `cd app && node node_modules/typescript/bin/tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add app/src/components/LiveTranscript.tsx app/app/(tabs)/session.tsx
git commit -m "feat(app): LiveTranscript component + session screen integration (D.1.4)"
```

---

### Task 8: Wire transcriptService into app startup

**Files:**
- Modify: `app/app/_layout.tsx` (or wherever sessionTracker.start() is called)

- [ ] **Step 1: Find where sessionTracker.start() is called**

Read the app layout file to find where `sessionTracker.start()` is invoked. Add `transcriptService.start()` right after it.

```typescript
import { transcriptService } from '../src/services/transcriptService';

// After sessionTracker.start():
transcriptService.start();
```

- [ ] **Step 2: Run TypeScript check**

Run: `cd app && node node_modules/typescript/bin/tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add app/app/_layout.tsx
git commit -m "feat(app): wire transcriptService into app startup (D.1.5)"
```

---

### Task 9: Docs Update

**Files:**
- Modify: `PHASE_PLAN.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update PHASE_PLAN.md**

Mark D.1 as complete (or in-progress with subtask detail).

- [ ] **Step 2: Update CLAUDE.md**

Add to Architecture section:

```markdown
### Transcript Pipeline (Phase D.1)
Phone mic captures audio via react-native-live-audio-stream during active sessions. Audio streams to Deepgram Nova-3 over raw WebSocket. Live transcript appears in session screen via transcriptStore (Zustand). On session end, finalized plain text + structured segment JSON persisted to sessions table (transcript, transcript_timestamps columns). Retention tier auto-promoted to TRANSCRIPT.
transcriptService.ts orchestrates the pipeline, consuming activeSessionId from sessionStore (set by sessionTracker). deepgramClient.ts wraps the Deepgram WebSocket. transcriptStore.ts holds reactive UI state.
API key is client-side for prototyping only — move behind backend auth before production.
```

Add to App Non-Negotiables:

```markdown
- **Deepgram API key**: `EXPO_PUBLIC_DEEPGRAM_API_KEY` env var. Client-side prototyping only — do not ship to TestFlight without reviewing security model.
- **react-native-live-audio-stream**: requires EAS build (not Expo Go). 16kHz/mono/16-bit PCM.
```

- [ ] **Step 3: Commit**

```bash
git add PHASE_PLAN.md CLAUDE.md
git commit -m "docs: update PHASE_PLAN + CLAUDE.md for D.1 transcript pipeline"
```

---

### Task 10: Final Verification + Push + Code Review

- [ ] **Step 1: Run full TypeScript check**

Run: `cd app && node node_modules/typescript/bin/tsc --noEmit`
Expected: PASS

- [ ] **Step 2: Run full test suite**

Run: `cd app && npx jest --no-coverage`
Expected: All tests pass (existing + transcriptStore + deepgramClient + transcriptService)

- [ ] **Step 3: Push**

```bash
git push
```

- [ ] **Step 4: Code review**

Run `superpowers:requesting-code-review` to verify the implementation against the D.1 spec.
