/**
 * Voice Profile Service — manages voice enrollment from onboarding samples.
 *
 * Creates a voice profile when confirmed samples exist and no profile exists.
 * D.2: profile stores sample references with NULL embedding.
 * D.3: extends with embedding generation.
 */
import { getVoiceProfile, createVoiceProfile } from '../db/voiceProfiles';
import { getVoiceSamples } from '../db/voiceSamples';
import type { VoiceProfile, VoiceProfileStatus } from '../types';

/**
 * Ensure a voice profile exists if enrollment samples are available.
 * Idempotent — skips if profile already exists.
 * Best-effort — errors are logged, not thrown (safe for startup).
 */
export async function ensureProfileExists(): Promise<void> {
  try {
    const existing = await getVoiceProfile();
    if (existing) return; // already exists

    const samples = await getVoiceSamples();
    const confirmed = samples.filter((s) => s.confirmed);
    if (confirmed.length === 0) return; // no confirmed samples

    await createVoiceProfile(confirmed.map((s) => s.id));
    console.log(`[VoiceProfile] Created profile from ${confirmed.length} samples`);
  } catch (error) {
    console.warn('[VoiceProfile] Failed to ensure profile:', error);
  }
}

/** Get the current voice profile, or null if none exists. */
export async function getProfile(): Promise<VoiceProfile | null> {
  return getVoiceProfile();
}

/** Get the profile status: none, enrolled, needs_embedding, or ready. */
export async function getProfileStatus(): Promise<'none' | VoiceProfileStatus> {
  const profile = await getVoiceProfile();
  return profile ? profile.status : 'none';
}
