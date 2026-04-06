/**
 * Home Screen — Welcome dashboard.
 *
 * Shows: time-of-day greeting, device connection status, today's exercise
 * progress, current streak, and voice enrollment CTA if incomplete.
 */
import { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useDeviceStore } from '../../src/stores/deviceStore';
import { useTheme } from '../../src/theme/theme';
import { getVoiceSampleCount } from '../../src/db/voiceSamples';
import { getTodayExerciseCount, getCurrentStreak } from '../../src/db/exercises';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

type Theme = ReturnType<typeof useTheme>;

function StatCard({
  value,
  label,
  icon,
  theme,
}: {
  value: string;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  theme: Theme;
}) {
  return (
    <View
      style={[
        styles.statCard,
        { backgroundColor: theme.colors.card, borderRadius: theme.radius.xl },
      ]}
    >
      <Ionicons name={icon} size={20} color={theme.primary[400]} style={styles.statIcon} />
      <Text style={[theme.type.heading, { color: theme.text.primary, fontSize: 28, letterSpacing: -1 }]}>
        {value}
      </Text>
      <Text style={[theme.type.caption, { color: theme.text.muted, marginTop: 2 }]}>{label}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function HomeScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const connected = useDeviceStore((s) => s.connected);
  const battery = useDeviceStore((s) => s.battery);

  const [sampleCount, setSampleCount] = useState<number | null>(null);
  const [todayCount, setTodayCount] = useState<number>(0);
  const [streak, setStreak] = useState<number>(0);

  const loadData = useCallback(async () => {
    const [samples, today, s] = await Promise.all([
      getVoiceSampleCount(),
      getTodayExerciseCount(),
      getCurrentStreak(),
    ]);
    setSampleCount(samples);
    setTodayCount(today);
    setStreak(s);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Refresh stats whenever the tab is focused (e.g. user returns from exercises)
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const showEnrollment = sampleCount !== null && sampleCount < 5;
  const dailyGoal = 3;
  const allDoneToday = todayCount >= dailyGoal;

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.bg, paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Greeting ── */}
        <Text style={[theme.type.title, { color: theme.text.primary }]}>
          {greeting()}
        </Text>
        <Text style={[theme.type.body, { color: theme.text.secondary, marginTop: 4, marginBottom: theme.spacing.xl }]}>
          {allDoneToday
            ? "You've finished today's practice. Great work."
            : "Let's get some practice in."}
        </Text>

        {/* ── Today's stats ── */}
        <View style={styles.statsRow}>
          <StatCard
            value={`${todayCount}/${dailyGoal}`}
            label="Today's exercises"
            icon="barbell-outline"
            theme={theme}
          />
          <StatCard
            value={streak === 0 ? '—' : `${streak}`}
            label={streak === 1 ? 'day streak' : 'day streak'}
            icon="flame-outline"
            theme={theme}
          />
        </View>

        {/* ── Practice CTA ── */}
        {!allDoneToday && (
          <Pressable
            onPress={() => router.push('/(tabs)/exercises')}
            style={[
              styles.ctaButton,
              { backgroundColor: theme.primary[500], borderRadius: theme.radius.xl },
            ]}
          >
            <Text style={[theme.type.subtitle, { color: theme.text.onColor }]}>
              Start today's practice
            </Text>
            <Ionicons name="arrow-forward" size={18} color={theme.text.onColor} />
          </Pressable>
        )}

        {/* ── Device status ── */}
        <View
          style={[
            styles.deviceCard,
            { backgroundColor: theme.colors.card, borderRadius: theme.radius.xl },
          ]}
        >
          <View style={styles.deviceRow}>
            <View style={[styles.statusDot, { backgroundColor: connected ? theme.alert.safe : theme.text.muted }]} />
            <View style={styles.deviceText}>
              <Text style={[theme.type.subtitle, { color: theme.text.primary }]}>
                {connected ? 'Device connected' : 'No device connected'}
              </Text>
              <Text style={[theme.type.small, { color: theme.text.muted, marginTop: 2 }]}>
                {connected
                  ? `RamblingGuard · ${battery}% battery`
                  : 'Go to Session tab to connect'}
              </Text>
            </View>
            <Ionicons
              name={connected ? 'radio' : 'radio-outline'}
              size={20}
              color={connected ? theme.alert.safe : theme.text.muted}
            />
          </View>
        </View>

        {/* ── Voice enrollment CTA ── */}
        {showEnrollment && (
          <Pressable
            onPress={() => router.push('/onboarding')}
            style={[
              styles.enrollCard,
              { backgroundColor: theme.colors.card, borderRadius: theme.radius.xl },
            ]}
          >
            <View
              style={[
                styles.enrollIcon,
                { backgroundColor: `${theme.primary[500]}22`, borderRadius: theme.radius.lg },
              ]}
            >
              <Ionicons name="mic-outline" size={22} color={theme.primary[400]} />
            </View>
            <View style={styles.enrollText}>
              <Text style={[theme.type.subtitle, { color: theme.text.primary }]}>
                Set up voice enrollment
              </Text>
              <Text style={[theme.type.small, { color: theme.text.tertiary, marginTop: 2 }]}>
                {sampleCount === 0
                  ? '5 short recordings · 2 min'
                  : `${sampleCount} of 5 samples recorded`}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.text.muted} />
          </Pressable>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    padding: 16,
    alignItems: 'flex-start',
  },
  statIcon: {
    marginBottom: 8,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    marginBottom: 24,
    minHeight: 52,
  },
  deviceCard: {
    padding: 16,
    marginBottom: 12,
  },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  deviceText: {
    flex: 1,
  },
  enrollCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  enrollIcon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  enrollText: {
    flex: 1,
  },
});
