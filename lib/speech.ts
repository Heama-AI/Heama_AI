import { Buffer } from 'buffer';
import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import * as Speech from 'expo-speech';

type SpeechCallbacks = {
  onStart?: () => void;
  onComplete?: () => void;
  onError?: (error?: Error) => void;
};

type TTSProvider = 'expo' | 'openai';

type OpenAITTSConfig = {
  endpoint: string;
  model: string;
  voice: string;
  format: string;
  speed: number;
};

const OPENAI_TTS_ENDPOINT = 'https://api.openai.com/v1/audio/speech';
const DEFAULT_OPENAI_TTS_MODEL = 'tts-1';
const DEFAULT_OPENAI_TTS_VOICE = 'alloy';
const DEFAULT_OPENAI_TTS_FORMAT = 'mp3';

let currentSound: Audio.Sound | null = null;
let currentSoundFileUri: string | null = null;
let pendingFinalize: ((error?: Error) => void) | null = null;

export function say(text: string, callbacks?: SpeechCallbacks) {
  const provider = resolveProvider();
  const openaiConfig = provider === 'openai' ? resolveOpenAITTSConfig() : undefined;
  const descriptor = provider === 'openai' ? `openai:${openaiConfig?.model}:${openaiConfig?.voice}` : 'expo:native';
  const startedAt = Date.now();

  console.log(`[ai] TTS provider=${descriptor}`);

  const playbackPromise =
    provider === 'openai' && openaiConfig ? speakWithOpenAI(text, callbacks, openaiConfig) : speakWithExpo(text, callbacks);

  return playbackPromise.finally(() => {
    const elapsed = Date.now() - startedAt;
    console.log(`[latency] TTS(${descriptor}) ${elapsed}ms`);
  });
}

export function stopSpeaking() {
  Speech.stop();
  if (pendingFinalize) {
    pendingFinalize();
  } else {
    void disposeCurrentSound();
  }
}

function resolveProvider(): TTSProvider {
  const configured = process.env.EXPO_PUBLIC_TTS_PROVIDER?.toLowerCase();
  if (configured === 'openai') return 'openai';
  return 'expo';
}

async function ensurePlaybackAudioMode() {
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      interruptionModeIOS: InterruptionModeIOS.DoNotMix,
      interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
      shouldDuckAndroid: false,
      playThroughEarpieceAndroid: false,
    });
  } catch (error) {
    if (__DEV__) {
      console.warn('Failed to set audio mode before speech', error);
    }
  }
}

function speakWithExpo(text: string, callbacks?: SpeechCallbacks) {
  return new Promise<void>((resolve, reject) => {
    void ensurePlaybackAudioMode().finally(() => {
      let finished = false;
      Speech.speak(text, {
        language: 'ko-KR',
        pitch: 1.0,
        rate: 0.95,
        onStart: () => callbacks?.onStart?.(),
        onDone: () => {
          if (!finished) {
            finished = true;
            callbacks?.onComplete?.();
            resolve();
          }
        },
        onStopped: () => {
          if (!finished) {
            finished = true;
            callbacks?.onComplete?.();
            resolve();
          }
        },
        onError: (error) => {
          if (!finished) {
            finished = true;
            callbacks?.onError?.(error);
            reject(error);
          }
        },
      });
    });
  });
}

function resolveOpenAITTSConfig(): OpenAITTSConfig {
  const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OpenAI API Key(EXPO_PUBLIC_OPENAI_API_KEY)이 설정되지 않았습니다.');
  }

  const endpoint = process.env.EXPO_PUBLIC_OPENAI_TTS_ENDPOINT ?? OPENAI_TTS_ENDPOINT;
  const model = process.env.EXPO_PUBLIC_OPENAI_TTS_MODEL ?? DEFAULT_OPENAI_TTS_MODEL;
  const voice = process.env.EXPO_PUBLIC_OPENAI_TTS_VOICE ?? DEFAULT_OPENAI_TTS_VOICE;
  const format = process.env.EXPO_PUBLIC_OPENAI_TTS_FORMAT ?? DEFAULT_OPENAI_TTS_FORMAT;
  const speed = Number(process.env.EXPO_PUBLIC_OPENAI_TTS_SPEED ?? '1');

  return { endpoint, model, voice, format, speed };
}

async function speakWithOpenAI(text: string, callbacks: SpeechCallbacks | undefined, config: OpenAITTSConfig) {
  const { endpoint, model, voice, format, speed } = config;
  const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY!;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      voice,
      input: text,
      response_format: format,
      speed,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI 음성 합성 실패: ${errorText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString('base64');
  const extension = format === 'wav' ? 'wav' : format === 'pcm' ? 'pcm' : 'mp3';
  const fileUri = `${FileSystem.cacheDirectory ?? FileSystem.documentDirectory ?? ''}tts-${Date.now()}.${extension}`;
  await FileSystem.writeAsStringAsync(fileUri, base64, { encoding: FileSystem.EncodingType.Base64 });

  return playAudioFile(fileUri, callbacks);
}

async function playAudioFile(fileUri: string, callbacks?: SpeechCallbacks) {
  await ensurePlaybackAudioMode();
  if (pendingFinalize) {
    pendingFinalize(new Error('Playback interrupted'));
  }
  await disposeCurrentSound();

  currentSoundFileUri = fileUri;

  return new Promise<void>(async (resolve, reject) => {
    let settled = false;
    const finalize = (error?: Error) => {
      if (settled) return;
      settled = true;
      void (async () => {
        if (currentSound) {
          currentSound.setOnPlaybackStatusUpdate(null);
        }
        const delayDeleteMs = error ? 0 : 250;
        await disposeCurrentSound(delayDeleteMs ? { delayDeleteMs } : undefined);
        if (pendingFinalize === finalize) {
          pendingFinalize = null;
        }
        if (error) {
          callbacks?.onError?.(error);
          reject(error);
        } else {
          callbacks?.onComplete?.();
          resolve();
        }
      })();
    };

    pendingFinalize = finalize;

    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri: fileUri },
        { shouldPlay: true, volume: 1, isMuted: false },
      );

      currentSound = sound;
      callbacks?.onStart?.();

      sound.setOnPlaybackStatusUpdate((status) => {
        if (!status.isLoaded) {
          if ('error' in status && status.error) {
            finalize(new Error(status.error));
          }
          return;
        }

        if (status.didJustFinish) {
          finalize();
        }
      });
    } catch (error) {
      finalize(error instanceof Error ? error : new Error(String(error)));
    }
  });
}

async function disposeCurrentSound(options?: { delayDeleteMs?: number }) {
  if (currentSound) {
    try {
      await currentSound.stopAsync();
    } catch {
      // ignore
    }
    try {
      await currentSound.unloadAsync();
    } catch {
      // ignore
    }
    currentSound = null;
  }

  if (currentSoundFileUri) {
    const targetUri = currentSoundFileUri;
    currentSoundFileUri = null;

    const deleteFile = () => FileSystem.deleteAsync(targetUri, { idempotent: true }).catch(() => undefined);

    if (options?.delayDeleteMs && options.delayDeleteMs > 0) {
      setTimeout(() => {
        void deleteFile();
      }, options.delayDeleteMs);
    } else {
      await deleteFile();
    }
  }
}
