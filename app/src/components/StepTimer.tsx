import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../theme/theme';

interface StepTimerProps {
  durationSeconds: number;
  isPaused: boolean;
  onComplete: () => void;
}

export function StepTimer({ durationSeconds, isPaused, onComplete }: StepTimerProps) {
  const theme = useTheme();
  const [remaining, setRemaining] = useState(durationSeconds);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const completedRef = useRef(false);

  useEffect(() => {
    setRemaining(durationSeconds);
    completedRef.current = false;
  }, [durationSeconds]);

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (!isPaused && remaining > 0) {
      intervalRef.current = setInterval(() => {
        setRemaining((prev) => {
          if (prev <= 1) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            if (!completedRef.current) {
              completedRef.current = true;
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setTimeout(onComplete, 0);
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPaused, remaining > 0]);

  const progress = durationSeconds > 0 ? (durationSeconds - remaining) / durationSeconds : 0;
  const isUrgent = remaining <= 5 && remaining > 0;
  const ringColor = isUrgent ? theme.alert.urgent : theme.colors.elevated;
  const fillColor = isUrgent ? theme.alert.urgent : theme.primary[500];
  const textColor = isUrgent ? theme.alert.urgent : theme.text.primary;

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const timeStr = `${mins}:${String(secs).padStart(2, '0')}`;

  return (
    <View style={styles.container}>
      <View style={[styles.ring, { borderColor: ringColor }]}>
        <Text style={[theme.type.heading, { color: textColor, fontFamily: theme.fontFamily.bold }]}>
          {timeStr}
        </Text>
      </View>
      <View style={[styles.progressTrack, { backgroundColor: theme.colors.elevated }]}>
        <View style={[styles.progressFill, { backgroundColor: fillColor, width: `${progress * 100}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: 12 },
  ring: {
    width: 88, height: 88, borderRadius: 44,
    borderWidth: 5, alignItems: 'center', justifyContent: 'center',
  },
  progressTrack: { width: '100%', height: 4, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: 4, borderRadius: 2 },
});
