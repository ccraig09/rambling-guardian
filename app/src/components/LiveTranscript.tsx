/**
 * LiveTranscript — displays real-time transcript during active sessions.
 *
 * Shows speaker-labeled segments with provisional indicators.
 * Tap a speaker label to reassign via SpeakerPicker.
 */
import { useRef, useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../theme/theme';
import { useTranscriptStore } from '../stores/transcriptStore';
import { useSpeakerStore } from '../stores/speakerStore';
import { speakerService } from '../services/speakerService';
import { SpeakerPicker } from './SpeakerPicker';
import { NewSpeakerBanner } from './NewSpeakerBanner';

export function LiveTranscript() {
  const theme = useTheme();
  const status = useTranscriptStore((s) => s.status);
  const segments = useTranscriptStore((s) => s.segments);
  const interimText = useTranscriptStore((s) => s.interimText);
  // Subscribe to mappings so component re-renders when speaker names change
  const mappings = useSpeakerStore((s) => s.mappings);
  const scrollRef = useRef<ScrollView>(null);
  const [pickerLabel, setPickerLabel] = useState<string | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [segments.length, interimText]);

  // Diagnostic: confirm transcript data reaches the component
  useEffect(() => {
    if (status === 'streaming') {
      console.log(`[LiveTranscript] render: status=${status}, segments=${segments.length}, interim="${interimText?.substring(0, 30) ?? ''}"`);
    }
  }, [status, segments.length, interimText]);

  const handleSpeakerTap = useCallback((diarizedLabel: string) => {
    setPickerLabel(diarizedLabel);
  }, []);

  // Count provisional speakers that aren't "Me" — these need naming
  const unnamedCount = Object.values(mappings).filter(
    (m) => m.confidence === 'provisional' && m.displayName !== 'Me',
  ).length;

  // Open SpeakerPicker for the first unnamed label (safe: no-op if none left)
  const handleBannerPress = useCallback(() => {
    const firstUnnamed = Object.entries(mappings).find(
      ([, m]) => m.confidence === 'provisional' && m.displayName !== 'Me',
    );
    if (firstUnnamed) {
      setPickerLabel(firstUnnamed[0]);
    }
  }, [mappings]);

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

      <NewSpeakerBanner unnamedCount={unnamedCount} onPress={handleBannerPress} />

      <ScrollView ref={scrollRef} style={styles.scroll} showsVerticalScrollIndicator={false}>
        {segments.map((seg, i) => {
          const prevSpeaker = i > 0 ? segments[i - 1].speaker : null;
          const showLabel = seg.speaker && seg.speaker !== prevSpeaker;
          const displayName = seg.speaker ? speakerService.getDisplayName(seg.speaker) : null;
          const confidence = seg.speaker ? speakerService.getConfidence(seg.speaker) : null;
          const isProvisional = confidence === 'provisional';

          return (
            <View key={`${i}-${seg.start}-${seg.end}`}>
              {showLabel && displayName && (
                <Pressable
                  onPress={() => seg.speaker && handleSpeakerTap(seg.speaker)}
                  style={styles.speakerLabel}
                >
                  <Text
                    style={[
                      theme.type.caption,
                      {
                        color: theme.primary[500],
                        fontWeight: '600',
                        opacity: isProvisional ? 0.6 : 1,
                      },
                    ]}
                  >
                    {displayName}
                  </Text>
                </Pressable>
              )}
              <Text style={[theme.type.body, { color: theme.text.primary }]}>
                {seg.text}{' '}
              </Text>
            </View>
          );
        })}
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

      {pickerLabel && (
        <SpeakerPicker
          diarizedLabel={pickerLabel}
          visible={!!pickerLabel}
          onClose={() => setPickerLabel(null)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    minHeight: 120,
    maxHeight: 280,
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
    flexGrow: 1,
    flexShrink: 1,
  },
  speakerLabel: {
    marginTop: 8,
    marginBottom: 2,
  },
});
