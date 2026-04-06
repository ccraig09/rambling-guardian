import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../theme/theme';
import { WaveformBars } from './WaveformBars';

type CardState = 'idle' | 'recording' | 'complete';

interface VoicePromptCardProps {
  prompt: string;
  currentIndex: number;
  totalPrompts: number;
  state: CardState;
  onRecord: () => void;
  onSkip: () => void;
}

export function VoicePromptCard({
  prompt, currentIndex, totalPrompts, state, onRecord, onSkip,
}: VoicePromptCardProps) {
  const theme = useTheme();

  const buttonColor = state === 'recording' ? theme.alert.urgent
    : state === 'complete' ? theme.semantic.success
    : theme.primary[500];

  return (
    <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
      <Text style={[theme.type.body, { color: theme.text.primary, textAlign: 'center' }]}>
        Read this aloud:{'\n'}
        <Text style={{ fontFamily: theme.fontFamily.semibold }}>"{prompt}"</Text>
      </Text>

      <WaveformBars state={state} />

      <Pressable onPress={onRecord} style={[styles.recordButton, { backgroundColor: buttonColor }]}>
        {state === 'recording' ? (
          <View style={styles.stopIcon} />
        ) : (
          <View style={[styles.micDot, { backgroundColor: theme.text.onColor }]} />
        )}
      </Pressable>

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
  recordButton: { width: 64, height: 64, borderRadius: 9999, alignItems: 'center', justifyContent: 'center' },
  stopIcon: { width: 20, height: 20, borderRadius: 4, backgroundColor: '#fff' },
  micDot: { width: 20, height: 20, borderRadius: 10 },
});
