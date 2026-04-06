import { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { useTheme } from '../theme/theme';

type WaveformState = 'idle' | 'recording' | 'complete';

interface WaveformBarsProps {
  state: WaveformState;
  barCount?: number;
}

export function WaveformBars({ state, barCount = 30 }: WaveformBarsProps) {
  const theme = useTheme();
  const barHeights = useRef(
    Array.from({ length: barCount }, () => new Animated.Value(2)),
  ).current;

  useEffect(() => {
    if (state === 'recording') {
      const animations = barHeights.map((height) =>
        Animated.loop(
          Animated.sequence([
            Animated.timing(height, {
              toValue: Math.random() * 40 + 8,
              duration: 150 + Math.random() * 200,
              useNativeDriver: false,
            }),
            Animated.timing(height, {
              toValue: Math.random() * 20 + 4,
              duration: 150 + Math.random() * 200,
              useNativeDriver: false,
            }),
          ]),
        ),
      );
      Animated.stagger(30, animations).start();
      return () => { animations.forEach((a) => a.stop()); };
    } else if (state === 'complete') {
      barHeights.forEach((height, i) => {
        Animated.timing(height, {
          toValue: Math.max(4, Math.sin(i * 0.3) * 15 + 18),
          duration: 300,
          useNativeDriver: false,
        }).start();
      });
    } else {
      barHeights.forEach((height) => {
        Animated.timing(height, { toValue: 2, duration: 200, useNativeDriver: false }).start();
      });
    }
  }, [state]);

  const barColor = state === 'recording' ? theme.primary[500]
    : state === 'complete' ? theme.semantic.success
    : theme.text.muted;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.elevated }]}>
      {barHeights.map((height, i) => (
        <Animated.View key={i} style={[styles.bar, { height, backgroundColor: barColor }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 3, height: 80, borderRadius: 12, paddingHorizontal: 16,
  },
  bar: { width: 4, borderRadius: 2 },
});
