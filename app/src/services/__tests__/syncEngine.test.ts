import {
  loadSyncCheckpoint,
  saveSyncCheckpoint,
  clearSyncCheckpoint,
  advanceCheckpoint,
  beginSync,
  completeSync,
  failSync,
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
