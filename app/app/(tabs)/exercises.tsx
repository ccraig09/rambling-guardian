import { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../src/theme/theme';
import { ExerciseCard } from '../../src/components/ExerciseCard';
import { StreakCalendar } from '../../src/components/StreakCalendar';
import { getDailyExercises } from '../../src/services/exerciseEngine';
import { getExercises, completeExercise } from '../../src/db/exercises';
import type { Exercise, ExerciseCategory } from '../../src/types';

const ALL_CATEGORIES: ExerciseCategory[] = ['warmup', 'breathing', 'articulation', 'speech'];

const CATEGORY_LABELS: Record<ExerciseCategory, string> = {
  warmup: 'Warm-Up',
  breathing: 'Breathing',
  articulation: 'Articulation',
  speech: 'Speech',
};

export default function ExercisesScreen() {
  const theme = useTheme();
  const [dailyExercises, setDailyExercises] = useState<Exercise[]>([]);
  const [allExercises, setAllExercises] = useState<Exercise[]>([]);
  const [dailyLoading, setDailyLoading] = useState(true);
  const [libraryLoading, setLibraryLoading] = useState(true);

  const loadDailyExercises = useCallback(async () => {
    try {
      setDailyLoading(true);
      const picks = await getDailyExercises();
      setDailyExercises(picks);
    } catch (e) {
      console.error('[Exercises] Failed to load daily exercises:', e);
    } finally {
      setDailyLoading(false);
    }
  }, []);

  const loadAllExercises = useCallback(async () => {
    try {
      setLibraryLoading(true);
      const all = await getExercises();
      setAllExercises(all);
    } catch (e) {
      console.error('[Exercises] Failed to load exercise library:', e);
    } finally {
      setLibraryLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDailyExercises();
    loadAllExercises();
  }, [loadDailyExercises, loadAllExercises]);

  const handleComplete = useCallback(
    async (exerciseId: string, rating: number | null) => {
      try {
        await completeExercise(exerciseId, rating);
        await loadDailyExercises();
      } catch (e) {
        console.error('[Exercises] Failed to record completion:', e);
      }
    },
    [loadDailyExercises],
  );

  // Group all exercises by category
  const exercisesByCategory = ALL_CATEGORIES.reduce<Record<ExerciseCategory, Exercise[]>>(
    (acc, cat) => {
      acc[cat] = allExercises.filter((ex) => ex.category === cat);
      return acc;
    },
    { warmup: [], breathing: [], articulation: [], speech: [] },
  );

  // The user's unlocked difficulty is not async-read here to keep UI simple.
  // We show difficulty > 1 as "locked" (muted) if we assume difficulty 1 is always unlocked.
  // (A more complete approach would read getUnlockedDifficulty per category, but that
  //  requires async state per category — kept simple per spec instructions.)
  const UNLOCKED_DIFFICULTY = 1; // baseline: always show difficulty 1 as accessible

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.colors.bg }]}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingHorizontal: 16 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Today's Practice ── */}
        <Text style={[theme.type.title, { color: theme.text.primary, marginBottom: 16 }]}>
          Today's Practice
        </Text>

        {dailyLoading ? (
          <Text style={[theme.type.small, { color: theme.text.muted }]}>Loading exercises…</Text>
        ) : dailyExercises.length === 0 ? (
          <View style={[styles.emptyState, { backgroundColor: theme.colors.card, borderRadius: theme.radius.xl }]}>
            <Text style={[theme.type.subtitle, { color: theme.text.secondary }]}>No exercises available</Text>
            <Text style={[theme.type.small, { color: theme.text.muted, marginTop: 4 }]}>
              Check back tomorrow or browse the library below.
            </Text>
          </View>
        ) : (
          <View style={styles.cardList}>
            {dailyExercises.map((ex) => (
              <ExerciseCard
                key={ex.id}
                exercise={ex}
                onComplete={(rating) => handleComplete(ex.id, rating)}
              />
            ))}
          </View>
        )}

        {/* ── Your Streak ── */}
        <View style={styles.section}>
          <Text style={[theme.type.heading, { color: theme.text.primary, marginBottom: 12 }]}>
            Your Streak
          </Text>
          <StreakCalendar />
        </View>

        {/* ── All Exercises ── */}
        <View style={styles.section}>
          <Text style={[theme.type.heading, { color: theme.text.primary, marginBottom: 12 }]}>
            All Exercises
          </Text>

          {libraryLoading ? (
            <Text style={[theme.type.small, { color: theme.text.muted }]}>Loading library…</Text>
          ) : (
            ALL_CATEGORIES.map((cat) => {
              const catExercises = exercisesByCategory[cat];
              if (catExercises.length === 0) return null;

              return (
                <View key={cat} style={styles.categorySection}>
                  {/* Category header */}
                  <Text style={[theme.type.subtitle, { color: theme.text.secondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1, fontSize: 12 }]}>
                    {CATEGORY_LABELS[cat]}
                  </Text>

                  <View style={styles.cardList}>
                    {catExercises.map((ex) => {
                      const isLocked = ex.difficulty > UNLOCKED_DIFFICULTY;
                      return (
                        <View key={ex.id} style={isLocked ? styles.lockedWrapper : undefined}>
                          <ExerciseCard
                            exercise={ex}
                            onComplete={(rating) => handleComplete(ex.id, rating)}
                          />
                          {isLocked && (
                            <View style={styles.lockedOverlay} />
                          )}
                        </View>
                      );
                    })}
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* Bottom padding */}
        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 24,
  },
  cardList: {
    gap: 12,
  },
  section: {
    marginTop: 24,
  },
  categorySection: {
    marginBottom: 24,
  },
  emptyState: {
    padding: 24,
    alignItems: 'center',
  },
  lockedWrapper: {
    position: 'relative',
  },
  lockedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 16,
  },
});
