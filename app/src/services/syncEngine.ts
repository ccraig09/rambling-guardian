/**
 * Sync Engine — app-side sync state machine with checkpoint persistence.
 *
 * Stateless functions that read/write to the settings DB (for durable
 * checkpoint storage) and the sessionStore (for reactive UI state).
 *
 * Phase transitions are explicit:
 *   beginSync → REQUESTING_MANIFEST
 *   startImport → IMPORTING
 *   startFinalizing → FINALIZING
 *   completeSync → COMPLETE
 *   failSync → FAILED
 */
import { saveSetting, loadAllSettings } from '../db/settings';
import { useSessionStore } from '../stores/sessionStore';
import type { SyncCheckpoint } from '../types';
import { SyncPhase } from '../types';

const CHECKPOINT_KEY = 'syncCheckpoint';

// -------------------------------------------------------------------
// Phase transitions
// -------------------------------------------------------------------

/** Begin a sync cycle. Sets phase to REQUESTING_MANIFEST, marks isSyncing. */
export async function beginSync(): Promise<void> {
  const store = useSessionStore.getState();
  store.setSyncPhase(SyncPhase.REQUESTING_MANIFEST);
  store.setIsSyncing(true);

  // Increment attempt count in checkpoint
  const checkpoint = await loadSyncCheckpoint();
  const updated: SyncCheckpoint = checkpoint
    ? { ...checkpoint, syncAttemptCount: checkpoint.syncAttemptCount + 1, lastSyncError: null }
    : {
        deviceCheckpoint: '',
        lastSuccessfulSyncAt: 0,
        lastImportedSessionId: null,
        syncAttemptCount: 1,
        lastSyncError: null,
      };
  await saveSyncCheckpoint(updated);
}

/** Transition to IMPORTING phase — call when actual item import begins. */
export function startImport(): void {
  useSessionStore.getState().setSyncPhase(SyncPhase.IMPORTING);
}

/** Transition to FINALIZING phase — checkpoint advance + cleanup. */
export function startFinalizing(): void {
  useSessionStore.getState().setSyncPhase(SyncPhase.FINALIZING);
}

/**
 * Mark sync as complete. Clears isSyncing, records timestamp.
 * Note: The caller (sync orchestrator) is responsible for resetting
 * syncPhase back to IDLE after the UI has displayed the result.
 */
export async function completeSync(): Promise<void> {
  const store = useSessionStore.getState();
  const now = Date.now();
  store.setSyncPhase(SyncPhase.COMPLETE);
  store.setIsSyncing(false);
  store.setLastSyncAt(now);

  const checkpoint = await loadSyncCheckpoint();
  if (checkpoint) {
    await saveSyncCheckpoint({ ...checkpoint, lastSuccessfulSyncAt: now, lastSyncError: null });
  }
}

/** Mark sync as failed. Records error, clears isSyncing. */
export async function failSync(error: string): Promise<void> {
  const store = useSessionStore.getState();
  store.setSyncPhase(SyncPhase.FAILED);
  store.setIsSyncing(false);

  const checkpoint = await loadSyncCheckpoint();
  if (checkpoint) {
    await saveSyncCheckpoint({ ...checkpoint, lastSyncError: error });
  }
}

// -------------------------------------------------------------------
// Checkpoint persistence
// -------------------------------------------------------------------

/** Load the sync checkpoint from the settings table. Returns null if missing or malformed. */
export async function loadSyncCheckpoint(): Promise<SyncCheckpoint | null> {
  try {
    const settings = await loadAllSettings();
    const raw = settings.get(CHECKPOINT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Basic shape validation
    if (typeof parsed.deviceCheckpoint !== 'string') return null;
    return parsed as SyncCheckpoint;
  } catch {
    return null;
  }
}

/** Persist the sync checkpoint as JSON in the settings table. */
export async function saveSyncCheckpoint(checkpoint: SyncCheckpoint): Promise<void> {
  await saveSetting(CHECKPOINT_KEY, JSON.stringify(checkpoint));
}

/** Clear the sync checkpoint — used when forgetting a device. */
export async function clearSyncCheckpoint(): Promise<void> {
  await saveSetting(CHECKPOINT_KEY, '');
}

/** Advance the checkpoint watermark after a successful session import. */
export async function advanceCheckpoint(
  deviceCheckpoint: string,
  sessionId: string,
): Promise<void> {
  const existing = await loadSyncCheckpoint();
  const updated: SyncCheckpoint = existing
    ? { ...existing, deviceCheckpoint, lastImportedSessionId: sessionId }
    : {
        deviceCheckpoint,
        lastSuccessfulSyncAt: 0,
        lastImportedSessionId: sessionId,
        syncAttemptCount: 0,
        lastSyncError: null,
      };
  await saveSyncCheckpoint(updated);
}
