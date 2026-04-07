import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Animated, StyleSheet, useWindowDimensions } from 'react-native';
import { useTheme } from '../theme/theme';
import { getStreaksForMonth, getCurrentStreak } from '../db/exercises';
import type { Streak } from '../types';

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function toYearMonth(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

interface DayCell {
  day: number | null; // null = empty filler before month start
  dateISO: string | null;
}

function buildGrid(year: number, month: number): DayCell[] {
  const firstDow = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: DayCell[] = [];

  // Leading empty cells
  for (let i = 0; i < firstDow; i++) {
    cells.push({ day: null, dateISO: null });
  }

  // Day cells
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({ day: d, dateISO: iso });
  }

  return cells;
}

const GRID_GAP = 4;
const COLUMNS = 7;

/** Calculate the cell size that fits exactly 7 columns in the available width. */
export function calculateCellSize(screenWidth: number, containerPadding = 16, outerPadding = 16): number {
  const available = screenWidth - (containerPadding + outerPadding) * 2;
  return Math.floor((available - (COLUMNS - 1) * GRID_GAP) / COLUMNS);
}

// Skeleton rows/cols for loading state
const SKELETON_ROWS = 5;
const SKELETON_COLS = 7;

export function StreakCalendar() {
  const theme = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const cellSize = calculateCellSize(screenWidth);
  const today = todayISO();
  const now = new Date();

  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-indexed
  const [streaks, setStreaks] = useState<Streak[]>([]);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Skeleton pulse animation
  const pulseAnim = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.5,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    const ym = toYearMonth(year, month);
    const [monthStreaks, streak] = await Promise.all([
      getStreaksForMonth(ym),
      getCurrentStreak(),
    ]);
    setStreaks(monthStreaks);
    setCurrentStreak(streak);
    setIsLoading(false);
  }, [year, month]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Month navigation capping
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();
  const isMinMonth = (() => {
    const minDate = new Date(now.getFullYear() - 1, now.getMonth(), 1);
    return year === minDate.getFullYear() && month === minDate.getMonth();
  })();

  function goToPrevMonth() {
    if (isMinMonth) return;
    setSelectedDate(null);
    if (month === 0) {
      setYear((y) => y - 1);
      setMonth(11);
    } else {
      setMonth((m) => m - 1);
    }
  }

  function goToNextMonth() {
    if (isCurrentMonth) return;
    setSelectedDate(null);
    if (month === 11) {
      setYear((y) => y + 1);
      setMonth(0);
    } else {
      setMonth((m) => m + 1);
    }
  }

  // Build streak lookup map for O(1) cell checks
  const streakMap = new Map<string, Streak>();
  for (const s of streaks) {
    streakMap.set(s.date, s);
  }

  const grid = buildGrid(year, month);

  function getCellStyle(cell: DayCell): {
    bgColor: string;
    borderColor: string | null;
  } {
    if (!cell.dateISO) return { bgColor: 'transparent', borderColor: null };

    const streak = streakMap.get(cell.dateISO);
    const isToday = cell.dateISO === today;

    if (streak && streak.exercisesDone > 0 && streak.sessionsDone > 0) {
      return {
        bgColor: theme.primary[500],
        borderColor: isToday ? theme.text.primary : null,
      };
    }
    if (streak && streak.exercisesDone > 0) {
      return {
        bgColor: theme.primary[200],
        borderColor: isToday ? theme.text.primary : null,
      };
    }
    if (isToday) {
      return { bgColor: 'transparent', borderColor: theme.primary[500] };
    }
    return { bgColor: theme.colors.elevated, borderColor: null };
  }

  function handleCellPress(dateISO: string | null) {
    if (!dateISO) return;
    setSelectedDate((prev) => (prev === dateISO ? null : dateISO));
  }

  // Selected date info for tooltip
  function getSelectedInfo(): string | null {
    if (!selectedDate) return null;
    const streak = streakMap.get(selectedDate);
    if (!streak) return 'No activity';
    const parts: string[] = [];
    if (streak.exercisesDone > 0) {
      parts.push(`${streak.exercisesDone} exercise${streak.exercisesDone === 1 ? '' : 's'} done`);
    }
    if (streak.sessionsDone > 0) {
      parts.push(`${streak.sessionsDone} session${streak.sessionsDone === 1 ? '' : 's'}`);
    }
    return parts.length > 0 ? parts.join(' · ') : 'No activity';
  }

  // Empty state: non-current month with zero streak entries
  const showEmptyState = !isLoading && !isCurrentMonth && streaks.length === 0;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.card, borderRadius: theme.radius.xl }]}>
      {/* Streak headline */}
      <View style={styles.streakRow}>
        <Text style={[theme.type.heading, { color: theme.text.primary }]}>
          {currentStreak}
        </Text>
        <Text style={[theme.type.small, { color: theme.text.brand, marginLeft: 8 }]}>
          {currentStreak > 0
            ? `day streak · Keep it up!`
            : 'Start your streak today!'}
        </Text>
      </View>

      {/* Month navigation */}
      <View style={styles.navRow}>
        <Pressable
          onPress={goToPrevMonth}
          hitSlop={12}
          style={[styles.navButton, isMinMonth && styles.navButtonDisabled]}
          accessibilityLabel="Previous month"
          disabled={isMinMonth}
        >
          <Text style={[theme.type.subtitle, { color: isMinMonth ? theme.text.muted : theme.text.secondary }]}>
            {'<'}
          </Text>
        </Pressable>

        <Text style={[theme.type.subtitle, { color: theme.text.primary }]}>
          {MONTH_NAMES[month]} {year}
        </Text>

        <Pressable
          onPress={goToNextMonth}
          hitSlop={12}
          style={[styles.navButton, isCurrentMonth && styles.navButtonDisabled]}
          accessibilityLabel="Next month"
          disabled={isCurrentMonth}
        >
          <Text style={[theme.type.subtitle, { color: isCurrentMonth ? theme.text.muted : theme.text.secondary }]}>
            {'>'}
          </Text>
        </Pressable>
      </View>

      {/* Day label row */}
      <View style={styles.dayLabelRow}>
        {DAY_LABELS.map((label, i) => (
          <Text
            key={`label-${i}`}
            style={[theme.type.caption, { color: theme.text.muted, width: cellSize, textAlign: 'center' }]}
          >
            {label}
          </Text>
        ))}
      </View>

      {/* Grid — loading skeleton or real cells */}
      {isLoading ? (
        <View style={styles.grid}>
          {Array.from({ length: SKELETON_ROWS * SKELETON_COLS }).map((_, i) => (
            <Animated.View
              key={`skel-${i}`}
              style={[
                styles.cell,
                {
                  width: cellSize,
                  height: cellSize,
                  backgroundColor: theme.colors.elevated,
                  borderRadius: theme.radius.sm,
                  opacity: pulseAnim,
                },
              ]}
            />
          ))}
        </View>
      ) : (
        <View style={styles.grid}>
          {grid.map((cell, i) => {
            const { bgColor, borderColor } = getCellStyle(cell);
            const isSelected = cell.dateISO != null && cell.dateISO === selectedDate;
            return (
              <Pressable
                key={i}
                onPress={() => handleCellPress(cell.dateISO)}
                disabled={cell.day === null}
                style={[
                  styles.cell,
                  {
                    width: cellSize,
                    height: cellSize,
                    backgroundColor: bgColor,
                    borderRadius: theme.radius.sm,
                    borderWidth: borderColor ? 1.5 : 0,
                    borderColor: borderColor ?? 'transparent',
                  },
                  isSelected && {
                    borderWidth: 2,
                    borderColor: theme.text.primary,
                  },
                ]}
                accessibilityLabel={
                  cell.dateISO
                    ? `${MONTH_NAMES[month]} ${cell.day}`
                    : undefined
                }
              >
                {cell.day !== null && (
                  <Text style={[theme.type.caption, { color: theme.text.muted }]}>
                    {cell.day}
                  </Text>
                )}
              </Pressable>
            );
          })}
        </View>
      )}

      {/* Selected date tooltip */}
      {selectedDate && !isLoading && (
        <View style={[styles.tooltip, { backgroundColor: theme.colors.elevated, borderRadius: theme.radius.md }]}>
          <Text style={[theme.type.caption, { color: theme.text.secondary }]}>
            {getSelectedInfo()}
          </Text>
        </View>
      )}

      {/* Empty state */}
      {showEmptyState && (
        <Text style={[theme.type.small, { color: theme.text.muted, textAlign: 'center' }]}>
          No activity in {MONTH_NAMES[month]}
        </Text>
      )}

      {/* Legend */}
      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendSquare, { backgroundColor: theme.colors.elevated, borderRadius: theme.radius.sm }]} />
          <Text style={[theme.type.caption, { color: theme.text.muted }]}>No activity</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendSquare, { backgroundColor: theme.primary[200], borderRadius: theme.radius.sm }]} />
          <Text style={[theme.type.caption, { color: theme.text.muted }]}>Exercises</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendSquare, { backgroundColor: theme.primary[500], borderRadius: theme.radius.sm }]} />
          <Text style={[theme.type.caption, { color: theme.text.muted }]}>Exercises + Session</Text>
        </View>
        <View style={styles.legendItem}>
          <View
            style={[
              styles.legendSquare,
              {
                backgroundColor: 'transparent',
                borderRadius: theme.radius.sm,
                borderWidth: 1.5,
                borderColor: theme.primary[500],
              },
            ]}
          />
          <Text style={[theme.type.caption, { color: theme.text.muted }]}>Today</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 12,
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navButtonDisabled: {
    opacity: 0.4,
  },
  dayLabelRow: {
    flexDirection: 'row',
    gap: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  cell: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tooltip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignSelf: 'center',
  },
  legendRow: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
    marginTop: 4,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendSquare: {
    width: 12,
    height: 12,
  },
});
