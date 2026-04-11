# Phase D.0 — Local-First Sync & Retention Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement sync checkpoint rules and retention policy enforcement locally in SQLite, with clean module boundaries for future Firebase integration.

**Architecture:** Extract checkpoint tracking from syncEngine into a dedicated syncCheckpointService with per-session status and committed-only watermark semantics. Add a retentionService with 4-tier model, enforcement loop, and manual trigger. Add a SyncTarget type for future cloud adapter shape. All local-first — no cloud services.

**Tech Stack:** expo-sqlite, zustand, TypeScript, Jest

**Spec:** `docs/specs/2026-04-08-d0-local-sync-retention-design.md`

---

## File Structure

| File | Responsibility |
|------|----------------|
| `app/src/types/index.ts` | Add SyncStatus type, RetentionTier enum, SessionSyncInfo type |
| `app/src/db/schema.ts` | Add migrateToV3 with new columns + backfill |
| `app/src/db/sessions.ts` | Add sync status update queries, retention queries |
| `app/src/services/syncCheckpointService.ts` | **New** — per-session status pipeline + watermark |
| `app/src/services/retentionService.ts` | **New** — tier model, enforcement loop, pruning |
| `app/src/services/syncTarget.ts` | **New** — type-only future cloud adapter shape |
| `app/src/services/syncEngine.ts` | Delegate checkpoint ops to new service |
| `app/src/services/syncTransport.ts` | Wire status transitions into sync cycle |
| `app/src/stores/settingsStore.ts` | Add retention settings |
| `app/src/services/__tests__/syncCheckpointService.test.ts` | **New** — checkpoint tests |
| `app/src/services/__tests__/retentionService.test.ts` | **New** — retention tests |

---

### Task 1: Types + Schema Migration

**Files:**
- Modify: `app/src/types/index.ts`
- Modify: `app/src/db/schema.ts`
- Modify: `app/src/db/database.ts` (call migrateToV3)

- [ ] **Step 1: Add types to `app/src/types/index.ts`**

Add after the existing `SyncCheckpoint` interface (around line 162):

```typescript
// ============================================
// Sync Status + Retention Types (D.0)
// ============================================

/** Per-session sync pipeline position. NULL for local sessions. */
export type SyncStatus = 'pending' | 'received' | 'processed' | 'acked' | 'committed' | 'failed';

/** Retention tier — determines auto-prune behavior. */
export enum RetentionTier {
  /** Session metadata only — kept forever */
  METADATA = 1,
  /** Transcript + timestamps — kept indefinitely (manual delete only) */
  TRANSCRIPT = 2,
  /** Alert-moment audio clips — auto-pruned after configurable window (default 30 days) */
  ALERT_CLIPS = 3,
  /** Full session audio — auto-pruned after configurable window (default 7 days) */
  FULL_AUDIO = 4,
}

/** Sync info for a session — used by checkpoint service queries. */
export interface SessionSyncInfo {
  id: string;
  syncStatus: SyncStatus | null;
  receivedAt: number | null;
  processedAt: number | null;
  committedAt: number | null;
  bootId: number | null;
  deviceSequence: number | null;
}
```

- [ ] **Step 2: Add `migrateToV3` to `app/src/db/schema.ts`**

Add after `migrateToV2`:

```typescript
export async function migrateToV3(db: SQLiteDatabase): Promise<void> {
  const migrations = [
    `ALTER TABLE sessions ADD COLUMN sync_status TEXT`,
    `ALTER TABLE sessions ADD COLUMN received_at INTEGER`,
    `ALTER TABLE sessions ADD COLUMN processed_at INTEGER`,
    `ALTER TABLE sessions ADD COLUMN committed_at INTEGER`,
    `ALTER TABLE sessions ADD COLUMN retention_tier INTEGER DEFAULT 1`,
    `ALTER TABLE sessions ADD COLUMN retention_until INTEGER`,
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

  // Backfill: device-synced sessions get sync_status = 'committed'
  await db.execAsync(
    `UPDATE sessions SET sync_status = 'committed', committed_at = ended_at WHERE synced_from_device = 1 AND sync_status IS NULL`,
  );
}
```

- [ ] **Step 3: Call migrateToV3 from database initialization**

In `app/src/db/database.ts`, find where `migrateToV2` is called and add `migrateToV3` after it. Read the file first to find the exact location.

- [ ] **Step 4: Run TypeScript check**

Run: `cd app && node node_modules/typescript/bin/tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/src/types/index.ts app/src/db/schema.ts app/src/db/database.ts
git commit -m "feat(db): add sync status + retention schema migration (D.0)"
```

---

### Task 2: Session DB Queries for Sync Status + Retention

**Files:**
- Modify: `app/src/db/sessions.ts`

- [ ] **Step 1: Add sync status update functions to `app/src/db/sessions.ts`**

Add after the existing `getPendingSyncCount` function:

```typescript
import type { SyncStatus, SessionSyncInfo, RetentionTier } from '../types';

// -------------------------------------------------------------------
// Sync status updates (D.0)
// -------------------------------------------------------------------

/** Update sync_status and set the corresponding timestamp. */
export async function updateSyncStatus(
  sessionId: string,
  status: SyncStatus,
): Promise<void> {
  const db = await getDatabase();
  const now = Date.now();
  const timestampCol =
    status === 'received' ? 'received_at' :
    status === 'processed' ? 'processed_at' :
    status === 'committed' ? 'committed_at' : null;

  if (timestampCol) {
    await db.runAsync(
      `UPDATE sessions SET sync_status = ?, ${timestampCol} = ? WHERE id = ?`,
      [status, now, sessionId],
    );
  } else {
    await db.runAsync(
      `UPDATE sessions SET sync_status = ? WHERE id = ?`,
      [status, sessionId],
    );
  }
}

/** Get all sessions that are not yet committed (in-flight or failed). */
export async function getUncommittedSessions(): Promise<SessionSyncInfo[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>(
    `SELECT id, sync_status, received_at, processed_at, committed_at, boot_id, device_sequence
     FROM sessions
     WHERE sync_status IS NOT NULL AND sync_status != 'committed'
     ORDER BY received_at ASC`,
  );
  return rows.map(parseSyncInfo);
}

/** Get sessions that failed sync. */
export async function getFailedSessions(): Promise<SessionSyncInfo[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>(
    `SELECT id, sync_status, received_at, processed_at, committed_at, boot_id, device_sequence
     FROM sessions WHERE sync_status = 'failed'`,
  );
  return rows.map(parseSyncInfo);
}

/** Get sync stats: count by status category. */
export async function getSyncStats(): Promise<{
  pending: number;
  inFlight: number;
  committed: number;
  failed: number;
}> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ sync_status: string | null; count: number }>(
    `SELECT sync_status, COUNT(*) as count FROM sessions
     WHERE sync_status IS NOT NULL
     GROUP BY sync_status`,
  );
  let pending = 0, inFlight = 0, committed = 0, failed = 0;
  for (const r of rows) {
    if (r.sync_status === 'pending') pending += r.count;
    else if (r.sync_status === 'committed') committed += r.count;
    else if (r.sync_status === 'failed') failed += r.count;
    else inFlight += r.count; // received, processed, acked
  }
  return { pending, inFlight, committed, failed };
}

// -------------------------------------------------------------------
// Retention queries (D.0)
// -------------------------------------------------------------------

/** Update retention tier and deadline for a session. */
export async function updateRetention(
  sessionId: string,
  tier: RetentionTier,
  retentionUntil: number | null,
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE sessions SET retention_tier = ?, retention_until = ? WHERE id = ?`,
    [tier, retentionUntil, sessionId],
  );
}

/** Get sessions whose retention has expired and are eligible for pruning. */
export async function getExpiredSessions(): Promise<Array<{
  id: string;
  retentionTier: RetentionTier;
  retentionUntil: number;
}>> {
  const db = await getDatabase();
  const now = Date.now();
  const rows = await db.getAllAsync<any>(
    `SELECT id, retention_tier, retention_until FROM sessions
     WHERE retention_until IS NOT NULL AND retention_until < ? AND retention_tier > 2`,
    [now],
  );
  return rows.map((r: any) => ({
    id: r.id,
    retentionTier: r.retention_tier as RetentionTier,
    retentionUntil: r.retention_until,
  }));
}

/** Delete a session and its alert events. */
export async function deleteSession(sessionId: string): Promise<void> {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM alert_events WHERE session_id = ?', [sessionId]);
    await db.runAsync('DELETE FROM sessions WHERE id = ?', [sessionId]);
  });
}

function parseSyncInfo(r: any): SessionSyncInfo {
  return {
    id: r.id,
    syncStatus: r.sync_status,
    receivedAt: r.received_at,
    processedAt: r.processed_at,
    committedAt: r.committed_at,
    bootId: r.boot_id,
    deviceSequence: r.device_sequence,
  };
}
```

- [ ] **Step 2: Update `upsertDeviceSession` to set initial sync_status**

In the existing `upsertDeviceSession` function, add `sync_status` to the INSERT columns. Change the INSERT to include `'processed'` as the initial status (the session has been received AND processed/upserted in one step during BLE import):

Find the INSERT statement at line 144-156 and update the column list and values to include `sync_status = 'processed'` and `processed_at = Date.now()`.

```typescript
// In the INSERT column list, add: sync_status, processed_at
// In VALUES, add: 'processed', Date.now()
// In ON CONFLICT, add: sync_status = excluded.sync_status, processed_at = excluded.processed_at
```

- [ ] **Step 3: Run TypeScript check**

Run: `cd app && node node_modules/typescript/bin/tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add app/src/db/sessions.ts
git commit -m "feat(db): add sync status + retention queries (D.0)"
```

---

### Task 3: syncCheckpointService + Tests

**Files:**
- Create: `app/src/services/syncCheckpointService.ts`
- Create: `app/src/services/__tests__/syncCheckpointService.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
// app/src/services/__tests__/syncCheckpointService.test.ts
import {
  advanceToReceived,
  advanceToProcessed,
  advanceToAcked,
  advanceToCommitted,
  markFailed,
  getWatermark,
} from '../syncCheckpointService';

// Mock the DB layer
const mockSessions = new Map<string, any>();
const mockSettings = new Map<string, string>();

jest.mock('../../db/sessions', () => ({
  updateSyncStatus: jest.fn(async (id: string, status: string) => {
    const existing = mockSessions.get(id) || {};
    mockSessions.set(id, { ...existing, sync_status: status });
  }),
  getUncommittedSessions: jest.fn(async () => []),
  getFailedSessions: jest.fn(async () => []),
  getSyncStats: jest.fn(async () => ({ pending: 0, inFlight: 0, committed: 0, failed: 0 })),
}));

jest.mock('../../db/settings', () => ({
  saveSetting: jest.fn(async (key: string, value: string) => {
    mockSettings.set(key, value);
  }),
  loadAllSettings: jest.fn(async () => new Map(mockSettings)),
}));

beforeEach(() => {
  mockSessions.clear();
  mockSettings.clear();
});

describe('syncCheckpointService', () => {
  const SESSION_ID = 'dev-1-1';

  test('advanceToReceived updates sync status', async () => {
    await advanceToReceived(SESSION_ID);
    const { updateSyncStatus } = require('../../db/sessions');
    expect(updateSyncStatus).toHaveBeenCalledWith(SESSION_ID, 'received');
  });

  test('advanceToProcessed updates sync status', async () => {
    await advanceToProcessed(SESSION_ID);
    const { updateSyncStatus } = require('../../db/sessions');
    expect(updateSyncStatus).toHaveBeenCalledWith(SESSION_ID, 'processed');
  });

  test('advanceToAcked updates sync status', async () => {
    await advanceToAcked(SESSION_ID);
    const { updateSyncStatus } = require('../../db/sessions');
    expect(updateSyncStatus).toHaveBeenCalledWith(SESSION_ID, 'acked');
  });

  test('advanceToCommitted updates status and advances watermark', async () => {
    await advanceToCommitted(SESSION_ID, '1-1');
    const { updateSyncStatus } = require('../../db/sessions');
    expect(updateSyncStatus).toHaveBeenCalledWith(SESSION_ID, 'committed');

    const watermark = await getWatermark();
    expect(watermark).toBe('1-1');
  });

  test('watermark is null when no sessions committed', async () => {
    const watermark = await getWatermark();
    expect(watermark).toBeNull();
  });

  test('watermark advances only on committed, not on acked', async () => {
    await advanceToAcked(SESSION_ID);
    const watermark = await getWatermark();
    expect(watermark).toBeNull();
  });

  test('markFailed sets failed status', async () => {
    await markFailed(SESSION_ID, 'BLE timeout');
    const { updateSyncStatus } = require('../../db/sessions');
    expect(updateSyncStatus).toHaveBeenCalledWith(SESSION_ID, 'failed');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx jest src/services/__tests__/syncCheckpointService.test.ts --no-coverage`
Expected: FAIL — module not found

- [ ] **Step 3: Write `app/src/services/syncCheckpointService.ts`**

```typescript
/**
 * Sync Checkpoint Service — per-session status pipeline + watermark.
 *
 * Extracted from syncEngine.ts. Tracks each session through:
 *   pending → received → processed → acked → committed
 *
 * The single watermark advances ONLY when a session reaches 'committed'
 * (device confirmed its SD checkpoint write). 'acked' is transitional.
 */
import { updateSyncStatus, getUncommittedSessions, getFailedSessions, getSyncStats } from '../db/sessions';
import { saveSetting, loadAllSettings } from '../db/settings';
import type { SyncStatus, SessionSyncInfo } from '../types';

const WATERMARK_KEY = 'syncWatermark';

export async function advanceToReceived(sessionId: string): Promise<void> {
  await updateSyncStatus(sessionId, 'received');
}

export async function advanceToProcessed(sessionId: string): Promise<void> {
  await updateSyncStatus(sessionId, 'processed');
}

export async function advanceToAcked(sessionId: string): Promise<void> {
  await updateSyncStatus(sessionId, 'acked');
}

/**
 * Mark session as committed and advance the watermark.
 * Only committed sessions move the watermark.
 */
export async function advanceToCommitted(
  sessionId: string,
  deviceCheckpoint: string,
): Promise<void> {
  await updateSyncStatus(sessionId, 'committed');
  await saveSetting(WATERMARK_KEY, deviceCheckpoint);
}

export async function markFailed(sessionId: string, error: string): Promise<void> {
  await updateSyncStatus(sessionId, 'failed');
}

/** Get the last committed watermark. */
export async function getWatermark(): Promise<string | null> {
  const settings = await loadAllSettings();
  const raw = settings.get(WATERMARK_KEY);
  return raw || null;
}

// Re-export query helpers from sessions.ts for convenience
export { getUncommittedSessions, getFailedSessions, getSyncStats };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npx jest src/services/__tests__/syncCheckpointService.test.ts --no-coverage`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/src/services/syncCheckpointService.ts app/src/services/__tests__/syncCheckpointService.test.ts
git commit -m "feat(app): syncCheckpointService with per-session status + watermark (D.0.4)"
```

---

### Task 4: retentionService + Tests

**Files:**
- Create: `app/src/services/retentionService.ts`
- Create: `app/src/services/__tests__/retentionService.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
// app/src/services/__tests__/retentionService.test.ts
import {
  RETENTION_DEFAULTS,
  calculateRetentionUntil,
  assignRetentionTier,
  runPruneNow,
} from '../retentionService';
import { RetentionTier } from '../../types';

// Mock DB
jest.mock('../../db/sessions', () => ({
  getExpiredSessions: jest.fn(async () => []),
  updateRetention: jest.fn(async () => {}),
  deleteSession: jest.fn(async () => {}),
}));

jest.mock('../../db/settings', () => ({
  saveSetting: jest.fn(async () => {}),
  loadAllSettings: jest.fn(async () => new Map()),
}));

describe('retentionService', () => {
  test('RETENTION_DEFAULTS has correct tier windows', () => {
    expect(RETENTION_DEFAULTS[RetentionTier.METADATA]).toBeNull();
    expect(RETENTION_DEFAULTS[RetentionTier.TRANSCRIPT]).toBeNull();
    expect(RETENTION_DEFAULTS[RetentionTier.ALERT_CLIPS]).toBe(30 * 24 * 60 * 60 * 1000);
    expect(RETENTION_DEFAULTS[RetentionTier.FULL_AUDIO]).toBe(7 * 24 * 60 * 60 * 1000);
  });

  test('calculateRetentionUntil returns null for tiers 1 and 2', () => {
    expect(calculateRetentionUntil(RetentionTier.METADATA, 1000)).toBeNull();
    expect(calculateRetentionUntil(RetentionTier.TRANSCRIPT, 1000)).toBeNull();
  });

  test('calculateRetentionUntil returns ended_at + window for tier 3', () => {
    const endedAt = 1712400000000;
    const result = calculateRetentionUntil(RetentionTier.ALERT_CLIPS, endedAt);
    expect(result).toBe(endedAt + 30 * 24 * 60 * 60 * 1000);
  });

  test('calculateRetentionUntil returns ended_at + window for tier 4', () => {
    const endedAt = 1712400000000;
    const result = calculateRetentionUntil(RetentionTier.FULL_AUDIO, endedAt);
    expect(result).toBe(endedAt + 7 * 24 * 60 * 60 * 1000);
  });

  test('assignRetentionTier returns METADATA when no artifacts', () => {
    expect(assignRetentionTier({ hasTranscript: false, hasClips: false, hasFullAudio: false }))
      .toBe(RetentionTier.METADATA);
  });

  test('assignRetentionTier returns TRANSCRIPT when transcript exists', () => {
    expect(assignRetentionTier({ hasTranscript: true, hasClips: false, hasFullAudio: false }))
      .toBe(RetentionTier.TRANSCRIPT);
  });

  test('assignRetentionTier returns highest tier present', () => {
    expect(assignRetentionTier({ hasTranscript: true, hasClips: true, hasFullAudio: true }))
      .toBe(RetentionTier.FULL_AUDIO);
  });

  test('runPruneNow returns 0 when no expired sessions', async () => {
    const count = await runPruneNow();
    expect(count).toBe(0);
  });

  test('runPruneNow prunes expired sessions', async () => {
    const { getExpiredSessions, updateRetention } = require('../../db/sessions');
    getExpiredSessions.mockResolvedValueOnce([
      { id: 'session-1', retentionTier: RetentionTier.FULL_AUDIO, retentionUntil: 1000 },
    ]);

    const count = await runPruneNow();
    expect(count).toBe(1);
    // Should downgrade from FULL_AUDIO (4) to TRANSCRIPT (2) — audio pruned, transcript kept
    expect(updateRetention).toHaveBeenCalledWith('session-1', RetentionTier.TRANSCRIPT, null);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx jest src/services/__tests__/retentionService.test.ts --no-coverage`
Expected: FAIL — module not found

- [ ] **Step 3: Write `app/src/services/retentionService.ts`**

```typescript
/**
 * Retention Service — 4-tier retention policy enforcement.
 *
 * Tiers:
 *   1 (METADATA)     — session metadata, kept forever
 *   2 (TRANSCRIPT)   — transcript + timestamps, kept indefinitely (manual delete)
 *   3 (ALERT_CLIPS)  — alert-moment audio clips, auto-pruned (default 30 days)
 *   4 (FULL_AUDIO)   — full session audio, auto-pruned (default 7 days)
 *
 * retention_tier on the session row is the current effective / highest tier.
 * A single session may later have multiple artifact classes with different
 * retention behavior. Future phases may introduce a per-artifact retention
 * table to complement or replace this session-level model.
 *
 * Future exemption: favorited sessions should be exempt from auto-pruning.
 * Not implemented until the favorited column exists on the sessions table.
 */
import { getExpiredSessions, updateRetention } from '../db/sessions';
import { RetentionTier } from '../types';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Default retention windows per tier. null = keep forever/indefinitely. */
export const RETENTION_DEFAULTS: Record<RetentionTier, number | null> = {
  [RetentionTier.METADATA]: null,
  [RetentionTier.TRANSCRIPT]: null,
  [RetentionTier.ALERT_CLIPS]: 30 * DAY_MS,
  [RetentionTier.FULL_AUDIO]: 7 * DAY_MS,
};

/** Calculate retention_until for a given tier and session end time. */
export function calculateRetentionUntil(
  tier: RetentionTier,
  endedAt: number,
): number | null {
  const window = RETENTION_DEFAULTS[tier];
  if (window === null) return null;
  return endedAt + window;
}

/** Determine the retention tier based on which artifacts exist. */
export function assignRetentionTier(artifacts: {
  hasTranscript: boolean;
  hasClips: boolean;
  hasFullAudio: boolean;
}): RetentionTier {
  if (artifacts.hasFullAudio) return RetentionTier.FULL_AUDIO;
  if (artifacts.hasClips) return RetentionTier.ALERT_CLIPS;
  if (artifacts.hasTranscript) return RetentionTier.TRANSCRIPT;
  return RetentionTier.METADATA;
}

/**
 * Run retention enforcement now.
 * Queries for expired sessions (tier > 2, retention_until < now) and
 * downgrades them by removing the highest-tier artifact.
 *
 * Returns the number of sessions pruned.
 */
export async function runPruneNow(): Promise<number> {
  const expired = await getExpiredSessions();
  if (expired.length === 0) return 0;

  let pruned = 0;
  for (const session of expired) {
    // Downgrade tier: remove the highest artifact, keep lower ones
    // FULL_AUDIO → TRANSCRIPT (audio removed, transcript stays)
    // ALERT_CLIPS → TRANSCRIPT (clips removed, transcript stays)
    // Tiers 1-2 never reach here (query filters retention_tier > 2)
    const newTier =
      session.retentionTier === RetentionTier.FULL_AUDIO
        ? RetentionTier.TRANSCRIPT
        : RetentionTier.TRANSCRIPT; // ALERT_CLIPS also downgrades to TRANSCRIPT

    // TODO: When audio artifacts exist (Phase D), delete the actual files here
    // e.g., FileSystem.deleteAsync(audioFilePath)

    const newRetentionUntil = calculateRetentionUntil(newTier, 0); // null for tier 2
    await updateRetention(session.id, newTier, newRetentionUntil);
    pruned++;
  }

  return pruned;
}

let pruneInterval: ReturnType<typeof setInterval> | null = null;

/** Start the daily retention enforcement interval. Also runs once immediately. */
export async function startRetentionEnforcement(): Promise<void> {
  await runPruneNow();
  if (pruneInterval) clearInterval(pruneInterval);
  pruneInterval = setInterval(() => {
    runPruneNow().catch(console.warn);
  }, DAY_MS);
}

/** Stop the retention enforcement interval. */
export function stopRetentionEnforcement(): void {
  if (pruneInterval) {
    clearInterval(pruneInterval);
    pruneInterval = null;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npx jest src/services/__tests__/retentionService.test.ts --no-coverage`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/src/services/retentionService.ts app/src/services/__tests__/retentionService.test.ts
git commit -m "feat(app): retentionService with 4-tier model + manual prune trigger (D.0.5)"
```

---

### Task 5: syncTarget Type Definition

**Files:**
- Create: `app/src/services/syncTarget.ts`

- [ ] **Step 1: Write `app/src/services/syncTarget.ts`**

```typescript
/**
 * Future cloud sync adapter interface. Not implemented in D.0.
 *
 * Documents the shape so Firebase can slot in without reworking
 * the local sync/retention architecture. This file is imported
 * nowhere in D.0 — it exists purely as the future integration contract.
 *
 * Expected implementations:
 * - FirebaseSyncTarget (after transcript artifacts exist)
 */
import type { RetentionTier } from '../types';

export type SyncTarget = {
  /** Push session metadata to cloud store (e.g., Firestore). */
  pushSessionMetadata(session: {
    id: string;
    startedAt: number;
    endedAt: number;
    alertCount: number;
    maxAlert: number;
    speechSegments: number;
    triggerSource: string;
    retentionTier: RetentionTier;
  }): Promise<void>;

  /** Push an artifact (transcript, audio) to cloud storage. Returns remote ID. */
  pushArtifact(
    sessionId: string,
    tier: RetentionTier,
    data: { uri: string; mimeType: string; sizeBytes: number },
  ): Promise<string>;

  /** Delete an artifact from cloud storage. */
  deleteArtifact(remoteId: string): Promise<void>;

  /** Get the cloud-side sync watermark. */
  getCheckpoint(): Promise<string | null>;

  /** Set the cloud-side sync watermark. */
  setCheckpoint(watermark: string): Promise<void>;
};
```

- [ ] **Step 2: Run TypeScript check**

Run: `cd app && node node_modules/typescript/bin/tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add app/src/services/syncTarget.ts
git commit -m "feat(app): SyncTarget type definition for future cloud adapter (D.0)"
```

---

### Task 6: Wire syncCheckpointService into syncTransport

**Files:**
- Modify: `app/src/services/syncTransport.ts`
- Modify: `app/src/services/syncEngine.ts`

- [ ] **Step 1: Update syncTransport.ts to use checkpoint service**

Replace the `advanceCheckpoint` import with checkpoint service calls. In the import block (line 16-18), replace:

```typescript
// Remove from syncEngine imports:
//   advanceCheckpoint,
// Add new import:
import {
  advanceToProcessed,
  advanceToAcked,
  advanceToCommitted,
  markFailed,
} from './syncCheckpointService';
```

In the sync loop (around line 120-148), after `upsertDeviceSession`:

```typescript
// After upsertDeviceSession (line ~133):
await advanceToProcessed(sessionId);

// After successful ack response (line ~146, inside the ack check):
await advanceToAcked(sessionId);

// Replace the advanceCheckpoint call (line ~148):
// OLD: await advanceCheckpoint(`${record.bootId}-${record.deviceSessionSequence}`, sessionId);
// NEW: (moved to after commit below)
```

After the commit response (around line 160-165), advance to committed only if device confirms:

```typescript
// After commit response check:
if (!commitResp || parseUint8(commitResp) !== 0x02) {
  // Commit succeeded — advance all acked sessions to committed
  for (const id of importedSessionIds) {
    await advanceToCommitted(id, `${/* bootId */}-${/* sequence */}`);
  }
}
```

Note: This requires collecting the imported session IDs and their checkpoint strings during the import loop. Add an array before the loop:

```typescript
const importedSessions: Array<{ id: string; checkpoint: string }> = [];
```

And in the loop, push to it:

```typescript
importedSessions.push({
  id: sessionId,
  checkpoint: `${record.bootId}-${record.deviceSessionSequence}`,
});
```

Then after commit success, advance each to committed with its checkpoint.

- [ ] **Step 2: Clean up syncEngine.ts**

The `advanceCheckpoint` function in syncEngine.ts is no longer called by syncTransport. It can stay for now (existing tests reference it) but add a deprecation comment:

```typescript
/** @deprecated Use syncCheckpointService.advanceToCommitted() instead. Kept for test compatibility. */
export async function advanceCheckpoint(
```

- [ ] **Step 3: Run TypeScript check**

Run: `cd app && node node_modules/typescript/bin/tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Run all tests**

Run: `cd app && npx jest --no-coverage`
Expected: All existing tests pass. New checkpoint tests pass.

- [ ] **Step 5: Commit**

```bash
git add app/src/services/syncTransport.ts app/src/services/syncEngine.ts
git commit -m "refactor(app): wire syncCheckpointService into sync transport (D.0.4)"
```

---

### Task 7: Retention Settings in settingsStore

**Files:**
- Modify: `app/src/stores/settingsStore.ts`

- [ ] **Step 1: Add retention settings to settingsStore**

Add to the `SettingsStore` interface (after `minBatteryForRecording`):

```typescript
retentionTier3Days: number;
retentionTier4Days: number;
setRetentionTier3Days: (days: number) => void;
setRetentionTier4Days: (days: number) => void;
```

Add defaults in the store creation:

```typescript
retentionTier3Days: 30,
retentionTier4Days: 7,
```

Add setters:

```typescript
setRetentionTier3Days: (days) => {
  set({ retentionTier3Days: days });
  saveSetting('retentionTier3Days', String(days)).catch(console.warn);
},
setRetentionTier4Days: (days) => {
  set({ retentionTier4Days: days });
  saveSetting('retentionTier4Days', String(days)).catch(console.warn);
},
```

Add hydration in `hydrateFromDb` (after the theme hydration block):

```typescript
const r3 = safeInt(raw.get('retentionTier3Days'));
if (r3 !== undefined) parsed.retentionTier3Days = r3;
const r4 = safeInt(raw.get('retentionTier4Days'));
if (r4 !== undefined) parsed.retentionTier4Days = r4;
```

Also add `retentionTier3Days` and `retentionTier4Days` to the `parsed` type.

- [ ] **Step 2: Run TypeScript check**

Run: `cd app && node node_modules/typescript/bin/tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add app/src/stores/settingsStore.ts
git commit -m "feat(app): add retention settings to settingsStore (D.0.5)"
```

---

### Settings UI Note

The spec mentions a "Storage & Retention" section in Settings. Deferred — tiers 3-4 are no-ops (no audio artifacts exist), and the retention store values (Task 7) have no user-visible effect yet. Add the UI when Phase D starts producing prunable artifacts. The store values and persistence are ready for it.

---

### Task 8: Update PHASE_PLAN.md + CLAUDE.md

**Files:**
- Modify: `PHASE_PLAN.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update PHASE_PLAN.md**

Replace the D.0 section with the revised local-first tickets. Mark completed tickets. Defer cloud tickets with strikethrough.

- [ ] **Step 2: Update CLAUDE.md**

Add to the Architecture section:

```markdown
### Sync Status Model (Phase D.0)
Per-session `sync_status`: NULL (local) | pending | received | processed | acked | committed | failed.
Single watermark advances only on `committed` (device confirmed SD write).
syncCheckpointService.ts manages status transitions. syncEngine.ts retains the BLE state machine.

### Retention Tiers (Phase D.0)
| Tier | Data | Retention | Auto-Prune |
|------|------|-----------|------------|
| 1 | Metadata | Forever | Never |
| 2 | Transcript | Indefinite | Manual only |
| 3 | Alert clips | 30 days | Yes |
| 4 | Full audio | 7 days | Yes |
retentionService.ts enforces. `runPruneNow()` for manual trigger. Tiers 3-4 are no-ops until artifacts exist.
```

- [ ] **Step 3: Commit**

```bash
git add PHASE_PLAN.md CLAUDE.md
git commit -m "docs: update PHASE_PLAN + CLAUDE.md for D.0 local-first sync/retention"
```

---

### Task 9: Final Verification + Push

- [ ] **Step 1: Run full TypeScript check**

Run: `cd app && node node_modules/typescript/bin/tsc --noEmit`
Expected: PASS

- [ ] **Step 2: Run full test suite**

Run: `cd app && npx jest --no-coverage`
Expected: All tests pass (existing + new syncCheckpointService + retentionService)

- [ ] **Step 3: Push**

```bash
git push
```

- [ ] **Step 4: Code review**

Run `superpowers:requesting-code-review` to verify the implementation against the D.0 spec before marking the phase complete.
