import {
  getSummarySystemPrompt,
  buildSummaryUserMessage,
  truncateTranscript,
} from '../summaryPrompts';
import type { AlertEvent } from '../../types';
import { AlertLevel } from '../../types';

describe('getSummarySystemPrompt', () => {
  test('solo prompt mentions self-coaching', () => {
    const prompt = getSummarySystemPrompt('solo');
    expect(prompt.toLowerCase()).toMatch(/solo|self|you/);
  });

  test('with_others prompt mentions conversation', () => {
    const prompt = getSummarySystemPrompt('with_others');
    expect(prompt.toLowerCase()).toMatch(/conversation|others|speaker/);
  });

  test('presentation prompt mentions presentation', () => {
    const prompt = getSummarySystemPrompt('presentation');
    expect(prompt.toLowerCase()).toMatch(/present|audience|talk/);
  });

  test('null context falls back to solo', () => {
    const nullPrompt = getSummarySystemPrompt(null);
    const soloPrompt = getSummarySystemPrompt('solo');
    expect(nullPrompt).toBe(soloPrompt);
  });

  test('all prompts request 3-5 sentences', () => {
    for (const ctx of ['solo', 'with_others', 'presentation'] as const) {
      expect(getSummarySystemPrompt(ctx)).toMatch(/3-5 sentences|3 to 5 sentences/i);
    }
  });

  test('all prompts request plain text', () => {
    for (const ctx of ['solo', 'with_others', 'presentation'] as const) {
      expect(getSummarySystemPrompt(ctx).toLowerCase()).toMatch(/plain text|no markdown/);
    }
  });
});

describe('buildSummaryUserMessage', () => {
  const baseInput = {
    sessionContext: 'with_others' as const,
    durationMs: 12 * 60 * 1000 + 34 * 1000,
    alertCount: 4,
    maxAlertLevel: AlertLevel.MODERATE,
    speakerCount: 3,
    transcriptText: 'Hello, this is the transcript.',
    alertEvents: [
      { id: 1, sessionId: 's1', timestamp: 135000, alertLevel: AlertLevel.GENTLE, durationAtAlert: 7000 } as AlertEvent,
      { id: 2, sessionId: 's1', timestamp: 242000, alertLevel: AlertLevel.MODERATE, durationAtAlert: 15000 } as AlertEvent,
    ],
  };

  test('includes session context', () => {
    const msg = buildSummaryUserMessage(baseInput);
    expect(msg).toMatch(/with_others/);
  });

  test('includes duration in minutes and seconds', () => {
    const msg = buildSummaryUserMessage(baseInput);
    expect(msg).toMatch(/12 minutes/);
    expect(msg).toMatch(/34 seconds/);
  });

  test('includes alert count and max level', () => {
    const msg = buildSummaryUserMessage(baseInput);
    expect(msg).toMatch(/4 alerts/);
    expect(msg).toMatch(/moderate/i);
  });

  test('includes speaker count', () => {
    const msg = buildSummaryUserMessage(baseInput);
    expect(msg).toMatch(/3 speakers|Speakers: 3/i);
  });

  test('includes formatted alert timeline', () => {
    const msg = buildSummaryUserMessage(baseInput);
    expect(msg).toMatch(/2:15/); // 135000ms = 2:15
    expect(msg).toMatch(/Gentle/i);
  });

  test('includes transcript text', () => {
    const msg = buildSummaryUserMessage(baseInput);
    expect(msg).toMatch(/Hello, this is the transcript/);
  });

  test('handles null session context as unknown', () => {
    const msg = buildSummaryUserMessage({ ...baseInput, sessionContext: null });
    expect(msg.toLowerCase()).toMatch(/unknown|unclassified/);
  });

  test('handles empty alert events', () => {
    const msg = buildSummaryUserMessage({ ...baseInput, alertEvents: [], alertCount: 0 });
    expect(msg).toMatch(/no alerts|0 alerts/i);
  });
});

describe('truncateTranscript', () => {
  test('returns transcript unchanged when under limit', () => {
    const short = 'This is a short transcript.';
    expect(truncateTranscript(short, 100)).toBe(short);
  });

  test('keeps only the last N characters when over limit', () => {
    const long = 'a'.repeat(1000) + 'b'.repeat(500);
    const result = truncateTranscript(long, 500);
    expect(result.length).toBeLessThanOrEqual(500 + 50); // allow for prefix marker
    expect(result.endsWith('b'.repeat(500))).toBe(true);
  });

  test('prepends a truncation marker when truncated', () => {
    const long = 'x'.repeat(1000);
    const result = truncateTranscript(long, 500);
    expect(result).toMatch(/\[truncated/i);
  });
});
