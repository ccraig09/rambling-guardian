import { getNotificationPermissionStatus } from '../notifications';

// Mock expo-notifications
const mockGetPermissionsAsync = jest.fn();

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: (...args: any[]) => mockGetPermissionsAsync(...args),
  setNotificationHandler: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
  getAllScheduledNotificationsAsync: jest.fn().mockResolvedValue([]),
  SchedulableTriggerInputTypes: { DAILY: 'daily' },
}));

// Mock react-native Platform
jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

// Mock DB modules that notifications.ts imports at module level
jest.mock('../../db/database', () => ({
  getDatabase: jest.fn().mockResolvedValue({
    runAsync: jest.fn(),
    getAllAsync: jest.fn().mockResolvedValue([]),
    getFirstAsync: jest.fn().mockResolvedValue(null),
  }),
}));

jest.mock('../../db/exercises', () => ({
  getCurrentStreak: jest.fn().mockResolvedValue(0),
}));

beforeEach(() => {
  mockGetPermissionsAsync.mockClear();
});

describe('getNotificationPermissionStatus', () => {
  test('returns "granted" when OS says granted', async () => {
    mockGetPermissionsAsync.mockResolvedValue({ status: 'granted' });
    const result = await getNotificationPermissionStatus();
    expect(result).toBe('granted');
  });

  test('returns "denied" when OS says denied', async () => {
    mockGetPermissionsAsync.mockResolvedValue({ status: 'denied' });
    const result = await getNotificationPermissionStatus();
    expect(result).toBe('denied');
  });

  test('returns "undetermined" for other statuses', async () => {
    mockGetPermissionsAsync.mockResolvedValue({ status: 'undetermined' });
    const result = await getNotificationPermissionStatus();
    expect(result).toBe('undetermined');
  });
});
