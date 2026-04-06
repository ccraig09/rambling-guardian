import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../src/theme/theme';
import { ExerciseCard, getCategoryColor } from '../../src/components/ExerciseCard';
import { StreakCalendar } from '../../src/components/StreakCalendar';
import { getDailyExercises, getUnlockedDifficulty } from '../../src/services/exerciseEngine';
import {
  getExercises,
  completeExercise,
  getCategoryCompletions,
  getFavoriteIds,
  getFavoriteExercises,
  toggleFavorite,
  autoFavoriteIfHighRated,
} from '../../src/db/exercises';
import type { Exercise, ExerciseCategory } from '../../src/types';

// ─── Constants ──────────────────────────────────────────────────────────────

const ALL_CATEGORIES: ExerciseCategory[] = ['warmup', 'breathing', 'articulation', 'speech'];

const CATEGORY_LABELS: Record<ExerciseCategory, string> = {
  warmup: 'Warm-Up',
  breathing: 'Breathing',
  articulation: 'Articulation',
  speech: 'Speech',
};

const CATEGORY_DESCRIPTIONS: Record<ExerciseCategory, string> = {
  warmup: 'Loosen your jaw, lips, and vocal cords before speaking.',
  breathing: 'Calm your nervous system and control your pace.',
  articulation: 'Sharpen consonants and vowels for crystal-clear speech.',
  speech: 'Practice real-world speaking patterns \u2014 pacing, pausing, storytelling.',
};

// ─── Skeleton ───────────────────────────────────────────────────────────────

type Theme = ReturnType<typeof import('../../src/theme/theme').useTheme>;

function SkeletonExerciseCards({ theme, count = 3 }: { theme: Theme; count?: number }) {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.85, duration: 750, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 750, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  return (
    <View style={{ gap: 12 }}>
      {Array.from({ length: count }).map((_, i) => (
        <Animated.View
          key={i}
          style={{
            backgroundColor: theme.colors.card,
            borderRadius: theme.radius.xl,
            padding: 16,
            gap: 10,
            opacity,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ width: '55%', height: 14, backgroundColor: theme.colors.elevated, borderRadius: 6 }} />
            <View style={{ width: 28, height: 28, backgroundColor: theme.colors.elevated, borderRadius: theme.radius.full }} />
          </View>
          <View style={{ width: '80%', height: 12, backgroundColor: theme.colors.elevated, borderRadius: 6 }} />
          <View style={{ width: '45%', height: 12, backgroundColor: theme.colors.elevated, borderRadius: 6 }} />
        </Animated.View>
      ))}
    </View>
  );
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function ExercisesScreen() {
  const theme = useTheme();
  const libraryRef = useRef<View>(null);
  const scrollRef = useRef<ScrollView>(null);

  // Daily exercises
  const [dailyExercises, setDailyExercises] = useState<Exercise[]>([]);
  const [dailyLoading, setDailyLoading] = useState(true);

  // Library
  const [allExercises, setAllExercises] = useState<Exercise[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(true);

  // Favorites
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [favoriteExercises, setFavoriteExercises] = useState<Exercise[]>([]);

  // Tabbed navigation
  const [selectedCategory, setSelectedCategory] = useState<ExerciseCategory>('warmup');
  const [unlockedDifficulties, setUnlockedDifficulties] = useState<Record<ExerciseCategory, number>>({
    warmup: 1, breathing: 1, articulation: 1, speech: 1,
  });
  const [categoryCompletions, setCategoryCompletions] = useState<Record<ExerciseCategory, number>>({
    warmup: 0, breathing: 0, articulation: 0, speech: 0,
  });

  // ─── Data loaders ───────────────────────────────────────────────────────────

  const loadUnlockData = useCallback(async () => {
    const [difficulties, completions] = await Promise.all([
      Promise.all(ALL_CATEGORIES.map((c) => getUnlockedDifficulty(c))),
      Promise.all(ALL_CATEGORIES.map((c) => getCategoryCompletions(c))),
    ]);

    const dMap = {} as Record<ExerciseCategory, number>;
    const cMap = {} as Record<ExerciseCategory, number>;
    ALL_CATEGORIES.forEach((cat, i) => {
      dMap[cat] = difficulties[i];
      cMap[cat] = completions[i];
    });

    setUnlockedDifficulties(dMap);
    setCategoryCompletions(cMap);
  }, []);

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

  const loadFavorites = useCallback(async () => {
    try {
      const [ids, exs] = await Promise.all([getFavoriteIds(), getFavoriteExercises()]);
      setFavoriteIds(new Set(ids));
      setFavoriteExercises(exs);
    } catch (e) {
      console.error('[Exercises] Failed to load favorites:', e);
    }
  }, []);

  useEffect(() => {
    loadDailyExercises();
    loadAllExercises();
    loadUnlockData();
    loadFavorites();
  }, [loadDailyExercises, loadAllExercises, loadUnlockData, loadFavorites]);

  // ─── Handlers ───────────────────────────────────────────────────────────────

  const handleComplete = useCallback(
    async (exerciseId: string, rating: number | null) => {
      try {
        await completeExercise(exerciseId, rating);
        await autoFavoriteIfHighRated(exerciseId, rating);
        // Reload everything after a completion
        await Promise.all([loadDailyExercises(), loadUnlockData(), loadFavorites()]);
      } catch (e) {
        console.error('[Exercises] Failed to record completion:', e);
      }
    },
    [loadDailyExercises, loadUnlockData, loadFavorites],
  );

  const handleToggleFavorite = useCallback(async (exerciseId: string) => {
    try {
      await toggleFavorite(exerciseId);
      const ids = await getFavoriteIds();
      setFavoriteIds(new Set(ids));
      const exs = await getFavoriteExercises();
      setFavoriteExercises(exs);
    } catch (e) {
      console.error('[Exercises] Failed to toggle favorite:', e);
    }
  }, []);

  const scrollToLibrary = useCallback(() => {
    libraryRef.current?.measureLayout(
      scrollRef.current as any,
      (_x, y) => {
        scrollRef.current?.scrollTo({ y, animated: true });
      },
      () => {},
    );
  }, []);

  // ─── Derived data ─────────────────────────────────────────────────────────

  const categoryExercises = allExercises
    .filter((ex) => ex.category === selectedCategory)
    .sort((a, b) => a.difficulty - b.difficulty || a.sortOrder - b.sortOrder);

  const unlocked = unlockedDifficulties[selectedCategory];
  const completions = categoryCompletions[selectedCategory];

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.colors.bg }]}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.scrollContent, { paddingHorizontal: 16 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Today's Practice ── */}
        <Text style={[theme.type.title, { color: theme.text.primary, marginBottom: 8 }]}>
          Today&apos;s Practice
        </Text>
        <Text style={[theme.type.small, { color: theme.text.secondary, marginBottom: 12 }]}>
          3 exercises picked fresh for you — one from each category.
        </Text>
        <View style={styles.categoryLegend}>
          {ALL_CATEGORIES.map((cat) => (
            <View key={cat} style={styles.legendChip}>
              <View style={[styles.catDot, { backgroundColor: getCategoryColor(cat, theme) }]} />
              <Text style={[theme.type.caption, { color: theme.text.muted }]}>
                {CATEGORY_LABELS[cat]}
              </Text>
            </View>
          ))}
        </View>

        {dailyLoading ? (
          <SkeletonExerciseCards theme={theme} count={3} />
        ) : dailyExercises.length === 0 ? (
          <View style={[styles.emptyState, { backgroundColor: theme.colors.card, borderRadius: theme.radius.xl }]}>
            <Text style={[theme.type.subtitle, { color: theme.text.primary }]}>
              Your first exercise takes 2 minutes
            </Text>
            <Text style={[theme.type.small, { color: theme.text.secondary, marginTop: 4, textAlign: 'center' }]}>
              Voice exercises help you speak with more clarity and confidence.
            </Text>
            <Pressable
              style={[styles.ctaButton, { backgroundColor: theme.primary[500], borderRadius: theme.radius.full, marginTop: 12 }]}
              onPress={scrollToLibrary}
              accessibilityRole="button"
              accessibilityLabel="Browse exercises"
            >
              <Text style={[theme.type.subtitle, { color: theme.text.onColor }]}>Browse exercises</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.cardList}>
            {dailyExercises.map((ex) => (
              <ExerciseCard
                key={ex.id}
                exercise={ex}
                isFavorited={favoriteIds.has(ex.id)}
                onToggleFavorite={() => handleToggleFavorite(ex.id)}
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

        {/* ── Favorites ── */}
        {favoriteIds.size > 0 && (
          <View style={styles.section}>
            <Text style={[theme.type.heading, { color: theme.text.primary, marginBottom: 8 }]}>
              Favorites
            </Text>
            <Text style={[theme.type.small, { color: theme.text.secondary, marginBottom: 12 }]}>
              Your bookmarked and highly-rated exercises.
            </Text>
            <View style={styles.cardList}>
              {favoriteExercises.map((ex) => (
                <ExerciseCard
                  key={ex.id}
                  exercise={ex}
                  isFavorited={favoriteIds.has(ex.id)}
                  onToggleFavorite={() => handleToggleFavorite(ex.id)}
                  onComplete={(rating) => handleComplete(ex.id, rating)}
                />
              ))}
            </View>
          </View>
        )}

        {/* ── Exercise Library ── */}
        <View ref={libraryRef} style={styles.section}>
          <Text style={[theme.type.heading, { color: theme.text.primary, marginBottom: 8 }]}>
            Exercise Library
          </Text>
          <Text style={[theme.type.small, { color: theme.text.secondary, marginBottom: 16 }]}>
            {CATEGORY_DESCRIPTIONS[selectedCategory]}
          </Text>

          {/* Category tab row */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabRow}
          >
            {ALL_CATEGORIES.map((cat) => {
              const isSelected = cat === selectedCategory;
              return (
                <Pressable
                  key={cat}
                  style={[
                    styles.tab,
                    {
                      backgroundColor: isSelected ? theme.primary[500] : theme.colors.elevated,
                      borderRadius: theme.radius.full,
                    },
                  ]}
                  onPress={() => setSelectedCategory(cat)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={CATEGORY_LABELS[cat]}
                >
                  <Text
                    style={[
                      theme.type.small,
                      {
                        color: isSelected ? theme.text.onColor : theme.text.secondary,
                        fontFamily: theme.fontFamily.semibold,
                      },
                    ]}
                  >
                    {CATEGORY_LABELS[cat]}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Difficulty legend */}
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <Text style={[styles.legendDot, { color: theme.primary[500] }]}>{'\u25CF'}</Text>
              <Text style={[theme.type.caption, { color: theme.text.muted }]}>Beginner</Text>
            </View>
            <View style={styles.legendItem}>
              <Text style={[styles.legendDot, { color: theme.primary[500] }]}>{'\u25CF\u25CF'}</Text>
              <Text style={[theme.type.caption, { color: theme.text.muted }]}>Intermediate</Text>
            </View>
            <View style={styles.legendItem}>
              <Text style={[styles.legendDot, { color: theme.primary[500] }]}>{'\u25CF\u25CF\u25CF'}</Text>
              <Text style={[theme.type.caption, { color: theme.text.muted }]}>Advanced</Text>
            </View>
          </View>

          {/* Exercise list */}
          {libraryLoading ? (
            <SkeletonExerciseCards theme={theme} count={4} />
          ) : (
            <View style={styles.cardList}>
              {categoryExercises.map((ex) => {
                const isLocked = ex.difficulty > unlocked;

                if (!isLocked) {
                  return (
                    <ExerciseCard
                      key={ex.id}
                      exercise={ex}
                      isFavorited={favoriteIds.has(ex.id)}
                      onToggleFavorite={() => handleToggleFavorite(ex.id)}
                      onComplete={(rating) => handleComplete(ex.id, rating)}
                    />
                  );
                }

                // Locked overlay with progress
                const threshold = ex.difficulty * 5;
                const remaining = Math.max(0, threshold - completions);
                const progress = Math.min(1, completions / threshold);

                return (
                  <View key={ex.id} style={styles.lockedWrapper}>
                    <ExerciseCard
                      exercise={ex}
                      isFavorited={favoriteIds.has(ex.id)}
                      onToggleFavorite={() => handleToggleFavorite(ex.id)}
                      onComplete={(rating) => handleComplete(ex.id, rating)}
                    />
                    <View style={[styles.lockedOverlay, { borderRadius: theme.radius.xl }]}>
                      <View style={styles.lockBadge}>
                        <Text style={[theme.type.small, { color: '#fff', textAlign: 'center', fontFamily: theme.fontFamily.semibold }]}>
                          Complete {remaining} more {selectedCategory} exercises to unlock
                        </Text>
                        <View style={[styles.progressTrack, { backgroundColor: theme.colors.elevated }]}>
                          <View
                            style={[
                              styles.progressFill,
                              { backgroundColor: theme.primary[500], width: `${progress * 100}%` as any },
                            ]}
                          />
                        </View>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Bottom padding */}
        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

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
  emptyState: {
    padding: 24,
    alignItems: 'center',
  },
  ctaButton: {
    height: 44,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // ── Tab row ──
  tabRow: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 4,
  },
  tab: {
    height: 44,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // ── Difficulty legend ──
  legendRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 12,
    marginBottom: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    fontSize: 10,
  },
  // ── Category color legend ──
  categoryLegend: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  legendChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  catDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  // ── Locked exercises ──
  lockedWrapper: {
    position: 'relative',
  },
  lockedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  lockBadge: {
    alignItems: 'center',
    gap: 8,
    maxWidth: 240,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    alignSelf: 'stretch',
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
  },
});
