import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';

const RECORDING_OPTIONS: Audio.RecordingOptions = {
  isMeteringEnabled: true,
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
let meteringCallback: ((level: number) => void) | null = null;

export function setOnMeteringUpdate(callback: ((level: number) => void) | null): void {
  meteringCallback = callback;
}

export async function requestMicPermission(): Promise<boolean> {
  const { granted } = await Audio.requestPermissionsAsync();
  return granted;
}

export async function startRecording(): Promise<boolean> {
  if (currentRecording) return false;
  const granted = await requestMicPermission();
  if (!granted) return false;
  await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
  const { recording } = await Audio.Recording.createAsync(RECORDING_OPTIONS);
  currentRecording = recording;

  recording.setProgressUpdateInterval(100);
  recording.setOnRecordingStatusUpdate((status) => {
    if (status.isRecording && status.metering !== undefined && meteringCallback) {
      // Metering is in dB (negative values, -160 to 0). Normalize to 0-1.
      const normalized = Math.max(0, Math.min(1, (status.metering + 60) / 60));
      meteringCallback(normalized);
    }
  });

  return true;
}

export async function stopRecording(): Promise<{ filePath: string; durationMs: number } | null> {
  if (!currentRecording) return null;
  meteringCallback = null;
  const status = await currentRecording.stopAndUnloadAsync();
  await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
  const uri = currentRecording.getURI();
  currentRecording = null;
  if (!uri) return null;
  const fileName = `voice_${Date.now()}.wav`;
  const destDir = `${FileSystem.documentDirectory}voice_samples/`;
  await FileSystem.makeDirectoryAsync(destDir, { intermediates: true });
  const destPath = `${destDir}${fileName}`;
  await FileSystem.moveAsync({ from: uri, to: destPath });
  return { filePath: destPath, durationMs: status.durationMillis ?? 0 };
}

export async function cancelRecording(): Promise<void> {
  if (!currentRecording) return;
  meteringCallback = null;
  await currentRecording.stopAndUnloadAsync();
  await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
  const uri = currentRecording.getURI();
  currentRecording = null;
  if (uri) await FileSystem.deleteAsync(uri, { idempotent: true });
}

export async function playRecording(filePath: string): Promise<Audio.Sound> {
  await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
  const { sound } = await Audio.Sound.createAsync({ uri: filePath });
  await sound.playAsync();
  return sound;
}

export async function stopPlayback(sound: Audio.Sound): Promise<void> {
  await sound.stopAsync();
  await sound.unloadAsync();
}

export function isRecording(): boolean {
  return currentRecording !== null;
}
