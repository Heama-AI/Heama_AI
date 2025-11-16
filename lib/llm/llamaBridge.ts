type LlamaModule = typeof import('llama.rn');

let llamaModulePromise: Promise<LlamaModule | null> | null = null;

/**
 * Tries to load the llama.rn native module. Returns null when the module
 * is not linked (e.g., running inside Expo Go).
 */
export async function loadLlamaModule(): Promise<LlamaModule | null> {
  if (!llamaModulePromise) {
    llamaModulePromise = import('llama.rn')
      .then((module) => module)
      .catch((error) => {
        if (__DEV__) {
          console.warn('[llama] 네이티브 모듈을 찾을 수 없어 로컬 LLM 기능을 비활성화합니다.', error);
        }
        return null;
      });
  }
  return llamaModulePromise;
}

export function resetLlamaModuleCache() {
  llamaModulePromise = null;
}
