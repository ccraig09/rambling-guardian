import { useState } from 'react';
import { View, Text, Pressable, Alert, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../theme/theme';
import type { Exercise, ExerciseCategory } from '../types';
import { StepTimer } from './StepTimer';

interface ExerciseCardProps {
  exercise: Exercise;
  onStart?: () => void;
  onComplete: (rating: number | null) => void;
}

type CardState = 'collapsed' | 'preview' | 'active' | 'completed';

const DIFFICULTY_LABELS: Record<number, string> = {
  1: 'Beginner',
  2: 'Intermediate',
  3: 'Advanced',
};

function getCategoryColor(category: ExerciseCategory, theme: ReturnType<typeof useTheme>): string {
  switch (category) {
    case 'warmup':       return theme.alert.gentle;
    case 'breathing':    return theme.alert.safe;
    case 'articulation': return theme.alert.moderate;
    case 'speech':       return theme.primary[500];
  }
}

function CategoryBadge({ category }: { category: ExerciseCategory }) {
  const theme = useTheme();
  const color = getCategoryColor(category, theme);
  return (
    <View style={[styles.badge, { backgroundColor: `${color}26` }]}>
      <Text style={[theme.type.caption, { color, fontFamily: theme.fontFamily.semibold, textTransform: 'capitalize' }]}>
        {category}
      </Text>
    </View>
  );
}

export function ExerciseCard({ exercise, onStart, onComplete }: ExerciseCardProps) {
  const theme = useTheme();
  const [cardState, setCardState] = useState<CardState>('collapsed');
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [selectedRating, setSelectedRating] = useState<number | null>(null);

  const steps = exercise.instructions;
  const currentStep = steps[currentStepIndex];

  const difficultyLabel = DIFFICULTY_LABELS[exercise.difficulty] ?? `Difficulty ${exercise.difficulty}`;
  const totalMinutes = Math.floor(exercise.durationSeconds / 60);
  const totalSecs = exercise.durationSeconds % 60;
  const durationStr = totalMinutes > 0
    ? `${totalMinutes}m ${totalSecs > 0 ? `${totalSecs}s` : ''}`.trim()
    : `${totalSecs}s`;

  function resetToCollapsed() {
    setCardState('collapsed');
    setCurrentStepIndex(0);
    setIsPaused(false);
    setSelectedRating(null);
  }

  function handleStart() {
    setCurrentStepIndex(0);
    setIsPaused(false);
    setCardState('active');
    onStart?.();
  }

  function advanceStep() {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < steps.length) {
      setCurrentStepIndex(nextIndex);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCardState('completed');
    }
  }

  function handleSkip() {
    advanceStep();
  }

  function handleStepDotPress(index: number) {
    if (index < currentStepIndex) {
      setCurrentStepIndex(index);
      setIsPaused(true);
    }
  }

  function handleStop() {
    Alert.alert(
      'Stop Exercise?',
      "Your progress won't be saved.",
      [
        { text: 'Continue', style: 'cancel' },
        { text: 'Stop', style: 'destructive', onPress: resetToCollapsed },
      ],
    );
  }

  function handleRatingSelect(rating: number) {
    setSelectedRating(rating);
  }

  function handleDone() {
    onComplete(selectedRating);
    resetToCollapsed();
  }

  function handleSkipRating() {
    onComplete(null);
    resetToCollapsed();
  }

  // ─── Collapsed state ────────────────────────────────────────────────────────
  if (cardState === 'collapsed') {
    return (
      <Pressable
        style={[styles.card, { backgroundColor: theme.colors.card }]}
        onPress={() => setCardState('preview')}
        accessibilityRole="button"
        accessibilityLabel={`Preview ${exercise.title}`}
      >
        <CategoryBadge category={exercise.category} />
        <Text style={[theme.type.subtitle, { color: theme.text.primary, marginTop: 4 }]}>
          {exercise.title}
        </Text>
        <Text style={[theme.type.small, { color: theme.text.secondary, marginTop: 4 }]}>
          {exercise.description}
        </Text>
        <View style={styles.metaRow}>
          <Text style={[theme.type.caption, { color: theme.text.tertiary }]}>
            {durationStr}
          </Text>
          <Text style={[theme.type.caption, { color: theme.text.tertiary }]}>
            {'\u00B7'}
          </Text>
          <Text style={[theme.type.caption, { color: theme.text.tertiary }]}>
            {difficultyLabel}
          </Text>
        </View>
      </Pressable>
    );
  }

  // ─── Preview state ──────────────────────────────────────────────────────────
  if (cardState === 'preview') {
    return (
      <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
        <CategoryBadge category={exercise.category} />
        <Text style={[theme.type.subtitle, { color: theme.text.primary, marginTop: 4 }]}>
          {exercise.title}
        </Text>

        <View style={[styles.divider, { backgroundColor: theme.colors.elevated }]} />

        {/* Step list */}
        <View style={styles.stepList}>
          {steps.map((s) => (
            <View key={s.step} style={styles.stepListItem}>
              <Text style={[theme.type.body, { color: theme.text.primary, flex: 1 }]}>
                Step {s.step} {'\u00B7'} {s.durationSeconds}s
              </Text>
              <Text style={[theme.type.small, { color: theme.text.secondary, flex: 2 }]} numberOfLines={2}>
                {s.text}
              </Text>
            </View>
          ))}
        </View>

        <Text style={[theme.type.caption, { color: theme.text.tertiary, textAlign: 'center' }]}>
          Total: {durationStr}
        </Text>

        {/* Start button */}
        <Pressable
          style={[styles.primaryButton, { backgroundColor: theme.primary[500], borderRadius: theme.radius.lg }]}
          onPress={handleStart}
          accessibilityRole="button"
          accessibilityLabel="Start exercise"
        >
          <Text style={[theme.type.body, { color: theme.text.onColor, fontFamily: theme.fontFamily.semibold }]}>
            Start Exercise
          </Text>
        </Pressable>

        {/* Back button */}
        <Pressable
          style={styles.textButton}
          onPress={resetToCollapsed}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={[theme.type.small, { color: theme.text.tertiary }]}>Back</Text>
        </Pressable>
      </View>
    );
  }

  // ─── Active state ───────────────────────────────────────────────────────────
  if (cardState === 'active') {
    const stepProgress = `Step ${currentStepIndex + 1} of ${steps.length}`;

    return (
      <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
        <CategoryBadge category={exercise.category} />
        <Text style={[theme.type.subtitle, { color: theme.text.primary, marginTop: 4 }]}>
          {exercise.title}
        </Text>

        <View style={[styles.divider, { backgroundColor: theme.colors.elevated }]} />

        {/* Step indicator dots */}
        <View style={styles.dotRow}>
          {steps.map((_, i) => {
            const isCompleted = i < currentStepIndex;
            const isCurrent = i === currentStepIndex;
            const dotBg = isCompleted
              ? theme.primary[500]
              : isCurrent
                ? 'transparent'
                : theme.colors.elevated;
            const dotBorder = isCurrent ? theme.primary[500] : 'transparent';
            return (
              <Pressable
                key={i}
                style={styles.dotTouchTarget}
                onPress={() => handleStepDotPress(i)}
                accessibilityRole="button"
                accessibilityLabel={`Go to step ${i + 1}`}
                disabled={i >= currentStepIndex}
              >
                <View
                  style={[
                    styles.dot,
                    {
                      backgroundColor: dotBg,
                      borderColor: dotBorder,
                      borderWidth: isCurrent ? 2 : 0,
                    },
                  ]}
                />
              </Pressable>
            );
          })}
        </View>

        {/* Current step text */}
        <Text style={[theme.type.body, { color: theme.text.primary, textAlign: 'center' }]}>
          {currentStep?.text}
        </Text>

        <Text style={[theme.type.caption, { color: theme.text.tertiary, textAlign: 'center' }]}>
          {stepProgress}
        </Text>

        {/* Timer */}
        {currentStep && (
          <StepTimer
            key={`${currentStepIndex}-${currentStep.durationSeconds}`}
            durationSeconds={currentStep.durationSeconds}
            isPaused={isPaused}
            onComplete={advanceStep}
          />
        )}

        {/* Control row: Pause + Skip */}
        <View style={styles.controlRow}>
          <View style={styles.controlItem}>
            <Pressable
              style={[styles.controlButton, { backgroundColor: theme.primary[500] }]}
              onPress={() => setIsPaused((p) => !p)}
              accessibilityRole="button"
              accessibilityLabel={isPaused ? 'Resume' : 'Pause'}
            >
              {isPaused ? (
                <View style={[styles.playTriangle, { borderLeftColor: theme.text.onColor }]} />
              ) : (
                <View style={styles.pauseIcon}>
                  <View style={[styles.pauseBar, { backgroundColor: theme.text.onColor }]} />
                  <View style={[styles.pauseBar, { backgroundColor: theme.text.onColor }]} />
                </View>
              )}
            </Pressable>
            <Text style={[theme.type.caption, { color: theme.text.tertiary, marginTop: 4 }]}>
              {isPaused ? 'Resume' : 'Pause'}
            </Text>
          </View>

          <View style={styles.controlItem}>
            <Pressable
              style={[styles.controlButton, { backgroundColor: theme.colors.elevated }]}
              onPress={handleSkip}
              accessibilityRole="button"
              accessibilityLabel="Skip this step"
            >
              <Text style={{ fontSize: 18, color: theme.text.secondary }}>{'>'}</Text>
            </Pressable>
            <Text style={[theme.type.caption, { color: theme.text.tertiary, marginTop: 4 }]}>
              Skip
            </Text>
          </View>
        </View>

        {/* Stop button */}
        <Pressable
          style={[styles.ghostButton, { borderColor: theme.colors.elevated, borderRadius: theme.radius.lg }]}
          onPress={handleStop}
          accessibilityRole="button"
          accessibilityLabel="Stop exercise"
        >
          <Text style={[theme.type.body, { color: theme.text.tertiary }]}>
            Stop Exercise
          </Text>
        </Pressable>
      </View>
    );
  }

  // ─── Completed state ────────────────────────────────────────────────────────
  return (
    <View style={[styles.card, { backgroundColor: theme.colors.card, alignItems: 'center' }]}>
      {/* Green check circle */}
      <View style={[styles.checkCircle, { backgroundColor: `${theme.alert.safe}26` }]}>
        <Text style={{ fontSize: 32, color: theme.alert.safe }}>{'✓'}</Text>
      </View>

      <Text style={[theme.type.heading, { color: theme.text.primary, marginTop: 8 }]}>
        Nice work!
      </Text>
      <Text style={[theme.type.small, { color: theme.text.secondary, marginTop: 4 }]}>
        {exercise.title}
      </Text>
      <Text style={[theme.type.caption, { color: theme.text.tertiary, marginTop: 8 }]}>
        How did that feel?
      </Text>

      {/* Rating row */}
      <View style={styles.ratingRow}>
        {[1, 2, 3, 4, 5].map((n) => {
          const isSelected = selectedRating === n;
          const dotColor = isSelected ? theme.primary[500] : theme.colors.elevated;
          return (
            <View key={n} style={styles.ratingItem}>
              <Pressable
                style={[
                  styles.ratingDot,
                  { backgroundColor: dotColor },
                ]}
                onPress={() => handleRatingSelect(n)}
                accessibilityRole="button"
                accessibilityLabel={`Rate ${n} out of 5`}
              >
                <Text style={[theme.type.caption, { color: isSelected ? theme.text.onColor : theme.text.tertiary }]}>
                  {n}
                </Text>
              </Pressable>
              {n === 1 && (
                <Text style={[theme.type.caption, { color: theme.text.muted, marginTop: 2 }]}>Hard</Text>
              )}
              {n === 5 && (
                <Text style={[theme.type.caption, { color: theme.text.muted, marginTop: 2 }]}>Easy</Text>
              )}
            </View>
          );
        })}
      </View>

      {/* Done button */}
      <Pressable
        style={[styles.primaryButton, { backgroundColor: theme.primary[500], borderRadius: theme.radius.lg }]}
        onPress={handleDone}
        accessibilityRole="button"
        accessibilityLabel="Done"
      >
        <Text style={[theme.type.body, { color: theme.text.onColor, fontFamily: theme.fontFamily.semibold }]}>
          Done
        </Text>
      </Pressable>

      {/* Skip rating */}
      <Pressable
        style={styles.textButton}
        onPress={handleSkipRating}
        accessibilityRole="button"
        accessibilityLabel="Skip rating"
      >
        <Text style={[theme.type.small, { color: theme.text.muted }]}>
          Skip rating
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    marginTop: 4,
  },
  divider: {
    height: 1,
    alignSelf: 'stretch',
    marginVertical: 4,
  },
  stepList: {
    gap: 8,
  },
  stepListItem: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  primaryButton: {
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    marginTop: 4,
  },
  textButton: {
    alignSelf: 'center',
    paddingHorizontal: 16,
    minHeight: 44,
    justifyContent: 'center',
  },
  ghostButton: {
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    borderWidth: 1,
    marginTop: 4,
  },
  dotRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
  },
  dotTouchTarget: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  controlRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 32,
    marginTop: 4,
  },
  controlItem: {
    alignItems: 'center',
  },
  controlButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pauseIcon: {
    flexDirection: 'row',
    gap: 4,
  },
  pauseBar: {
    width: 4,
    height: 16,
    borderRadius: 2,
  },
  playTriangle: {
    width: 0,
    height: 0,
    borderTopWidth: 8,
    borderBottomWidth: 8,
    borderLeftWidth: 14,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    marginLeft: 3,
  },
  checkCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratingRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  ratingItem: {
    alignItems: 'center',
  },
  ratingDot: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
