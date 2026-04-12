/**
 * Anthropic provider adapter — D.6 v1.
 *
 * Abstracts whether we use the @anthropic-ai/sdk or raw fetch to the
 * Messages API. summaryService never touches this decision — it just
 * calls createMessage().
 *
 * SDK is tried first. If the SDK import throws (React Native compat
 * issues), we fall back to raw fetch.
 */
import * as anthropicConfig from '../config/anthropic';

const MESSAGES_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const MAX_OUTPUT_TOKENS = 512;

interface MessagesResponse {
  content: Array<{ type: string; text?: string }>;
}

async function createMessageViaFetch(
  systemPrompt: string,
  userMessage: string,
): Promise<string> {
  const res = await fetch(MESSAGES_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': anthropicConfig.ANTHROPIC_API_KEY,
      'anthropic-version': ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model: anthropicConfig.SUMMARY_MODEL,
      max_tokens: MAX_OUTPUT_TOKENS,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Anthropic API ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = (await res.json()) as MessagesResponse;
  const textBlock = data.content.find((b) => b.type === 'text');
  if (!textBlock?.text) throw new Error('Anthropic API returned no text');
  return textBlock.text;
}

async function createMessageViaSdk(
  systemPrompt: string,
  userMessage: string,
): Promise<string> {
  // Dynamic import — if SDK fails to load in RN, we fall back to fetch.
  const mod = await import('@anthropic-ai/sdk');
  const AnthropicCtor = (mod as any).default ?? mod;
  const client = new AnthropicCtor({ apiKey: anthropicConfig.ANTHROPIC_API_KEY });
  const response = await client.messages.create({
    model: anthropicConfig.SUMMARY_MODEL,
    max_tokens: MAX_OUTPUT_TOKENS,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });
  const textBlock = response.content.find((b: any) => b.type === 'text');
  if (!textBlock?.text) throw new Error('Anthropic SDK returned no text');
  return textBlock.text;
}

/**
 * Send a system + user message to Claude and return the text response.
 *
 * Tries SDK first, falls back to raw fetch on SDK load failure.
 */
export async function createMessage(
  systemPrompt: string,
  userMessage: string,
): Promise<string> {
  if (!anthropicConfig.ANTHROPIC_API_KEY) {
    throw new Error('Anthropic API key not configured');
  }

  try {
    return await createMessageViaSdk(systemPrompt, userMessage);
  } catch (e: unknown) {
    // If SDK fails for reasons other than RN incompat (e.g. network),
    // we still try fetch. Fetch will surface the real error.
    const msg = e instanceof Error ? e.message : String(e);
    console.warn('[Anthropic] SDK path failed, falling back to fetch:', msg);
    return createMessageViaFetch(systemPrompt, userMessage);
  }
}
