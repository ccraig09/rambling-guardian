import { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
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

export function StreakCalendar() {
  const theme = useTheme();
  const today = todayISO();
  const now = new Date();

  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-indexed
  const [streaks, setStreaks] = useState<Streak[]>([]);
  const [currentStreak, setCurrentStreak] = useState(0);

  const loadData = useCallback(async () => {
    const ym = toYearMonth(year, month);
    const [monthStreaks, streak] = await Promise.all([
      getStreaksForMonth(ym),
      getCurrentStreak(),
    ]);
    setStreaks(monthStreaks);
    setCurrentStreak(streak);
  }, [year, month]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function goToPrevMonth() {
    if (month === 0) {
      setYear((y) => y - 1);
      setMonth(11);
    } else {
      setMonth((m) => m - 1);
    }
  }

  function goToNextMonth() {
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
      return { bgColor: theme.primary[500], borderColor: null };
    }
    if (streak && streak.exercisesDone > 0) {
      return { bgColor: theme.primary[200], borderColor: null };
    }
    if (isToday) {
      return { bgColor: 'transparent', borderColor: theme.primary[500] };
    }
    return { bgColor: theme.colors.elevated, borderColor: null };
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.card, borderRadius: theme.radius.xl }]}>
      {/* Streak headline */}
      <View style={styles.streakRow}>
        <Text style={[theme.type.heading, { color: theme.text.primary }]}>
          {currentStreak}
        </Text>
        <Text style={[theme.type.small, { color: theme.text.brand, marginLeft: 8 }]}>
          {currentStreak === 1 ? 'day streak' : 'day streak'}{currentStreak > 0 ? '  Keep it up!' : '  Start today!'}
        </Text>
      </View>

      {/* Month navigation */}
      <View style={styles.navRow}>
        <Pressable
          onPress={goToPrevMonth}
          hitSlop={12}
          style={styles.navButton}
          accessibilityLabel="Previous month"
        >
          <Text style={[theme.type.subtitle, { color: theme.text.secondary }]}>{'<'}</Text>
        </Pressable>

        <Text style={[theme.type.subtitle, { color: theme.text.primary }]}>
          {MONTH_NAMES[month]} {year}
        </Text>

        <Pressable
          onPress={goToNextMonth}
          hitSlop={12}
          style={styles.navButton}
          accessibilityLabel="Next month"
        >
          <Text style={[theme.type.subtitle, { color: theme.text.secondary }]}>{'>'}</Text>
        </Pressable>
      </View>

      {/* Day label row */}
      <View style={styles.dayLabelRow}>
        {DAY_LABELS.map((label, i) => (
          <Text
            key={`label-${i}`}
            style={[theme.type.caption, { color: theme.text.muted, width: 36, textAlign: 'center' }]}
          >
            {label}
          </Text>
        ))}
      </View>

      {/* Grid */}
      <View style={styles.grid}>
        {grid.map((cell, i) => {
          const { bgColor, borderColor } = getCellStyle(cell);
          return (
            <View
              key={i}
              style={[
                styles.cell,
                {
                  backgroundColor: bgColor,
                  borderRadius: theme.radius.sm,
                  borderWidth: borderColor ? 1.5 : 0,
                  borderColor: borderColor ?? 'transparent',
                },
              ]}
            >
              {cell.day !== null && (
                <Text style={[theme.type.caption, { color: theme.text.muted }]}>
                  {cell.day}
                </Text>
              )}
            </View>
          );
        })}
      </View>

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
          <Text style={[theme.type.caption, { color: theme.text.muted }]}>Full day</Text>
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
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
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
