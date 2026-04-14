import { formatSessionAsMarkdown, buildDriveFileName, buildDriveFolderPath } from '../sessionMarkdown';
import { AlertLevel } from '../../types';
import type { Session, AlertEvent } from '../../types';

const baseSession: Session = {
  id: 'session-1234567890',
  startedAt: new Date('2026-04-13T09:30:00.000Z').getTime(),
  endedAt: new Date('2026-04-13T09:42:34.000Z').getTime(),
  durationMs: 12 * 60 * 1000 + 34 * 1000,
  mode: 'solo',
  alertCount: 2,
  maxAlert: AlertLevel.MODERATE,
  speechSegments: 5,
  sensitivity: 1,
  syncedFromDevice: false,
  sessionContext: 'with_others',
  sessionContextSource: 'auto',
  transcript: 'Hello world.',
  transcriptTimestamps: null,
  speakerMap: null,
  summary: 'Good session.',
  summaryStatus: 'complete',
  summaryGeneratedAt: Date.now(),
  driveFileId: null,
  backupStatus: null,
};

const events: AlertEvent[] = [
  { id: 1, sessionId: 'session-1234567890', timestamp: 45000, alertLevel: AlertLevel.GENTLE, durationAtAlert: 32000 },
  { id: 2, sessionId: 'session-1234567890', timestamp: 118000, alertLevel: AlertLevel.MODERATE, durationAtAlert: 47000 },
];

describe('formatSessionAsMarkdown', () => {
  it('includes session metadata header', () => {
    const md = formatSessionAsMarkdown(baseSession, []);
    expect(md).toContain('# Session —');
    expect(md).toContain('12 minutes 34 seconds');
    expect(md).toContain('With Others');
  });

  it('includes flat transcript when no timestamps', () => {
    const md = formatSessionAsMarkdown(baseSession, []);
    expect(md).toContain('## Transcript');
    expect(md).toContain('Hello world.');
  });

  it('includes AI summary when complete', () => {
    const md = formatSessionAsMarkdown(baseSession, []);
    expect(md).toContain('## AI Summary');
    expect(md).toContain('Good session.');
  });

  it('includes alert timeline when events exist', () => {
    const md = formatSessionAsMarkdown(baseSession, events);
    expect(md).toContain('## Alert Timeline');
    expect(md).toContain('0:45');
    expect(md).toContain('Gentle');
    expect(md).toContain('32s');
  });

  it('omits transcript section when transcript is null', () => {
    const s = { ...baseSession, transcript: null, transcriptTimestamps: null };
    const md = formatSessionAsMarkdown(s, []);
    expect(md).not.toContain('## Transcript');
  });

  it('omits summary section when summaryStatus is not complete', () => {
    const s = { ...baseSession, summary: null, summaryStatus: null };
    const md = formatSessionAsMarkdown(s, []);
    expect(md).not.toContain('## AI Summary');
  });

  it('omits alert timeline section when no events', () => {
    const md = formatSessionAsMarkdown(baseSession, []);
    expect(md).not.toContain('## Alert Timeline');
  });

  it('renders speaker-attributed turns from transcriptTimestamps', () => {
    const segments = JSON.stringify([
      { speaker: null, start: 3000, text: 'Hello there', isFinal: true },
      { speaker: 'Speaker 0', start: 74000, text: 'Response here', isFinal: true },
    ]);
    const speakerMap = JSON.stringify([
      { diarizedLabel: 'Speaker 0', displayName: 'Alex' },
    ]);
    const s = { ...baseSession, transcriptTimestamps: segments, speakerMap };
    const md = formatSessionAsMarkdown(s, []);
    expect(md).toContain('**Unknown**');
    expect(md).toContain('**Alex**');
    expect(md).toContain('Hello there');
  });

  it('skips non-final segments in speaker turns', () => {
    const segments = JSON.stringify([
      { speaker: null, start: 3000, text: 'Interim text', isFinal: false },
      { speaker: null, start: 3500, text: 'Final text', isFinal: true },
    ]);
    const s = { ...baseSession, transcriptTimestamps: segments, speakerMap: null };
    const md = formatSessionAsMarkdown(s, []);
    expect(md).not.toContain('Interim text');
    expect(md).toContain('Final text');
  });

  it('falls back to flat transcript when transcriptTimestamps parse fails', () => {
    const s = { ...baseSession, transcriptTimestamps: 'INVALID JSON', transcript: 'Fallback text' };
    const md = formatSessionAsMarkdown(s, []);
    expect(md).toContain('Fallback text');
  });
});

describe('buildDriveFileName', () => {
  it('formats file name with date, time, and context', () => {
    const name = buildDriveFileName(baseSession);
    // Should match YYYY-MM-DD_HH-MM_context.md
    expect(name).toMatch(/^2026-04-13_\d{2}-\d{2}_with-others\.md$/);
  });

  it('uses session fallback when context is null', () => {
    const s = { ...baseSession, sessionContext: null };
    const name = buildDriveFileName(s);
    expect(name).toContain('_session.md');
  });

  it('ends with .md extension', () => {
    const name = buildDriveFileName(baseSession);
    expect(name.endsWith('.md')).toBe(true);
  });
});

describe('buildDriveFolderPath', () => {
  it('returns correct year and zero-padded month', () => {
    const path = buildDriveFolderPath(baseSession);
    expect(path.year).toBe('2026');
    // Month depends on the local timezone — just check it's a 2-digit string
    expect(path.month).toMatch(/^\d{2}$/);
  });
});
