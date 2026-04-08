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
