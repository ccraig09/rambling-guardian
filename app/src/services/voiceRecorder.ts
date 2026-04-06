import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';

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
  return true;
}

export async function stopRecording(): Promise<{ filePath: string; durationMs: number } | null> {
  if (!currentRecording) return null;
  await currentRecording.stopAndUnloadAsync();
  await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
  const uri = currentRecording.getURI();
  const status = await currentRecording.getStatusAsync();
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
  await currentRecording.stopAndUnloadAsync();
  await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
  const uri = currentRecording.getURI();
  currentRecording = null;
  if (uri) await FileSystem.deleteAsync(uri, { idempotent: true });
}

export function isRecording(): boolean {
  return currentRecording !== null;
}
