import {
  advanceToReceived,
  advanceToProcessed,
  advanceToAcked,
  advanceToCommitted,
  markFailed,
  getWatermark,
} from '../syncCheckpointService';

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
