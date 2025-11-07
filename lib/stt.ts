import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

type TranscriptionOptions = {
  language?: string;
};

type STTProvider = 'openai' | 'google';

const OPENAI_ENDPOINT = 'https://api.openai.com/v1/audio/transcriptions';
const OPENAI_MODEL = 'whisper-1';
const GOOGLE_ENDPOINT = 'https://speech.googleapis.com/v1p1beta1/speech:recognize';

const DEFAULT_LANGUAGE = 'ko-KR';

export async function transcribeAudio(fileUri: string, options?: TranscriptionOptions): Promise<string> {
  await ensureRecordingExists(fileUri);

  const provider = resolveProvider();
  if (provider === 'google') {
    return transcribeWithGoogle(fileUri, options);
  }
  return transcribeWithOpenAI(fileUri, options);
}

function resolveProvider(): STTProvider {
  const explicit = process.env.EXPO_PUBLIC_STT_PROVIDER?.toLowerCase();
  if (explicit === 'google') return 'google';
  if (explicit === 'openai') return 'openai';
  if (process.env.EXPO_PUBLIC_GOOGLE_SPEECH_API_KEY) return 'google';
  return 'openai';
}

async function ensureRecordingExists(fileUri: string) {
  const fileInfo = await FileSystem.getInfoAsync(fileUri);
  if (!fileInfo.exists) {
    throw new Error('녹음 파일을 찾을 수 없습니다.');
  }
}

async function transcribeWithOpenAI(fileUri: string, options?: TranscriptionOptions) {
  const endpoint = process.env.EXPO_PUBLIC_TRANSCRIBE_ENDPOINT ?? OPENAI_ENDPOINT;
  const model = process.env.EXPO_PUBLIC_TRANSCRIBE_MODEL ?? OPENAI_MODEL;
  const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('OpenAI API Key(EXPO_PUBLIC_OPENAI_API_KEY)이 설정되지 않았습니다.');
  }

  const fileName = fileUri.split('/').pop() ?? `recording.${Platform.OS === 'web' ? 'webm' : 'm4a'}`;
  const mimeType = Platform.select({ web: 'audio/webm', default: 'audio/m4a' }) ?? 'audio/m4a';

  const formData = new FormData();
  formData.append('model', model);
  formData.append('language', options?.language ?? 'ko');
  formData.append('temperature', '0');
  formData.append('response_format', 'json');
  formData.append('file', {
    uri: fileUri,
    name: fileName,
    type: mimeType,
  } as unknown as Blob);

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(async () => {
      const fallbackText = await response.text();
      return { error: { message: fallbackText } };
    });

    const errorMessage = errorBody?.error?.message;
    if (errorMessage?.includes('insufficient_quota')) {
      throw new Error('OpenAI 음성 인식 한도를 초과했습니다. 결제/한도 설정을 확인해주세요.');
    }

    throw new Error(`음성 인식 요청이 실패했습니다: ${errorMessage ?? '알 수 없는 오류'}`);
  }

  const data = (await response.json()) as { text?: string };
  if (!data?.text) {
    throw new Error('음성 인식 결과가 비어 있습니다.');
  }

  return data.text.trim();
}

async function transcribeWithGoogle(fileUri: string, options?: TranscriptionOptions) {
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_SPEECH_API_KEY;
  if (!apiKey) {
    throw new Error('Google Cloud Speech API Key(EXPO_PUBLIC_GOOGLE_SPEECH_API_KEY)을 설정해주세요.');
  }

  const endpoint = process.env.EXPO_PUBLIC_GOOGLE_SPEECH_ENDPOINT ?? GOOGLE_ENDPOINT;
  const language = options?.language ?? DEFAULT_LANGUAGE;
  const sampleRate = Number(process.env.EXPO_PUBLIC_GOOGLE_SPEECH_SAMPLE_RATE ?? '44100');
  const model = process.env.EXPO_PUBLIC_GOOGLE_SPEECH_MODEL;

  const audioContent = await FileSystem.readAsStringAsync(fileUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const config: Record<string, unknown> = {
    encoding: 'ENCODING_UNSPECIFIED',
    sampleRateHertz: sampleRate,
    languageCode: language,
    enableAutomaticPunctuation: true,
  };

  if (model) {
    config.model = model;
  }

  const body = {
    config,
    audio: {
      content: audioContent,
    },
  };

  const response = await fetch(`${endpoint}?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMessage = data?.error?.message ?? '알 수 없는 오류';
    throw new Error(`Google 음성 인식 요청이 실패했습니다: ${errorMessage}`);
  }

  const transcript = extractGoogleTranscript(data);
  if (!transcript) {
    throw new Error('Google 음성 인식 결과가 비어 있습니다.');
  }

  return transcript;
}

function extractGoogleTranscript(data: any): string | undefined {
  if (!Array.isArray(data?.results)) return undefined;
  const phrases: string[] = [];

  for (const result of data.results) {
    const alternative = result?.alternatives?.[0];
    if (alternative?.transcript) {
      phrases.push(alternative.transcript);
    }
  }

  return phrases.join(' ').trim() || undefined;
}
