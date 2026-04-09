/**
 * LiveTranscript — displays real-time transcript during active sessions.
 *
 * Shows finalized segments as normal text, interim text in faded italic,
 * and status-driven display for starting/interrupted/failed states.
 */
import { useRef, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useTheme } from '../theme/theme';
import { useTranscriptStore } from '../stores/transcriptStore';

export function LiveTranscript() {
  const theme = useTheme();
  const status = useTranscriptStore((s) => s.status);
  const segments = useTranscriptStore((s) => s.segments);
  const interimText = useTranscriptStore((s) => s.interimText);
  const scrollRef = useRef<ScrollView>(null);

  // Auto-scroll to bottom on new content
  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [segments.length, interimText]);

  // Status-driven display
  if (status === 'idle') return null;

  if (status === 'failed') {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.card, borderRadius: theme.radius.xl }]}>
        <Text style={[theme.type.caption, { color: theme.text.muted }]}>
          Transcript unavailable
        </Text>
      </View>
    );
  }

  if (status === 'starting') {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.card, borderRadius: theme.radius.xl }]}>
        <Text style={[theme.type.caption, { color: theme.text.muted }]}>
          Starting transcript...
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.card, borderRadius: theme.radius.xl }]}>
      {/* Header */}
      <View style={styles.headerRow}>
        <Text style={[theme.type.subtitle, { color: theme.text.primary }]}>
          Live Transcript
        </Text>
        {status === 'streaming' && (
          <View style={[styles.streamingDot, { backgroundColor: theme.alert.safe }]} />
        )}
        {status === 'interrupted' && (
          <Text style={[theme.type.caption, { color: theme.semantic.error }]}>
            Interrupted
          </Text>
        )}
      </View>

      {/* Transcript content */}
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {segments.map((seg, i) => (
          <Text key={i} style={[theme.type.body, { color: theme.text.primary }]}>
            {seg.text}{' '}
          </Text>
        ))}
        {interimText ? (
          <Text style={[theme.type.body, { color: theme.text.muted, fontStyle: 'italic' }]}>
            {interimText}
          </Text>
        ) : null}
        {segments.length === 0 && !interimText && status === 'streaming' && (
          <Text style={[theme.type.body, { color: theme.text.muted }]}>
            Listening...
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    maxHeight: 240,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  streamingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  scroll: {
    flex: 1,
  },
});
