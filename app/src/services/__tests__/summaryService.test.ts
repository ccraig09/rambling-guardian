jest.mock('../../db/settings', () => ({
  loadAllSettings: jest.fn().mockResolvedValue(new Map()),
  saveSetting: jest.fn().mockResolvedValue(undefined),
  saveSettings: jest.fn().mockResolvedValue(undefined),
}));

const mockCreateMessage = jest.fn();
jest.mock('../anthropicClient', () => ({
  createMessage: (...args: unknown[]) => mockCreateMessage(...args),
}));

const mockUpdateSummary = jest.fn().mockResolvedValue(undefined);
const mockUpdateSummaryStatus = jest.fn().mockResolvedValue(undefined);
const mockGetAlertEvents = jest.fn().mockResolvedValue([]);
const mockGetSessionById = jest.fn();

jest.mock('../../db/sessions', () => ({
  updateSummary: (...args: unknown[]) => mockUpdateSummary(...args),
  updateSummaryStatus: (...args: unknown[]) => mockUpdateSummaryStatus(...args),
  getAlertEvents: (...args: unknown[]) => mockGetAlertEvents(...args),
  getSessionById: (...args: unknown[]) => mockGetSessionById(...args),
}));

import { generateSummary, SHORT_SESSION_MIN_MS } from '../summaryService';
import { AlertLevel } from '../../types';

const baseSession = {
  id: 's1',
  startedAt: 0,
  endedAt: 0,
  durationMs: 5 * 60 * 1000,
  mode: 'solo' as const,
  alertCount: 0,
  maxAlert: AlertLevel.NONE,
  speechSegments: 10,
  sensitivity: 1,
  syncedFromDevice: false,
  transcript: 'Hello world, this is a transcript.',
  transcriptTimestamps: null,
  retentionTier: null,
  audioRetention: null,
  bootId: null,
  deviceSequence: null,
  speakerMap: null,
  sessionContext: 'solo' as const,
  sessionContextSource: 'auto' as const,
  summary: null,
  summaryStatus: null,
  summaryGeneratedAt: null,
};

describe('generateSummary', () => {
  beforeEach(() => {
    mockCreateMessage.mockReset().mockResolvedValue('Generated summary text.');
    mockUpdateSummary.mockClear();
    mockUpdateSummaryStatus.mockClear();
    mockGetAlertEvents.mockReset().mockResolvedValue([]);
    mockGetSessionById.mockReset().mockResolvedValue(baseSession);
  });

  test('successful generation updates summary with complete status', async () => {
    await generateSummary('s1');
    expect(mockUpdateSummaryStatus).toHaveBeenCalledWith('s1', 'generating');
    expect(mockCreateMessage).toHaveBeenCalledTimes(1);
    expect(mockUpdateSummary).toHaveBeenCalledWith(
      's1',
      'Generated summary text.',
      expect.any(Number),
    );
  });

  test('failed API call marks status as failed and does not update summary', async () => {
    mockCreateMessage.mockRejectedValueOnce(new Error('API error'));
    await expect(generateSummary('s1')).rejects.toThrow('API error');
    expect(mockUpdateSummaryStatus).toHaveBeenCalledWith('s1', 'generating');
    expect(mockUpdateSummaryStatus).toHaveBeenCalledWith('s1', 'failed');
    expect(mockUpdateSummary).not.toHaveBeenCalled();
  });

  test('refuses to generate when already generating (in-flight protection)', async () => {
    mockGetSessionById.mockResolvedValueOnce({
      ...baseSession,
      summaryStatus: 'generating',
    });
    await expect(generateSummary('s1')).rejects.toThrow(/already|in progress/i);
    expect(mockCreateMessage).not.toHaveBeenCalled();
  });

  test('refuses to generate when summary already complete', async () => {
    mockGetSessionById.mockResolvedValueOnce({
      ...baseSession,
      summary: 'Existing summary.',
      summaryStatus: 'complete',
    });
    await expect(generateSummary('s1')).rejects.toThrow(/already|exists/i);
    expect(mockCreateMessage).not.toHaveBeenCalled();
  });

  test('refuses to generate when session has no transcript', async () => {
    mockGetSessionById.mockResolvedValueOnce({
      ...baseSession,
      transcript: null,
    });
    await expect(generateSummary('s1')).rejects.toThrow(/transcript/i);
    expect(mockCreateMessage).not.toHaveBeenCalled();
  });

  test('refuses to generate when session is too short', async () => {
    mockGetSessionById.mockResolvedValueOnce({
      ...baseSession,
      durationMs: SHORT_SESSION_MIN_MS - 1,
    });
    await expect(generateSummary('s1')).rejects.toThrow(/short/i);
    expect(mockCreateMessage).not.toHaveBeenCalled();
  });

  test('retry after failure succeeds and updates to complete', async () => {
    mockGetSessionById.mockResolvedValueOnce({
      ...baseSession,
      summaryStatus: 'failed',
    });
    await generateSummary('s1');
    expect(mockUpdateSummary).toHaveBeenCalledWith(
      's1',
      'Generated summary text.',
      expect.any(Number),
    );
  });
});
