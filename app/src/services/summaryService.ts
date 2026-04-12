/**
 * Summary Service — D.6 v1.
 *
 * Orchestrates summary generation:
 *   1. Load session + alert events from DB
 *   2. Guard against duplicate/invalid generation
 *   3. Mark as generating (in-flight protection)
 *   4. Assemble prompt + user message
 *   5. Call Anthropic via the provider adapter
 *   6. Persist result (complete) or mark failed
 */
import { createMessage } from './anthropicClient';
import { MAX_INPUT_TOKENS } from '../config/anthropic';
import {
  getSessionById,
  getAlertEvents,
  updateSummary,
  updateSummaryStatus,
} from '../db/sessions';
import {
  getSummarySystemPrompt,
  buildSummaryUserMessage,
  truncateTranscript,
} from './summaryPrompts';

/**
 * Extended session shape that includes D.1/D.2 transcript + speaker fields
 * not yet reflected in the core Session interface. getSessionById returns
 * SELECT * so all columns are present at runtime.
 */
interface SessionWithTranscript {
  id: string;
  durationMs: number;
  alertCount: number;
  maxAlert: import('../types').AlertLevel;
  sessionContext: import('../types').SessionContext | null;
  summary: string | null;
  summaryStatus: string | null;
  summaryGeneratedAt: number | null;
  transcript: string | null;
  speakerMap: string | null;
}

/** Minimum session duration required to generate a summary. */
export const SHORT_SESSION_MIN_MS = 30_000;

/** Rough char-to-token ratio for truncation (1 token ≈ 4 chars). */
const CHARS_PER_TOKEN = 4;

/**
 * Check whether a summary can be generated for this session.
 * Returns null if eligible, or a string reason if not.
 */
export function summaryEligibilityReason(session: {
  durationMs: number;
  transcript: string | null;
  summary: string | null;
  summaryStatus: string | null;
}): string | null {
  if (session.summaryStatus === 'generating') {
    return 'Summary generation is already in progress.';
  }
  if (session.summary && session.summaryStatus === 'complete') {
    return 'Summary already exists for this session.';
  }
  if (!session.transcript || session.transcript.length === 0) {
    return 'No transcript available for this session.';
  }
  if (session.durationMs < SHORT_SESSION_MIN_MS) {
    return 'Session is too short for a summary.';
  }
  return null;
}

/**
 * Generate a summary for the given session.
 *
 * Throws if the session is ineligible (duplicate, missing transcript,
 * too short) or if the API call fails. On API failure, marks
 * summary_status = 'failed' before throwing.
 */
export async function generateSummary(sessionId: string): Promise<void> {
  // Cast to extended type — getSessionById uses SELECT * so all DB columns
  // are present at runtime, including transcript + speaker_map from D.1/D.2.
  const session = (await getSessionById(sessionId)) as SessionWithTranscript | null;
  if (!session) throw new Error(`Session not found: ${sessionId}`);

  const ineligible = summaryEligibilityReason(session);
  if (ineligible) throw new Error(ineligible);

  // Mark as generating — in-flight protection across taps
  await updateSummaryStatus(sessionId, 'generating');

  try {
    const alertEvents = await getAlertEvents(sessionId);

    // Count distinct speakers from speaker_map if available, else 1 default
    let speakerCount = 1;
    if (session.speakerMap) {
      try {
        const map = JSON.parse(session.speakerMap) as Record<string, unknown>;
        speakerCount = Math.max(1, Object.keys(map).length);
      } catch {
        speakerCount = 1;
      }
    }

    // Deterministic truncation: preserve metadata + alerts, truncate
    // transcript tail only if the assembled char count would exceed budget
    const maxTranscriptChars = MAX_INPUT_TOKENS * CHARS_PER_TOKEN;
    const transcriptText = truncateTranscript(
      session.transcript ?? '',
      maxTranscriptChars,
    );

    const userMessage = buildSummaryUserMessage({
      sessionContext: session.sessionContext,
      durationMs: session.durationMs,
      alertCount: session.alertCount,
      maxAlertLevel: session.maxAlert,
      speakerCount,
      transcriptText,
      alertEvents,
    });

    const systemPrompt = getSummarySystemPrompt(session.sessionContext);
    const summaryText = await createMessage(systemPrompt, userMessage);

    await updateSummary(sessionId, summaryText, Date.now());
  } catch (e) {
    await updateSummaryStatus(sessionId, 'failed').catch(() => {
      /* best effort — original error is the real failure */
    });
    throw e;
  }
}
