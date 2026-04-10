/**
 * Speaker Service — manages per-session speaker identity mappings.
 *
 * Maps raw Deepgram diarized labels ("Speaker 0") to display names ("Me").
 * Default "Me" assignment is conditional on speaker count (1-2 only).
 * User can manually correct any mapping via reassignSpeaker().
 *
 * TranscriptSegment.speaker always holds the raw diarized label.
 * Display names are resolved at render time via getDisplayName().
 */
import { useSpeakerStore } from '../stores/speakerStore';
import { updateSpeakerMap } from '../db/sessions';
import type { SpeakerMapping } from '../types';

class SpeakerService {
  private speakerCount = 0;
  private meAssigned = false;

  /** Handle a new diarized speaker label. Applies default mapping rules. */
  handleNewSpeaker(diarizedLabel: string): void {
    const store = useSpeakerStore.getState();
    if (store.mappings[diarizedLabel]) return; // already mapped

    this.speakerCount++;

    let displayName: string;
    const confidence: 'provisional' | 'user_confirmed' = 'provisional';

    // Conditional "Me" assignment:
    // - 1 speaker: Speaker 0 → Me (solo session)
    // - 2 speakers: Speaker 0 → Me (if not already assigned to another)
    // - 3+ speakers: generic labels only for new speakers
    if (!this.meAssigned && this.speakerCount <= 2) {
      displayName = 'Me';
      this.meAssigned = true;
    } else {
      displayName = diarizedLabel; // "Speaker 1", "Speaker 2", etc.
    }

    store.setMapping(diarizedLabel, {
      diarizedLabel,
      displayName,
      confidence,
    });
    console.log(`[SpeakerService] mapped: ${diarizedLabel} → "${displayName}" (${confidence})`);
  }

  /** Reassign a speaker's display name. Sets confidence to user_confirmed. */
  reassignSpeaker(diarizedLabel: string, newDisplayName: string): void {
    const store = useSpeakerStore.getState();
    const existing = store.mappings[diarizedLabel];
    if (!existing) return;

    store.setMapping(diarizedLabel, {
      ...existing,
      displayName: newDisplayName,
      confidence: 'user_confirmed',
    });
  }

  /** Get the display name for a diarized label. Returns raw label if unmapped. */
  getDisplayName(diarizedLabel: string): string {
    const mapping = useSpeakerStore.getState().mappings[diarizedLabel];
    return mapping?.displayName ?? diarizedLabel;
  }

  /** Get the confidence for a diarized label. */
  getConfidence(diarizedLabel: string): 'provisional' | 'user_confirmed' | null {
    const mapping = useSpeakerStore.getState().mappings[diarizedLabel];
    return mapping?.confidence ?? null;
  }

  /** Persist current speaker mappings to the session row. */
  async persistToSession(sessionId: string): Promise<void> {
    const { mappings } = useSpeakerStore.getState();
    await updateSpeakerMap(sessionId, JSON.stringify(mappings));
  }

  /** Reset all mappings for a new session. */
  reset(): void {
    this.speakerCount = 0;
    this.meAssigned = false;
    useSpeakerStore.getState().reset();
  }
}

export const speakerService = new SpeakerService();
