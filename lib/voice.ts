import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

type RecordingCallbacks = {
  onLevel?: (level: number) => void;
};

export interface RecordingResult {
  fileUri: string;
  mimeType: string;
  durationMillis?: number;
}

export interface RecordingHandle {
  stop: (options?: { discard?: boolean }) => Promise<RecordingResult | undefined>;
}

const MIME_TYPE = Platform.select({
  web: 'audio/webm',
  default: 'audio/m4a',
});

const RECORDING_AUDIO_MODE = {
  allowsRecordingIOS: true,
  playsInSilentModeIOS: true,
  staysActiveInBackground: false,
  interruptionModeIOS: InterruptionModeIOS.DoNotMix,
  interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
  shouldDuckAndroid: false,
  playThroughEarpieceAndroid: false,
};

const PLAYBACK_AUDIO_MODE = {
  allowsRecordingIOS: false,
  playsInSilentModeIOS: true,
  staysActiveInBackground: false,
  interruptionModeIOS: InterruptionModeIOS.DoNotMix,
  interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
  shouldDuckAndroid: false,
  playThroughEarpieceAndroid: false,
};

async function ensurePermissions() {
  const { status } = await Audio.requestPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('마이크 권한이 필요합니다.');
  }
}

function meteringToLevel(metering?: number) {
  if (typeof metering !== 'number' || Number.isNaN(metering)) return 0;
  // Expo returns levels in dBFS where 0 is loudest and -160 is silence.
  return Math.min(1, Math.max(0, (metering + 160) / 70));
}

export async function startVoiceRecording(callbacks?: RecordingCallbacks): Promise<RecordingHandle> {
  await ensurePermissions();
  await Audio.setAudioModeAsync(RECORDING_AUDIO_MODE);

  const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);

  let levelInterval: NodeJS.Timeout | null = null;

  if (callbacks?.onLevel) {
    levelInterval = setInterval(async () => {
      try {
        const status = await recording.getStatusAsync();
        if (!status.isRecording) return;
        callbacks.onLevel?.(meteringToLevel(status.metering));
      } catch {
        // no-op: metering failures shouldn't break recording
      }
    }, 120);
  }

  return {
    stop: async (options) => {
      if (levelInterval) {
        clearInterval(levelInterval);
        levelInterval = null;
      }

      try {
        const status = await recording.getStatusAsync();
        if (status.isRecording) {
          await recording.stopAndUnloadAsync();
        }
      } catch (error) {
        if (__DEV__) {
          console.warn('stopAndUnloadAsync failed – possibly already stopped', error);
        }
      }

      callbacks?.onLevel?.(0);

      const uri = recording.getURI();
      if (!uri) {
        await Audio.setAudioModeAsync(PLAYBACK_AUDIO_MODE).catch(() => undefined);
        return undefined;
      }

      if (options?.discard) {
        await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined);
        await Audio.setAudioModeAsync(PLAYBACK_AUDIO_MODE).catch(() => undefined);
        return undefined;
      }

      const fileInfo = await FileSystem.getInfoAsync(uri);
      if (!fileInfo.exists) {
        await Audio.setAudioModeAsync(PLAYBACK_AUDIO_MODE).catch(() => undefined);
        return undefined;
      }

      await Audio.setAudioModeAsync(PLAYBACK_AUDIO_MODE).catch(() => undefined);

      return {
        fileUri: uri,
        mimeType: MIME_TYPE ?? 'audio/m4a',
        durationMillis: (await recording.getStatusAsync()).durationMillis,
      };
    },
  };
}
