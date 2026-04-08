# Phase D.0 — Local-First Sync & Retention Foundation

Design spec for sync checkpoint rules, retention policy enforcement, and cloud-ready adapter interfaces — all implemented locally in SQLite. No cloud services in this phase.

## Motivation

Phase D.0 was originally scoped as a full cloud standup (Firestore, Storage, Drive). Revised to local-first because:

- The next real product value is the transcript/coaching pipeline (D.1), not cloud infrastructure
- Sync correctness and retention rules should be validated locally before adding moving parts
- This is still a single-user system — avoid overbuilding
- Firebase can slot in cleanly after transcript artifacts actually exist

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Cloud scope | Local-first, cloud-ready interfaces only | Next value is transcripts, not infra |
| Checkpoint model | Single watermark + per-session status | Single user, idempotent sync, sufficient visibility |
| Watermark semantics | Advances only on `committed` | Committed = device confirmed SD write |
| Retention model | 4 tiers with distinct defaults | Transcripts vs audio have different value/size profiles |
| Adapter pattern | Clean module boundaries + type definition | No abstraction ceremony before Firebase is real |

## Schema Changes

### New columns on `sessions` table

```sql
ALTER TABLE sessions ADD COLUMN sync_status TEXT;
ALTER TABLE sessions ADD COLUMN received_at INTEGER;
ALTER TABLE sessions ADD COLUMN processed_at INTEGER;
ALTER TABLE sessions ADD COLUMN committed_at INTEGER;
ALTER TABLE sessions ADD COLUMN retention_tier INTEGER DEFAULT 1;
ALTER TABLE sessions ADD COLUMN retention_until INTEGER;
```

**`sync_status`** — per-session sync pipeline position (NULL for local sessions, set explicitly for device-synced sessions):
- NULL — local session (created on phone), not part of BLE sync pipeline
- `pending` — device session, sync not started
- `received` — BLE delivered the record bytes to phone
- `processed` — upserted to SQLite
- `acked` — ack written back to device via BLE
- `committed` — device confirmed SD checkpoint update
- `failed` — sync failed at some stage (queryable for retry)

**Timestamps** — set at each transition for debugging:
- `received_at` — when BLE delivered
- `processed_at` — when upserted to SQLite
- `committed_at` — when device confirmed

**Retention columns:**
- `retention_tier` — current effective tier (1–4) for this session, default 1 (metadata). Represents the highest artifact tier currently attached. Note: a single session may later have multiple artifact classes (transcript + audio clips + full audio) each with different retention behavior. Future phases may introduce a per-artifact retention table to complement or replace this single-tier-per-session model. For D.0, the session-level tier is sufficient.
- `retention_until` — Unix ms deadline for auto-prune, NULL = keep forever/indefinite

**Backward compatibility:** Existing `synced_from_device` boolean stays. Only `committed` is treated as fully synced — `acked` remains a transitional state (device has not yet confirmed its SD write). Existing `audio_retention` column stays as the user-facing preference string; `retention_tier` is the engine's internal classification.

### Migration

Add columns via the existing schema migration system in `schema.ts`. All columns are nullable or have defaults, so existing rows get sensible values without data migration. Backfill: existing rows with `synced_from_device = 1` get `sync_status = 'committed'` (the only fully-synced terminal state). Local sessions (`synced_from_device = 0`) keep `sync_status = NULL`.

## syncCheckpointService.ts

New service extracted from syncEngine.ts checkpoint logic.

### Responsibilities

1. **Advance per-session status** through the pipeline with timestamps
2. **Advance watermark** only when status reaches `committed`
3. **Query helpers** for sync state visibility

### API

```typescript
// Status transitions (set timestamp at each step)
advanceToReceived(sessionId: string): void
advanceToProcessed(sessionId: string): void
advanceToAcked(sessionId: string): void
advanceToCommitted(sessionId: string): void
markFailed(sessionId: string, error: string): void

// Watermark (committed-only semantics)
getWatermark(): string | null
// Watermark advances automatically inside advanceToCommitted()

// Queries
getUncommittedSessions(): SessionSyncInfo[]
getFailedSessions(): SessionSyncInfo[]
getSyncStats(): { pending: number; inFlight: number; committed: number; failed: number }
```

### Integration with syncEngine.ts

The existing syncEngine state machine (IDLE → REQUESTING_MANIFEST → IMPORTING → FINALIZING → COMPLETE/FAILED) stays. At each protocol step, syncEngine calls the checkpoint service:

- Record received from BLE → `advanceToReceived()`
- Upserted to SQLite → `advanceToProcessed()`
- Ack written to device → `advanceToAcked()`
- Device commit confirmed → `advanceToCommitted()`
- Any failure → `markFailed()`

The existing `advanceCheckpoint()` in syncEngine.ts is replaced by calls to the checkpoint service.

### Integration with syncTransport.ts

syncTransport drives the BLE protocol. It currently calls `syncEngine.importSession()` directly. After this change, the transport still calls syncEngine, but syncEngine delegates status tracking to the checkpoint service.

## retentionService.ts

New service for retention policy enforcement.

### 4-Tier Model

| Tier | Data Type | Default Retention | Auto-Prune | Enforcement |
|------|-----------|-------------------|------------|-------------|
| 1 | Session metadata | Forever | Never | Always active |
| 2 | Transcript + timestamps | Indefinite | Never (manual delete) | Active when transcripts exist (Phase D) |
| 3 | Alert-moment audio clips | 30 days | Yes | Active when clips exist (future) |
| 4 | Full session audio | 7 days | Yes | Active when full audio exists (future) |

### Tier Assignment

When a session is created or updated, the retention service assigns its tier based on what artifacts exist:

- Session has no transcript, no audio → Tier 1
- Session has transcript → Tier 2
- Session has alert-moment clips → Tier 3
- Session has full audio → Tier 4

A session's tier is its *highest* artifact tier. Pruning removes the highest-tier artifact and downgrades the session (e.g., Tier 4 → Tier 2 after full audio expires, transcript stays).

### `retention_until` Calculation

- Tier 1: NULL (forever)
- Tier 2: NULL (indefinite, manual delete only)
- Tier 3: `ended_at + 30 days`
- Tier 4: `ended_at + 7 days`

Recalculated on tier change (e.g., when audio is attached to a session).

### Enforcement

- **Runs on:** App launch, daily interval (24h timer), and manual invocation via `retentionService.runPruneNow()`
- **Manual trigger:** Exposed for deterministic testing, debugging, and future explicit cleanup actions (e.g., a "Free Storage" button in Settings)
- **Query:** `SELECT * FROM sessions WHERE retention_until IS NOT NULL AND retention_until < ? AND retention_tier > 2`
- **Action:** Delete the tier-specific artifact (audio file, clip), downgrade `retention_tier`, recalculate `retention_until`
- **No-ops for now:** Tiers 3 and 4 have no real artifacts yet. The engine runs but finds nothing to prune.

**Future exemption — favorited sessions:** When a `favorited` column is added to the sessions table, favorited sessions should be exempt from auto-pruning. D.0 does not implement favorite-aware checks — the exemption activates once the field exists. <!-- TODO: add favorite-aware prune filter when session favoriting is implemented -->

### User Settings

Retention defaults stored in the settings table:

```typescript
retentionTier3Days: number  // default 30
retentionTier4Days: number  // default 7
```

Surfaced in Settings screen under a "Storage & Retention" section. User can adjust windows. Changes apply to future sessions only (existing `retention_until` values are not retroactively updated).

### Manual Delete

User can delete any session from History regardless of tier. Manual delete removes the session row and any associated artifacts (files on disk). This is independent of auto-prune.

## syncTarget.ts — Future Cloud Adapter Shape

Type-only file documenting the contract a future Firebase adapter would implement.

```typescript
import type { RetentionTier } from './retentionService';

/**
 * Future cloud sync adapter interface. Not implemented in D.0.
 * Documents the shape so Firebase can slot in without reworking
 * local sync/retention architecture.
 *
 * Expected implementations:
 * - FirebaseSyncTarget (Phase D.0-cloud, after transcripts exist)
 */
export type SyncTarget = {
  /** Push session metadata to cloud store (e.g., Firestore) */
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

  /** Push an artifact (transcript, audio) to cloud storage */
  pushArtifact(
    sessionId: string,
    tier: RetentionTier,
    data: { uri: string; mimeType: string; sizeBytes: number },
  ): Promise<string>; // returns remote storage ID

  /** Delete an artifact from cloud storage */
  deleteArtifact(remoteId: string): Promise<void>;

  /** Get the cloud-side sync watermark */
  getCheckpoint(): Promise<string | null>;

  /** Set the cloud-side sync watermark */
  setCheckpoint(watermark: string): Promise<void>;
};
```

This file is imported nowhere in D.0. It exists purely as documentation for the future integration point.

## Revised D.0 Ticket List

The original 6 tickets assumed full cloud standup. Revised for local-first:

| Ticket | Description | Status |
|--------|-------------|--------|
| RG-D.0.4 | Sync checkpoints — schema migration, syncCheckpointService, integrate with syncEngine/syncTransport | Implement |
| RG-D.0.5 | Retention policy — retentionService, tier definitions, enforcement loop, settings UI | Implement |
| RG-D.0.T | syncTarget type definition + tests for checkpoint and retention services | Implement |
| RG-D.0.1 | Firestore for metadata | **Deferred** to post-D.1 |
| RG-D.0.2 | Storage for audio blobs | **Deferred** to post-D.1 |
| RG-D.0.3 | Google Drive for archive/export | **Deferred** to post-D.1 |
| RG-D.0.6 | Cloud retry/resume tests | **Deferred** to post-D.1 |

## Files to Create/Modify

| File | Action |
|------|--------|
| `app/src/db/schema.ts` | Add migration: new columns on sessions table |
| `app/src/db/sessions.ts` | Add sync status update queries, retention queries |
| `app/src/services/syncCheckpointService.ts` | **New** — checkpoint status pipeline + watermark |
| `app/src/services/retentionService.ts` | **New** — tier model, enforcement loop, pruning |
| `app/src/services/syncTarget.ts` | **New** — type definition only, ~30 lines |
| `app/src/services/syncEngine.ts` | Refactor to delegate checkpoint ops to new service |
| `app/src/services/syncTransport.ts` | Minor — pass timestamps for received_at |
| `app/src/stores/settingsStore.ts` | Add retention settings (tier3Days, tier4Days) |
| `app/src/db/settings.ts` | Persist retention defaults |
| `app/app/(tabs)/settings.tsx` | Add Storage & Retention section |
| `PHASE_PLAN.md` | Update D.0 tickets to reflect local-first scope |
| `CLAUDE.md` | Document retention tiers + sync status model |

## Testing

- **Checkpoint service:** status transitions, watermark-only-on-committed, getUncommittedSessions, backfill migration
- **Retention service:** tier assignment, retention_until calculation, prune query finds expired sessions, favorited exemption, no-op when no artifacts exist
- **Integration:** syncEngine → checkpointService delegation, status advances through full BLE sync cycle
- **Settings:** retention defaults persist and load correctly
