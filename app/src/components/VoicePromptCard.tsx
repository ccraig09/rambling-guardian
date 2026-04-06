import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../theme/theme';
import { WaveformBars } from './WaveformBars';

type CardState = 'idle' | 'recording' | 'complete' | 'error';

interface VoicePromptCardProps {
  prompt: string;
  currentIndex: number;
  totalPrompts: number;
  state: CardState;
  audioLevel?: number;
  elapsedMs?: number;
  lastRecordingPath?: string | null;
  onRecord: () => void;
  onPlayback?: () => void;
  onReRecord?: () => void;
  onSkip: () => void;
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function VoicePromptCard({
  prompt,
  currentIndex,
  totalPrompts,
  state,
  audioLevel,
  elapsedMs = 0,
  lastRecordingPath,
  onRecord,
  onPlayback,
  onReRecord,
  onSkip,
}: VoicePromptCardProps) {
  const theme = useTheme();

  const waveformState = state === 'error' ? 'idle' : state;

  const buttonColor =
    state === 'recording'
      ? theme.alert.urgent
      : state === 'complete'
        ? theme.semantic.success
        : theme.primary[500];

  const buttonLabel =
    state === 'recording'
      ? 'Tap to stop'
      : state === 'complete'
        ? 'Recorded'
        : 'Tap to record';

  return (
    <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
      <Text style={[theme.type.body, { color: theme.text.primary, textAlign: 'center' }]}>
        Read this aloud:{'\n'}
        <Text style={{ fontFamily: theme.fontFamily.semibold }}>"{prompt}"</Text>
      </Text>

      <WaveformBars state={waveformState} audioLevel={audioLevel} />

      {/* Recording timer */}
      {state === 'recording' && (
        <View style={styles.timerRow}>
          <Text style={[theme.type.body, { color: theme.text.primary, fontFamily: theme.fontFamily.semibold }]}>
            {formatTime(elapsedMs)}
          </Text>
          {elapsedMs < 3000 && (
            <Text style={[theme.type.caption, { color: theme.text.muted, marginLeft: 8 }]}>
              min 0:03
            </Text>
          )}
        </View>
      )}

      {/* Error state: too short */}
      {state === 'error' && (
        <Text style={[theme.type.caption, { color: theme.semantic.error, textAlign: 'center' }]}>
          Recording too short — try again
        </Text>
      )}

      {/* Record / stop button */}
      {(state === 'idle' || state === 'recording' || state === 'error') && (
        <View style={styles.recordSection}>
          <Pressable onPress={onRecord} style={[styles.recordButton, { backgroundColor: buttonColor }]}>
            {state === 'recording' ? (
              <View style={styles.stopIcon} />
            ) : (
              <View style={[styles.micDot, { backgroundColor: theme.text.onColor }]} />
            )}
          </Pressable>
          <Text style={[theme.type.caption, { color: theme.text.tertiary, marginTop: 6 }]}>
            {state === 'error' ? 'Tap to record' : buttonLabel}
          </Text>
        </View>
      )}

      {/* Complete state: playback, re-record, use recording */}
      {state === 'complete' && (
        <View style={styles.completeActions}>
          <View style={styles.ghostRow}>
            {lastRecordingPath && onPlayback && (
              <Pressable
                onPress={onPlayback}
                style={[styles.ghostButton, { borderColor: theme.text.tertiary }]}
              >
                <Text style={[theme.type.subtitle, { color: theme.text.primary, fontSize: 14 }]}>
                  Play back
                </Text>
              </Pressable>
            )}
            {onReRecord && (
              <Pressable
                onPress={onReRecord}
                style={[styles.ghostButton, { borderColor: theme.text.tertiary }]}
              >
                <Text style={[theme.type.subtitle, { color: theme.text.primary, fontSize: 14 }]}>
                  Re-record
                </Text>
              </Pressable>
            )}
          </View>
          <Pressable
            onPress={onRecord}
            style={[styles.primaryButton, { backgroundColor: theme.primary[500] }]}
          >
            <Text style={[theme.type.subtitle, { color: theme.text.onColor, fontSize: 15 }]}>
              Use this recording
            </Text>
          </Pressable>
        </View>
      )}

      <Text style={[theme.type.caption, { color: theme.text.tertiary }]}>
        Sample {currentIndex + 1} of {totalPrompts}
      </Text>

      <Pressable onPress={onSkip} hitSlop={12}>
        <Text style={[theme.type.subtitle, { color: theme.text.tertiary, fontSize: 14 }]}>
          Skip for now
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, padding: 24, alignItems: 'center', gap: 16 },
  timerRow: { flexDirection: 'row', alignItems: 'center' },
  recordSection: { alignItems: 'center' },
  recordButton: {
    width: 72,
    height: 72,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopIcon: { width: 22, height: 22, borderRadius: 4, backgroundColor: '#fff' },
  micDot: { width: 22, height: 22, borderRadius: 11 },
  completeActions: { width: '100%', gap: 12, alignItems: 'center' },
  ghostRow: { flexDirection: 'row', gap: 12 },
  ghostButton: {
    height: 48,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    width: '100%',
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
