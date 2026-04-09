/**
 * Session persistence layer.
 *
 * Two-level model:
 * - **ConnectionWindow (sessions table)**: What current rows represent — a contiguous
 *   BLE connection period. Created on connect, finalized on disconnect.
 *   Duration = ended_at - started_at.
 * - **ConversationSession (future)**: A user-facing conversation that may span
 *   multiple connection windows (e.g., reconnect after a BLE dropout).
 *   Not persisted yet — see types/index.ts for the forward type definition.
 *
 * Other definitions:
 * - **Speaking run (speech segment)**: A contiguous period of speech above the VAD
 *   threshold. Counted by the device firmware, not the app.
 * - **Alert event**: A transition to a new (higher) alert level during a connection
 *   window. `timestamp` is ms offset from `sessions.started_at`.
 * - **Manual capture**: A user-triggered voice recording (voice_samples table).
 *   NOT a session — kept separate.
 */

import { getDatabase } from './database';
import type { Session, SessionMode, AlertEvent, SyncStatus, SessionSyncInfo, RetentionTier } from '../types';
import { AlertLevel } from '../types';

/** Start a new session, returns session id */
export async function createSession(sensitivity: number): Promise<string> {
  const db = await getDatabase();
  const id = `session-${Date.now()}`;
  await db.runAsync(
    'INSERT INTO sessions (id, started_at, ended_at, duration_ms, mode, alert_count, max_alert, speech_segments, sensitivity, synced_from_device) VALUES (?, ?, NULL, 0, ?, 0, 0, 0, ?, 0)',
    [id, Date.now(), 'solo', sensitivity],
  );
  return id;
}

/** Update session with final stats when it ends */
export async function finalizeSession(
  id: string,
  durationMs: number,
  alertCount: number,
  maxAlert: AlertLevel,
  speechSegments: number,
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE sessions SET ended_at = ?, duration_ms = ?, alert_count = ?, max_alert = ?, speech_segments = ? WHERE id = ?',
    [Date.now(), durationMs, alertCount, maxAlert, speechSegments, id],
  );
}

/** Record an alert event within a session */
export async function recordAlertEvent(
  sessionId: string,
  alertLevel: AlertLevel,
  timestamp: number,
  durationAtAlert: number,
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'INSERT INTO alert_events (session_id, timestamp, alert_level, duration_at_alert) VALUES (?, ?, ?, ?)',
    [sessionId, timestamp, alertLevel, durationAtAlert],
  );
}

/** Get sessions ordered newest first, excluding reconnect noise. */
export async function getSessions(limit = 50): Promise<Session[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>(
    `SELECT * FROM sessions
     WHERE ended_at IS NOT NULL
       AND NOT (duration_ms < 5000 AND speech_segments = 0 AND alert_count = 0)
     ORDER BY started_at DESC LIMIT ?`,
    [limit],
  );
  return rows.map(parseSession);
}

/** Get a single session by id */
export async function getSessionById(id: string): Promise<Session | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<any>('SELECT * FROM sessions WHERE id = ?', [id]);
  return row ? parseSession(row) : null;
}

/** Get alert events for a session */
export async function getAlertEvents(sessionId: string): Promise<AlertEvent[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>(
    'SELECT * FROM alert_events WHERE session_id = ? ORDER BY timestamp ASC',
    [sessionId],
  );
  return rows.map((r: any) => ({
    id: r.id,
    sessionId: r.session_id,
    timestamp: r.timestamp,
    alertLevel: r.alert_level as AlertLevel,
    durationAtAlert: r.duration_at_alert,
  }));
}

/** Get lifetime stats: total sessions, total speech time, total alerts */
export async function getLifetimeStats(): Promise<{
  totalSessions: number;
  totalSpeechMs: number;
  totalAlerts: number;
  avgAlertsPer: number;
}> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<any>(
    `SELECT COUNT(*) as count, SUM(duration_ms) as total_ms, SUM(alert_count) as total_alerts
     FROM sessions
     WHERE ended_at IS NOT NULL
       AND NOT (duration_ms < 5000 AND speech_segments = 0 AND alert_count = 0)`,
  );
  const count = row?.count ?? 0;
  const totalMs = row?.total_ms ?? 0;
  const totalAlerts = row?.total_alerts ?? 0;
  return {
    totalSessions: count,
    totalSpeechMs: totalMs,
    totalAlerts,
    avgAlertsPer: count > 0 ? Math.round(totalAlerts / count) : 0,
  };
}

/**
 * Upsert a session synced from the device via BLE.
 * Idempotent: safe to replay the same session without duplication.
 */
export async function upsertDeviceSession(session: {
  id: string;
  startedAt: number;
  endedAt: number | null;
  durationMs: number;
  mode: SessionMode;
  alertCount: number;
  maxAlert: number;
  speechSegments: number;
  sensitivity: number;
  bootId?: number;
  deviceSequence?: number;
}): Promise<void> {
  const db = await getDatabase();
  const now = Date.now();
  await db.runAsync(
    `INSERT INTO sessions
       (id, started_at, ended_at, duration_ms, mode, alert_count, max_alert, speech_segments, sensitivity, synced_from_device, boot_id, device_sequence, sync_status, processed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, 'processed', ?)
     ON CONFLICT(id) DO UPDATE SET
       ended_at        = COALESCE(excluded.ended_at, sessions.ended_at),
       duration_ms     = excluded.duration_ms,
       alert_count     = excluded.alert_count,
       max_alert       = excluded.max_alert,
       speech_segments = excluded.speech_segments,
       synced_from_device = 1,
       boot_id         = COALESCE(excluded.boot_id, sessions.boot_id),
       device_sequence = COALESCE(excluded.device_sequence, sessions.device_sequence),
       sync_status     = excluded.sync_status,
       processed_at    = excluded.processed_at`,
    [
      session.id,
      session.startedAt,
      session.endedAt,
      session.durationMs,
      session.mode,
      session.alertCount,
      session.maxAlert,
      session.speechSegments,
      session.sensitivity,
      session.bootId ?? null,
      session.deviceSequence ?? null,
      now,
    ],
  );
}

/**
 * Count finalized local sessions not yet pushed to the device.
 * Active sessions (ended_at IS NULL) are excluded — they cannot be synced
 * until finalized.
 */
export async function getPendingSyncCount(): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM sessions WHERE synced_from_device = 0 AND ended_at IS NOT NULL',
  );
  return row?.count ?? 0;
}

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

/** Update transcript and timestamps for a session. */
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

function parseSession(r: any): Session {
  return {
    id: r.id,
    startedAt: r.started_at,
    endedAt: r.ended_at,
    durationMs: r.duration_ms,
    mode: r.mode,
    alertCount: r.alert_count,
    maxAlert: r.max_alert as AlertLevel,
    speechSegments: r.speech_segments,
    sensitivity: r.sensitivity,
    syncedFromDevice: r.synced_from_device === 1,
  };
}
