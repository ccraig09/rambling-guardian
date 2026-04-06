/**
 * Daily exercise rotation engine.
 *
 * Key design decisions:
 * - Deterministic per calendar day: same date → same exercise picks.
 * - Freshness weighting: recently completed exercises are deprioritised.
 * - Difficulty unlocking: completions gate access to harder tiers.
 */

import {
  getExercises,
  getCategoryCompletions,
  getRecentCompletions,
} from '../db/exercises';
import type { Exercise, ExerciseCategory } from '../types';

// ─── Constants ───────────────────────────────────────────────────────────────

const ALL_CATEGORIES: ExerciseCategory[] = [
  'warmup',
  'breathing',
  'articulation',
  'speech',
];

const COMPLETIONS_FOR_TIER_2 = 5;
const COMPLETIONS_FOR_TIER_3 = 10;

// Recency window used for freshness scoring (days)
const FRESHNESS_WINDOW_DAYS = 7;

// ─── Seeded PRNG (Math.sin-based) ────────────────────────────────────────────

/**
 * Returns a pseudo-random float in [0, 1) from a numeric seed.
 * Deterministic: same seed → same result.
 */
function seededRandom(seed: number): () => number {
  let s = seed;
  return function next(): number {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

/**
 * Build a simple integer seed from a YYYY-MM-DD string.
 * e.g. "2026-04-06" → 20260406
 */
function dateSeed(dateStr: string): number {
  return parseInt(dateStr.replace(/-/g, ''), 10);
}

// ─── Fisher-Yates shuffle (seeded) ───────────────────────────────────────────

function shuffleSeeded<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── Weighted random pick ─────────────────────────────────────────────────────

/**
 * Select one item using weighted random.
 * Higher weight = higher probability.
 * Falls back to uniform if all weights are 0.
 */
function weightedPick<T>(
  items: T[],
  weights: number[],
  rng: () => number,
): T {
  const total = weights.reduce((s, w) => s + w, 0);
  if (total === 0) {
    // Uniform fallback
    return items[Math.floor(rng() * items.length)];
  }
  let threshold = rng() * total;
  for (let i = 0; i < items.length; i++) {
    threshold -= weights[i];
    if (threshold <= 0) return items[i];
  }
  return items[items.length - 1];
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns the max difficulty tier the user has unlocked for a category.
 *
 * Tier 1 (default): < 5 completions
 * Tier 2:           5–9 completions
 * Tier 3:           10+ completions
 */
export async function getUnlockedDifficulty(
  category: ExerciseCategory | string,
): Promise<1 | 2 | 3> {
  const count = await getCategoryCompletions(category);
  if (count >= COMPLETIONS_FOR_TIER_3) return 3;
  if (count >= COMPLETIONS_FOR_TIER_2) return 2;
  return 1;
}

/**
 * Returns today's 3 daily exercises — one from each of 3 randomly (but
 * deterministically) chosen categories.
 *
 * Selection algorithm:
 * 1. Seed PRNG with today's date integer.
 * 2. Shuffle all 4 categories; take the first 3.
 * 3. For each chosen category:
 *    a. Fetch exercises filtered by unlocked difficulty.
 *    b. Score each by inverse recent completions (freshness weight).
 *    c. Weighted-random pick.
 */
export async function getDailyExercises(): Promise<Exercise[]> {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const rng = seededRandom(dateSeed(today));

  // Step 1 — pick 3 categories for today
  const shuffled = shuffleSeeded(ALL_CATEGORIES, rng);
  const todayCategories = shuffled.slice(0, 3);

  const picked: Exercise[] = [];

  for (const category of todayCategories) {
    const maxDifficulty = await getUnlockedDifficulty(category);

    const candidates = await getExercises({ category, maxDifficulty });

    if (candidates.length === 0) continue;

    // Build freshness weights: more recent completions → lower weight
    const recencies = await Promise.all(
      candidates.map((ex) =>
        getRecentCompletions(ex.id, FRESHNESS_WINDOW_DAYS),
      ),
    );

    // Inverse weight: exercises done 0 times recently get weight 1,
    // done N times get weight 1/(N+1).
    const weights = recencies.map((n) => 1 / (n + 1));

    const choice = weightedPick(candidates, weights, rng);
    picked.push(choice);
  }

  return picked;
}
