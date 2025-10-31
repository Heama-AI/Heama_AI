import { extractKeywords } from '@/lib/conversation';
import { ChatMessage } from '@/types/chat';

const OPENAI_CHAT_ENDPOINT = process.env.EXPO_PUBLIC_OPENAI_CHAT_ENDPOINT ?? 'https://api.openai.com/v1/chat/completions';
const OPENAI_CHAT_MODEL = process.env.EXPO_PUBLIC_OPENAI_CHAT_MODEL ?? 'gpt-4o-mini';
const OPENAI_CHAT_TEMPERATURE = Number(process.env.EXPO_PUBLIC_OPENAI_CHAT_TEMPERATURE ?? '0.6');
const OPENAI_CHAT_MAX_TOKENS = Number(process.env.EXPO_PUBLIC_OPENAI_CHAT_MAX_TOKENS ?? '320');

const SYSTEM_PROMPT = `당신은 치매 초기 또는 경도 인지장애를 가진 어르신의 한국어 대화 파트너입니다.
- 말투는 따뜻하고 존중하는 어투를 유지합니다.
- 짧고 이해하기 쉬운 문장으로 안내하며, 한 번에 한 가지 행동만 제안합니다.
- 어르신이 스스로 기억을 떠올리거나 일상을 기록하도록 돕는 질문을 던집니다.
- 위험 신호(약 복용, 길 잃음, 안전 우려 등)가 감지되면 보호자나 전문가에게 도움을 요청하라고 안내합니다.
- 대화는 한국어로 응답하며, 120~180자(한글 기준)를 넘지 않도록 합니다.
- 괄호나 불필요한 메타 설명 없이 자연스러운 구어체로 답변합니다.`;

const OPENING_PROMPTS = [
  '오늘 하루는 어떠셨나요?',
  '최근 기억에 남는 일이 있으신가요?',
  '불편한 점이나 걱정되는 일이 있으면 말씀해주세요.',
];

const FOLLOW_UP_SUGGESTIONS = [
  '비슷한 상황이 있을 때 어떻게 대처하셨나요?',
  '해당 상황에서 도움이 될 만한 사람이나 도구가 있을까요?',
  '할 수 있는 작은 실천 한 가지를 정해보면 어떨까요?',
];

const ENCOURAGEMENTS = [
  '잘 하고 계세요. 천천히 함께 해보면 됩니다.',
  '스스로 챙기려는 마음이 너무 소중합니다.',
  '이야기해 주셔서 감사합니다. 큰 도움이 됩니다.',
];

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function buildPlanSuggestion(keywords: string[]) {
  const keyword = keywords[0];
  if (!keyword) return '오늘 기억하고 싶은 내용을 메모로 남겨보면 어떨까요?';
  if (keyword.includes('약')) return '약 복용 알람을 설정해두면 깜빡하지 않을 수 있어요.';
  if (keyword.includes('운동')) return '가벼운 스트레칭으로 몸을 깨우는 시간을 추천드려요.';
  if (keyword.includes('수면')) return '취침 전 조용한 음악을 틀고 마음을 가라앉혀보세요.';
  if (keyword.includes('기억')) return '최근 기억을 사진이나 글로 남기는 것도 도움이 됩니다.';
  return '오늘 대화를 바탕으로 일정을 정리해보는 건 어떨까요?';
}

export function generateAssistantDraft(messages: ChatMessage[], keywords?: string[]): string {
  const userMessages = messages.filter((message) => message.role === 'user');
  const lastUser = userMessages.at(-1);
  const safeKeywords = keywords ?? extractKeywords(messages);

  if (!lastUser) {
    return `${pick(OPENING_PROMPTS)} ${pick(ENCOURAGEMENTS)}`;
  }

  const intro = `말씀해주신 "${lastUser.text}" 내용을 잘 들었습니다.`;
  const guidance = buildPlanSuggestion(safeKeywords);
  const followUp = pick(FOLLOW_UP_SUGGESTIONS);
  const encouragement = pick(ENCOURAGEMENTS);

  return `${intro} ${encouragement} ${guidance} ${followUp}`;
}

export async function mockLLMReply(messages: ChatMessage[], keywords?: string[]): Promise<string> {
  const latency = 400 + Math.random() * 900;
  await new Promise((resolve) => setTimeout(resolve, latency));
  return generateAssistantDraft(messages, keywords);
}

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

  const openAIMessages: OpenAIChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...(assistantNotes ? [{ role: 'system', content: assistantNotes }] as OpenAIChatMessage[] : []),
    ...mapMessagesToOpenAI(messages),
  ];

  return {
    model: OPENAI_CHAT_MODEL,
    temperature: OPENAI_CHAT_TEMPERATURE,
    max_tokens: OPENAI_CHAT_MAX_TOKENS,
    messages: openAIMessages,
  };
}

export async function getAssistantReply(messages: ChatMessage[], keywords?: string[]): Promise<string> {
  const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
  if (!apiKey) {
    if (__DEV__) {
      console.warn('EXPO_PUBLIC_OPENAI_API_KEY 미설정 – mock 응답 사용 중');
    }
    return mockLLMReply(messages, keywords);
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
    const content: string | undefined = data?.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('OpenAI 응답 본문이 비어 있습니다.');
    }

    return content.trim();
  } catch (error) {
    console.error('OpenAI 응답 생성 실패 – mock 응답 사용', error);
    return mockLLMReply(messages, keywords);
  }
}
