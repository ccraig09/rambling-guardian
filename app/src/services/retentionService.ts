/**
 * Retention Service — 4-tier retention policy enforcement.
 *
 * Tiers:
 *   1 (METADATA)     — session metadata, kept forever
 *   2 (TRANSCRIPT)   — transcript + timestamps, kept indefinitely (manual delete)
 *   3 (ALERT_CLIPS)  — alert-moment audio clips, auto-pruned (default 30 days)
 *   4 (FULL_AUDIO)   — full session audio, auto-pruned (default 7 days)
 *
 * retention_tier on the session row is the current effective / highest tier.
 * A single session may later have multiple artifact classes with different
 * retention behavior. Future phases may introduce a per-artifact retention
 * table to complement or replace this session-level model.
 *
 * Future exemption: favorited sessions should be exempt from auto-pruning.
 * Not implemented until the favorited column exists on the sessions table.
 */
import { getExpiredSessions, updateRetention } from '../db/sessions';
import { useSettingsStore } from '../stores/settingsStore';
import { RetentionTier } from '../types';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Default retention windows per tier. null = keep forever/indefinitely. */
export const RETENTION_DEFAULTS: Record<RetentionTier, number | null> = {
  [RetentionTier.METADATA]: null,
  [RetentionTier.TRANSCRIPT]: null,
  [RetentionTier.ALERT_CLIPS]: 30 * DAY_MS,
  [RetentionTier.FULL_AUDIO]: 7 * DAY_MS,
};

/** Get the effective retention window for a tier, using user settings when available. */
function getRetentionWindow(tier: RetentionTier): number | null {
  if (tier <= RetentionTier.TRANSCRIPT) return null;
  const settings = useSettingsStore.getState();
  if (tier === RetentionTier.ALERT_CLIPS) return settings.retentionTier3Days * DAY_MS;
  if (tier === RetentionTier.FULL_AUDIO) return settings.retentionTier4Days * DAY_MS;
  return RETENTION_DEFAULTS[tier];
}

/** Calculate retention_until for a given tier and session end time. */
export function calculateRetentionUntil(
  tier: RetentionTier,
  endedAt: number,
): number | null {
  const window = getRetentionWindow(tier);
  if (window === null) return null;
  return endedAt + window;
}

/** Determine the retention tier based on which artifacts exist. */
export function assignRetentionTier(artifacts: {
  hasTranscript: boolean;
  hasClips: boolean;
  hasFullAudio: boolean;
}): RetentionTier {
  if (artifacts.hasFullAudio) return RetentionTier.FULL_AUDIO;
  if (artifacts.hasClips) return RetentionTier.ALERT_CLIPS;
  if (artifacts.hasTranscript) return RetentionTier.TRANSCRIPT;
  return RetentionTier.METADATA;
}

/**
 * Run retention enforcement now.
 * Queries for expired sessions (tier > 2, retention_until < now) and
 * downgrades them by removing the highest-tier artifact.
 *
 * Returns the number of sessions pruned.
 */
export async function runPruneNow(): Promise<number> {
  const expired = await getExpiredSessions();
  if (expired.length === 0) return 0;

  let pruned = 0;
  for (const session of expired) {
    // Tier 4 (full audio) → Tier 2 (transcript stays)
    // Tier 3 (alert clips) → Tier 2 (transcript stays)
    const newTier = RetentionTier.TRANSCRIPT;

    // TODO: When audio artifacts exist (Phase D), delete the actual files here

    const newRetentionUntil = calculateRetentionUntil(newTier, 0);
    await updateRetention(session.id, newTier, newRetentionUntil);
    pruned++;
  }

  return pruned;
}

let pruneInterval: ReturnType<typeof setInterval> | null = null;

/** Start the daily retention enforcement interval. Also runs once immediately. */
export async function startRetentionEnforcement(): Promise<void> {
  await runPruneNow();
  if (pruneInterval) clearInterval(pruneInterval);
  pruneInterval = setInterval(() => {
    runPruneNow().catch(console.warn);
  }, DAY_MS);
}

/** Stop the retention enforcement interval. */
export function stopRetentionEnforcement(): void {
  if (pruneInterval) {
    clearInterval(pruneInterval);
    pruneInterval = null;
  }
}
