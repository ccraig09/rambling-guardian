import { useState, useCallback, useEffect, useRef } from 'react';
import { View, StyleSheet, Alert, Linking } from 'react-native';
import { router } from 'expo-router';
import { Audio } from 'expo-av';
import { useTheme } from '../../src/theme/theme';
import { VoicePromptCard } from '../../src/components/VoicePromptCard';
import { voicePrompts } from '../../src/data/voicePrompts';
import {
  startRecording,
  stopRecording,
  cancelRecording,
  setOnMeteringUpdate,
  playRecording,
  stopPlayback,
} from '../../src/services/voiceRecorder';
import { insertVoiceSample } from '../../src/db/voiceSamples';
import { useDeviceStore } from '../../src/stores/deviceStore';
import { useSettingsStore } from '../../src/stores/settingsStore';

type RecordingState = 'idle' | 'recording' | 'complete' | 'error';

const MIN_DURATION_MS = 3000;

export default function RecordScreen() {
  const theme = useTheme();
  const deviceBattery = useDeviceStore((s) => s.battery);
  const deviceConnected = useDeviceStore((s) => s.connected);
  const minBattery = useSettingsStore((s) => s.minBatteryForRecording);
  const [promptIndex, setPromptIndex] = useState(0);
  const [state, setState] = useState<RecordingState>('idle');
  const [audioLevel, setAudioLevel] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [lastRecordingPath, setLastRecordingPath] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const playbackSoundRef = useRef<Audio.Sound | null>(null);

  // Set up metering callback once
  useEffect(() => {
    setOnMeteringUpdate((level) => setAudioLevel(level));
    return () => {
      setOnMeteringUpdate(null);
    };
  }, []);

  // Clean up playback sound on unmount
  useEffect(() => {
    return () => {
      if (playbackSoundRef.current) {
        stopPlayback(playbackSoundRef.current).catch(() => {});
        playbackSoundRef.current = null;
      }
    };
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Critical battery auto-stop: save recording safely if battery drops below 5%
  useEffect(() => {
    if (state !== 'recording' || !deviceConnected) return;
    if (deviceBattery < 5) {
      clearTimer();
      stopRecording()
        .then((result) => {
          if (result) {
            insertVoiceSample(result.filePath, result.durationMs).catch(console.warn);
            setLastRecordingPath(result.filePath);
          }
          setState('complete');
          setAudioLevel(0);
          Alert.alert(
            'Recording Saved',
            'Device battery is critically low. Your recording was saved automatically.',
            [{ text: 'OK' }],
          );
        })
        .catch(console.warn);
    }
  }, [state, deviceConnected, deviceBattery, clearTimer]);

  const startTimer = useCallback(() => {
    startTimeRef.current = Date.now();
    setElapsedMs(0);
    timerRef.current = setInterval(() => {
      setElapsedMs(Date.now() - startTimeRef.current);
    }, 100);
  }, []);

  const handleRecord = useCallback(async () => {
    if (state === 'recording') {
      // Stop recording
      clearTimer();
      const result = await stopRecording();
      if (result) {
        if (result.durationMs < MIN_DURATION_MS) {
          // Too short -- discard and show error
          const FileSystem = require('expo-file-system/legacy');
          await FileSystem.deleteAsync(result.filePath, { idempotent: true });
          setLastRecordingPath(null);
          setState('error');
        } else {
          await insertVoiceSample(result.filePath, result.durationMs);
          setLastRecordingPath(result.filePath);
          setState('complete');
        }
      }
      setAudioLevel(0);
    } else if (state === 'idle' || state === 'error') {
      // Battery guard: don't start recording if device battery is too low
      if (deviceConnected && deviceBattery < minBattery) {
        Alert.alert(
          'Low Battery',
          `Device battery is at ${deviceBattery}%. Recording requires at least ${minBattery}% battery.`,
          [{ text: 'OK' }],
        );
        return;
      }
      // Start recording
      try {
        const started = await startRecording();
        if (started) {
          setState('recording');
          startTimer();
        } else {
          Alert.alert(
            'Microphone Access',
            'Please enable microphone access in Settings to record voice samples.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Settings', onPress: () => Linking.openSettings() },
            ],
          );
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        Alert.alert('Recording Error', `Could not start recording: ${message}`);
      }
    } else if (state === 'complete') {
      // "Use this recording" -- advance to next prompt
      if (promptIndex < voicePrompts.length - 1) {
        setPromptIndex((i) => i + 1);
        setLastRecordingPath(null);
        setElapsedMs(0);
        setState('idle');
      } else {
        router.replace('/onboarding/complete');
      }
    }
  }, [state, promptIndex, clearTimer, startTimer, deviceConnected, deviceBattery, minBattery]);

  const handlePlayback = useCallback(async () => {
    if (!lastRecordingPath) return;
    // Stop any existing playback first
    if (playbackSoundRef.current) {
      await stopPlayback(playbackSoundRef.current).catch(() => {});
      playbackSoundRef.current = null;
    }
    try {
      const sound = await playRecording(lastRecordingPath);
      playbackSoundRef.current = sound;
      // Auto-cleanup when playback finishes
      sound.setOnPlaybackStatusUpdate((status) => {
        if ('didJustFinish' in status && status.didJustFinish) {
          sound.unloadAsync().catch(() => {});
          if (playbackSoundRef.current === sound) {
            playbackSoundRef.current = null;
          }
        }
      });
    } catch (err) {
      Alert.alert('Playback Error', 'Could not play the recording.');
    }
  }, [lastRecordingPath]);

  const handleReRecord = useCallback(async () => {
    // Stop any playback
    if (playbackSoundRef.current) {
      await stopPlayback(playbackSoundRef.current).catch(() => {});
      playbackSoundRef.current = null;
    }
    setLastRecordingPath(null);
    setElapsedMs(0);
    setAudioLevel(0);
    setState('idle');
  }, []);

  const handleSkip = useCallback(async () => {
    clearTimer();
    if (state === 'recording') await cancelRecording();
    if (playbackSoundRef.current) {
      await stopPlayback(playbackSoundRef.current).catch(() => {});
      playbackSoundRef.current = null;
    }
    router.back();
  }, [state, clearTimer]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.bg }]}>
      <VoicePromptCard
        prompt={voicePrompts[promptIndex]}
        currentIndex={promptIndex}
        totalPrompts={voicePrompts.length}
        state={state}
        audioLevel={audioLevel}
        elapsedMs={elapsedMs}
        lastRecordingPath={lastRecordingPath}
        onRecord={handleRecord}
        onPlayback={handlePlayback}
        onReRecord={handleReRecord}
        onSkip={handleSkip}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
});
