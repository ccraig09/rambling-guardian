/**
 * History Screen — Session history list with lifetime stats and per-session
 * alert timeline. Tap any session card to expand the alert timeline in-place.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Animated,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useTheme } from '../../src/theme/theme';
import { getSessions, getAlertEvents, getLifetimeStats, getSessionById } from '../../src/db/sessions';
import type { Session, AlertEvent } from '../../src/types';
import { AlertLevel } from '../../src/types';
import { formatSessionDate, formatDuration, formatTotalTime, formatOffset } from '../../src/utils/timeFormat';
import { generateSummary, summaryEligibilityReason } from '../../src/services/summaryService';
import { ANTHROPIC_API_KEY } from '../../src/config/anthropic';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getSessionLabel(session: Session): string | null {
  if (session.syncedFromDevice) return 'Synced from device';
  return null; // Default sessions don't need a special label
}

const ALERT_LABELS: Record<number, string> = {
  0: 'Clean',
  1: 'Gentle',
  2: 'Moderate',
  3: 'Urgent',
  4: 'Critical',
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

type Theme = ReturnType<typeof useTheme>;

function alertBadgeColor(level: AlertLevel, theme: Theme): string {
  switch (level) {
    case AlertLevel.GENTLE:   return theme.alert.gentle;
    case AlertLevel.MODERATE: return theme.alert.moderate;
    case AlertLevel.URGENT:   return theme.alert.urgent;
    case AlertLevel.CRITICAL: return theme.alert.urgent;
    default:                  return theme.alert.safe;
  }
}

interface StatPillProps {
  label: string;
  value: string;
  theme: Theme;
}

function StatPill({ label, value, theme }: StatPillProps) {
  return (
    <View style={[styles.statPill, { backgroundColor: theme.colors.elevated, borderRadius: theme.radius.xl }]}>
      <Text style={[theme.type.heading, { color: theme.text.primary }]}>{value}</Text>
      <Text style={[theme.type.caption, { color: theme.text.muted, marginTop: 2 }]}>{label}</Text>
    </View>
  );
}

interface AlertBadgeProps {
  level: AlertLevel;
  theme: Theme;
}

function AlertBadge({ level, theme }: AlertBadgeProps) {
  const color = alertBadgeColor(level, theme);
  return (
    <View
      style={[
        styles.alertBadge,
        { backgroundColor: `${color}22`, borderRadius: theme.radius.full },
      ]}
    >
      <Text style={[theme.type.caption, { color, fontFamily: theme.fontFamily.semibold }]}>
        {ALERT_LABELS[level] ?? 'Unknown'}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Skeleton loader
// ---------------------------------------------------------------------------

function SkeletonSessionCards({ theme }: { theme: Theme }) {
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
    <>
      {[0, 1, 2].map((i) => (
        <Animated.View
          key={i}
          style={[
            styles.sessionCard,
            {
              backgroundColor: theme.colors.card,
              borderRadius: theme.radius.xl,
              opacity,
            },
          ]}
        >
          <View style={[styles.skeletonRow, { marginBottom: 10 }]}>
            <View style={[styles.skeletonBlock, { width: '58%', height: 14, backgroundColor: theme.colors.elevated, borderRadius: 6 }]} />
            <View style={[styles.skeletonBlock, { width: '18%', height: 12, backgroundColor: theme.colors.elevated, borderRadius: 6 }]} />
          </View>
          <View style={styles.skeletonRow}>
            <View style={[styles.skeletonBlock, { width: '22%', height: 12, backgroundColor: theme.colors.elevated, borderRadius: 6 }]} />
            <View style={[styles.skeletonBlock, { width: '14%', height: 12, backgroundColor: theme.colors.elevated, borderRadius: 6 }]} />
            <View style={[styles.skeletonBlock, { width: '26%', height: 20, backgroundColor: theme.colors.elevated, borderRadius: theme.radius.full }]} />
          </View>
        </Animated.View>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------

interface SessionCardProps {
  session: Session;
  expanded: boolean;
  onToggle: () => void;
  theme: Theme;
}

function SessionCard({ session, expanded, onToggle, theme }: SessionCardProps) {
  const [events, setEvents] = useState<AlertEvent[]>([]);
  const [eventsLoaded, setEventsLoaded] = useState(false);

  const [localStatus, setLocalStatus] = useState<
    'generating' | 'complete' | 'failed' | null
  >(session.summaryStatus);
  const [localSummary, setLocalSummary] = useState<string | null>(session.summary);
  const [generating, setGenerating] = useState(false);

  async function handleGenerateSummary() {
    if (generating) return; // In-flight protection (local tap guard)
    setGenerating(true);
    setLocalStatus('generating');
    try {
      await generateSummary(session.id);
      const updated = await getSessionById(session.id);
      if (updated) {
        setLocalSummary(updated.summary);
        setLocalStatus(updated.summaryStatus);
      }
    } catch (e) {
      console.warn('[History] Summary generation failed:', e);
      setLocalStatus('failed');
    } finally {
      setGenerating(false);
    }
  }

  useEffect(() => {
    if (expanded && !eventsLoaded) {
      getAlertEvents(session.id)
        .then((rows) => {
          setEvents(rows);
          setEventsLoaded(true);
        })
        .catch((e) => {
          console.warn('[History] Failed to load alert events:', e);
          setEventsLoaded(true);
        });
    }
  }, [expanded, eventsLoaded, session.id]);

  return (
    <Pressable
      onPress={onToggle}
      style={[styles.sessionCard, { backgroundColor: theme.colors.card, borderRadius: theme.radius.xl }]}
    >
      {/* ── Card Header ── */}
      <View style={styles.cardHeader}>
        <Text style={[theme.type.subtitle, { color: theme.text.primary, flex: 1 }]}>
          {formatSessionDate(session.startedAt)}
        </Text>
        {/* Session type label */}
        {(() => {
          const label = getSessionLabel(session);
          return label ? (
            <Text style={[theme.type.caption, { color: theme.text.muted, marginLeft: theme.spacing.sm }]}>
              {label}
            </Text>
          ) : null;
        })()}
        <Text style={[theme.type.caption, { color: expanded ? theme.primary[500] : theme.text.muted }]}>
          {expanded ? 'Collapse' : 'Details'}
        </Text>
      </View>

      {/* ── Card Meta Row ── */}
      <View style={styles.cardMeta}>
        <Text style={[theme.type.small, { color: theme.text.secondary }]}>
          {formatDuration(session.durationMs)}
        </Text>
        <Text style={[theme.type.small, { color: theme.text.muted }]}>·</Text>
        <Text style={[theme.type.small, { color: theme.text.secondary }]}>
          {session.speechSegments} {session.speechSegments === 1 ? 'speaking run' : 'speaking runs'}
        </Text>
        <Text style={[theme.type.small, { color: theme.text.muted }]}>·</Text>
        <AlertBadge level={session.maxAlert} theme={theme} />
        {session.syncedFromDevice && (
          <View style={[styles.syncBadge, { backgroundColor: `${theme.primary[500]}22`, borderRadius: theme.radius.full }]}>
            <Text style={[theme.type.caption, { color: theme.primary[500] }]}>
              From device
            </Text>
          </View>
        )}
      </View>

      {/* ── Expanded: Alert Timeline ── */}
      {expanded && (
        <View style={[styles.timeline, { borderTopColor: theme.colors.elevated }]}>
          <Text style={[theme.type.small, { color: theme.text.tertiary, marginBottom: theme.spacing.sm, fontFamily: theme.fontFamily.semibold }]}>
            Alert Timeline
          </Text>
          {!eventsLoaded ? (
            <ActivityIndicator size="small" color={theme.primary[500]} />
          ) : events.length === 0 ? (
            <Text style={[theme.type.small, { color: theme.text.muted }]}>
              No alerts — clean session.
            </Text>
          ) : (
            // alert_events.timestamp is ms offset from sessions.started_at
            events.map((event) => (
              <View key={event.id} style={styles.timelineRow}>
                <Text style={[theme.type.caption, { color: theme.text.muted, width: 44 }]}>
                  {formatOffset(event.timestamp)}
                </Text>
                <View style={[styles.timelineDot, { backgroundColor: alertBadgeColor(event.alertLevel, theme) }]} />
                <Text style={[theme.type.small, { color: theme.text.secondary, flex: 1 }]}>
                  {ALERT_LABELS[event.alertLevel]} alert — {formatDuration(event.durationAtAlert)} of speech
                </Text>
              </View>
            ))
          )}

          {/* ── Expanded: AI Summary ── */}
          {ANTHROPIC_API_KEY && (
            <>
              {/* Generating — always visible while in-flight, not gated by eligibility */}
              {(generating || localStatus === 'generating') && (
                <View style={{ marginTop: theme.spacing.md }}>
                  <View
                    style={[
                      styles.summaryButton,
                      { backgroundColor: theme.colors.elevated, borderRadius: theme.radius.full, opacity: 0.7 },
                    ]}
                  >
                    <Text style={[theme.type.small, { color: theme.text.secondary, fontFamily: theme.fontFamily.semibold }]}>
                      Generating summary…
                    </Text>
                  </View>
                </View>
              )}

              {/* Button — show only when eligible and idle */}
              {!generating && localStatus !== 'generating' && summaryEligibilityReason({
                durationMs: session.durationMs,
                transcript: session.transcript ?? null,
                summary: localSummary,
                summaryStatus: localStatus,
              }) === null && (
                <View style={{ marginTop: theme.spacing.md }}>
                  <Pressable
                    onPress={handleGenerateSummary}
                    style={[styles.summaryButton, { backgroundColor: theme.primary[500], borderRadius: theme.radius.full }]}
                  >
                    <Text style={[theme.type.small, { color: '#fff', fontFamily: theme.fontFamily.semibold }]}>
                      Generate Summary
                    </Text>
                  </Pressable>
                </View>
              )}

              {/* Complete */}
              {localStatus === 'complete' && localSummary && (
                <View style={{ marginTop: theme.spacing.md }}>
                  <Text style={[theme.type.small, { color: theme.text.tertiary, marginBottom: theme.spacing.xs, fontFamily: theme.fontFamily.semibold }]}>
                    AI Summary
                  </Text>
                  <Text style={[theme.type.small, { color: theme.text.secondary, lineHeight: 20 }]}>
                    {localSummary}
                  </Text>
                </View>
              )}

              {/* Failed */}
              {localStatus === 'failed' && !generating && (
                <View style={{ marginTop: theme.spacing.md }}>
                  <Pressable onPress={handleGenerateSummary}>
                    <Text style={[theme.type.small, { color: theme.alert.urgent }]}>
                      Summary failed. Tap to retry.
                    </Text>
                  </Pressable>
                </View>
              )}
            </>
          )}
        </View>
      )}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function HistoryScreen() {
  const theme = useTheme();

  const [sessions, setSessions] = useState<Session[]>([]);
  const [lifetimeStats, setLifetimeStats] = useState({
    totalSessions: 0,
    totalSpeechMs: 0,
    totalAlerts: 0,
    avgAlertsPer: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [sessionRows, stats] = await Promise.all([
        getSessions(50),
        getLifetimeStats(),
      ]);
      setSessions(sessionRows);
      setLifetimeStats(stats);
    } catch (e) {
      console.warn('[History] Failed to load data:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  function handleToggle(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.colors.bg }]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primary[500]} />
        }
      >
        {/* ── Screen Title ── */}
        <Text style={[theme.type.title, { color: theme.text.primary, marginBottom: theme.spacing.lg }]}>
          History
        </Text>

        {/* ── Lifetime Stats Card ── */}
        <View style={[styles.lifetimeCard, { backgroundColor: theme.colors.card, borderRadius: theme.radius.xl }]}>
          <Text style={[theme.type.subtitle, { color: theme.text.primary, marginBottom: theme.spacing.md }]}>
            All Time
          </Text>
          <View style={styles.statPillRow}>
            <StatPill
              label="Sessions"
              value={String(lifetimeStats.totalSessions)}
              theme={theme}
            />
            <StatPill
              label="Talk time"
              value={lifetimeStats.totalSpeechMs > 0 ? formatTotalTime(lifetimeStats.totalSpeechMs) : '—'}
              theme={theme}
            />
            <StatPill
              label="Avg alerts/session"
              value={lifetimeStats.totalSessions > 0 ? String(lifetimeStats.avgAlertsPer) : '—'}
              theme={theme}
            />
          </View>
        </View>

        {/* ── Section Heading ── */}
        <Text style={[theme.type.subtitle, { color: theme.text.primary, marginTop: theme.spacing.lg, marginBottom: theme.spacing.md }]}>
          Recent Sessions
        </Text>

        {/* ── Session List ── */}
        {loading ? (
          <SkeletonSessionCards theme={theme} />
        ) : sessions.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: theme.colors.card, borderRadius: theme.radius.xl }]}>
            <Text style={[theme.type.subtitle, { color: theme.text.secondary, marginBottom: theme.spacing.sm }]}>
              No sessions yet
            </Text>
            <Text style={[theme.type.body, { color: theme.text.muted, textAlign: 'center' }]}>
              Connect your RamblingGuard device to start tracking your speaking patterns.
            </Text>
          </View>
        ) : (
          sessions.map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              expanded={expandedId === session.id}
              onToggle={() => handleToggle(session.id)}
              theme={theme}
            />
          ))
        )}

        {/* Bottom padding */}
        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
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
    paddingTop: 16,
  },
  lifetimeCard: {
    padding: 16,
  },
  statPillRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statPill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  sessionCard: {
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  alertBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  syncBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  timeline: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 5,
  },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  skeletonBlock: {},
  emptyCard: {
    padding: 24,
    alignItems: 'center',
  },
  summaryButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
});
