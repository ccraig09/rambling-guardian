import {
  RETENTION_DEFAULTS,
  calculateRetentionUntil,
  assignRetentionTier,
  runPruneNow,
} from '../retentionService';
import { RetentionTier } from '../../types';

jest.mock('../../db/sessions', () => ({
  getExpiredSessions: jest.fn(async () => []),
  updateRetention: jest.fn(async () => {}),
  deleteSession: jest.fn(async () => {}),
}));

jest.mock('../../db/settings', () => ({
  saveSetting: jest.fn(async () => {}),
  loadAllSettings: jest.fn(async () => new Map()),
}));

describe('retentionService', () => {
  test('RETENTION_DEFAULTS has correct tier windows', () => {
    expect(RETENTION_DEFAULTS[RetentionTier.METADATA]).toBeNull();
    expect(RETENTION_DEFAULTS[RetentionTier.TRANSCRIPT]).toBeNull();
    expect(RETENTION_DEFAULTS[RetentionTier.ALERT_CLIPS]).toBe(30 * 24 * 60 * 60 * 1000);
    expect(RETENTION_DEFAULTS[RetentionTier.FULL_AUDIO]).toBe(7 * 24 * 60 * 60 * 1000);
  });

  test('calculateRetentionUntil returns null for tiers 1 and 2', () => {
    expect(calculateRetentionUntil(RetentionTier.METADATA, 1000)).toBeNull();
    expect(calculateRetentionUntil(RetentionTier.TRANSCRIPT, 1000)).toBeNull();
  });

  test('calculateRetentionUntil returns ended_at + window for tier 3', () => {
    const endedAt = 1712400000000;
    const result = calculateRetentionUntil(RetentionTier.ALERT_CLIPS, endedAt);
    expect(result).toBe(endedAt + 30 * 24 * 60 * 60 * 1000);
  });

  test('calculateRetentionUntil returns ended_at + window for tier 4', () => {
    const endedAt = 1712400000000;
    const result = calculateRetentionUntil(RetentionTier.FULL_AUDIO, endedAt);
    expect(result).toBe(endedAt + 7 * 24 * 60 * 60 * 1000);
  });

  test('assignRetentionTier returns METADATA when no artifacts', () => {
    expect(assignRetentionTier({ hasTranscript: false, hasClips: false, hasFullAudio: false }))
      .toBe(RetentionTier.METADATA);
  });

  test('assignRetentionTier returns TRANSCRIPT when transcript exists', () => {
    expect(assignRetentionTier({ hasTranscript: true, hasClips: false, hasFullAudio: false }))
      .toBe(RetentionTier.TRANSCRIPT);
  });

  test('assignRetentionTier returns highest tier present', () => {
    expect(assignRetentionTier({ hasTranscript: true, hasClips: true, hasFullAudio: true }))
      .toBe(RetentionTier.FULL_AUDIO);
  });

  test('runPruneNow returns 0 when no expired sessions', async () => {
    const count = await runPruneNow();
    expect(count).toBe(0);
  });

  test('runPruneNow prunes expired sessions', async () => {
    const { getExpiredSessions, updateRetention } = require('../../db/sessions');
    getExpiredSessions.mockResolvedValueOnce([
      { id: 'session-1', retentionTier: RetentionTier.FULL_AUDIO, retentionUntil: 1000 },
    ]);

    const count = await runPruneNow();
    expect(count).toBe(1);
    expect(updateRetention).toHaveBeenCalledWith('session-1', RetentionTier.TRANSCRIPT, null);
  });
});
