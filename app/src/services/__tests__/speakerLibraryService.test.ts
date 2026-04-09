import {
  speakerLibraryService,
  normalizeSpeakerName,
} from '../speakerLibraryService';

const mockSpeakers: any[] = [];

jest.mock('../../db/knownSpeakers', () => ({
  getKnownSpeakers: jest.fn(async () => mockSpeakers),
  addKnownSpeaker: jest.fn(async () => {}),
  touchKnownSpeaker: jest.fn(async () => {}),
  renameKnownSpeaker: jest.fn(async () => {}),
  deleteKnownSpeaker: jest.fn(async () => {}),
}));

beforeEach(() => {
  mockSpeakers.length = 0;
  speakerLibraryService.clearCache();
  jest.clearAllMocks();
});

describe('normalizeSpeakerName', () => {
  test('trims whitespace', () => {
    expect(normalizeSpeakerName('  Sarah  ')).toBe('Sarah');
  });

  test('collapses internal spaces', () => {
    expect(normalizeSpeakerName('Dr.  Kim')).toBe('Dr. Kim');
  });

  test('preserves casing', () => {
    expect(normalizeSpeakerName('Dr. Kim')).toBe('Dr. Kim');
  });

  test('returns empty string for whitespace-only input', () => {
    expect(normalizeSpeakerName('   ')).toBe('');
  });
});

describe('speakerLibraryService', () => {
  test('getLibraryNames returns empty array before loadLibrary', () => {
    expect(speakerLibraryService.getLibraryNames()).toEqual([]);
  });

  test('loadLibrary populates cache from DB', async () => {
    mockSpeakers.push(
      { id: 1, name: 'Sarah', createdAt: 1000, updatedAt: 1000, lastSeenAt: 2000, sessionCount: 3 },
      { id: 2, name: 'Dr. Kim', createdAt: 900, updatedAt: 900, lastSeenAt: 1500, sessionCount: 1 },
    );
    await speakerLibraryService.loadLibrary();
    expect(speakerLibraryService.getLibraryNames()).toEqual(['Sarah', 'Dr. Kim']);
  });

  test('addSpeaker normalizes, writes to DB, updates cache', async () => {
    await speakerLibraryService.loadLibrary();
    await speakerLibraryService.addSpeaker('  Carlos  ');
    const { addKnownSpeaker } = require('../../db/knownSpeakers');
    expect(addKnownSpeaker).toHaveBeenCalledWith('Carlos');
    expect(speakerLibraryService.getLibraryNames()).toContain('Carlos');
  });

  test('addSpeaker with whitespace-only name is no-op', async () => {
    await speakerLibraryService.loadLibrary();
    await speakerLibraryService.addSpeaker('   ');
    const { addKnownSpeaker } = require('../../db/knownSpeakers');
    expect(addKnownSpeaker).not.toHaveBeenCalled();
  });

  test('addSpeaker with duplicate name does not add to cache twice', async () => {
    mockSpeakers.push({ id: 1, name: 'Sarah', createdAt: 1000, updatedAt: 1000, lastSeenAt: null, sessionCount: 0 });
    await speakerLibraryService.loadLibrary();
    await speakerLibraryService.addSpeaker('Sarah');
    expect(speakerLibraryService.getLibraryNames().filter((n) => n === 'Sarah')).toHaveLength(1);
  });

  test('markSeenInSession calls touchKnownSpeaker with normalized name', async () => {
    await speakerLibraryService.loadLibrary();
    await speakerLibraryService.markSeenInSession('  Sarah  ');
    const { touchKnownSpeaker } = require('../../db/knownSpeakers');
    expect(touchKnownSpeaker).toHaveBeenCalledWith('Sarah');
  });

  test('loadLibrary failure leaves cache empty (best-effort)', async () => {
    const { getKnownSpeakers } = require('../../db/knownSpeakers');
    getKnownSpeakers.mockRejectedValueOnce(new Error('DB error'));
    await speakerLibraryService.loadLibrary(); // should not throw
    expect(speakerLibraryService.getLibraryNames()).toEqual([]);
  });

  test('addSpeaker DB failure leaves cache unchanged', async () => {
    await speakerLibraryService.loadLibrary();
    const { addKnownSpeaker } = require('../../db/knownSpeakers');
    addKnownSpeaker.mockRejectedValueOnce(new Error('DB error'));
    await speakerLibraryService.addSpeaker('Sarah');
    expect(speakerLibraryService.getLibraryNames()).not.toContain('Sarah');
  });
});
