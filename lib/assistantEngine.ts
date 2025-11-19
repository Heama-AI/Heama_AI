import { useCallback } from 'react';

import { getOpenAIAssistantReply } from '@/lib/assistant.openai';
import { useExecuTorchAssistant } from '@/lib/assistant.executorch';
import { ASSISTANT_PROVIDER, IS_EXECUTORCH_ASSISTANT } from '@/lib/assistantConfig';
import type { ChatMessage } from '@/types/chat';

type AssistantEngine = {
  provider: typeof ASSISTANT_PROVIDER;
  isReady: boolean;
  isGenerating: boolean;
  downloadProgress: number;
  error: unknown;
  generateReply: (messages: ChatMessage[], keywords?: string[]) => Promise<string>;
  interrupt: () => void;
};

const noop = () => {};

export function useAssistantEngine(): AssistantEngine {
  if (IS_EXECUTORCH_ASSISTANT) {
    const execAssistant = useExecuTorchAssistant();
    const generateReply = useCallback(
      async (messages: ChatMessage[], keywords?: string[]) => {
        return execAssistant.generateReply(messages, keywords);
      },
      [execAssistant]
    );

    return {
      provider: ASSISTANT_PROVIDER,
      isReady: execAssistant.isReady,
      isGenerating: execAssistant.isGenerating,
      downloadProgress: execAssistant.downloadProgress,
      error: execAssistant.error,
      generateReply,
      interrupt: execAssistant.interrupt,
    };
  }

  const generateReply = useCallback(
    (messages: ChatMessage[], keywords?: string[]) => getOpenAIAssistantReply(messages, keywords),
    []
  );

  return {
    provider: ASSISTANT_PROVIDER,
    isReady: true,
    isGenerating: false,
    downloadProgress: 1,
    error: null,
    generateReply,
    interrupt: noop,
  };
}
