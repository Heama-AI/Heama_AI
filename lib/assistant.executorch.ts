import { createContext, createElement, useCallback, useContext, useEffect, useRef } from 'react';
import {
  LLAMA3_2_1B_SPINQUANT,
  type Message,
  type ResourceSource,
  useLLM,
} from 'react-native-executorch';

import { generateAssistantDraft, mockLLMReply, SYSTEM_PROMPT } from '@/lib/assistant.shared';
import { extractKeywords } from '@/lib/conversation';
import { useAuthStore } from '@/store/authStore';
import type { ChatMessage } from '@/types/chat';
import type { ReactNode } from 'react';

type ExecuTorchModelConfig = {
  modelSource: ResourceSource;
  tokenizerSource: ResourceSource;
  tokenizerConfigSource: ResourceSource;
};

type UseExecuTorchAssistantOptions = {
  model?: ExecuTorchModelConfig;
  /**
   * 최대 몇 개의 이전 메시지를 컨텍스트로 포함할지.
   */
  contextMessageCount?: number;
  /**
   * 키워드 힌트를 프롬프트에 몇 개까지 넣을지.
   */
  keywordNoteLimit?: number;
  /**
   * true이면 모델 로딩을 지연한다.
   */
  preventLoad?: boolean;
};

type ExecuTorchAssistantResult = {
  isReady: boolean;
  isGenerating: boolean;
  downloadProgress: number;
  error: unknown;
  generateReply: (messages: ChatMessage[], keywords?: string[]) => Promise<string>;
  interrupt: () => void;
};

const DEFAULT_OPTIONS: Required<Omit<UseExecuTorchAssistantOptions, 'model'>> = {
  contextMessageCount: 10,
  keywordNoteLimit: 6,
  preventLoad: false,
};

const ExecuTorchAssistantContext = createContext<ExecuTorchAssistantResult | null>(null);

function useExecuTorchAssistantImpl(
  options: UseExecuTorchAssistantOptions = {}
): ExecuTorchAssistantResult {
  const {
    model = LLAMA3_2_1B_SPINQUANT,
    contextMessageCount,
    keywordNoteLimit,
    preventLoad,
  } = { ...DEFAULT_OPTIONS, ...options };

  const llm = useLLM({ model, preventLoad });
  const responseRef = useRef(llm.response);

  useEffect(() => {
    responseRef.current = llm.response;
  }, [llm.response]);

  const buildPromptMessages = useCallback(
    (conversation: ChatMessage[], keywords: string[] = []): Message[] => {
      const recentMessages = conversation.slice(-contextMessageCount).map((message) => ({
        role: message.role,
        content: message.text,
      }));

      const prompt: Message[] = [{ role: 'system', content: SYSTEM_PROMPT }];

      if (keywords.length > 0) {
        prompt.push({
          role: 'system',
          content: `최근 대화 키워드: ${keywords.slice(0, keywordNoteLimit).join(', ')}`,
        });
      }

      return [...prompt, ...recentMessages];
    },
    [contextMessageCount, keywordNoteLimit]
  );

  const generateReply = useCallback(
    async (conversation: ChatMessage[], providedKeywords?: string[]) => {
      if (!llm.isReady) {
        throw new Error('ExecuTorch 모델이 아직 준비되지 않았습니다.');
      }
      if (llm.isGenerating) {
        llm.interrupt();
      }

      const keywords = providedKeywords ?? extractKeywords(conversation);
      const promptMessages = buildPromptMessages(conversation, keywords);

      try {
        await llm.generate(promptMessages);
        const cleaned = responseRef.current.trim();
        if (cleaned.length === 0) {
          return generateAssistantDraft(conversation, keywords);
        }
        console.log('[executorch] 응답 생성 완료');
        return cleaned;
      } catch (error) {
        console.error('[executorch] 응답 생성 실패 – mock 응답 사용', error);
        try {
          console.log('[mock] 응답 생성 시도 중...');
          return await mockLLMReply(conversation, keywords);
        } catch {
          console.error('[mock] 응답 생성도 실패');
          return generateAssistantDraft(conversation, keywords);
        }
      }
    },
    [buildPromptMessages, llm, responseRef]
  );

  return {
    isReady: llm.isReady,
    isGenerating: llm.isGenerating,
    downloadProgress: llm.downloadProgress,
    error: llm.error,
    generateReply,
    interrupt: llm.interrupt,
  };
}

export function ExecuTorchAssistantProvider({
  children,
  options,
}: {
  children: ReactNode;
  options?: Omit<UseExecuTorchAssistantOptions, 'preventLoad'>;
}) {
  const userId = useAuthStore((state) => state.userId);
  const assistant = useExecuTorchAssistantImpl({
    ...options,
    preventLoad: !userId,
  });
  const Provider = ExecuTorchAssistantContext.Provider;
  return createElement(Provider, { value: assistant }, children);
}

export function useExecuTorchAssistant() {
  const ctx = useContext(ExecuTorchAssistantContext);
  if (!ctx) {
    throw new Error('useExecuTorchAssistant는 ExecuTorchAssistantProvider 내부에서만 사용할 수 있습니다.');
  }
  return ctx;
}

export function useOptionalExecuTorchAssistant() {
  return useContext(ExecuTorchAssistantContext);
}
