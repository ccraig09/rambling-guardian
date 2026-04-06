import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/theme';

interface StepTimerProps {
  durationSeconds: number;
  isActive: boolean;
  onComplete: () => void;
}

export function StepTimer({ durationSeconds, isActive, onComplete }: StepTimerProps) {
  const theme = useTheme();
  const [remaining, setRemaining] = useState(durationSeconds);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setRemaining(durationSeconds);
  }, [durationSeconds]);

  useEffect(() => {
    if (isActive && remaining > 0) {
      intervalRef.current = setInterval(() => {
        setRemaining((prev) => {
          if (prev <= 1) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            setTimeout(onComplete, 0);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isActive, durationSeconds]);

  const progress = durationSeconds > 0 ? (durationSeconds - remaining) / durationSeconds : 0;

  return (
    <View style={styles.container}>
      <View style={[styles.ring, { borderColor: theme.colors.elevated }]}>
        <Text style={[theme.type.heading, { color: theme.text.primary }]}>{remaining}s</Text>
      </View>
      {/* Progress bar below ring */}
      <View style={[styles.progressTrack, { backgroundColor: theme.colors.elevated }]}>
        <View style={[styles.progressFill, { backgroundColor: theme.primary[500], width: `${progress * 100}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: 8 },
  ring: { width: 80, height: 80, borderRadius: 40, borderWidth: 6, alignItems: 'center', justifyContent: 'center' },
  progressTrack: { width: 80, height: 4, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: 4, borderRadius: 2 },
});
