import { getDatabase } from './database';
import type { Session, AlertEvent } from '../types';
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

/** Get all sessions ordered newest first */
export async function getSessions(limit = 50): Promise<Session[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>(
    'SELECT * FROM sessions ORDER BY started_at DESC LIMIT ?',
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
    'SELECT COUNT(*) as count, SUM(duration_ms) as total_ms, SUM(alert_count) as total_alerts FROM sessions WHERE ended_at IS NOT NULL',
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
