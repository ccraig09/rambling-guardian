/**
 * Text prompts for voice enrollment.
 * These sentences are chosen for phonetic diversity — they cover a wide range
 * of English phonemes so the voice model (Phase D) gets good coverage.
 * Users read each one aloud and record it.
 */
export const voicePrompts = [
  "The quick brown fox jumps over the lazy dog.",
  "She sells seashells by the seashore on sunny days.",
  "How much wood would a woodchuck chuck if a woodchuck could chuck wood?",
  "Peter Piper picked a peck of pickled peppers.",
  "The rain in Spain stays mainly in the plain.",
] as const;

export type VoicePromptIndex = 0 | 1 | 2 | 3 | 4;
