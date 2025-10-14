import * as Speech from 'expo-speech';

type SpeechCallbacks = {
  onStart?: () => void;
  onComplete?: () => void;
  onError?: (error?: Speech.SpeechError) => void;
};

export function say(text: string, callbacks?: SpeechCallbacks) {
  return new Promise<void>((resolve, reject) => {
    let finished = false;

    Speech.speak(text, {
      language: 'ko-KR',
      pitch: 1.0,
      rate: 0.95,
      onStart: () => {
        callbacks?.onStart?.();
      },
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
}

export function stopSpeaking() {
  Speech.stop();
}
