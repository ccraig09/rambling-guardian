import { upsertDeviceSession, getPendingSyncCount } from '../sessions';

const mockRunAsync = jest.fn().mockResolvedValue({ changes: 1, lastInsertRowId: 1 });
const mockGetFirstAsync = jest.fn().mockResolvedValue({ count: 0 });

jest.mock('../database', () => ({
  getDatabase: jest.fn().mockResolvedValue({
    runAsync: (...args: any[]) => mockRunAsync(...args),
    getFirstAsync: (...args: any[]) => mockGetFirstAsync(...args),
    getAllAsync: jest.fn().mockResolvedValue([]),
    withTransactionAsync: jest.fn(),
  }),
}));

beforeEach(() => {
  mockRunAsync.mockClear();
  mockGetFirstAsync.mockClear();
});

describe('upsertDeviceSession', () => {
  const sampleSession = {
    id: 'device-session-001',
    startedAt: 1712400000000,
    endedAt: 1712403600000,
    durationMs: 3600000,
    mode: 'solo' as const,
    alertCount: 5,
    maxAlert: 3,
    speechSegments: 12,
    sensitivity: 2,
  };

  test('calls runAsync with INSERT ON CONFLICT SQL', async () => {
    await upsertDeviceSession(sampleSession);

    expect(mockRunAsync).toHaveBeenCalledTimes(1);
    const sql = mockRunAsync.mock.calls[0][0] as string;
    expect(sql).toContain('INSERT INTO sessions');
    expect(sql).toContain('ON CONFLICT(id) DO UPDATE SET');
  });

  test('passes synced_from_device = 1 in the values', async () => {
    await upsertDeviceSession(sampleSession);

    const sql = mockRunAsync.mock.calls[0][0] as string;
    expect(sql).toContain('synced_from_device');
    // The VALUES clause includes 1 for synced_from_device
    expect(sql).toContain('VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)');
  });

  test('passes all session fields as params', async () => {
    await upsertDeviceSession(sampleSession);

    const params = mockRunAsync.mock.calls[0][1] as any[];
    expect(params).toEqual([
      'device-session-001',
      1712400000000,
      1712403600000,
      3600000,
      'solo',
      5,
      3,
      12,
      2,
    ]);
  });
});

describe('getPendingSyncCount', () => {
  test('calls getFirstAsync with correct WHERE clause', async () => {
    await getPendingSyncCount();

    expect(mockGetFirstAsync).toHaveBeenCalledTimes(1);
    const sql = mockGetFirstAsync.mock.calls[0][0] as string;
    expect(sql).toContain('synced_from_device = 0');
    expect(sql).toContain('ended_at IS NOT NULL');
  });

  test('returns 0 when count is 0', async () => {
    mockGetFirstAsync.mockResolvedValueOnce({ count: 0 });
    const count = await getPendingSyncCount();
    expect(count).toBe(0);
  });

  test('returns 0 when row is null', async () => {
    mockGetFirstAsync.mockResolvedValueOnce(null);
    const count = await getPendingSyncCount();
    expect(count).toBe(0);
  });

  test('returns count from DB row', async () => {
    mockGetFirstAsync.mockResolvedValueOnce({ count: 7 });
    const count = await getPendingSyncCount();
    expect(count).toBe(7);
  });
});

describe('upsert idempotency', () => {
  const session = {
    id: 'device-session-replay',
    startedAt: 1712400000000,
    endedAt: 1712403600000,
    durationMs: 3600000,
    mode: 'solo' as const,
    alertCount: 3,
    maxAlert: 2,
    speechSegments: 8,
    sensitivity: 1,
  };

  test('replaying the same session twice produces identical SQL', async () => {
    await upsertDeviceSession(session);
    const firstCall = mockRunAsync.mock.calls[0];

    mockRunAsync.mockClear();
    await upsertDeviceSession(session);
    const secondCall = mockRunAsync.mock.calls[0];

    expect(firstCall[0]).toBe(secondCall[0]); // Same SQL
    expect(firstCall[1]).toEqual(secondCall[1]); // Same params
  });

  test('ON CONFLICT sets synced_from_device = 1 in UPDATE clause', async () => {
    await upsertDeviceSession(session);
    const sql = mockRunAsync.mock.calls[0][0] as string;
    expect(sql).toContain('synced_from_device = 1');
  });
});
