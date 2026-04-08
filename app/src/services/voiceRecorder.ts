// expo-audio migration (RG-C.11.16): replaces expo-av before SDK 55 deprecation.
//
// Architecture note: expo-audio's recording API is hook-based (useAudioRecorder), but this
// module intentionally uses AudioModule.AudioRecorder directly to preserve the imperative
// service pattern. This keeps recording logic decoupled from React component lifecycle —
// important for battery auto-stop and other non-render-path callers. This contained usage
// of the internal constructor should be re-evaluated on future SDK upgrades (especially if
// expo-audio adds a public createAudioRecorder equivalent to createAudioPlayer).

import {
  AudioModule,
  createAudioPlayer,
  setAudioModeAsync,
  requestRecordingPermissionsAsync,
  IOSOutputFormat,
  AudioQuality,
} from 'expo-audio';
import type { AudioPlayer, AudioRecorder } from 'expo-audio';
import type { RecordingOptions } from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';

const RECORDING_OPTIONS: RecordingOptions = {
  isMeteringEnabled: true,
  extension: '.wav',
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 256000,
  android: {
    outputFormat: 'default',
    audioEncoder: 'default',
  },
  ios: {
    outputFormat: IOSOutputFormat.LINEARPCM,
    audioQuality: AudioQuality.HIGH,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {},
};

let currentRecorder: AudioRecorder | null = null;
let meteringCallback: ((level: number) => void) | null = null;
let meteringInterval: ReturnType<typeof setInterval> | null = null;

function clearMeteringInterval(): void {
  if (meteringInterval !== null) {
    clearInterval(meteringInterval);
    meteringInterval = null;
  }
}

function startMeteringPolling(recorder: AudioRecorder): void {
  clearMeteringInterval();
  meteringInterval = setInterval(() => {
    if (!meteringCallback) return;
    const status = recorder.getStatus();
    if (status.isRecording && status.metering !== undefined) {
      // Metering is in dB (negative values, -160 to 0). Normalize to 0-1.
      const normalized = Math.max(0, Math.min(1, (status.metering + 60) / 60));
      meteringCallback(normalized);
    }
  }, 100);
}

export function setOnMeteringUpdate(callback: ((level: number) => void) | null): void {
  meteringCallback = callback;
}

export async function requestMicPermission(): Promise<boolean> {
  const { granted } = await requestRecordingPermissionsAsync();
  return granted;
}

export async function startRecording(): Promise<boolean> {
  if (currentRecorder) return false;
  const granted = await requestMicPermission();
  if (!granted) return false;
  await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });

  const recorder = new AudioModule.AudioRecorder({});
  await recorder.prepareToRecordAsync(RECORDING_OPTIONS);
  recorder.record();
  currentRecorder = recorder;

  startMeteringPolling(recorder);
  return true;
}

export async function stopRecording(): Promise<{ filePath: string; durationMs: number } | null> {
  if (!currentRecorder) return null;
  clearMeteringInterval();
  // Note: do NOT null meteringCallback here — the component owns that lifecycle
  // via setOnMeteringUpdate. Nulling it breaks metering on subsequent recordings.

  // Read duration before stop — stop() returns void, not status
  const durationMs = currentRecorder.getStatus().durationMillis ?? 0;
  await currentRecorder.stop();
  await setAudioModeAsync({ allowsRecording: false });

  const uri = currentRecorder.uri;
  currentRecorder = null;
  if (!uri) return null;

  const fileName = `voice_${Date.now()}.wav`;
  const destDir = `${FileSystem.documentDirectory}voice_samples/`;
  await FileSystem.makeDirectoryAsync(destDir, { intermediates: true });
  const destPath = `${destDir}${fileName}`;
  await FileSystem.moveAsync({ from: uri, to: destPath });
  return { filePath: destPath, durationMs };
}

export async function cancelRecording(): Promise<void> {
  if (!currentRecorder) return;
  clearMeteringInterval();

  const uri = currentRecorder.uri;
  await currentRecorder.stop();
  await setAudioModeAsync({ allowsRecording: false });
  currentRecorder = null;
  if (uri) await FileSystem.deleteAsync(uri, { idempotent: true });
}

export async function playRecording(filePath: string): Promise<AudioPlayer> {
  await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
  const player = createAudioPlayer({ uri: filePath });
  player.play();
  return player;
}

export async function stopPlayback(player: AudioPlayer): Promise<void> {
  player.remove();
}

export function isRecording(): boolean {
  return currentRecorder !== null;
}
