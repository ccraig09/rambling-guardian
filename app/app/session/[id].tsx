/**
 * Session Detail Screen — D.7 v1
 *
 * Modal route: /session/[id]
 * Displays full session data: header, transcript, AI summary, alert timeline.
 */
import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '../../src/theme/theme';
import {
  getSessionById,
  getAlertEvents,
} from '../../src/db/sessions';
import type { Session, AlertEvent, TranscriptSegment, SpeakerMapping } from '../../src/types';
import {
  formatSessionDate,
  formatDuration,
  formatOffset,
} from '../../src/utils/timeFormat';

// ---------------------------------------------------------------------------
// Pure helpers — transcript parsing
// ---------------------------------------------------------------------------

function parseSegments(raw: string | null): TranscriptSegment[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch { return null; }
}

function parseSpeakerMap(raw: string | null): SpeakerMapping[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function resolveName(label: string | null, mappings: SpeakerMapping[]): string {
  if (!label) return 'Unknown';
  return mappings.find((m) => m.diarizedLabel === label)?.displayName ?? label;
}

interface Turn {
  displayName: string;
  startMs: number;
  text: string;
}

function buildTurns(segments: TranscriptSegment[], mappings: SpeakerMapping[]): Turn[] {
  const turns: Turn[] = [];
  for (const seg of segments) {
    if (!seg.isFinal) continue;
    const name = resolveName(seg.speaker, mappings);
    const last = turns[turns.length - 1];
    if (last && last.displayName === name) {
      last.text += ' ' + seg.text;
    } else {
      turns.push({ displayName: name, startMs: seg.start, text: seg.text });
    }
  }
  return turns;
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function SessionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useTheme();

  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [events, setEvents] = useState<AlertEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) {
      setSession(null);
      setLoading(false);
      return;
    }

    Promise.all([
      getSessionById(id),
      getAlertEvents(id),
    ])
      .then(([sess, evts]) => {
        setSession(sess ?? null);
        setEvents(evts);
      })
      .catch((e) => {
        console.warn('[SessionDetail] Failed to load session:', e);
        setSession(null);
      })
      .finally(() => setLoading(false));
  }, [id]);

  // ---------------------------------------------------------------------------
  // Loading / error states
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: theme.colors.bg }]}>
        <ActivityIndicator size="large" color={theme.primary[500]} style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  if (!session) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: theme.colors.bg }]}>
        <View style={styles.errorContainer}>
          <Text style={[theme.type.subtitle, { color: theme.text.secondary, marginBottom: theme.spacing.md }]}>
            Session not found.
          </Text>
          <Pressable onPress={() => router.back()}>
            <Text style={[theme.type.body, { color: theme.primary[400] }]}>← Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ---------------------------------------------------------------------------
  // Compute transcript data
  // ---------------------------------------------------------------------------

  const segments = parseSegments(session.transcriptTimestamps);
  const speakerMappings = parseSpeakerMap(session.speakerMap);
  const turns = segments ? buildTurns(segments, speakerMappings) : null;

  const contextLabel = session.sessionContext
    ? session.sessionContext.replace('_', ' ')
    : null;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.colors.bg }]}>
      {/* ── Non-scrolling header ── */}
      <View style={[styles.header, { borderBottomColor: theme.colors.elevated }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={[theme.type.body, { color: theme.primary[400] }]}>← Back</Text>
        </Pressable>

        <Text
          style={[theme.type.subtitle, { color: theme.text.primary, marginBottom: theme.spacing.xs }]}
          numberOfLines={1}
        >
          {formatSessionDate(session.startedAt)}
        </Text>

        {/* Meta badges row */}
        <View style={styles.headerMeta}>
          <Text style={[theme.type.small, { color: theme.text.secondary }]}>
            {formatDuration(session.durationMs)}
          </Text>

          {contextLabel && (
            <View
              style={[
                styles.badge,
                { backgroundColor: theme.primary[900], borderRadius: theme.radius.full },
              ]}
            >
              <Text
                style={[
                  theme.type.caption,
                  { color: theme.primary[300], fontFamily: theme.fontFamily.semibold },
                ]}
              >
                {contextLabel}
              </Text>
            </View>
          )}

          <View
            style={[
              styles.badge,
              { backgroundColor: theme.colors.elevated, borderRadius: theme.radius.full },
            ]}
          >
            <Text
              style={[
                theme.type.caption,
                { color: theme.text.secondary, fontFamily: theme.fontFamily.semibold },
              ]}
            >
              {session.alertCount} {session.alertCount === 1 ? 'alert' : 'alerts'}
            </Text>
          </View>
        </View>
      </View>

      {/* ── Scrollable body ── */}
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Transcript Section ── */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: theme.text.tertiary }]}>
            TRANSCRIPT
          </Text>

          {turns && turns.length > 0 ? (
            turns.map((turn, idx) => (
              <View key={idx} style={[styles.turnRow, { borderLeftColor: theme.colors.elevated }]}>
                <View style={styles.turnHeader}>
                  <Text
                    style={[
                      theme.type.caption,
                      { color: theme.primary[400], fontFamily: theme.fontFamily.semibold },
                    ]}
                  >
                    {turn.displayName}
                  </Text>
                  <Text style={[theme.type.caption, { color: theme.text.muted }]}>
                    {formatOffset(turn.startMs)}
                  </Text>
                </View>
                <Text style={[theme.type.body, { color: theme.text.secondary, lineHeight: 22 }]}>
                  {turn.text}
                </Text>
              </View>
            ))
          ) : session.transcript ? (
            <Text style={[theme.type.body, { color: theme.text.secondary, lineHeight: 22 }]}>
              {session.transcript}
            </Text>
          ) : (
            <Text
              style={[theme.type.body, { color: theme.text.tertiary, fontStyle: 'italic' }]}
            >
              No transcript was recorded for this session.
            </Text>
          )}
        </View>

        {/* Bottom padding */}
        <View style={{ height: 48 }} />
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
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  backButton: {
    marginBottom: 10,
  },
  headerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  turnRow: {
    borderLeftWidth: 2,
    paddingLeft: 12,
    marginBottom: 14,
  },
  turnHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
});
