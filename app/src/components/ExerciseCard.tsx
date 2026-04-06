import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../theme/theme';
import type { Exercise, ExerciseCategory } from '../types';
import { StepTimer } from './StepTimer';

interface ExerciseCardProps {
  exercise: Exercise;
  onStart?: () => void;
  onComplete: (rating: number | null) => void;
}

type CardState = 'collapsed' | 'active' | 'completed';

const DIFFICULTY_LABELS: Record<number, string> = {
  1: 'Beginner',
  2: 'Intermediate',
  3: 'Advanced',
};

function getCategoryColor(category: ExerciseCategory, theme: ReturnType<typeof useTheme>): string {
  switch (category) {
    case 'warmup':      return theme.alert.gentle;
    case 'breathing':   return theme.alert.safe;
    case 'articulation': return theme.alert.moderate;
    case 'speech':      return theme.primary[500];
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
  const [selectedRating, setSelectedRating] = useState<number | null>(null);

  const steps = exercise.instructions;
  const currentStep = steps[currentStepIndex];

  function handleStart() {
    setCurrentStepIndex(0);
    setCardState('active');
    onStart?.();
  }

  function advanceStep() {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < steps.length) {
      setCurrentStepIndex(nextIndex);
    } else {
      setCardState('completed');
    }
  }

  function handleSkip() {
    advanceStep();
  }

  function handleRatingSelect(rating: number) {
    setSelectedRating(rating);
    onComplete(rating);
  }

  // ─── Collapsed state ────────────────────────────────────────────────────────
  if (cardState === 'collapsed') {
    const difficultyLabel = DIFFICULTY_LABELS[exercise.difficulty] ?? `Difficulty ${exercise.difficulty}`;
    const minutes = Math.floor(exercise.durationSeconds / 60);
    const secs = exercise.durationSeconds % 60;
    const durationStr = minutes > 0
      ? `${minutes}m ${secs > 0 ? `${secs}s` : ''}`.trim()
      : `${secs}s`;

    return (
      <Pressable
        style={[styles.card, { backgroundColor: theme.colors.card }]}
        onPress={handleStart}
        accessibilityRole="button"
        accessibilityLabel={`Start ${exercise.title}`}
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

  // ─── Active state ────────────────────────────────────────────────────────────
  if (cardState === 'active') {
    const stepProgress = `Step ${currentStepIndex + 1} of ${steps.length}`;

    return (
      <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
        <CategoryBadge category={exercise.category} />
        <Text style={[theme.type.subtitle, { color: theme.text.primary, marginTop: 4 }]}>
          {exercise.title}
        </Text>

        <View style={[styles.divider, { backgroundColor: theme.colors.elevated }]} />

        <Text style={[theme.type.body, { color: theme.text.primary, textAlign: 'center' }]}>
          {currentStep?.text}
        </Text>

        <Text style={[theme.type.caption, { color: theme.text.tertiary }]}>
          {stepProgress}
        </Text>

        {currentStep && (
          <StepTimer
            key={`${currentStepIndex}-${currentStep.durationSeconds}`}
            durationSeconds={currentStep.durationSeconds}
            isActive={true}
            onComplete={advanceStep}
          />
        )}

        <Pressable
          style={[styles.skipButton, { minHeight: 48, justifyContent: 'center' }]}
          onPress={handleSkip}
          accessibilityRole="button"
          accessibilityLabel="Skip this step"
        >
          <Text style={[theme.type.small, { color: theme.text.tertiary }]}>
            Skip
          </Text>
        </Pressable>
      </View>
    );
  }

  // ─── Completed state ─────────────────────────────────────────────────────────
  return (
    <View style={[styles.card, { backgroundColor: theme.colors.card, alignItems: 'center' }]}>
      {/* Checkmark circle */}
      <View style={[styles.checkCircle, { backgroundColor: `${theme.alert.safe}26` }]}>
        <Text style={{ fontSize: 24 }}>{'✓'}</Text>
      </View>

      <Text style={[theme.type.subtitle, { color: theme.text.primary, marginTop: 8 }]}>
        {exercise.title}
      </Text>
      <Text style={[theme.type.small, { color: theme.text.secondary, textAlign: 'center', marginTop: 4 }]}>
        Great work! How did that feel?
      </Text>

      {/* Rating dots */}
      <View style={styles.ratingRow}>
        {[1, 2, 3, 4, 5].map((n) => {
          const isSelected = selectedRating === n;
          const dotColor = isSelected ? theme.primary[500] : theme.colors.elevated;
          return (
            <Pressable
              key={n}
              style={[styles.ratingDot, { backgroundColor: dotColor, minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' }]}
              onPress={() => handleRatingSelect(n)}
              accessibilityRole="button"
              accessibilityLabel={`Rate ${n} out of 5`}
            >
              <Text style={[theme.type.caption, { color: isSelected ? theme.text.onColor : theme.text.tertiary }]}>
                {n}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {selectedRating === null && (
        <Pressable
          style={[styles.skipButton, { minHeight: 48, justifyContent: 'center' }]}
          onPress={() => onComplete(null)}
          accessibilityRole="button"
          accessibilityLabel="Skip rating"
        >
          <Text style={[theme.type.small, { color: theme.text.muted }]}>
            Skip rating
          </Text>
        </Pressable>
      )}
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
  skipButton: {
    alignSelf: 'center',
    paddingHorizontal: 16,
  },
  checkCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratingRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  ratingDot: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
});
