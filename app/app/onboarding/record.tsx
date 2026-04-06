import { useState, useCallback } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../src/theme/theme';
import { VoicePromptCard } from '../../src/components/VoicePromptCard';
import { voicePrompts } from '../../src/data/voicePrompts';
import { startRecording, stopRecording, cancelRecording } from '../../src/services/voiceRecorder';
import { insertVoiceSample } from '../../src/db/voiceSamples';

type RecordingState = 'idle' | 'recording' | 'complete';

export default function RecordScreen() {
  const theme = useTheme();
  const [promptIndex, setPromptIndex] = useState(0);
  const [state, setState] = useState<RecordingState>('idle');

  const handleRecord = useCallback(async () => {
    if (state === 'recording') {
      const result = await stopRecording();
      if (result) {
        await insertVoiceSample(result.filePath, result.durationMs);
        setState('complete');
        setTimeout(() => {
          if (promptIndex < voicePrompts.length - 1) {
            setPromptIndex((i) => i + 1);
            setState('idle');
          } else {
            router.replace('/onboarding/complete');
          }
        }, 1000);
      }
    } else if (state === 'idle') {
      const started = await startRecording();
      if (started) {
        setState('recording');
      } else {
        Alert.alert('Microphone Access', 'Please enable microphone access in Settings to record voice samples.');
      }
    }
  }, [state, promptIndex]);

  const handleSkip = useCallback(async () => {
    if (state === 'recording') await cancelRecording();
    router.back();
  }, [state]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.bg }]}>
      <VoicePromptCard
        prompt={voicePrompts[promptIndex]}
        currentIndex={promptIndex}
        totalPrompts={voicePrompts.length}
        state={state}
        onRecord={handleRecord}
        onSkip={handleSkip}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
});
