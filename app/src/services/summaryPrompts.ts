/**
 * Summary prompt templates — D.6 v1.
 *
 * Three context-aware system prompts + one user message assembler.
 * All pure functions. No side effects, no store access.
 */
import type { SessionContext, AlertEvent } from '../types';
import { AlertLevel } from '../types';

// ============================================
// System prompts
// ============================================

const SOLO_PROMPT = `You are a supportive speech coach reviewing a solo speaking session.
The user was speaking alone (rehearsing, journaling, or self-coaching).
Give a 3-5 sentences recap focused on their pacing, rambling patterns, and what to work on.
Reference specific moments from the transcript when relevant.
If no alerts fired, acknowledge it as a clean session.
Output plain text. No markdown, no bullet lists, no em dashes, no colons used as connectors. Write in natural flowing sentences.`;

const WITH_OTHERS_PROMPT = `You are a meeting debrief coach reviewing a multi-speaker conversation.
The user was in a conversation with other speakers.
Give a 3-5 sentences recap focused on the user's talk-time share, conversational balance, and key topics.
Note whether the user dominated or balanced well, and reference specific moments when relevant.
Do not refer to other participants by name. Use neutral terms like "the other speaker" or "another participant" unless a name is explicitly provided in the session context.
Output plain text. No markdown, no bullet lists, no em dashes, no colons used as connectors. Write in natural flowing sentences.`;

const PRESENTATION_PROMPT = `You are a presentation coach reviewing a talk.
The user was presenting to an audience (one dominant speaker with listeners).
Give a 3-5 sentences recap focused on the user's pacing, whether alerts suggest they needed to pause more,
and any audience engagement signals (questions from others).
Do not refer to other participants by name. Use neutral terms like "an audience member" or "another speaker" unless a name is explicitly provided in the session context.
Output plain text. No markdown, no bullet lists, no em dashes, no colons used as connectors. Write in natural flowing sentences.`;

/**
 * Return the system prompt for a given session context.
 *
 * Null context falls back to the Solo template — it's the safe default
 * when classification never reached the floor.
 */
export function getSummarySystemPrompt(context: SessionContext | null): string {
  switch (context) {
    case 'with_others':
      return WITH_OTHERS_PROMPT;
    case 'presentation':
      return PRESENTATION_PROMPT;
    case 'solo':
    case null:
    default:
      return SOLO_PROMPT;
  }
}

// ============================================
// User message assembly
// ============================================

const ALERT_LEVEL_NAMES: Record<number, string> = {
  [AlertLevel.NONE]: 'none',
  [AlertLevel.GENTLE]: 'gentle',
  [AlertLevel.MODERATE]: 'moderate',
  [AlertLevel.URGENT]: 'urgent',
  [AlertLevel.CRITICAL]: 'critical',
};

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes} minutes ${seconds} seconds`;
}

function formatOffset(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export interface SummaryInput {
  sessionContext: SessionContext | null;
  durationMs: number;
  alertCount: number;
  maxAlertLevel: AlertLevel;
  speakerCount: number;
  transcriptText: string;
  alertEvents: AlertEvent[];
}

/**
 * Build the structured user message sent alongside the system prompt.
 *
 * Format: labeled plain-text sections. No JSON.
 */
export function buildSummaryUserMessage(input: SummaryInput): string {
  const contextLabel = input.sessionContext ?? 'unknown';
  const maxAlertName = ALERT_LEVEL_NAMES[input.maxAlertLevel] ?? 'none';

  const lines: string[] = [
    `Session context: ${contextLabel}`,
    `Duration: ${formatDuration(input.durationMs)}`,
    `Speakers: ${input.speakerCount}`,
    `Alerts: ${input.alertCount} alerts (max level: ${maxAlertName})`,
    '',
  ];

  if (input.alertEvents.length > 0) {
    lines.push('Alert timeline:');
    for (const e of input.alertEvents) {
      const levelName = ALERT_LEVEL_NAMES[e.alertLevel] ?? 'unknown';
      const durationSecs = Math.round(e.durationAtAlert / 1000);
      lines.push(
        `- ${formatOffset(e.timestamp)} — ${levelName} alert (${durationSecs}s of continuous speech)`,
      );
    }
  } else {
    lines.push('Alert timeline: no alerts fired.');
  }

  lines.push('', 'Transcript:', input.transcriptText);
  return lines.join('\n');
}

// ============================================
// Truncation (deterministic fallback)
// ============================================

/**
 * Truncate the transcript if it exceeds the given character budget.
 *
 * Deterministic strategy: keep only the most recent N characters of the
 * transcript. The metadata + alerts are always preserved in full
 * (they're assembled separately in buildSummaryUserMessage).
 *
 * A truncation marker is prepended so the model knows context is missing.
 */
export function truncateTranscript(transcript: string, maxChars: number): string {
  if (transcript.length <= maxChars) return transcript;
  const tail = transcript.slice(transcript.length - maxChars);
  return `[truncated — showing last ${maxChars} characters]\n${tail}`;
}
