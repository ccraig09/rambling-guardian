// app/src/services/__tests__/voiceProfileService.test.ts
import { ensureProfileExists, getProfile, getProfileStatus } from '../voiceProfileService';

const mockProfiles: any[] = [];
const mockSamples = [
  { id: 1, confirmed: 1 },
  { id: 2, confirmed: 1 },
  { id: 3, confirmed: 1 },
];

jest.mock('../../db/voiceProfiles', () => ({
  getVoiceProfile: jest.fn(async () => mockProfiles[0] ?? null),
  createVoiceProfile: jest.fn(async (sampleIds: number[]) => {
    const profile = { id: 1, label: 'Me', status: 'enrolled', enrolledSampleIds: sampleIds };
    mockProfiles.push(profile);
    return 1;
  }),
}));

jest.mock('../../db/voiceSamples', () => ({
  getVoiceSamples: jest.fn(async () => mockSamples.map((s) => ({
    id: s.id, recordedAt: 1000, filePath: '/test.wav', durationMs: 5000, confirmed: s.confirmed === 1,
  }))),
}));

beforeEach(() => {
  mockProfiles.length = 0;
  jest.clearAllMocks();
});

describe('voiceProfileService', () => {
  test('getProfileStatus returns none when no profile exists', async () => {
    const status = await getProfileStatus();
    expect(status).toBe('none');
  });

  test('ensureProfileExists creates profile from confirmed samples', async () => {
    await ensureProfileExists();
    expect(mockProfiles).toHaveLength(1);
    expect(mockProfiles[0].enrolledSampleIds).toEqual([1, 2, 3]);
  });

  test('ensureProfileExists is idempotent', async () => {
    await ensureProfileExists();
    await ensureProfileExists();
    const { createVoiceProfile } = require('../../db/voiceProfiles');
    expect(createVoiceProfile).toHaveBeenCalledTimes(1);
  });

  test('getProfileStatus returns enrolled after creation', async () => {
    await ensureProfileExists();
    const status = await getProfileStatus();
    expect(status).toBe('enrolled');
  });
});
