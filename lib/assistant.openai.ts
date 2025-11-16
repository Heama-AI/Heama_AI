import { SYSTEM_PROMPT, mockLLMReply } from '@/lib/assistant.shared';
import { extractKeywords } from '@/lib/conversation';
import type { ChatMessage } from '@/types/chat';

const OPENAI_CHAT_ENDPOINT = process.env.EXPO_PUBLIC_OPENAI_CHAT_ENDPOINT ?? 'https://api.openai.com/v1/chat/completions';
const OPENAI_CHAT_MODEL = process.env.EXPO_PUBLIC_OPENAI_CHAT_MODEL ?? 'gpt-4o-mini';
const OPENAI_CHAT_TEMPERATURE = Number(process.env.EXPO_PUBLIC_OPENAI_CHAT_TEMPERATURE ?? '0.6');
const OPENAI_CHAT_MAX_TOKENS = Number(process.env.EXPO_PUBLIC_OPENAI_CHAT_MAX_TOKENS ?? '320');
type OpenAIChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

function mapMessagesToOpenAI(messages: ChatMessage[]): OpenAIChatMessage[] {
  return messages.map((message) => ({
    role: message.role,
    content: message.text,
  })) as OpenAIChatMessage[];
}

function buildOpenAIRequestBody(messages: ChatMessage[], keywords?: string[]) {
  const assistantNotes =
    keywords && keywords.length > 0
      ? `최근 대화 키워드: ${keywords.slice(0, 6).join(', ')}`
      : undefined;

  const builtMessages: OpenAIChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...(assistantNotes ? [{ role: 'system', content: assistantNotes }] as OpenAIChatMessage[] : []),
    ...mapMessagesToOpenAI(messages),
  ];

  const body: Record<string, unknown> = {
    model: OPENAI_CHAT_MODEL,
    messages: builtMessages,
  };

  if (!Number.isNaN(OPENAI_CHAT_TEMPERATURE)) {
    body.temperature = OPENAI_CHAT_TEMPERATURE;
  }

  if (!Number.isNaN(OPENAI_CHAT_MAX_TOKENS)) {
    body.max_tokens = OPENAI_CHAT_MAX_TOKENS;
  }

  return body;
}

function extractResponseText(data: any): string | undefined {
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content === 'string') {
    return content.trim();
  }
  return undefined;
}

export async function getOpenAIAssistantReply(messages: ChatMessage[], keywords?: string[]): Promise<string> {
  const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
  const startedAt = Date.now();
  const finish = (provider: string) => {
    const elapsed = Date.now() - startedAt;
    console.log(`[latency] Response(${provider}) ${elapsed}ms`);
  };
  if (!apiKey) {
    if (__DEV__) {
      console.warn('EXPO_PUBLIC_OPENAI_API_KEY 미설정 – mock 응답 사용 중');
    }
    const reply = await mockLLMReply(messages, keywords);
    finish('mock');
    return reply;
  }

  try {
    const body = buildOpenAIRequestBody(messages, keywords ?? extractKeywords(messages));
    const response = await fetch(OPENAI_CHAT_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorPayload = await response.json().catch(async () => ({ error: { message: await response.text() } }));
      throw new Error(errorPayload?.error?.message ?? 'OpenAI 응답이 실패했습니다.');
    }

    const data = await response.json();
    // console.log(JSON.stringify(data, null, 2))
    const content = extractResponseText(data);
    if (!content) {
      throw new Error('OpenAI 응답 본문이 비어 있습니다.');
    }

    finish('openai');
    return content;
  } catch (error) {
    console.error('OpenAI 응답 생성 실패 – mock 응답 사용', error);
    const fallback = await mockLLMReply(messages, keywords);
    finish('mock-fallback');
    return fallback;
  }
}

export { generateAssistantDraft } from '@/lib/assistant.shared';
export { mockLLMReply };
