# RG-C.4.5 Offline Exercise Library — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an offline exercise library with 55 voice exercises, daily rotation, difficulty progression, streaks, and a polished Exercises tab matching the Figma design system.

**Architecture:** Exercise data is a static JSON array seeded into SQLite on first launch. A rotation engine picks 3 exercises daily (one per category, freshness-weighted). Completions and streaks are tracked in SQLite. The Exercises tab shows today's picks, the streak calendar, and the full library. All UI uses the indigo design system via `useTheme()`.

**Tech Stack:** TypeScript, React Native (Expo 54), expo-sqlite, Zustand, useTheme() hook, Plus Jakarta Sans

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/data/exercises.ts` | 55 exercises as typed JSON array |
| Create | `src/services/exerciseEngine.ts` | Daily rotation, difficulty unlock, seeding |
| Create | `src/services/__tests__/exerciseEngine.test.ts` | Rotation + progression tests |
| Create | `src/db/exercises.ts` | CRUD for exercises, completions, streaks |
| Create | `src/components/ExerciseCard.tsx` | Exercise card (collapsed + expanded + completed states) |
| Create | `src/components/StepTimer.tsx` | Countdown timer for exercise steps |
| Create | `src/components/StreakCalendar.tsx` | Monthly heat map calendar |
| Modify | `app/(tabs)/exercises.tsx` | Full exercises screen with daily picks + streak + library |
| Modify | `app/_layout.tsx` | Seed exercises on first launch |

---

### Task 1: Exercise Data (55 exercises)

**Files:**
- Create: `app/src/data/exercises.ts`

- [ ] **Step 1: Create exercises.ts with 55 exercises across 4 categories**

Generate 55 exercises with proper `ExerciseStep[]` instructions. Categories: warmup (12), breathing (14), articulation (14), speech (15). Difficulties 1-3 (beginner/intermediate/advanced). Each exercise has 3-5 timed steps.

The file should export `const exerciseData: Omit<Exercise, 'id'>[]` — IDs are assigned during SQLite seeding.

Each exercise needs:
- `category`: one of 'warmup' | 'breathing' | 'articulation' | 'speech'
- `title`: short descriptive name
- `description`: 1-2 sentence explanation
- `instructions`: array of `{ step: number, text: string, durationSeconds: number }`
- `durationSeconds`: total duration (sum of step durations)
- `difficulty`: 1 (beginner), 2 (intermediate), 3 (advanced)
- `tags`: relevant tags like ['pause', 'pace', 'volume']
- `sortOrder`: position within category

- [ ] **Step 2: Commit**

```bash
git add app/src/data/exercises.ts
git commit -m "feat(exercises): 55 voice exercises across 4 categories"
```

---

### Task 2: Exercise Database Operations

**Files:**
- Create: `app/src/db/exercises.ts`

- [ ] **Step 1: Create exercises.ts with CRUD operations**

```typescript
import { getDatabase } from './database';
import type { Exercise, ExerciseStep, ExerciseCompletion, Streak } from '../types';

/** Seed exercises into DB if empty. Called once on app launch. */
export async function seedExercises(exercises: Omit<Exercise, 'id'>[]): Promise<void> {
  const db = await getDatabase();
  const count = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM exercises');
  if (count && count.count > 0) return; // already seeded

  for (const ex of exercises) {
    const id = `${ex.category}-${ex.sortOrder}`;
    await db.runAsync(
      'INSERT INTO exercises (id, category, title, description, instructions, duration_seconds, difficulty, tags, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, ex.category, ex.title, ex.description, JSON.stringify(ex.instructions), ex.durationSeconds, ex.difficulty, JSON.stringify(ex.tags), ex.sortOrder],
    );
  }
}

/** Get all exercises, optionally filtered by category and max difficulty. */
export async function getExercises(opts?: { category?: string; maxDifficulty?: number }): Promise<Exercise[]> {
  const db = await getDatabase();
  let query = 'SELECT * FROM exercises WHERE 1=1';
  const params: any[] = [];
  if (opts?.category) { query += ' AND category = ?'; params.push(opts.category); }
  if (opts?.maxDifficulty) { query += ' AND difficulty <= ?'; params.push(opts.maxDifficulty); }
  query += ' ORDER BY sort_order ASC';
  const rows = await db.getAllAsync<any>(query, params);
  return rows.map(parseExerciseRow);
}

/** Get a single exercise by ID. */
export async function getExerciseById(id: string): Promise<Exercise | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<any>('SELECT * FROM exercises WHERE id = ?', [id]);
  return row ? parseExerciseRow(row) : null;
}

/** Record an exercise completion. */
export async function completeExercise(exerciseId: string, rating: number | null): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'INSERT INTO exercise_completions (exercise_id, completed_at, rating) VALUES (?, ?, ?)',
    [exerciseId, Date.now(), rating],
  );
  // Update today's streak
  const today = new Date().toISOString().split('T')[0];
  const existing = await db.getFirstAsync<any>('SELECT * FROM streaks WHERE date = ?', [today]);
  if (existing) {
    await db.runAsync('UPDATE streaks SET exercises_done = exercises_done + 1 WHERE date = ?', [today]);
  } else {
    await db.runAsync('INSERT INTO streaks (date, exercises_done, sessions_done, total_speech_ms) VALUES (?, 1, 0, 0)', [today]);
  }
}

/** Get completion count for an exercise. Used for difficulty progression. */
export async function getCompletionCount(exerciseId: string): Promise<number> {
  const db = await getDatabase();
  const result = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM exercise_completions WHERE exercise_id = ?', [exerciseId]);
  return result?.count ?? 0;
}

/** Get total completions per category. Used for difficulty unlocking. */
export async function getCategoryCompletions(category: string): Promise<number> {
  const db = await getDatabase();
  const result = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM exercise_completions ec JOIN exercises e ON ec.exercise_id = e.id WHERE e.category = ?`,
    [category],
  );
  return result?.count ?? 0;
}

/** Get streaks for a given month (YYYY-MM format). */
export async function getStreaksForMonth(yearMonth: string): Promise<Streak[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>(`SELECT * FROM streaks WHERE date LIKE ? ORDER BY date ASC`, [`${yearMonth}%`]);
  return rows.map((r: any) => ({
    id: r.id, date: r.date, exercisesDone: r.exercises_done,
    sessionsDone: r.sessions_done, totalSpeechMs: r.total_speech_ms,
  }));
}

/** Get current streak count (consecutive days with exercises_done > 0). */
export async function getCurrentStreak(): Promise<number> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ date: string }>('SELECT date FROM streaks WHERE exercises_done > 0 ORDER BY date DESC LIMIT 60');
  if (rows.length === 0) return 0;
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < rows.length; i++) {
    const expected = new Date(today);
    expected.setDate(expected.getDate() - i);
    const expectedStr = expected.toISOString().split('T')[0];
    if (rows[i].date === expectedStr) { streak++; } else { break; }
  }
  return streak;
}

/** Get recent completions for an exercise (for freshness weighting). */
export async function getRecentCompletions(exerciseId: string, dayLimit: number): Promise<number> {
  const db = await getDatabase();
  const cutoff = Date.now() - dayLimit * 24 * 60 * 60 * 1000;
  const result = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM exercise_completions WHERE exercise_id = ? AND completed_at > ?',
    [exerciseId, cutoff],
  );
  return result?.count ?? 0;
}

function parseExerciseRow(row: any): Exercise {
  return {
    id: row.id,
    category: row.category,
    title: row.title,
    description: row.description,
    instructions: JSON.parse(row.instructions) as ExerciseStep[],
    durationSeconds: row.duration_seconds,
    difficulty: row.difficulty,
    tags: JSON.parse(row.tags || '[]'),
    sortOrder: row.sort_order,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add app/src/db/exercises.ts
git commit -m "feat(exercises): exercise + streak + completion DB operations"
```

---

### Task 3: Exercise Rotation Engine

Picks 3 daily exercises (one from each of 3 categories), weighted by freshness and respecting difficulty locks.

**Files:**
- Create: `app/src/services/exerciseEngine.ts`

- [ ] **Step 1: Create exerciseEngine.ts**

```typescript
import { getExercises, getCategoryCompletions, getRecentCompletions } from '../db/exercises';
import type { Exercise, ExerciseCategory } from '../types';

const DIFFICULTY_UNLOCK_THRESHOLD = 5; // completions per category to unlock next tier
const DAILY_PICK_COUNT = 3;
const FRESHNESS_WINDOW_DAYS = 7;

/** Get the unlocked difficulty level for a category (1-3). */
export async function getUnlockedDifficulty(category: ExerciseCategory): Promise<number> {
  const completions = await getCategoryCompletions(category);
  if (completions >= DIFFICULTY_UNLOCK_THRESHOLD * 2) return 3;
  if (completions >= DIFFICULTY_UNLOCK_THRESHOLD) return 2;
  return 1;
}

/** Pick today's exercises: one from each of 3 random categories, freshness-weighted. */
export async function getDailyExercises(): Promise<Exercise[]> {
  const categories: ExerciseCategory[] = ['warmup', 'breathing', 'articulation', 'speech'];

  // Use today's date as seed for consistent daily picks
  const today = new Date().toISOString().split('T')[0];
  const seed = hashString(today);

  // Shuffle categories deterministically, pick first 3
  const shuffled = seededShuffle(categories, seed);
  const pickedCategories = shuffled.slice(0, DAILY_PICK_COUNT);

  const picks: Exercise[] = [];

  for (const category of pickedCategories) {
    const maxDiff = await getUnlockedDifficulty(category);
    const available = await getExercises({ category, maxDifficulty: maxDiff });
    if (available.length === 0) continue;

    // Score by freshness (fewer recent completions = higher score)
    const scored = await Promise.all(
      available.map(async (ex) => {
        const recent = await getRecentCompletions(ex.id, FRESHNESS_WINDOW_DAYS);
        return { exercise: ex, score: 1 / (1 + recent) };
      }),
    );

    // Weighted random selection using seed
    const totalScore = scored.reduce((sum, s) => sum + s.score, 0);
    let target = seededRandom(seed + hashString(category)) * totalScore;
    let picked = scored[0].exercise;
    for (const s of scored) {
      target -= s.score;
      if (target <= 0) { picked = s.exercise; break; }
    }
    picks.push(picked);
  }

  return picks;
}

/** Simple string hash for deterministic seeding. */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return Math.abs(hash);
}

/** Seeded pseudo-random number 0-1. */
function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

/** Seeded Fisher-Yates shuffle. */
function seededShuffle<T>(array: T[], seed: number): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(seededRandom(seed + i) * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
```

- [ ] **Step 2: Commit**

```bash
git add app/src/services/exerciseEngine.ts
git commit -m "feat(exercises): daily rotation engine with freshness weighting"
```

---

### Task 4: StepTimer Component

Countdown timer for individual exercise steps. Shows a progress ring and time remaining.

**Files:**
- Create: `app/src/components/StepTimer.tsx`

- [ ] **Step 1: Create StepTimer.tsx**

```typescript
import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/theme';

interface StepTimerProps {
  durationSeconds: number;
  isActive: boolean;
  onComplete: () => void;
}

export function StepTimer({ durationSeconds, isActive, onComplete }: StepTimerProps) {
  const theme = useTheme();
  const [remaining, setRemaining] = useState(durationSeconds);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setRemaining(durationSeconds);
  }, [durationSeconds]);

  useEffect(() => {
    if (isActive && remaining > 0) {
      intervalRef.current = setInterval(() => {
        setRemaining((prev) => {
          if (prev <= 1) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            onComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isActive, durationSeconds]);

  const progress = durationSeconds > 0 ? (durationSeconds - remaining) / durationSeconds : 0;

  return (
    <View style={styles.container}>
      {/* Simple circular progress */}
      <View style={[styles.ring, { borderColor: theme.colors.elevated }]}>
        <View
          style={[
            styles.progressArc,
            {
              borderColor: theme.primary[500],
              borderRightColor: 'transparent',
              borderBottomColor: progress > 0.5 ? theme.primary[500] : 'transparent',
              transform: [{ rotate: `${progress * 360}deg` }],
            },
          ]}
        />
        <Text style={[theme.type.heading, { color: theme.text.primary }]}>
          {remaining}s
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center' },
  ring: {
    width: 80, height: 80, borderRadius: 40,
    borderWidth: 6, alignItems: 'center', justifyContent: 'center',
  },
  progressArc: {
    position: 'absolute', width: 80, height: 80, borderRadius: 40,
    borderWidth: 6,
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add app/src/components/StepTimer.tsx
git commit -m "feat(exercises): step timer countdown component"
```

---

### Task 5: ExerciseCard Component

Matches Figma design — collapsed (list view), expanded (active with step timer), completed states.

**Files:**
- Create: `app/src/components/ExerciseCard.tsx`

- [ ] **Step 1: Create ExerciseCard.tsx**

Full component with 3 states: collapsed (shows title, description, metadata), expanded (shows current step instruction + timer + skip), completed (checkmark + rating). Uses category badge, surface/card background, proper hierarchy per DESIGN.md.

The card accepts: `exercise: Exercise`, `state: 'collapsed' | 'active' | 'completed'`, `currentStep: number`, `onStart: () => void`, `onStepComplete: () => void`, `onSkip: () => void`, `onRate: (rating: number) => void`.

- [ ] **Step 2: Commit**

```bash
git add app/src/components/ExerciseCard.tsx
git commit -m "feat(exercises): exercise card component (3 states, Figma design)"
```

---

### Task 6: StreakCalendar Component

Monthly heat map matching the Figma streak calendar design.

**Files:**
- Create: `app/src/components/StreakCalendar.tsx`

- [ ] **Step 1: Create StreakCalendar.tsx**

Shows a month grid with activity levels (none/exercises/full), today indicator, streak count, navigation arrows, and legend. Uses `getStreaksForMonth()` and `getCurrentStreak()`.

- [ ] **Step 2: Commit**

```bash
git add app/src/components/StreakCalendar.tsx
git commit -m "feat(exercises): streak calendar heat map component"
```

---

### Task 7: Exercises Screen

Wire everything together into the Exercises tab.

**Files:**
- Modify: `app/app/(tabs)/exercises.tsx`
- Modify: `app/app/_layout.tsx` (add exercise seeding)

- [ ] **Step 1: Update _layout.tsx to seed exercises on first launch**

Add to the existing database init flow:
```typescript
import { seedExercises } from '../src/db/exercises';
import { exerciseData } from '../src/data/exercises';
// After getDatabase():
await seedExercises(exerciseData);
```

- [ ] **Step 2: Build the Exercises screen**

The screen has 3 sections:
1. **Today's Picks** — 3 daily exercises from rotation engine, shown as ExerciseCards
2. **Streak Calendar** — monthly heat map
3. **Full Library** — all exercises grouped by category, with difficulty badges

Uses `ScrollView`, `useTheme()`, proper spacing per DESIGN.md (24dp between sections).

- [ ] **Step 3: Run TypeScript check and tests**

- [ ] **Step 4: Commit and push**

```bash
git add app/app/(tabs)/exercises.tsx app/app/_layout.tsx
git commit -m "feat(exercises): full exercises tab with daily picks, streaks, and library"
git push
```
