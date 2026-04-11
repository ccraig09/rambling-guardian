import { loadAllSettings, saveSetting, saveSettings } from '../settings';

const mockDb: Record<string, string> = {};

const mockRunAsync = jest.fn().mockImplementation(async (_sql: string, params: any[]) => {
  // INSERT OR REPLACE INTO settings(key, value) VALUES(?, ?)
  mockDb[params[0]] = params[1];
});

const mockGetAllAsync = jest.fn().mockImplementation(async () => {
  return Object.entries(mockDb).map(([key, value]) => ({ key, value }));
});

const mockWithTransactionAsync = jest.fn().mockImplementation(async (fn: () => Promise<void>) => {
  await fn();
});

jest.mock('../database', () => ({
  getDatabase: jest.fn().mockResolvedValue({
    getAllAsync: (...args: any[]) => mockGetAllAsync(...args),
    runAsync: (...args: any[]) => mockRunAsync(...args),
    withTransactionAsync: (...args: any[]) => mockWithTransactionAsync(...args),
  }),
}));

beforeEach(() => {
  for (const key of Object.keys(mockDb)) delete mockDb[key];
  mockRunAsync.mockClear();
  mockGetAllAsync.mockClear();
  mockWithTransactionAsync.mockClear();
});

describe('settings persistence', () => {
  test('empty DB returns empty Map', async () => {
    const result = await loadAllSettings();
    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(0);
  });

  test('saveSetting + loadAllSettings round-trip', async () => {
    await saveSetting('theme', 'dark');
    const result = await loadAllSettings();
    expect(result.get('theme')).toBe('dark');
  });

  test('saveSettings batch writes multiple keys', async () => {
    await saveSettings([
      ['sensitivity', '2'],
      ['alertThreshold', '30'],
      ['vibration', 'true'],
    ]);

    expect(mockWithTransactionAsync).toHaveBeenCalledTimes(1);
    expect(mockRunAsync).toHaveBeenCalledTimes(3);

    const result = await loadAllSettings();
    expect(result.get('sensitivity')).toBe('2');
    expect(result.get('alertThreshold')).toBe('30');
    expect(result.get('vibration')).toBe('true');
    expect(result.size).toBe(3);
  });

  test('saveSetting overwrites existing key', async () => {
    await saveSetting('theme', 'dark');
    await saveSetting('theme', 'light');
    const result = await loadAllSettings();
    expect(result.get('theme')).toBe('light');
    expect(result.size).toBe(1);
  });
});
