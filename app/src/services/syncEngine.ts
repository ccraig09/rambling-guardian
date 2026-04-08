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

/** How long COMPLETE/FAILED states remain visible before resetting to IDLE (ms). */
const TERMINAL_DISPLAY_MS = 3000;

/** Timer handle for the pending reset — allows cancellation if a new sync starts. */
let resetTimer: ReturnType<typeof setTimeout> | null = null;

/** Schedule a reset from a terminal phase (COMPLETE/FAILED) back to IDLE. */
function schedulePhaseReset(): void {
  if (resetTimer) clearTimeout(resetTimer);
  resetTimer = setTimeout(() => {
    resetTimer = null;
    const { syncPhase } = useSessionStore.getState();
    // Only reset if still in a terminal state — a new sync may have started
    if (syncPhase === SyncPhase.COMPLETE || syncPhase === SyncPhase.FAILED) {
      useSessionStore.getState().setSyncPhase(SyncPhase.IDLE);
    }
  }, TERMINAL_DISPLAY_MS);
}

/** Immediately reset sync phase to IDLE. Cancels any pending auto-reset. */
export function resetSyncPhase(): void {
  if (resetTimer) { clearTimeout(resetTimer); resetTimer = null; }
  useSessionStore.getState().setSyncPhase(SyncPhase.IDLE);
}

// -------------------------------------------------------------------
// Phase transitions
// -------------------------------------------------------------------

/** Begin a sync cycle. Sets phase to REQUESTING_MANIFEST, marks isSyncing. */
export async function beginSync(): Promise<void> {
  // Cancel any pending auto-reset from a previous sync's terminal state
  if (resetTimer) { clearTimeout(resetTimer); resetTimer = null; }
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

/** Mark sync as complete. Clears isSyncing, records timestamp. Auto-resets to IDLE after display. */
export async function completeSync(): Promise<void> {
  const store = useSessionStore.getState();
  const now = Date.now();
  store.setSyncPhase(SyncPhase.COMPLETE);
  store.setIsSyncing(false);
  store.setLastSyncAt(now);
  schedulePhaseReset();

  const checkpoint = await loadSyncCheckpoint();
  if (checkpoint) {
    await saveSyncCheckpoint({ ...checkpoint, lastSuccessfulSyncAt: now, lastSyncError: null });
  }
}

/** Mark sync as failed. Records error, clears isSyncing. Auto-resets to IDLE after display. */
export async function failSync(error: string): Promise<void> {
  const store = useSessionStore.getState();
  store.setSyncPhase(SyncPhase.FAILED);
  store.setIsSyncing(false);
  schedulePhaseReset();

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
    // Must have a string deviceCheckpoint to be considered valid at all
    if (typeof parsed.deviceCheckpoint !== 'string') return null;
    // Normalize all fields to safe defaults — prevents partial JSON from
    // poisoning sync state (e.g., undefined + 1 → NaN)
    return {
      deviceCheckpoint: parsed.deviceCheckpoint,
      lastSuccessfulSyncAt: typeof parsed.lastSuccessfulSyncAt === 'number' ? parsed.lastSuccessfulSyncAt : 0,
      lastImportedSessionId: typeof parsed.lastImportedSessionId === 'string' ? parsed.lastImportedSessionId : null,
      syncAttemptCount: typeof parsed.syncAttemptCount === 'number' && !Number.isNaN(parsed.syncAttemptCount) ? parsed.syncAttemptCount : 0,
      lastSyncError: typeof parsed.lastSyncError === 'string' ? parsed.lastSyncError : null,
    };
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

/** @deprecated Use syncCheckpointService.advanceToCommitted() instead. Kept for test compatibility. */
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
