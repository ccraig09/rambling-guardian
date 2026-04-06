# RG-C.4 Voice Trainer Onboarding — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a voice enrollment onboarding flow where users record 5 speech samples for future speaker recognition (Phase D). Recordings are stored locally as WAV files + SQLite metadata. "Skip for now" is always available.

**Architecture:** Onboarding is a modal stack inside Expo Router (`app/onboarding/`). A `voiceRecorder` service wraps `expo-av` for recording. The `VoicePromptCard` component (matching the Figma design) handles the per-prompt UI. Voice samples are saved to the app's document directory and tracked in the `voice_samples` SQLite table.

**Tech Stack:** React Native (Expo 54), expo-av (Audio.Recording), expo-file-system, expo-sqlite, Zustand (settingsStore for enrollment state), useTheme() hook

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/data/voicePrompts.ts` | 5 text prompts for voice enrollment |
| Create | `src/services/voiceRecorder.ts` | expo-av recording: start, stop, save WAV, get duration |
| Create | `src/services/__tests__/voiceRecorder.test.ts` | Test recording state machine logic |
| Create | `src/db/voiceSamples.ts` | CRUD for voice_samples table |
| Create | `src/db/__tests__/voiceSamples.test.ts` | Test DB operations |
| Create | `src/components/WaveformBars.tsx` | Animated waveform visualization |
| Create | `src/components/VoicePromptCard.tsx` | Recording card (Figma design, 3 states) |
| Create | `app/onboarding/_layout.tsx` | Stack layout for onboarding modal |
| Create | `app/onboarding/index.tsx` | Welcome screen — explains enrollment |
| Create | `app/onboarding/record.tsx` | Recording loop — cycles through 5 prompts |
| Create | `app/onboarding/complete.tsx` | Completion screen — celebration + continue |
| Modify | `app/(tabs)/index.tsx` | Add onboarding entry button if not enrolled |

---

### Task 1: Voice Prompts Data

**Files:**
- Create: `app/src/data/voicePrompts.ts`

- [ ] **Step 1: Create voicePrompts.ts**

```typescript
/**
 * Text prompts for voice enrollment.
 * These sentences are chosen for phonetic diversity — they cover a wide range
 * of English phonemes so the voice model (Phase D) gets good coverage.
 * Users read each one aloud and record it.
 */
export const voicePrompts = [
  "The quick brown fox jumps over the lazy dog.",
  "She sells seashells by the seashore on sunny days.",
  "How much wood would a woodchuck chuck if a woodchuck could chuck wood?",
  "Peter Piper picked a peck of pickled peppers.",
  "The rain in Spain stays mainly in the plain.",
] as const;

export type VoicePromptIndex = 0 | 1 | 2 | 3 | 4;
```

- [ ] **Step 2: Commit**

```bash
git add app/src/data/voicePrompts.ts
git commit -m "feat(onboarding): add 5 voice enrollment prompts"
```

---

### Task 2: Voice Recorder Service

Wraps expo-av Audio.Recording with a clean start/stop/save API. Handles permissions.

**Files:**
- Create: `app/src/services/voiceRecorder.ts`

- [ ] **Step 1: Create voiceRecorder.ts**

```typescript
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';

const RECORDING_OPTIONS: Audio.RecordingOptions = {
  android: {
    extension: '.wav',
    outputFormat: Audio.AndroidOutputFormat.DEFAULT,
    audioEncoder: Audio.AndroidAudioEncoder.DEFAULT,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 256000,
  },
  ios: {
    extension: '.wav',
    outputFormat: Audio.IOSOutputFormat.LINEARPCM,
    audioQuality: Audio.IOSAudioQuality.HIGH,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 256000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {},
};

let currentRecording: Audio.Recording | null = null;

/** Request microphone permission. Returns true if granted. */
export async function requestMicPermission(): Promise<boolean> {
  const { granted } = await Audio.requestPermissionsAsync();
  return granted;
}

/** Start a new recording. Returns false if permission denied or already recording. */
export async function startRecording(): Promise<boolean> {
  if (currentRecording) return false;

  const granted = await requestMicPermission();
  if (!granted) return false;

  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
  });

  const { recording } = await Audio.Recording.createAsync(RECORDING_OPTIONS);
  currentRecording = recording;
  return true;
}

/** Stop the current recording and save to a permanent path. Returns the file path and duration. */
export async function stopRecording(): Promise<{ filePath: string; durationMs: number } | null> {
  if (!currentRecording) return null;

  await currentRecording.stopAndUnloadAsync();
  await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

  const uri = currentRecording.getURI();
  const status = await currentRecording.getStatusAsync();
  currentRecording = null;

  if (!uri) return null;

  // Move to permanent location
  const fileName = `voice_${Date.now()}.wav`;
  const destDir = `${FileSystem.documentDirectory}voice_samples/`;
  await FileSystem.makeDirectoryAsync(destDir, { intermediates: true });
  const destPath = `${destDir}${fileName}`;
  await FileSystem.moveAsync({ from: uri, to: destPath });

  return {
    filePath: destPath,
    durationMs: status.durationMillis ?? 0,
  };
}

/** Cancel the current recording without saving. */
export async function cancelRecording(): Promise<void> {
  if (!currentRecording) return;
  await currentRecording.stopAndUnloadAsync();
  await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
  const uri = currentRecording.getURI();
  currentRecording = null;
  if (uri) {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  }
}

/** Returns true if currently recording. */
export function isRecording(): boolean {
  return currentRecording !== null;
}
```

- [ ] **Step 2: Install expo-file-system if needed**

Run: `cd /Users/carlos/Workspace/rambling-guardian/app && npx expo install expo-file-system`

- [ ] **Step 3: Commit**

```bash
git add app/src/services/voiceRecorder.ts app/package.json app/package-lock.json
git commit -m "feat(onboarding): voice recorder service (expo-av wrapper)"
```

---

### Task 3: Voice Samples Database Operations

**Files:**
- Create: `app/src/db/voiceSamples.ts`

- [ ] **Step 1: Create voiceSamples.ts**

```typescript
import { getDatabase } from './database';
import type { VoiceSample } from '../types';

/** Insert a new voice sample record. */
export async function insertVoiceSample(
  filePath: string,
  durationMs: number,
): Promise<number> {
  const db = await getDatabase();
  const result = await db.runAsync(
    'INSERT INTO voice_samples (recorded_at, file_path, duration_ms, confirmed) VALUES (?, ?, ?, 0)',
    [Date.now(), filePath, durationMs],
  );
  return result.lastInsertRowId;
}

/** Get all voice samples, newest first. */
export async function getVoiceSamples(): Promise<VoiceSample[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    id: number;
    recorded_at: number;
    file_path: string;
    duration_ms: number;
    confirmed: number;
  }>('SELECT * FROM voice_samples ORDER BY recorded_at DESC');

  return rows.map((r) => ({
    id: r.id,
    recordedAt: r.recorded_at,
    filePath: r.file_path,
    durationMs: r.duration_ms,
    confirmed: r.confirmed === 1,
  }));
}

/** Mark a voice sample as confirmed (user reviewed and accepted it). */
export async function confirmVoiceSample(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE voice_samples SET confirmed = 1 WHERE id = ?', [id]);
}

/** Delete a voice sample record and its file. */
export async function deleteVoiceSample(id: number): Promise<void> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ file_path: string }>(
    'SELECT file_path FROM voice_samples WHERE id = ?',
    [id],
  );
  if (row) {
    const FileSystem = require('expo-file-system');
    await FileSystem.deleteAsync(row.file_path, { idempotent: true });
  }
  await db.runAsync('DELETE FROM voice_samples WHERE id = ?', [id]);
}

/** Get count of voice samples. Used to check if enrollment is done. */
export async function getVoiceSampleCount(): Promise<number> {
  const db = await getDatabase();
  const result = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM voice_samples',
  );
  return result?.count ?? 0;
}
```

- [ ] **Step 2: Commit**

```bash
git add app/src/db/voiceSamples.ts
git commit -m "feat(onboarding): voice samples CRUD operations"
```

---

### Task 4: WaveformBars Component

Animated waveform visualization. Shows idle (flat), recording (dynamic), and complete (static green) states.

**Files:**
- Create: `app/src/components/WaveformBars.tsx`

- [ ] **Step 1: Create WaveformBars.tsx**

```typescript
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

  // Create animated values for each bar
  const barHeights = useRef(
    Array.from({ length: barCount }, () => new Animated.Value(2)),
  ).current;

  useEffect(() => {
    if (state === 'recording') {
      // Animate bars with staggered random heights
      const animations = barHeights.map((height, i) =>
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

      return () => {
        animations.forEach((a) => a.stop());
      };
    } else if (state === 'complete') {
      // Static waveform shape
      barHeights.forEach((height, i) => {
        const val = Math.sin(i * 0.3) * 15 + 18;
        Animated.timing(height, {
          toValue: Math.max(4, val),
          duration: 300,
          useNativeDriver: false,
        }).start();
      });
    } else {
      // Idle — flat line
      barHeights.forEach((height) => {
        Animated.timing(height, {
          toValue: 2,
          duration: 200,
          useNativeDriver: false,
        }).start();
      });
    }
  }, [state]);

  const barColor =
    state === 'recording'
      ? theme.primary[500]
      : state === 'complete'
        ? theme.semantic.success
        : theme.text.muted;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.elevated }]}>
      {barHeights.map((height, i) => (
        <Animated.View
          key={i}
          style={[
            styles.bar,
            {
              height,
              backgroundColor: barColor,
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    height: 80,
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  bar: {
    width: 4,
    borderRadius: 2,
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add app/src/components/WaveformBars.tsx
git commit -m "feat(onboarding): animated waveform bars component"
```

---

### Task 5: VoicePromptCard Component

The main recording UI per Figma design. Shows prompt text, waveform, record button, progress, and skip.

**Files:**
- Create: `app/src/components/VoicePromptCard.tsx`

- [ ] **Step 1: Create VoicePromptCard.tsx**

```typescript
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
  prompt,
  currentIndex,
  totalPrompts,
  state,
  onRecord,
  onSkip,
}: VoicePromptCardProps) {
  const theme = useTheme();

  const buttonColor =
    state === 'recording'
      ? theme.alert.urgent // red for stop
      : state === 'complete'
        ? theme.semantic.success
        : theme.primary[500]; // indigo for record

  return (
    <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
      {/* Prompt text */}
      <Text
        style={[
          theme.type.body,
          { color: theme.text.primary, textAlign: 'center' },
        ]}
      >
        Read this aloud:{'\n'}
        <Text style={{ fontFamily: theme.fontFamily.semibold }}>
          "{prompt}"
        </Text>
      </Text>

      {/* Waveform */}
      <WaveformBars state={state} />

      {/* Record / Stop button */}
      <Pressable
        onPress={onRecord}
        style={[styles.recordButton, { backgroundColor: buttonColor }]}
      >
        {state === 'recording' ? (
          <View style={styles.stopIcon} />
        ) : (
          <View style={[styles.micDot, { backgroundColor: theme.text.onColor }]} />
        )}
      </Pressable>

      {/* Progress */}
      <Text style={[theme.type.caption, { color: theme.text.tertiary }]}>
        Sample {currentIndex + 1} of {totalPrompts}
      </Text>

      {/* Skip */}
      <Pressable onPress={onSkip} hitSlop={12}>
        <Text
          style={[
            theme.type.subtitle,
            { color: theme.text.tertiary, fontSize: 14 },
          ]}
        >
          Skip for now
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    gap: 16,
  },
  recordButton: {
    width: 64,
    height: 64,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopIcon: {
    width: 20,
    height: 20,
    borderRadius: 4,
    backgroundColor: '#fff',
  },
  micDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add app/src/components/VoicePromptCard.tsx
git commit -m "feat(onboarding): voice prompt card component (Figma design)"
```

---

### Task 6: Onboarding Flow Screens

Three screens: welcome, recording loop, completion.

**Files:**
- Create: `app/app/onboarding/_layout.tsx`
- Create: `app/app/onboarding/index.tsx`
- Create: `app/app/onboarding/record.tsx`
- Create: `app/app/onboarding/complete.tsx`

- [ ] **Step 1: Create onboarding layout**

```typescript
// app/app/onboarding/_layout.tsx
import { Stack } from 'expo-router';
import { useTheme } from '../../src/theme/theme';

export default function OnboardingLayout() {
  const theme = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.bg },
        animation: 'slide_from_right',
      }}
    />
  );
}
```

- [ ] **Step 2: Create welcome screen**

```typescript
// app/app/onboarding/index.tsx
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../src/theme/theme';

export default function OnboardingWelcome() {
  const theme = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.bg }]}>
      <View style={styles.content}>
        {/* Hero icon placeholder — indigo circle */}
        <View
          style={[styles.heroIcon, { backgroundColor: theme.primary[500] }]}
        />

        <Text
          style={[
            theme.type.title,
            { color: theme.text.primary, textAlign: 'center' },
          ]}
        >
          Voice Enrollment
        </Text>

        <Text
          style={[
            theme.type.body,
            {
              color: theme.text.secondary,
              textAlign: 'center',
              maxWidth: 280,
            },
          ]}
        >
          Record a few sentences so Rambling Guardian can learn your voice.
          This helps with speaker recognition later.
        </Text>

        <Text
          style={[
            theme.type.small,
            { color: theme.text.tertiary, textAlign: 'center' },
          ]}
        >
          5 short recordings · Takes about 2 minutes
        </Text>
      </View>

      <View style={styles.actions}>
        <Pressable
          onPress={() => router.push('/onboarding/record')}
          style={[
            styles.primaryButton,
            {
              backgroundColor: theme.primary[500],
              borderRadius: theme.radius.md,
            },
          ]}
        >
          <Text style={[theme.type.subtitle, { color: theme.text.onColor }]}>
            Let's Go
          </Text>
        </Pressable>

        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
        >
          <Text style={[theme.type.subtitle, { color: theme.text.tertiary, fontSize: 14 }]}>
            Skip for now
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
    paddingTop: 120,
    paddingBottom: 48,
    paddingHorizontal: 24,
  },
  content: {
    alignItems: 'center',
    gap: 16,
  },
  heroIcon: {
    width: 80,
    height: 80,
    borderRadius: 9999,
    marginBottom: 16,
  },
  actions: {
    alignItems: 'center',
    gap: 16,
  },
  primaryButton: {
    width: '100%',
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
```

- [ ] **Step 3: Create recording screen**

```typescript
// app/app/onboarding/record.tsx
import { useState, useCallback } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../src/theme/theme';
import { VoicePromptCard } from '../../src/components/VoicePromptCard';
import { voicePrompts } from '../../src/data/voicePrompts';
import {
  startRecording,
  stopRecording,
  cancelRecording,
} from '../../src/services/voiceRecorder';
import { insertVoiceSample } from '../../src/db/voiceSamples';

type RecordingState = 'idle' | 'recording' | 'complete';

export default function RecordScreen() {
  const theme = useTheme();
  const [promptIndex, setPromptIndex] = useState(0);
  const [state, setState] = useState<RecordingState>('idle');

  const handleRecord = useCallback(async () => {
    if (state === 'recording') {
      // Stop recording
      const result = await stopRecording();
      if (result) {
        await insertVoiceSample(result.filePath, result.durationMs);
        setState('complete');

        // Auto-advance after a brief pause
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
      // Start recording
      const started = await startRecording();
      if (started) {
        setState('recording');
      } else {
        Alert.alert(
          'Microphone Access',
          'Please enable microphone access in Settings to record voice samples.',
        );
      }
    }
    // If 'complete', do nothing (auto-advancing)
  }, [state, promptIndex]);

  const handleSkip = useCallback(async () => {
    if (state === 'recording') {
      await cancelRecording();
    }
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
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
});
```

- [ ] **Step 4: Create completion screen**

```typescript
// app/app/onboarding/complete.tsx
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../src/theme/theme';

export default function OnboardingComplete() {
  const theme = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.bg }]}>
      <View style={styles.content}>
        {/* Success circle */}
        <View
          style={[
            styles.successIcon,
            { backgroundColor: theme.semantic.success },
          ]}
        />

        <Text
          style={[
            theme.type.title,
            { color: theme.text.primary, textAlign: 'center' },
          ]}
        >
          You're all set!
        </Text>

        <Text
          style={[
            theme.type.body,
            {
              color: theme.text.secondary,
              textAlign: 'center',
              maxWidth: 280,
            },
          ]}
        >
          Your voice samples are saved. Speaker recognition will be available
          in a future update.
        </Text>
      </View>

      <Pressable
        onPress={() => router.dismissAll()}
        style={[
          styles.primaryButton,
          {
            backgroundColor: theme.primary[500],
            borderRadius: theme.radius.md,
          },
        ]}
      >
        <Text style={[theme.type.subtitle, { color: theme.text.onColor }]}>
          Continue
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
    paddingTop: 160,
    paddingBottom: 48,
    paddingHorizontal: 24,
  },
  content: {
    alignItems: 'center',
    gap: 16,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 9999,
    marginBottom: 16,
  },
  primaryButton: {
    width: '100%',
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
```

- [ ] **Step 5: Commit**

```bash
git add app/app/onboarding/
git commit -m "feat(onboarding): voice enrollment flow (welcome, record, complete)"
```

---

### Task 7: Wire Up Onboarding Entry Point

Add a "Set up voice" button to the home screen that opens onboarding as a modal. Shows only if the user hasn't completed enrollment.

**Files:**
- Modify: `app/app/(tabs)/index.tsx`

- [ ] **Step 1: Update HomeScreen with onboarding entry**

Replace the full contents of `app/app/(tabs)/index.tsx`:

```typescript
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

      <Text
        style={[
          theme.type.body,
          { color: theme.text.secondary, textAlign: 'center' },
        ]}
      >
        {connected
          ? `Device connected — ${battery}% battery`
          : 'No device connected. Go to Session tab to connect.'}
      </Text>

      {showEnrollment && (
        <Pressable
          onPress={() => router.push('/onboarding')}
          style={[
            styles.enrollButton,
            {
              backgroundColor: theme.colors.card,
              borderRadius: theme.radius.xl,
            },
          ]}
        >
          <View
            style={[
              styles.enrollDot,
              { backgroundColor: theme.primary[500] },
            ]}
          />
          <View style={styles.enrollText}>
            <Text
              style={[theme.type.subtitle, { color: theme.text.primary }]}
            >
              Set up voice enrollment
            </Text>
            <Text style={[theme.type.small, { color: theme.text.tertiary }]}>
              {sampleCount === 0
                ? '5 short recordings · 2 min'
                : `${sampleCount} of 5 samples recorded`}
            </Text>
          </View>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 16,
  },
  enrollButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
    marginTop: 16,
    width: '100%',
  },
  enrollDot: {
    width: 40,
    height: 40,
    borderRadius: 9999,
  },
  enrollText: {
    flex: 1,
    gap: 2,
  },
});
```

- [ ] **Step 2: Run TypeScript check**

Run: `cd /Users/carlos/Workspace/rambling-guardian/app && npx tsc --noEmit 2>&1 | head -20`

Expected: No errors.

- [ ] **Step 3: Run all tests**

Run: `cd /Users/carlos/Workspace/rambling-guardian/app && npx jest --no-cache 2>&1 | tail -10`

Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add app/app/\(tabs\)/index.tsx
git commit -m "feat(onboarding): add voice enrollment entry point to home screen"
```

- [ ] **Step 5: Push to GitHub**

```bash
git push
```
