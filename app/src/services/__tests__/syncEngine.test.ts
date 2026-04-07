import {
  loadSyncCheckpoint,
  saveSyncCheckpoint,
  clearSyncCheckpoint,
  advanceCheckpoint,
  beginSync,
  completeSync,
  failSync,
  resetSyncPhase,
} from '../syncEngine';
import { useSessionStore } from '../../stores/sessionStore';
import { SyncPhase } from '../../types';
import type { SyncCheckpoint } from '../../types';

// In-memory settings mock — mirrors the real saveSetting/loadAllSettings contract
const mockDb = new Map<string, string>();

jest.mock('../../db/settings', () => ({
  saveSetting: jest.fn(async (key: string, value: string) => {
    mockDb.set(key, value);
  }),
  loadAllSettings: jest.fn(async () => new Map(mockDb)),
}));

beforeEach(() => {
  mockDb.clear();
  // Reset store to defaults
  useSessionStore.setState({
    isSyncing: false,
    lastSyncAt: null,
    syncPhase: SyncPhase.IDLE,
    pendingSyncCount: 0,
  });
});

describe('checkpoint persistence', () => {
  const sampleCheckpoint: SyncCheckpoint = {
    deviceCheckpoint: 'cp-001',
    lastSuccessfulSyncAt: 1712400000000,
    lastImportedSessionId: 'session-42',
    syncAttemptCount: 3,
    lastSyncError: null,
  };

  test('saveSyncCheckpoint + loadSyncCheckpoint round-trip', async () => {
    await saveSyncCheckpoint(sampleCheckpoint);
    const loaded = await loadSyncCheckpoint();
    expect(loaded).toEqual(sampleCheckpoint);
  });

  test('loadSyncCheckpoint returns null on empty DB', async () => {
    const result = await loadSyncCheckpoint();
    expect(result).toBeNull();
  });

  test('loadSyncCheckpoint returns null on malformed JSON', async () => {
    mockDb.set('syncCheckpoint', 'not valid json {{{');
    const result = await loadSyncCheckpoint();
    expect(result).toBeNull();
  });

  test('loadSyncCheckpoint returns null when JSON lacks deviceCheckpoint', async () => {
    mockDb.set('syncCheckpoint', JSON.stringify({ foo: 'bar' }));
    const result = await loadSyncCheckpoint();
    expect(result).toBeNull();
  });

  test('loadSyncCheckpoint normalizes missing numeric fields to safe defaults', async () => {
    // Partial JSON with only deviceCheckpoint — everything else missing
    mockDb.set('syncCheckpoint', JSON.stringify({ deviceCheckpoint: 'cp-partial' }));
    const result = await loadSyncCheckpoint();
    expect(result).not.toBeNull();
    expect(result!.deviceCheckpoint).toBe('cp-partial');
    expect(result!.lastSuccessfulSyncAt).toBe(0);
    expect(result!.lastImportedSessionId).toBeNull();
    expect(result!.syncAttemptCount).toBe(0);
    expect(result!.lastSyncError).toBeNull();
  });

  test('loadSyncCheckpoint normalizes non-numeric syncAttemptCount to 0', async () => {
    mockDb.set('syncCheckpoint', JSON.stringify({
      deviceCheckpoint: 'cp-bad',
      syncAttemptCount: 'not-a-number',
    }));
    const result = await loadSyncCheckpoint();
    expect(result).not.toBeNull();
    expect(result!.syncAttemptCount).toBe(0);
  });

  test('beginSync after partial checkpoint does not produce NaN', async () => {
    // Save partial checkpoint with only deviceCheckpoint
    mockDb.set('syncCheckpoint', JSON.stringify({ deviceCheckpoint: 'cp-partial' }));
    await beginSync();
    const checkpoint = await loadSyncCheckpoint();
    expect(checkpoint).not.toBeNull();
    expect(Number.isNaN(checkpoint!.syncAttemptCount)).toBe(false);
    expect(checkpoint!.syncAttemptCount).toBe(1);
  });

  test('clearSyncCheckpoint removes checkpoint', async () => {
    await saveSyncCheckpoint(sampleCheckpoint);
    await clearSyncCheckpoint();
    const result = await loadSyncCheckpoint();
    expect(result).toBeNull();
  });

  test('advanceCheckpoint creates new checkpoint when none exists', async () => {
    await advanceCheckpoint('cp-new', 'session-99');
    const loaded = await loadSyncCheckpoint();
    expect(loaded).not.toBeNull();
    expect(loaded!.deviceCheckpoint).toBe('cp-new');
    expect(loaded!.lastImportedSessionId).toBe('session-99');
  });

  test('advanceCheckpoint updates existing checkpoint', async () => {
    await saveSyncCheckpoint(sampleCheckpoint);
    await advanceCheckpoint('cp-002', 'session-100');
    const loaded = await loadSyncCheckpoint();
    expect(loaded!.deviceCheckpoint).toBe('cp-002');
    expect(loaded!.lastImportedSessionId).toBe('session-100');
    // Preserves existing fields
    expect(loaded!.syncAttemptCount).toBe(sampleCheckpoint.syncAttemptCount);
  });
});

describe('sync phase transitions', () => {
  test('beginSync sets REQUESTING_MANIFEST and isSyncing true', async () => {
    await beginSync();
    const state = useSessionStore.getState();
    expect(state.syncPhase).toBe(SyncPhase.REQUESTING_MANIFEST);
    expect(state.isSyncing).toBe(true);
  });

  test('beginSync increments attempt count', async () => {
    await beginSync();
    const checkpoint1 = await loadSyncCheckpoint();
    expect(checkpoint1!.syncAttemptCount).toBe(1);

    await beginSync();
    const checkpoint2 = await loadSyncCheckpoint();
    expect(checkpoint2!.syncAttemptCount).toBe(2);
  });

  test('completeSync sets COMPLETE, isSyncing false, records timestamp', async () => {
    const before = Date.now();
    await beginSync();
    await completeSync();
    const state = useSessionStore.getState();
    expect(state.syncPhase).toBe(SyncPhase.COMPLETE);
    expect(state.isSyncing).toBe(false);
    expect(state.lastSyncAt).toBeGreaterThanOrEqual(before);
  });

  test('failSync sets FAILED, isSyncing false, records error', async () => {
    await beginSync();
    await failSync('network timeout');
    const state = useSessionStore.getState();
    expect(state.syncPhase).toBe(SyncPhase.FAILED);
    expect(state.isSyncing).toBe(false);

    const checkpoint = await loadSyncCheckpoint();
    expect(checkpoint!.lastSyncError).toBe('network timeout');
  });
});

describe('sync phase reset', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('completeSync auto-resets to IDLE after delay', async () => {
    await beginSync();
    await completeSync();
    expect(useSessionStore.getState().syncPhase).toBe(SyncPhase.COMPLETE);

    jest.advanceTimersByTime(3000);
    expect(useSessionStore.getState().syncPhase).toBe(SyncPhase.IDLE);
  });

  test('failSync auto-resets to IDLE after delay', async () => {
    await beginSync();
    await failSync('error');
    expect(useSessionStore.getState().syncPhase).toBe(SyncPhase.FAILED);

    jest.advanceTimersByTime(3000);
    expect(useSessionStore.getState().syncPhase).toBe(SyncPhase.IDLE);
  });

  test('beginSync cancels pending reset from previous sync', async () => {
    await beginSync();
    await completeSync();
    // Start a new sync before the reset fires
    await beginSync();
    jest.advanceTimersByTime(3000);
    // Should still be in REQUESTING_MANIFEST, not reset to IDLE
    expect(useSessionStore.getState().syncPhase).toBe(SyncPhase.REQUESTING_MANIFEST);
  });

  test('resetSyncPhase immediately sets IDLE', async () => {
    await beginSync();
    await completeSync();
    expect(useSessionStore.getState().syncPhase).toBe(SyncPhase.COMPLETE);
    resetSyncPhase();
    expect(useSessionStore.getState().syncPhase).toBe(SyncPhase.IDLE);
  });
});
