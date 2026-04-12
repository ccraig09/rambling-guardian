/**
 * Anthropic API configuration.
 *
 * API key is client-side for prototyping — same pattern as Deepgram.
 * Flag for backend migration before production.
 */
export const ANTHROPIC_API_KEY = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY ?? '';

/** Model used for session summaries. Upgrade to Sonnet by changing this constant. */
export const SUMMARY_MODEL = 'claude-haiku-4-5-20251001';

/** Max input tokens before truncation kicks in (Section 3 of spec). */
export const MAX_INPUT_TOKENS = 8000;

// Dev-mode guardrail: warn once when the key is missing so the
// summary button's silent absence doesn't confuse developers.
if (process.env.NODE_ENV !== 'production' && !ANTHROPIC_API_KEY) {
  // eslint-disable-next-line no-console
  console.warn(
    '[Anthropic] EXPO_PUBLIC_ANTHROPIC_API_KEY is not set — summary button will be hidden. Add it to app/.env',
  );
}
