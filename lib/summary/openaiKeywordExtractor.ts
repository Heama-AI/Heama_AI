import type { ChatMessage } from '@/types/chat';

const OPENAI_CHAT_ENDPOINT = process.env.EXPO_PUBLIC_OPENAI_CHAT_ENDPOINT ?? 'https://api.openai.com/v1/chat/completions';
const OPENAI_KEYWORD_MODEL = process.env.EXPO_PUBLIC_OPENAI_KEYWORD_MODEL ?? process.env.EXPO_PUBLIC_OPENAI_CHAT_MODEL ?? 'gpt-4o-mini';
const OPENAI_KEYWORD_TEMPERATURE = Number(process.env.EXPO_PUBLIC_OPENAI_KEYWORD_TEMPERATURE ?? '0.2');
const OPENAI_KEYWORD_MAX_TOKENS = Number(process.env.EXPO_PUBLIC_OPENAI_KEYWORD_MAX_TOKENS ?? '120');

function buildTranscript(messages: ChatMessage[]) {
  return messages
    .map((message) => {
      const speaker = message.role === 'user' ? '사용자' : '해마';
      return `${speaker}: ${message.text}`;
    })
    .join('\n');
}

function buildPrompt(messages: ChatMessage[]) {
  const transcript = buildTranscript(messages);
  return `다음은 치매 돌봄 도우미 해마와 사용자 간의 대화 기록입니다.
핵심 키워드를 3~5개 도출해주세요.
- 키워드는 한글 위주 명사/명사구로 1~3단어, 불필요한 조사·대명사(저,너,오늘) 제외.
- 번호, 기호, 따옴표 없이 쉼표로만 구분합니다.
- 문장/요약을 만들지 말고 키워드만 출력합니다.

대화 기록:
${transcript}

키워드:`;
}

function parseKeywords(raw: string): string[] {
  return raw
    .split(/[,|\n]/)
    .map((token) => token.replace(/[#*"']/g, '').trim())
    .filter((token) => token.length > 0)
    .map((token) => token.slice(0, 20));
}

export async function generateOpenAIKeywords(messages: ChatMessage[]): Promise<string[] | null> {
  const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
  if (!apiKey) return null;

  const body = {
    model: OPENAI_KEYWORD_MODEL,
    temperature: OPENAI_KEYWORD_TEMPERATURE,
    max_tokens: Number.isNaN(OPENAI_KEYWORD_MAX_TOKENS) ? undefined : OPENAI_KEYWORD_MAX_TOKENS,
    messages: [
      {
        role: 'system',
        content:
          '당신은 치매 초기 또는 경도 인지장애 어르신을 지원하는 기록 보조 도우미입니다. 대화에서 핵심 키워드를 간결하게 추출하세요.',
      },
      { role: 'user', content: buildPrompt(messages) },
    ],
  };

  try {
    const response = await fetch(OPENAI_CHAT_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error(`OpenAI keyword 실패: ${response.status}`);
    }
    const data = await response.json();
    const content: string | undefined = data?.choices?.[0]?.message?.content;
    if (!content) return null;
    const parsed = parseKeywords(content);
    return parsed.length ? parsed.slice(0, 5) : null;
  } catch (error) {
    console.warn('OpenAI keyword 생성 실패', error);
    return null;
  }
}
