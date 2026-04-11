/**
 * Deepgram configuration.
 *
 * SECURITY NOTE: Client-side API key usage is for D.1 prototyping only.
 * A future phase should move authentication behind a backend token relay.
 * Do not ship to TestFlight with a raw client-side key without revisiting.
 */
export const DEEPGRAM_API_KEY = process.env.EXPO_PUBLIC_DEEPGRAM_API_KEY ?? '';

export const DEEPGRAM_DEFAULTS = {
  model: 'nova-3',
  language: 'en',
  smart_format: 'true',
  interim_results: 'true',
  utterance_end_ms: '1000',
  encoding: 'linear16',
  sample_rate: '16000',
  channels: '1',
  diarize: 'true',
} as const;
