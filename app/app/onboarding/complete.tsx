import { View, Text, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../src/theme/theme';

export default function OnboardingComplete() {
  const theme = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: theme.colors.bg }]}>
      <View style={styles.content}>
        <View style={[styles.successIcon, { backgroundColor: theme.semantic.success }]} />
        <Text style={[theme.type.title, { color: theme.text.primary, textAlign: 'center' }]}>
          You're all set!
        </Text>
        <Text style={[theme.type.body, { color: theme.text.secondary, textAlign: 'center', maxWidth: 280 }]}>
          Your voice samples are saved. Speaker recognition will be available in a future update.
        </Text>
      </View>
      <Pressable
        onPress={() => router.dismissAll()}
        style={[styles.primaryButton, { backgroundColor: theme.primary[500], borderRadius: theme.radius.md }]}
      >
        <Text style={[theme.type.subtitle, { color: theme.text.onColor }]}>Continue</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'space-between', paddingTop: 160, paddingBottom: 48, paddingHorizontal: 24 },
  content: { alignItems: 'center', gap: 16 },
  successIcon: { width: 80, height: 80, borderRadius: 9999, marginBottom: 16 },
  primaryButton: { width: '100%', height: 48, alignItems: 'center', justifyContent: 'center' },
});
