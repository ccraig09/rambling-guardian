import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, Text, ActivityIndicator, Pressable } from 'react-native';
import { useFonts } from 'expo-font';
import { getDatabase } from '../src/db/database';
import { seedExercises } from '../src/db/exercises';
import { exerciseData } from '../src/data/exercises';
import { fonts } from '../src/theme/typography';
import { useTheme } from '../src/theme/theme';
import { sessionTracker } from '../src/services/sessionTracker';

export default function RootLayout() {
  const [dbReady, setDbReady] = useState(false);
  const [dbError, setDbError] = useState(false);
  const [fontsLoaded] = useFonts(fonts);
  const theme = useTheme();

  const initDb = () => {
    setDbError(false);
    getDatabase()
      .then(() => seedExercises(exerciseData))
      .then(() => {
        sessionTracker.start();
        setDbReady(true);
      })
      .catch((err) => {
        console.error('[DB] Init failed:', err);
        setDbError(true);
      });
  };

  useEffect(() => {
    initDb();
  }, []);

  if (dbError) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.bg, padding: theme.spacing.lg }}>
        <Text style={[theme.type.subtitle, { color: theme.semantic.error, marginBottom: theme.spacing.sm }]}>
          Database Error
        </Text>
        <Text style={[theme.type.small, { color: theme.text.secondary, textAlign: 'center', marginBottom: theme.spacing.lg }]}>
          Failed to initialize the database. Try again or restart the app.
        </Text>
        <Pressable
          onPress={initDb}
          style={{ backgroundColor: theme.primary[500], paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md, borderRadius: theme.radius.md }}
        >
          <Text style={[theme.type.subtitle, { color: theme.text.onColor }]}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  if (!dbReady || !fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.bg }}>
        <ActivityIndicator size="large" color={theme.primary[500]} />
        <Text style={[theme.type.small, { color: theme.text.secondary, marginTop: theme.spacing.md }]}>Loading...</Text>
      </View>
    );
  }

  return (
    <>
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" options={{ presentation: 'modal' }} />
      </Stack>
    </>
  );
}
