import { getDatabase } from './database';
import type { Exercise, ExerciseStep, Streak } from '../types';

// ─── Row shapes returned from SQLite ────────────────────────────────────────

interface ExerciseRow {
  id: string;
  category: string;
  title: string;
  description: string;
  instructions: string; // JSON
  duration_seconds: number;
  difficulty: number;
  tags: string; // JSON
  sort_order: number;
}

interface StreakRow {
  id: number;
  date: string;
  exercises_done: number;
  sessions_done: number;
  total_speech_ms: number;
}

interface CountRow {
  count: number;
}

// ─── Mapping helpers ─────────────────────────────────────────────────────────

function mapExerciseRow(row: ExerciseRow): Exercise {
  return {
    id: row.id,
    category: row.category as Exercise['category'],
    title: row.title,
    description: row.description,
    instructions: JSON.parse(row.instructions) as ExerciseStep[],
    durationSeconds: row.duration_seconds,
    difficulty: row.difficulty,
    tags: JSON.parse(row.tags ?? '[]') as string[],
    sortOrder: row.sort_order,
  };
}

function mapStreakRow(row: StreakRow): Streak {
  return {
    id: row.id,
    date: row.date,
    exercisesDone: row.exercises_done,
    sessionsDone: row.sessions_done,
    totalSpeechMs: row.total_speech_ms,
  };
}

// ─── Today helper ────────────────────────────────────────────────────────────

function todayISO(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Seed the exercises table if it is empty.
 * ID format: `${category}-${sortOrder}` (e.g. "warmup-1").
 */
export async function seedExercises(
  exercises: Omit<Exercise, 'id'>[],
): Promise<void> {
  const db = await getDatabase();

  const existing = await db.getFirstAsync<CountRow>(
    'SELECT COUNT(*) as count FROM exercises',
  );
  if (existing && existing.count > 0) return;

  for (const ex of exercises) {
    const id = `${ex.category}-${ex.sortOrder}`;
    await db.runAsync(
      `INSERT INTO exercises
         (id, category, title, description, instructions, duration_seconds, difficulty, tags, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        ex.category,
        ex.title,
        ex.description,
        JSON.stringify(ex.instructions),
        ex.durationSeconds,
        ex.difficulty,
        JSON.stringify(ex.tags),
        ex.sortOrder,
      ],
    );
  }
}

/**
 * Fetch exercises with optional filtering.
 */
export async function getExercises(opts?: {
  category?: string;
  maxDifficulty?: number;
}): Promise<Exercise[]> {
  const db = await getDatabase();

  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (opts?.category) {
    conditions.push('category = ?');
    params.push(opts.category);
  }
  if (opts?.maxDifficulty !== undefined) {
    conditions.push('difficulty <= ?');
    params.push(opts.maxDifficulty);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = await db.getAllAsync<ExerciseRow>(
    `SELECT * FROM exercises ${where} ORDER BY sort_order ASC`,
    params,
  );

  return rows.map(mapExerciseRow);
}

/**
 * Fetch a single exercise by ID.
 */
export async function getExerciseById(id: string): Promise<Exercise | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<ExerciseRow>(
    'SELECT * FROM exercises WHERE id = ?',
    [id],
  );
  return row ? mapExerciseRow(row) : null;
}

/**
 * Record a completion and upsert today's streak row.
 */
export async function completeExercise(
  exerciseId: string,
  rating: number | null,
): Promise<void> {
  const db = await getDatabase();
  const now = Date.now();
  const today = todayISO();

  await db.runAsync(
    `INSERT INTO exercise_completions (exercise_id, completed_at, rating) VALUES (?, ?, ?)`,
    [exerciseId, now, rating],
  );

  // Upsert today's streak — increment exercises_done
  await db.runAsync(
    `INSERT INTO streaks (date, exercises_done, sessions_done, total_speech_ms)
       VALUES (?, 1, 0, 0)
     ON CONFLICT(date) DO UPDATE SET
       exercises_done = exercises_done + 1`,
    [today],
  );
}

/**
 * Total number of times a specific exercise has been completed.
 */
export async function getCompletionCount(exerciseId: string): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<CountRow>(
    'SELECT COUNT(*) as count FROM exercise_completions WHERE exercise_id = ?',
    [exerciseId],
  );
  return row?.count ?? 0;
}

/**
 * Total completions across all exercises in a category.
 */
export async function getCategoryCompletions(
  category: string,
): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<CountRow>(
    `SELECT COUNT(*) as count
       FROM exercise_completions ec
       JOIN exercises e ON e.id = ec.exercise_id
      WHERE e.category = ?`,
    [category],
  );
  return row?.count ?? 0;
}

/**
 * Streaks for a given month. yearMonth format: "YYYY-MM".
 */
export async function getStreaksForMonth(yearMonth: string): Promise<Streak[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<StreakRow>(
    `SELECT * FROM streaks WHERE date LIKE ? ORDER BY date ASC`,
    [`${yearMonth}%`],
  );
  return rows.map(mapStreakRow);
}

/**
 * Count of consecutive days (going back from today) where exercises_done > 0.
 */
export async function getCurrentStreak(): Promise<number> {
  const db = await getDatabase();

  // Pull all days that had at least one exercise, ordered newest first
  const rows = await db.getAllAsync<{ date: string }>(
    `SELECT date FROM streaks WHERE exercises_done > 0 ORDER BY date DESC`,
  );

  if (rows.length === 0) return 0;

  let streak = 0;
  const MS_PER_DAY = 86_400_000;

  // Start checking from today; if today has no entry we still start the chain
  let expected = new Date(todayISO()).getTime();

  for (const row of rows) {
    const rowTime = new Date(row.date).getTime();

    if (rowTime === expected) {
      streak += 1;
      expected -= MS_PER_DAY;
    } else if (rowTime < expected) {
      // Gap — chain is broken
      break;
    }
    // rowTime > expected shouldn't happen given ORDER BY DESC, skip if so
  }

  return streak;
}

/**
 * Completions for a single exercise within the last N days.
 */
export async function getRecentCompletions(
  exerciseId: string,
  dayLimit: number,
): Promise<number> {
  const db = await getDatabase();
  const cutoff = Date.now() - dayLimit * 86_400_000;
  const row = await db.getFirstAsync<CountRow>(
    `SELECT COUNT(*) as count
       FROM exercise_completions
      WHERE exercise_id = ? AND completed_at >= ?`,
    [exerciseId, cutoff],
  );
  return row?.count ?? 0;
}
