# D.2 Voice Enrollment + Speaker Attribution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable Deepgram diarization for speaker segmentation, build voice profile infrastructure from onboarding samples, and add provisional speaker labels with manual correction in the transcript UI.

**Architecture:** Enable `diarize: true` on the Deepgram WebSocket. Parse speaker labels from results into `TranscriptSegment.speaker` (raw diarized label, never mutated). A new `speakerService` manages per-session speaker mappings (diarized label → display name) with conditional "Me" defaults (1-2 speakers only). `voiceProfileService` creates a profile row from enrollment samples (embedding NULL until D.3). `LiveTranscript` resolves display names at render time and supports tap-to-correct via `SpeakerPicker`.

**Tech Stack:** Zustand, expo-sqlite, React Native, Deepgram diarization

**Spec:** `docs/specs/2026-04-09-d2-voice-enrollment-speaker-attribution-design.md`

---

## File Structure

| File | Responsibility |
|------|----------------|
| `app/src/types/index.ts` | Add SpeakerConfidence, SpeakerMapping, VoiceProfile, VoiceProfileStatus |
| `app/src/config/deepgram.ts` | Add `diarize: 'true'` |
| `app/src/db/schema.ts` | migrateToV4: voice_profiles table + speaker_map column |
| `app/src/db/voiceProfiles.ts` | **New** — CRUD for voice profiles |
| `app/src/db/sessions.ts` | Add updateSpeakerMap query |
| `app/src/services/deepgramClient.ts` | Parse speaker field from Deepgram results |
| `app/src/stores/speakerStore.ts` | **New** — reactive speaker mapping state |
| `app/src/services/speakerService.ts` | **New** — conditional defaults, reassignment, persistence |
| `app/src/services/voiceProfileService.ts` | **New** — profile creation from enrollment samples |
| `app/src/services/transcriptService.ts` | Wire speakerService into segment handling + finalization |
| `app/src/components/LiveTranscript.tsx` | Speaker labels, provisional indicator, tap handler |
| `app/src/components/SpeakerPicker.tsx` | **New** — modal for reassigning speaker identity |
| `app/app/_layout.tsx` | Call voiceProfileService.ensureProfileExists() |
| `app/src/services/__tests__/speakerService.test.ts` | **New** |
| `app/src/services/__tests__/voiceProfileService.test.ts` | **New** |
| `app/src/services/__tests__/deepgramClient.test.ts` | Update for speaker parsing |

---

### Task 1: Types + Deepgram Config

**Files:**
- Modify: `app/src/types/index.ts`
- Modify: `app/src/config/deepgram.ts`

- [ ] **Step 1: Add D.2 types to `app/src/types/index.ts`**

Add after the TranscriptStatus type (end of "Transcript Types (D.1)" section):

```typescript
// ============================================
// Speaker + Voice Profile Types (D.2)
// ============================================

/** Confidence level for a speaker identity mapping. */
export type SpeakerConfidence = 'provisional' | 'user_confirmed';

/** Maps a raw Deepgram diarized label to a display identity. */
export interface SpeakerMapping {
  diarizedLabel: string;         // "Speaker 0" — raw from Deepgram, immutable
  displayName: string;           // "Me", "Speaker 1", or user-assigned name
  confidence: SpeakerConfidence;
}

/** Voice profile status. */
export type VoiceProfileStatus = 'enrolled' | 'needs_embedding' | 'ready';

/** Voice profile — created from onboarding enrollment samples. */
export interface VoiceProfile {
  id: number;
  label: string;                  // "Me"
  status: VoiceProfileStatus;
  enrolledSampleIds: number[];    // voice_samples IDs
  embeddingData: null;            // NULL in D.2, populated by D.3
  embeddingModel: string | null;
  embeddingVersion: string | null;
  createdAt: number;
  updatedAt: number;
}
```

- [ ] **Step 2: Add diarization to Deepgram config**

In `app/src/config/deepgram.ts`, add `diarize: 'true'` to `DEEPGRAM_DEFAULTS`:

```typescript
export const DEEPGRAM_DEFAULTS = {
  model: 'nova-3',
  language: 'en',
  smart_format: 'true',
  interim_results: 'true',
  utterance_end_ms: '1000',
  encoding: 'linear16',
  sample_rate: '16000',
  channels: '1',
  diarize: 'true',
} as const;
```

- [ ] **Step 3: Run TypeScript check**

Run: `cd /Users/carlos/Workspace/rambling-guardian/app && node node_modules/typescript/bin/tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add app/src/types/index.ts app/src/config/deepgram.ts
git commit -m "feat(app): add speaker/voice profile types + enable Deepgram diarization (D.2.1)"
```

---

### Task 2: Schema Migration — voice_profiles + speaker_map

**Files:**
- Modify: `app/src/db/schema.ts`
- Modify: `app/src/db/database.ts`

- [ ] **Step 1: Add migrateToV4 to `app/src/db/schema.ts`**

Add after `migrateToV3`:

```typescript
export async function migrateToV4(db: SQLiteDatabase): Promise<void> {
  // Voice profiles table
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS voice_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      label TEXT NOT NULL DEFAULT 'Me',
      status TEXT NOT NULL DEFAULT 'enrolled',
      enrolled_sample_ids TEXT NOT NULL,
      embedding_data BLOB,
      embedding_model TEXT,
      embedding_version TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  // Speaker map column on sessions
  const migrations = [
    `ALTER TABLE sessions ADD COLUMN speaker_map TEXT`,
  ];
  for (const sql of migrations) {
    try {
      await db.execAsync(sql);
    } catch (e: any) {
      if (!e.message?.includes('duplicate column')) {
        throw e;
      }
    }
  }
}
```

- [ ] **Step 2: Call migrateToV4 from database.ts**

Read `app/src/db/database.ts`, find where `migrateToV3` is called, add `await migrateToV4(db);` after it. Import `migrateToV4` from `./schema`.

- [ ] **Step 3: Run TypeScript check**

Run: `cd /Users/carlos/Workspace/rambling-guardian/app && node node_modules/typescript/bin/tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add app/src/db/schema.ts app/src/db/database.ts
git commit -m "feat(db): migrateToV4 — voice_profiles table + speaker_map column (D.2.2)"
```

---

### Task 3: Voice Profile DB + Service

**Files:**
- Create: `app/src/db/voiceProfiles.ts`
- Create: `app/src/services/voiceProfileService.ts`
- Create: `app/src/services/__tests__/voiceProfileService.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
// app/src/services/__tests__/voiceProfileService.test.ts
import { ensureProfileExists, getProfile, getProfileStatus } from '../voiceProfileService';

const mockProfiles: any[] = [];
const mockSamples = [
  { id: 1, confirmed: 1 },
  { id: 2, confirmed: 1 },
  { id: 3, confirmed: 1 },
];

jest.mock('../../db/voiceProfiles', () => ({
  getVoiceProfile: jest.fn(async () => mockProfiles[0] ?? null),
  createVoiceProfile: jest.fn(async (sampleIds: number[]) => {
    const profile = { id: 1, label: 'Me', status: 'enrolled', enrolledSampleIds: sampleIds };
    mockProfiles.push(profile);
    return 1;
  }),
}));

jest.mock('../../db/voiceSamples', () => ({
  getVoiceSamples: jest.fn(async () => mockSamples.map((s) => ({
    id: s.id, recordedAt: 1000, filePath: '/test.wav', durationMs: 5000, confirmed: s.confirmed === 1,
  }))),
}));

beforeEach(() => {
  mockProfiles.length = 0;
  jest.clearAllMocks();
});

describe('voiceProfileService', () => {
  test('getProfileStatus returns none when no profile exists', async () => {
    const status = await getProfileStatus();
    expect(status).toBe('none');
  });

  test('ensureProfileExists creates profile from confirmed samples', async () => {
    await ensureProfileExists();
    expect(mockProfiles).toHaveLength(1);
    expect(mockProfiles[0].enrolledSampleIds).toEqual([1, 2, 3]);
  });

  test('ensureProfileExists is idempotent', async () => {
    await ensureProfileExists();
    await ensureProfileExists();
    const { createVoiceProfile } = require('../../db/voiceProfiles');
    expect(createVoiceProfile).toHaveBeenCalledTimes(1);
  });

  test('getProfileStatus returns enrolled after creation', async () => {
    await ensureProfileExists();
    const status = await getProfileStatus();
    expect(status).toBe('enrolled');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/carlos/Workspace/rambling-guardian/app && npx jest src/services/__tests__/voiceProfileService.test.ts --no-coverage`
Expected: FAIL — module not found

- [ ] **Step 3: Write `app/src/db/voiceProfiles.ts`**

```typescript
import { getDatabase } from './database';
import type { VoiceProfile, VoiceProfileStatus } from '../types';

/** Get the first (and typically only) voice profile. */
export async function getVoiceProfile(): Promise<VoiceProfile | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<any>('SELECT * FROM voice_profiles LIMIT 1');
  if (!row) return null;
  return {
    id: row.id,
    label: row.label,
    status: row.status as VoiceProfileStatus,
    enrolledSampleIds: JSON.parse(row.enrolled_sample_ids),
    embeddingData: row.embedding_data,
    embeddingModel: row.embedding_model,
    embeddingVersion: row.embedding_version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Create a voice profile from enrollment sample IDs. */
export async function createVoiceProfile(sampleIds: number[]): Promise<number> {
  const db = await getDatabase();
  const now = Date.now();
  const result = await db.runAsync(
    `INSERT INTO voice_profiles (label, status, enrolled_sample_ids, created_at, updated_at)
     VALUES ('Me', 'enrolled', ?, ?, ?)`,
    [JSON.stringify(sampleIds), now, now],
  );
  return result.lastInsertRowId;
}
```

- [ ] **Step 4: Write `app/src/services/voiceProfileService.ts`**

```typescript
/**
 * Voice Profile Service — manages voice enrollment from onboarding samples.
 *
 * Creates a voice profile when confirmed samples exist and no profile exists.
 * D.2: profile stores sample references with NULL embedding.
 * D.3: extends with embedding generation.
 */
import { getVoiceProfile, createVoiceProfile } from '../db/voiceProfiles';
import { getVoiceSamples } from '../db/voiceSamples';
import type { VoiceProfile, VoiceProfileStatus } from '../types';

/**
 * Ensure a voice profile exists if enrollment samples are available.
 * Idempotent — skips if profile already exists.
 * Best-effort — errors are logged, not thrown (safe for startup).
 */
export async function ensureProfileExists(): Promise<void> {
  try {
    const existing = await getVoiceProfile();
    if (existing) return; // already exists

    const samples = await getVoiceSamples();
    const confirmed = samples.filter((s) => s.confirmed);
    if (confirmed.length === 0) return; // no confirmed samples

    await createVoiceProfile(confirmed.map((s) => s.id));
    console.log(`[VoiceProfile] Created profile from ${confirmed.length} samples`);
  } catch (error) {
    console.warn('[VoiceProfile] Failed to ensure profile:', error);
  }
}

/** Get the current voice profile, or null if none exists. */
export async function getProfile(): Promise<VoiceProfile | null> {
  return getVoiceProfile();
}

/** Get the profile status: none, enrolled, needs_embedding, or ready. */
export async function getProfileStatus(): Promise<'none' | VoiceProfileStatus> {
  const profile = await getVoiceProfile();
  return profile ? profile.status : 'none';
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd /Users/carlos/Workspace/rambling-guardian/app && npx jest src/services/__tests__/voiceProfileService.test.ts --no-coverage`
Expected: PASS (4 tests)

- [ ] **Step 6: Commit**

```bash
git add app/src/db/voiceProfiles.ts app/src/services/voiceProfileService.ts app/src/services/__tests__/voiceProfileService.test.ts
git commit -m "feat(app): voiceProfileService + DB — profile creation from enrollment samples (D.2.3)"
```

---

### Task 4: Speaker Store + Speaker Service

**Files:**
- Create: `app/src/stores/speakerStore.ts`
- Create: `app/src/services/speakerService.ts`
- Create: `app/src/services/__tests__/speakerService.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
// app/src/services/__tests__/speakerService.test.ts
import { speakerService } from '../speakerService';
import { useSpeakerStore } from '../../stores/speakerStore';

jest.mock('../../db/sessions', () => ({
  updateSpeakerMap: jest.fn(async () => {}),
}));

jest.mock('../../db/settings', () => ({
  saveSetting: jest.fn(async () => {}),
  loadAllSettings: jest.fn(async () => new Map()),
}));

beforeEach(() => {
  speakerService.reset();
});

describe('speakerService', () => {
  test('first speaker in solo session maps to Me (provisional)', () => {
    speakerService.handleNewSpeaker('Speaker 0');
    const map = useSpeakerStore.getState().mappings;
    expect(map['Speaker 0']).toEqual({
      diarizedLabel: 'Speaker 0',
      displayName: 'Me',
      confidence: 'provisional',
    });
  });

  test('second speaker keeps Speaker 0 as Me', () => {
    speakerService.handleNewSpeaker('Speaker 0');
    speakerService.handleNewSpeaker('Speaker 1');
    const map = useSpeakerStore.getState().mappings;
    expect(map['Speaker 0'].displayName).toBe('Me');
    expect(map['Speaker 1'].displayName).toBe('Speaker 1');
  });

  test('third speaker does NOT auto-assign Me to new speakers', () => {
    speakerService.handleNewSpeaker('Speaker 0');
    speakerService.handleNewSpeaker('Speaker 1');
    speakerService.handleNewSpeaker('Speaker 2');
    const map = useSpeakerStore.getState().mappings;
    // Speaker 0 keeps Me (already assigned before threshold)
    expect(map['Speaker 0'].displayName).toBe('Me');
    expect(map['Speaker 2'].displayName).toBe('Speaker 2');
  });

  test('3+ speakers from start get generic labels only', () => {
    // Simulate all 3 appearing in quick succession before any mapping
    speakerService.handleNewSpeaker('Speaker 0');
    speakerService.handleNewSpeaker('Speaker 1');
    speakerService.handleNewSpeaker('Speaker 2');
    // Speaker 0 was assigned Me when count was 1, keeps it per spec
    const map = useSpeakerStore.getState().mappings;
    expect(map['Speaker 0'].displayName).toBe('Me');
  });

  test('reassignSpeaker updates displayName and sets user_confirmed', () => {
    speakerService.handleNewSpeaker('Speaker 0');
    speakerService.reassignSpeaker('Speaker 0', 'Carlos');
    const map = useSpeakerStore.getState().mappings;
    expect(map['Speaker 0'].displayName).toBe('Carlos');
    expect(map['Speaker 0'].confidence).toBe('user_confirmed');
  });

  test('getDisplayName returns display name for known speaker', () => {
    speakerService.handleNewSpeaker('Speaker 0');
    expect(speakerService.getDisplayName('Speaker 0')).toBe('Me');
  });

  test('getDisplayName returns raw label for unknown speaker', () => {
    expect(speakerService.getDisplayName('Speaker 99')).toBe('Speaker 99');
  });

  test('reset clears all mappings', () => {
    speakerService.handleNewSpeaker('Speaker 0');
    speakerService.reset();
    expect(useSpeakerStore.getState().mappings).toEqual({});
  });

  test('persistToSession calls updateSpeakerMap', async () => {
    speakerService.handleNewSpeaker('Speaker 0');
    await speakerService.persistToSession('session-123');
    const { updateSpeakerMap } = require('../../db/sessions');
    expect(updateSpeakerMap).toHaveBeenCalledWith(
      'session-123',
      expect.stringContaining('"Speaker 0"'),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/carlos/Workspace/rambling-guardian/app && npx jest src/services/__tests__/speakerService.test.ts --no-coverage`
Expected: FAIL — module not found

- [ ] **Step 3: Write `app/src/stores/speakerStore.ts`**

```typescript
import { create } from 'zustand';
import type { SpeakerMapping } from '../types';

interface SpeakerStore {
  mappings: Record<string, SpeakerMapping>;
  setMapping: (label: string, mapping: SpeakerMapping) => void;
  setMappings: (mappings: Record<string, SpeakerMapping>) => void;
  reset: () => void;
}

export const useSpeakerStore = create<SpeakerStore>((set) => ({
  mappings: {},

  setMapping: (label, mapping) =>
    set((state) => ({
      mappings: { ...state.mappings, [label]: mapping },
    })),

  setMappings: (mappings) => set({ mappings }),

  reset: () => set({ mappings: {} }),
}));
```

- [ ] **Step 4: Write `app/src/services/speakerService.ts`**

```typescript
/**
 * Speaker Service — manages per-session speaker identity mappings.
 *
 * Maps raw Deepgram diarized labels ("Speaker 0") to display names ("Me").
 * Default "Me" assignment is conditional on speaker count (1-2 only).
 * User can manually correct any mapping via reassignSpeaker().
 *
 * TranscriptSegment.speaker always holds the raw diarized label.
 * Display names are resolved at render time via getDisplayName().
 */
import { useSpeakerStore } from '../stores/speakerStore';
import { updateSpeakerMap } from '../db/sessions';
import type { SpeakerMapping } from '../types';

class SpeakerService {
  private speakerCount = 0;
  private meAssigned = false;

  /** Handle a new diarized speaker label. Applies default mapping rules. */
  handleNewSpeaker(diarizedLabel: string): void {
    const store = useSpeakerStore.getState();
    if (store.mappings[diarizedLabel]) return; // already mapped

    this.speakerCount++;

    let displayName: string;
    let confidence: 'provisional' | 'user_confirmed' = 'provisional';

    // Conditional "Me" assignment:
    // - 1 speaker: Speaker 0 → Me (solo session)
    // - 2 speakers: Speaker 0 → Me (if not already assigned to another)
    // - 3+ speakers: generic labels only for new speakers
    if (!this.meAssigned && this.speakerCount <= 2) {
      displayName = 'Me';
      this.meAssigned = true;
    } else {
      displayName = diarizedLabel; // "Speaker 1", "Speaker 2", etc.
    }

    store.setMapping(diarizedLabel, {
      diarizedLabel,
      displayName,
      confidence,
    });
  }

  /** Reassign a speaker's display name. Sets confidence to user_confirmed. */
  reassignSpeaker(diarizedLabel: string, newDisplayName: string): void {
    const store = useSpeakerStore.getState();
    const existing = store.mappings[diarizedLabel];
    if (!existing) return;

    store.setMapping(diarizedLabel, {
      ...existing,
      displayName: newDisplayName,
      confidence: 'user_confirmed',
    });
  }

  /** Get the display name for a diarized label. Returns raw label if unmapped. */
  getDisplayName(diarizedLabel: string): string {
    const mapping = useSpeakerStore.getState().mappings[diarizedLabel];
    return mapping?.displayName ?? diarizedLabel;
  }

  /** Get the confidence for a diarized label. */
  getConfidence(diarizedLabel: string): 'provisional' | 'user_confirmed' | null {
    const mapping = useSpeakerStore.getState().mappings[diarizedLabel];
    return mapping?.confidence ?? null;
  }

  /** Persist current speaker mappings to the session row. */
  async persistToSession(sessionId: string): Promise<void> {
    const { mappings } = useSpeakerStore.getState();
    await updateSpeakerMap(sessionId, JSON.stringify(mappings));
  }

  /** Reset all mappings for a new session. */
  reset(): void {
    this.speakerCount = 0;
    this.meAssigned = false;
    useSpeakerStore.getState().reset();
  }
}

export const speakerService = new SpeakerService();
```

- [ ] **Step 5: Add `updateSpeakerMap` to `app/src/db/sessions.ts`**

Add after the `updateTranscript` function:

```typescript
/** Update speaker map for a session. */
export async function updateSpeakerMap(
  sessionId: string,
  speakerMapJson: string,
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE sessions SET speaker_map = ? WHERE id = ?`,
    [speakerMapJson, sessionId],
  );
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd /Users/carlos/Workspace/rambling-guardian/app && npx jest src/services/__tests__/speakerService.test.ts --no-coverage`
Expected: PASS (9 tests)

- [ ] **Step 7: Commit**

```bash
git add app/src/stores/speakerStore.ts app/src/services/speakerService.ts app/src/services/__tests__/speakerService.test.ts app/src/db/sessions.ts
git commit -m "feat(app): speakerService + store — conditional Me mapping + manual correction (D.2.4)"
```

---

### Task 5: Parse Speaker from Deepgram Results

**Files:**
- Modify: `app/src/services/deepgramClient.ts`
- Modify: `app/src/services/__tests__/deepgramClient.test.ts`

- [ ] **Step 1: Update deepgramClient.ts to parse speaker field**

In `app/src/services/deepgramClient.ts`, find the segment construction (around line 79-86). Replace the `speaker: null` line with dominant-speaker logic:

```typescript
      // Determine segment speaker from word-level diarization.
      // Prefer dominant speaker across words; fall back to first word's speaker.
      let speaker: string | null = null;
      if (alt.words?.length) {
        const speakerCounts = new Map<number, number>();
        for (const w of alt.words) {
          if (w.speaker != null) {
            speakerCounts.set(w.speaker, (speakerCounts.get(w.speaker) ?? 0) + 1);
          }
        }
        if (speakerCounts.size > 0) {
          let maxCount = 0;
          let dominantSpeaker = 0;
          for (const [sp, count] of speakerCounts) {
            if (count > maxCount) {
              maxCount = count;
              dominantSpeaker = sp;
            }
          }
          speaker = `Speaker ${dominantSpeaker}`;
        }
      }

      const segment: TranscriptSegment = {
        text: alt.transcript,
        start: startMs,
        end: endMs,
        isFinal: data.is_final === true,
        speaker,
        words,
      };
```

- [ ] **Step 2: Add speaker parsing tests**

Add to `app/src/services/__tests__/deepgramClient.test.ts`:

```typescript
  test('parses dominant speaker from word-level diarization', () => {
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
            { word: 'Hello', start: 0.1, end: 0.4, confidence: 0.99, speaker: 0 },
            { word: 'world', start: 0.5, end: 0.9, confidence: 0.97, speaker: 0 },
          ],
        }],
      },
      start: 0.1,
      duration: 0.8,
    }));

    expect(transcripts[0].speaker).toBe('Speaker 0');
  });

  test('picks dominant speaker when words have mixed speakers', () => {
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
          transcript: 'Hello world test',
          confidence: 0.9,
          words: [
            { word: 'Hello', start: 0.1, end: 0.3, confidence: 0.9, speaker: 0 },
            { word: 'world', start: 0.4, end: 0.6, confidence: 0.9, speaker: 1 },
            { word: 'test', start: 0.7, end: 0.9, confidence: 0.9, speaker: 1 },
          ],
        }],
      },
      start: 0.1,
      duration: 0.8,
    }));

    expect(transcripts[0].speaker).toBe('Speaker 1'); // 2 words vs 1
  });

  test('speaker is null when diarization not present on words', () => {
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
          transcript: 'Hello',
          confidence: 0.9,
          words: [{ word: 'Hello', start: 0.1, end: 0.3, confidence: 0.9 }],
        }],
      },
      start: 0.1,
      duration: 0.2,
    }));

    expect(transcripts[0].speaker).toBeNull();
  });
```

- [ ] **Step 3: Run tests**

Run: `cd /Users/carlos/Workspace/rambling-guardian/app && npx jest src/services/__tests__/deepgramClient.test.ts --no-coverage`
Expected: PASS (all existing + 3 new tests)

- [ ] **Step 4: Commit**

```bash
git add app/src/services/deepgramClient.ts app/src/services/__tests__/deepgramClient.test.ts
git commit -m "feat(app): parse dominant speaker from Deepgram diarization results (D.2.5)"
```

---

### Task 6: Wire Speaker Service into Transcript Pipeline

**Files:**
- Modify: `app/src/services/transcriptService.ts`

- [ ] **Step 1: Update transcriptService to use speakerService**

Read `app/src/services/transcriptService.ts`. Make these changes:

**Add imports** at the top:
```typescript
import { speakerService } from './speakerService';
```

**In `startTranscription`**, after `store.reset()`, add:
```typescript
speakerService.reset();
```

**In the `onTranscript` callback** (around line 83-88), before adding the segment to the store, notify speaker service of new speakers:
```typescript
this.connection.onTranscript((segment: TranscriptSegment) => {
  // Notify speaker service of new speakers
  if (segment.speaker) {
    speakerService.handleNewSpeaker(segment.speaker);
  }

  if (segment.isFinal) {
    useTranscriptStore.getState().addFinalSegment(segment);
  } else {
    useTranscriptStore.getState().setInterim(segment.text);
  }
});
```

**In `stopTranscription`**, after persisting transcript but before setting status to complete, persist speaker mappings:
```typescript
// After: await updateTranscript(sessionId, plainText, segmentsJson);
// After: await updateRetention(sessionId, RetentionTier.TRANSCRIPT, null);
await speakerService.persistToSession(sessionId);
```

- [ ] **Step 2: Run TypeScript check**

Run: `cd /Users/carlos/Workspace/rambling-guardian/app && node node_modules/typescript/bin/tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Run all tests**

Run: `cd /Users/carlos/Workspace/rambling-guardian/app && npx jest --no-coverage`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add app/src/services/transcriptService.ts
git commit -m "feat(app): wire speakerService into transcript pipeline (D.2.6)"
```

---

### Task 7: LiveTranscript Speaker Labels + SpeakerPicker

**Files:**
- Modify: `app/src/components/LiveTranscript.tsx`
- Create: `app/src/components/SpeakerPicker.tsx`

- [ ] **Step 1: Create `app/src/components/SpeakerPicker.tsx`**

```typescript
/**
 * SpeakerPicker — bottom-sheet modal for reassigning a speaker identity.
 */
import { useState } from 'react';
import { View, Text, Pressable, TextInput, Modal, StyleSheet } from 'react-native';
import { useTheme } from '../theme/theme';
import { speakerService } from '../services/speakerService';
import { useSpeakerStore } from '../stores/speakerStore';

interface Props {
  diarizedLabel: string;
  visible: boolean;
  onClose: () => void;
}

export function SpeakerPicker({ diarizedLabel, visible, onClose }: Props) {
  const theme = useTheme();
  const mappings = useSpeakerStore((s) => s.mappings);
  const [customName, setCustomName] = useState('');

  // Collect existing display names for quick selection
  const existingNames = new Set<string>();
  existingNames.add('Me');
  for (const m of Object.values(mappings)) {
    if (m.displayName !== 'Me') existingNames.add(m.displayName);
  }

  function handleSelect(name: string) {
    speakerService.reassignSpeaker(diarizedLabel, name);
    onClose();
  }

  function handleCustomSubmit() {
    if (customName.trim()) {
      speakerService.reassignSpeaker(diarizedLabel, customName.trim());
      setCustomName('');
      onClose();
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: theme.colors.card, borderRadius: theme.radius.xl }]}>
          <Text style={[theme.type.subtitle, { color: theme.text.primary, marginBottom: theme.spacing.md }]}>
            Who is {diarizedLabel}?
          </Text>

          {[...existingNames].map((name) => (
            <Pressable
              key={name}
              onPress={() => handleSelect(name)}
              style={[styles.option, { borderColor: theme.colors.elevated, borderRadius: theme.radius.lg }]}
            >
              <Text style={[theme.type.body, { color: theme.text.primary }]}>{name}</Text>
            </Pressable>
          ))}

          <View style={[styles.customRow, { marginTop: theme.spacing.md }]}>
            <TextInput
              value={customName}
              onChangeText={setCustomName}
              placeholder="Custom name..."
              placeholderTextColor={theme.text.muted}
              style={[
                styles.input,
                {
                  color: theme.text.primary,
                  borderColor: theme.colors.elevated,
                  borderRadius: theme.radius.lg,
                },
              ]}
              onSubmitEditing={handleCustomSubmit}
              returnKeyType="done"
            />
          </View>

          <Pressable
            onPress={onClose}
            style={[styles.cancelButton, { marginTop: theme.spacing.md }]}
          >
            <Text style={[theme.type.body, { color: theme.text.muted }]}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    padding: 20,
    paddingBottom: 40,
  },
  option: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    marginBottom: 8,
  },
  customRow: {
    flexDirection: 'row',
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    fontSize: 16,
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
});
```

- [ ] **Step 2: Update `app/src/components/LiveTranscript.tsx`**

Rewrite the transcript content section to show speaker labels with provisional indicators and tap-to-correct:

```typescript
/**
 * LiveTranscript — displays real-time transcript during active sessions.
 *
 * Shows speaker-labeled segments with provisional indicators.
 * Tap a speaker label to reassign via SpeakerPicker.
 */
import { useRef, useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../theme/theme';
import { useTranscriptStore } from '../stores/transcriptStore';
import { useSpeakerStore } from '../stores/speakerStore';
import { speakerService } from '../services/speakerService';
import { SpeakerPicker } from './SpeakerPicker';

export function LiveTranscript() {
  const theme = useTheme();
  const status = useTranscriptStore((s) => s.status);
  const segments = useTranscriptStore((s) => s.segments);
  const interimText = useTranscriptStore((s) => s.interimText);
  const mappings = useSpeakerStore((s) => s.mappings);
  const scrollRef = useRef<ScrollView>(null);
  const [pickerLabel, setPickerLabel] = useState<string | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [segments.length, interimText]);

  const handleSpeakerTap = useCallback((diarizedLabel: string) => {
    setPickerLabel(diarizedLabel);
  }, []);

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

  // Group consecutive segments by speaker for cleaner display
  const lastSpeaker = segments.length > 0 ? segments[segments.length - 1].speaker : null;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.card, borderRadius: theme.radius.xl }]}>
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

      <ScrollView ref={scrollRef} style={styles.scroll} showsVerticalScrollIndicator={false}>
        {segments.map((seg, i) => {
          const prevSpeaker = i > 0 ? segments[i - 1].speaker : null;
          const showLabel = seg.speaker && seg.speaker !== prevSpeaker;
          const displayName = seg.speaker ? speakerService.getDisplayName(seg.speaker) : null;
          const confidence = seg.speaker ? speakerService.getConfidence(seg.speaker) : null;
          const isProvisional = confidence === 'provisional';

          return (
            <View key={`${seg.start}-${seg.end}`}>
              {showLabel && displayName && (
                <Pressable
                  onPress={() => seg.speaker && handleSpeakerTap(seg.speaker)}
                  style={styles.speakerLabel}
                >
                  <Text
                    style={[
                      theme.type.caption,
                      {
                        color: theme.primary[500],
                        fontWeight: '600',
                        opacity: isProvisional ? 0.6 : 1,
                      },
                    ]}
                  >
                    {displayName}
                  </Text>
                </Pressable>
              )}
              <Text style={[theme.type.body, { color: theme.text.primary }]}>
                {seg.text}{' '}
              </Text>
            </View>
          );
        })}
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

      {pickerLabel && (
        <SpeakerPicker
          diarizedLabel={pickerLabel}
          visible={!!pickerLabel}
          onClose={() => setPickerLabel(null)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    maxHeight: 280,
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
  speakerLabel: {
    marginTop: 8,
    marginBottom: 2,
  },
});
```

- [ ] **Step 3: Run TypeScript check**

Run: `cd /Users/carlos/Workspace/rambling-guardian/app && node node_modules/typescript/bin/tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add app/src/components/LiveTranscript.tsx app/src/components/SpeakerPicker.tsx
git commit -m "feat(app): LiveTranscript speaker labels + SpeakerPicker correction modal (D.2.7)"
```

---

### Task 8: Wire voiceProfileService into App Startup

**Files:**
- Modify: `app/app/_layout.tsx`

- [ ] **Step 1: Add voiceProfileService startup call**

Read `app/app/_layout.tsx`. Find where `transcriptService.start()` is called. After it, add:

```typescript
import { ensureProfileExists } from '../src/services/voiceProfileService';

// After transcriptService.start():
ensureProfileExists().catch(console.warn); // best-effort, non-blocking
```

The `.catch(console.warn)` ensures this is fire-and-forget — it never blocks app startup.

- [ ] **Step 2: Run TypeScript check**

Run: `cd /Users/carlos/Workspace/rambling-guardian/app && node node_modules/typescript/bin/tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add app/app/_layout.tsx
git commit -m "feat(app): wire voiceProfileService.ensureProfileExists() at startup (D.2.8)"
```

---

### Task 9: Docs Update

**Files:**
- Modify: `PHASE_PLAN.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update PHASE_PLAN.md**

Mark D.2 complete. Update the ticket description to reflect what was built.

- [ ] **Step 2: Update CLAUDE.md**

Add to Architecture section:

```markdown
### Speaker Attribution (Phase D.2)
Deepgram diarization (`diarize: true`) assigns speaker labels per word. `deepgramClient.ts` picks the dominant speaker per segment. `TranscriptSegment.speaker` holds the raw diarized label ("Speaker 0") — never mutated with display names.
`speakerService.ts` manages per-session mappings: diarized label → display name + confidence (provisional/user_confirmed). Default "Me" assignment is conditional: 1-2 speakers only, generic labels for 3+.
`speakerStore.ts` (Zustand) holds reactive mapping state. `LiveTranscript` resolves display names at render time. Tap speaker label → `SpeakerPicker` modal for correction.
`speaker_map TEXT` column on sessions table persists final mappings as JSON on session end.
`voice_profiles` table stores enrollment data (sample references, NULL embedding in D.2). `voiceProfileService.ensureProfileExists()` runs at startup (non-blocking, best-effort).
```

- [ ] **Step 3: Commit**

```bash
git add PHASE_PLAN.md CLAUDE.md
git commit -m "docs: update PHASE_PLAN + CLAUDE.md for D.2 speaker attribution"
```

---

### Task 10: Final Verification + Push + Code Review

- [ ] **Step 1: Run full TypeScript check**

Run: `cd /Users/carlos/Workspace/rambling-guardian/app && node node_modules/typescript/bin/tsc --noEmit`
Expected: PASS

- [ ] **Step 2: Run full test suite**

Run: `cd /Users/carlos/Workspace/rambling-guardian/app && npx jest --no-coverage`
Expected: All tests pass (existing + speakerService + voiceProfileService + deepgramClient updates)

- [ ] **Step 3: Push**

```bash
git push
```

- [ ] **Step 4: Code review**

Run `superpowers:requesting-code-review` to verify the implementation against the D.2 spec.
