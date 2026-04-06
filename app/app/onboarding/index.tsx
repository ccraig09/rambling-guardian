import { View, Text, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../src/theme/theme';

export default function OnboardingWelcome() {
  const theme = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: theme.colors.bg }]}>
      <View style={styles.content}>
        <View style={[styles.heroIcon, { backgroundColor: theme.primary[500] }]} />
        <Text style={[theme.type.title, { color: theme.text.primary, textAlign: 'center' }]}>
          Voice Enrollment
        </Text>
        <Text style={[theme.type.body, { color: theme.text.secondary, textAlign: 'center', maxWidth: 280 }]}>
          Record a few sentences so Rambling Guardian can learn your voice. This helps with speaker recognition later.
        </Text>
        <Text style={[theme.type.small, { color: theme.text.tertiary, textAlign: 'center' }]}>
          5 short recordings · Takes about 2 minutes
        </Text>
      </View>
      <View style={styles.actions}>
        <Pressable
          onPress={() => router.push('/onboarding/record')}
          style={[styles.primaryButton, { backgroundColor: theme.primary[500], borderRadius: theme.radius.md }]}
        >
          <Text style={[theme.type.subtitle, { color: theme.text.onColor }]}>Let's Go</Text>
        </Pressable>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={[theme.type.subtitle, { color: theme.text.tertiary, fontSize: 14 }]}>Skip for now</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'space-between', paddingTop: 120, paddingBottom: 48, paddingHorizontal: 24 },
  content: { alignItems: 'center', gap: 16 },
  heroIcon: { width: 80, height: 80, borderRadius: 9999, marginBottom: 16 },
  actions: { alignItems: 'center', gap: 16 },
  primaryButton: { width: '100%', height: 48, alignItems: 'center', justifyContent: 'center' },
});
