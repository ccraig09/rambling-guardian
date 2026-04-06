import { useState, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useDeviceStore } from '../../src/stores/deviceStore';
import { useTheme } from '../../src/theme/theme';
import { getVoiceSampleCount } from '../../src/db/voiceSamples';

export default function HomeScreen() {
  const connected = useDeviceStore((s) => s.connected);
  const battery = useDeviceStore((s) => s.battery);
  const theme = useTheme();
  const [sampleCount, setSampleCount] = useState<number | null>(null);

  useEffect(() => {
    getVoiceSampleCount().then(setSampleCount);
  }, []);

  const showEnrollment = sampleCount !== null && sampleCount < 5;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.bg }]}>
      <Text style={[theme.type.title, { color: theme.text.primary }]}>
        Rambling Guardian
      </Text>
      <Text style={[theme.type.body, { color: theme.text.secondary, textAlign: 'center' }]}>
        {connected
          ? `Device connected — ${battery}% battery`
          : 'No device connected. Go to Session tab to connect.'}
      </Text>
      {showEnrollment && (
        <Pressable
          onPress={() => router.push('/onboarding')}
          style={[styles.enrollButton, { backgroundColor: theme.colors.card, borderRadius: theme.radius.xl }]}
        >
          <View style={[styles.enrollDot, { backgroundColor: theme.primary[500] }]} />
          <View style={styles.enrollText}>
            <Text style={[theme.type.subtitle, { color: theme.text.primary }]}>
              Set up voice enrollment
            </Text>
            <Text style={[theme.type.small, { color: theme.text.tertiary }]}>
              {sampleCount === 0 ? '5 short recordings · 2 min' : `${sampleCount} of 5 samples recorded`}
            </Text>
          </View>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 16 },
  enrollButton: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12, marginTop: 16, width: '100%' },
  enrollDot: { width: 40, height: 40, borderRadius: 9999 },
  enrollText: { flex: 1, gap: 2 },
});
