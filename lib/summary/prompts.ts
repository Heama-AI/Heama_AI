import type { ChatMessage } from '@/types/chat';

export function buildConversationTranscript(messages: ChatMessage[]): string {
  return messages
    .map((message) => {
      const speaker = message.role === 'user' ? '사용자' : '해마';
      return `${speaker}: ${message.text}`;
    })
    .join('\n');
}

export function buildSummaryPrompt(messages: ChatMessage[], keywords: string[]): string {
  const transcript = buildConversationTranscript(messages);
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

export function buildKeywordPrompt(messages: ChatMessage[]): string {
  const transcript = buildConversationTranscript(messages);
  return `다음은 치매 돌봄 도우미 해마와 사용자 간의 대화 기록입니다.
핵심 키워드를 3~5개 도출해주세요.
- 키워드는 한글 위주 명사/명사구로 1~3단어, 불필요한 조사·대명사(저,너,오늘) 제외.
- 번호, 기호, 따옴표 없이 쉼표로만 구분합니다.
- 문장/요약을 만들지 말고 키워드만 출력합니다.

대화 기록:
${transcript}

키워드:`;
}

export function parseKeywords(raw: string): string[] {
  return raw
    .split(/[,|\n]/)
    .map((token) => token.replace(/[#*"']/g, '').trim())
    .filter((token) => token.length > 0)
    .map((token) => token.slice(0, 20));
}

export const SUMMARY_SYSTEM_PROMPT =
  '당신은 치매 초기 또는 경도 인지장애를 가진 어르신의 대화를 요약하는 기록 비서입니다. ' +
  '따뜻하지만 구체적인 행동 안내를 포함하고, 약 복용/안전 관련 위험 신호가 있는지 꼭 확인합니다.';

export const KEYWORD_SYSTEM_PROMPT =
  '당신은 치매 초·중기 어르신 대화에서 핵심 키워드만 추출하는 도우미입니다. ' +
  '명사 위주의 짧은 키워드로 출력하고, 번호 없이 쉼표로 구분합니다.';
