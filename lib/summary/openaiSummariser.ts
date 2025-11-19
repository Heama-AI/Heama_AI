import type { ChatMessage } from '@/types/chat';

const OPENAI_CHAT_ENDPOINT = process.env.EXPO_PUBLIC_OPENAI_CHAT_ENDPOINT ?? 'https://api.openai.com/v1/chat/completions';
const OPENAI_SUMMARY_MODEL = process.env.EXPO_PUBLIC_OPENAI_SUMMARY_MODEL ?? process.env.EXPO_PUBLIC_OPENAI_CHAT_MODEL ?? 'gpt-4o-mini';
const OPENAI_SUMMARY_TEMPERATURE = Number(process.env.EXPO_PUBLIC_OPENAI_SUMMARY_TEMPERATURE ?? '0.35');
const OPENAI_SUMMARY_MAX_TOKENS = Number(process.env.EXPO_PUBLIC_OPENAI_SUMMARY_MAX_TOKENS ?? '220');

function buildTranscript(messages: ChatMessage[]) {
  return messages
    .map((message) => {
      const speaker = message.role === 'user' ? '사용자' : '해마';
      return `${speaker}: ${message.text}`;
    })
    .join('\n');
}

function buildPrompt(messages: ChatMessage[], keywords: string[]): string {
  const transcript = buildTranscript(messages);
  const keywordLine = keywords.length > 0 ? `핵심 키워드: ${keywords.slice(0, 5).join(', ')}` : '핵심 키워드 없음';

  return `다음은 돌봄 도우미 해마와 사용자 간의 대화 기록입니다. 대화를 2~3문장으로 요약하세요.
- 첫 문장: 누가 어떤 주제로 이야기했는지, 핵심 내용/상황 정리.
- 두 번째 문장: 안전·약·위험 신호나 후속 행동(연락, 약 복용, 휴식 등)이 있으면 꼭 포함.
- 불필요한 인사/메타 정보는 제외, 번호/기호 없이 자연스러운 서술형 문장만 사용.

${keywordLine}

대화 기록:
${transcript}

요약:`;
}

function extractResponseText(data: any): string | null {
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content === 'string') {
    return content.trim();
  }
  return null;
}

export async function generateOpenAISummary(messages: ChatMessage[], keywords: string[]): Promise<string | null> {
  const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
  if (!apiKey) return null;

  const body = {
    model: OPENAI_SUMMARY_MODEL,
    temperature: OPENAI_SUMMARY_TEMPERATURE,
    max_tokens: Number.isNaN(OPENAI_SUMMARY_MAX_TOKENS) ? undefined : OPENAI_SUMMARY_MAX_TOKENS,
    messages: [
      {
        role: 'system',
        content:
          '당신은 치매 초기 또는 경도 인지장애를 가진 어르신의 보호 기록 작성 보조 도우미입니다. 친절하고 따뜻한 톤으로, 구체적인 행동 안내와 위험 신호를 놓치지 않고 정리합니다.',
      },
      { role: 'user', content: buildPrompt(messages, keywords) },
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
      throw new Error(`OpenAI summary failed: ${response.status}`);
    }

    const data = await response.json();
    return extractResponseText(data);
  } catch (error) {
    console.warn('OpenAI summary 생성 실패', error);
    return null;
  }
}
