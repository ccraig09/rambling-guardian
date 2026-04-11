/**
 * Context Classification Service — pure-logic module for D.4.
 *
 * Classifies a session as solo / with_others / presentation based on
 * speaker count and speech distribution. Stateless, no store access.
 */
import type { SessionContext } from '../types';

/** Tunable thresholds — easy to adjust based on real usage. */
export const PRESENTATION_DOMINANCE = 0.85;
export const PRESENTATION_MIN_SPEAKERS = 3;
export const MIN_SEGMENTS_FOR_CLASSIFICATION = 15;

/**
 * Classify session context from speaker segment counts.
 *
 * @param speakerSegmentCounts - Map of speaker label → number of final segments
 * @param totalSegments - Total number of final segments across all speakers
 * @returns The classified context, or null if below the minimum segment floor.
 */
export function classifyContext(
  speakerSegmentCounts: Map<string, number>,
  totalSegments: number,
): SessionContext | null {
  if (totalSegments < MIN_SEGMENTS_FOR_CLASSIFICATION) return null;

  const speakerCount = speakerSegmentCounts.size;
  if (speakerCount <= 1) return 'solo';

  // Find dominant speaker's share
  let maxSegments = 0;
  for (const count of speakerSegmentCounts.values()) {
    if (count > maxSegments) maxSegments = count;
  }
  const dominance = maxSegments / totalSegments;

  if (
    dominance >= PRESENTATION_DOMINANCE &&
    speakerCount >= PRESENTATION_MIN_SPEAKERS
  ) {
    return 'presentation';
  }

  return 'with_others';
}
