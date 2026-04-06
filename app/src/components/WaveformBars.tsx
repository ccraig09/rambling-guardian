import { useEffect, useRef, useState } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { useTheme } from '../theme/theme';

type WaveformState = 'idle' | 'recording' | 'complete';

interface WaveformBarsProps {
  state: WaveformState;
  barCount?: number;
  audioLevel?: number;
}

export function WaveformBars({ state, barCount = 30, audioLevel }: WaveformBarsProps) {
  const theme = useTheme();
  const barHeights = useRef(
    Array.from({ length: barCount }, () => new Animated.Value(2)),
  ).current;
  const levels = useRef<number[]>(Array(barCount).fill(0));
  const silenceStart = useRef<number | null>(null);
  const [showSpeakLouder, setShowSpeakLouder] = useState(false);
  const randomAnimations = useRef<Animated.CompositeAnimation[]>([]);

  // Track real audio levels: shift buffer left, push new level on right
  useEffect(() => {
    if (state === 'recording' && audioLevel !== undefined) {
      // Stop any random animations when we switch to real metering
      randomAnimations.current.forEach((a) => a.stop());
      randomAnimations.current = [];

      const buf = levels.current;
      buf.shift();
      buf.push(audioLevel);

      barHeights.forEach((height, i) => {
        const targetHeight = buf[i] * 48 + 4;
        Animated.timing(height, {
          toValue: targetHeight,
          duration: 80,
          useNativeDriver: false,
        }).start();
      });

      // Track silence for "Speak louder..." hint
      if (audioLevel <= 0.1) {
        if (silenceStart.current === null) {
          silenceStart.current = Date.now();
        } else if (Date.now() - silenceStart.current > 2000) {
          setShowSpeakLouder(true);
        }
      } else {
        silenceStart.current = null;
        setShowSpeakLouder(false);
      }
    }
  }, [audioLevel, state]);

  // Handle state transitions
  useEffect(() => {
    if (state === 'recording' && audioLevel === undefined) {
      // Fallback: random animation when no real metering data
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
      randomAnimations.current = animations;
      Animated.stagger(30, animations).start();
      return () => {
        animations.forEach((a) => a.stop());
      };
    } else if (state === 'complete') {
      randomAnimations.current.forEach((a) => a.stop());
      randomAnimations.current = [];
      barHeights.forEach((height, i) => {
        Animated.timing(height, {
          toValue: Math.max(4, Math.sin(i * 0.3) * 15 + 18),
          duration: 300,
          useNativeDriver: false,
        }).start();
      });
    } else if (state === 'idle') {
      randomAnimations.current.forEach((a) => a.stop());
      randomAnimations.current = [];
      levels.current = Array(barCount).fill(0);
      silenceStart.current = null;
      setShowSpeakLouder(false);
      barHeights.forEach((height) => {
        Animated.timing(height, { toValue: 2, duration: 200, useNativeDriver: false }).start();
      });
    }
  }, [state, audioLevel === undefined]);

  const barColor =
    state === 'recording'
      ? theme.primary[500]
      : state === 'complete'
        ? theme.semantic.success
        : theme.text.muted;

  // Hint text above bars
  let hintText: string | null = null;
  let hintColor: string = theme.text.muted;
  if (state === 'recording' && showSpeakLouder) {
    hintText = 'Speak louder...';
    hintColor = theme.text.muted;
  } else if (state === 'complete') {
    hintText = 'Recording saved';
    hintColor = theme.semantic.success;
  }

  return (
    <View style={styles.wrapper}>
      {hintText && (
        <Text style={[theme.type.caption, { color: hintColor, textAlign: 'center', marginBottom: 4 }]}>
          {hintText}
        </Text>
      )}
      <View style={[styles.container, { backgroundColor: theme.colors.elevated }]}>
        {barHeights.map((height, i) => (
          <Animated.View key={i} style={[styles.bar, { height, backgroundColor: barColor }]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { width: '100%' },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    height: 80,
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  bar: { width: 4, borderRadius: 2 },
});
