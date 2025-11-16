import { getOpenAIAssistantReply } from '@/lib/assistant.openai';
import { SYSTEM_PROMPT, generateAssistantDraft, mockLLMReply } from '@/lib/assistant.shared';
import { extractKeywords } from '@/lib/conversation';
import { ensureModelAsset, type ModelAssetConfig } from '@/lib/llm/modelLoader';
import type { ChatMessage } from '@/types/chat';
import { initLlama, type ContextParams, type LlamaContext, type TokenData } from 'llama.rn';

type LocalModelConfig = {
  asset: ModelAssetConfig;
  params: Pick<ContextParams, 'n_ctx' | 'n_threads'> & {
    temperature: number;
    maxTokens: number;
  };
};

const DEFAULT_MODEL_ID_qw = 'qwen2.5-1.5b-instruct-q3_k_m';
const DEFAULT_MODEL_ID = 'gemma-3n-E2B-it-Q4_K_S';
const DEFAULT_MODEL_ID_G3 = 'gemma-3-1b-it-q4_0';
const DEFAULT_BUNDLE_PATH = `models/${DEFAULT_MODEL_ID}.gguf`;

const LOCAL_CHAT_TEMPERATURE = Number(process.env.EXPO_PUBLIC_LOCAL_LLM_TEMPERATURE ?? '0.6');
const LOCAL_CHAT_MAX_TOKENS = Number(process.env.EXPO_PUBLIC_LOCAL_LLM_MAX_TOKENS ?? '320');
const LOCAL_CHAT_N_CTX = Number(process.env.EXPO_PUBLIC_LOCAL_LLM_CTX ?? '4096');
const LOCAL_CHAT_THREADS = Number(process.env.EXPO_PUBLIC_LOCAL_LLM_THREADS ?? '4');

const MODEL_ID = process.env.EXPO_PUBLIC_LOCAL_LLM_MODEL_ID ?? DEFAULT_MODEL_ID;
const MODEL_BUNDLE_PATH =
  process.env.EXPO_PUBLIC_LOCAL_LLM_BUNDLE_PATH ?? `models/${MODEL_ID === DEFAULT_MODEL_ID ? DEFAULT_MODEL_ID : MODEL_ID}.gguf`;
const MODEL_FILENAME = process.env.EXPO_PUBLIC_LOCAL_LLM_FILENAME ?? undefined;
const LOCAL_LLM_ENABLED = (process.env.EXPO_PUBLIC_LOCAL_LLM_ENABLED ?? 'true').toLowerCase() !== 'false';

const LOCAL_MODEL: LocalModelConfig = {
  asset: {
    id: MODEL_ID,
    bundleRelativePath: MODEL_BUNDLE_PATH,
    ...(MODEL_FILENAME ? { filename: MODEL_FILENAME } : {}),
  },
  params: {
    n_ctx: LOCAL_CHAT_N_CTX,
    n_threads: LOCAL_CHAT_THREADS,
    temperature: LOCAL_CHAT_TEMPERATURE,
    maxTokens: LOCAL_CHAT_MAX_TOKENS,
  },
};

const STOP_WORDS = [
  '</s>',
  '<|end|>',
  '<|eot_id|>',
  '<|end_of_text|>',
  '<|im_end|>',
  '<|EOT|>',
  '<|END_OF_TURN_TOKEN|>',
  '<|end_of_turn|>',
  '<|endoftext|>',
];

let contextPromise: Promise<LlamaContext> | null = null;

async function loadContext(): Promise<LlamaContext> {
  if (!contextPromise) {
    contextPromise = (async () => {
      const modelPath = await ensureModelAsset(LOCAL_MODEL.asset);
      const context = await initLlama({
        model: modelPath,
        n_ctx: LOCAL_MODEL.params.n_ctx,
        n_threads: LOCAL_MODEL.params.n_threads,
      });
      return context;
    })().catch((error) => {
      contextPromise = null;
      throw error;
    });
  }
  return contextPromise;
}

function buildLocalMessages(messages: ChatMessage[], keywords: string[] = []) {
  const assistantNotes =
    keywords.length > 0 ? `최근 대화 키워드: ${keywords.slice(0, 6).join(', ')}` : undefined;
  return [
    { role: 'system' as const, content: SYSTEM_PROMPT },
    ...(assistantNotes ? [{ role: 'system' as const, content: assistantNotes }] : []),
    ...messages.map((message) => ({
      role: message.role,
      content: message.text,
    })),
  ];
}

export async function getAssistantReply(messages: ChatMessage[], keywords?: string[]): Promise<string> {
  const startedAt = Date.now();
  const finish = (label: string) => {
    const elapsed = Date.now() - startedAt;
    console.log(`[latency] Response(${label}) ${elapsed}ms`);
  };

  if (!LOCAL_LLM_ENABLED) {
    const remote = await getOpenAIAssistantReply(messages, keywords);
    finish('openai');
    return remote;
  }

  try {
    const limitedMessages = messages.slice(-10);
    const resolvedKeywords = keywords ?? extractKeywords(limitedMessages);
    const llamaMessages = buildLocalMessages(limitedMessages, resolvedKeywords);
    const context = await loadContext();
    console.log(`[ai] Response provider=local model=${LOCAL_MODEL.asset.id}`);

    let output = '';
    const result = await context.completion(
      {
        messages: llamaMessages,
        n_predict: LOCAL_MODEL.params.maxTokens,
        temperature: LOCAL_MODEL.params.temperature,
        stop: STOP_WORDS,
      },
      (tokenData: TokenData) => {
        if (tokenData.token) {
          output += tokenData.token;
        }
      }
    );

    if (!output && result?.content) {
      output = result.content;
    } else if (!output && result?.text) {
      output = result.text;
    }

    const cleaned = output.trim();
    if (cleaned.length === 0) {
      const draft = generateAssistantDraft(messages, resolvedKeywords);
      finish(`local-empty:${LOCAL_MODEL.asset.id}`);
      return draft;
    }
    finish(`local:${LOCAL_MODEL.asset.id}`);
    return cleaned;
  } catch (error) {
    console.error('로컬 LLM 응답 생성 실패 – mock 응답 사용', error);
    const fallback = await mockLLMReply(messages, keywords);
    finish(`local-mock:${LOCAL_MODEL.asset.id}`);
    return fallback;
  }
}

export { generateAssistantDraft, mockLLMReply };
