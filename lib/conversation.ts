import { generateSummary } from '@/lib/summary';
import { ChatMessage } from '@/types/chat';

export const FALLBACK_KEYWORDS = ['건강', '기억력', '약 복용', '운동', '수면', '감정', '가족', '취미'];
export const DISTRACTOR_SENTENCES = ['규칙적인 식사', '여행 계획', '기억 훈련', '복약 관리'];

export function createId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

export function extractKeywords(messages: ChatMessage[]): string[] {
  const wordWeights = new Map<string, number>();

  for (const { text } of messages) {
    const cleaned = text.replace(/[^0-9a-zA-Z가-힣\s]/g, ' ');
    const tokens = cleaned.split(/\s+/).filter((token) => token.length >= 2 && token.length <= 12);

    tokens.forEach((token) => {
      const lower = token.toLowerCase();
      const weight = text.includes('중요') || text.includes('기억') ? 2 : 1;
      wordWeights.set(lower, (wordWeights.get(lower) ?? 0) + weight);
    });
  }

  const sorted = [...wordWeights.entries()].sort((a, b) => b[1] - a[1]);

  const selected = sorted.slice(0, 4).map(([word]) => word);

  return selected.length ? selected : FALLBACK_KEYWORDS.slice(0, 4);
}

export function deriveHighlights(messages: ChatMessage[]): string[] {
  const keySentences = messages
    .filter((message) => message.role === 'assistant')
    .slice(-3)
    .map((message) => message.text.trim())
    .filter((sentence) => sentence.length > 0);

  return keySentences.length ? keySentences : ['오늘 대화를 통해 일상을 점검했습니다.'];
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function deriveStats(messages: ChatMessage[]) {
  if (messages.length === 0) {
    return {
      totalTurns: 0,
      userTurns: 0,
      assistantTurns: 0,
      durationMinutes: 0,
      riskScore: 35,
      moodScore: 65,
    };
  }

  const userTurns = messages.filter((message) => message.role === 'user').length;
  const assistantTurns = messages.length - userTurns;
  const timestamps = messages.map((message) => message.ts);
  const durationMinutes = clamp(Math.round((Math.max(...timestamps) - Math.min(...timestamps)) / 60000), 1, 90);

  const combinedText = messages.map((message) => message.text).join(' ');
  const riskSignals = ['잊', '기억', '혼란', '불안', '걱정', '약', '검사', '다쳤', '길'];
  let riskScore = 40;

  for (const signal of riskSignals) {
    const occurrences = combinedText.split(signal).length - 1;
    riskScore += occurrences * 6;
  }

  const moodSignals = ['좋', '행복', '안정', '편안', '감사', '즐겁', '재밌'];
  let moodScore = 60;
  for (const signal of moodSignals) {
    const occurrences = combinedText.split(signal).length - 1;
    moodScore += occurrences * 4;
  }

  moodScore -= (riskScore - 50) * 0.4;

  return {
    totalTurns: messages.length,
    userTurns,
    assistantTurns,
    durationMinutes,
    riskScore: Math.round(clamp(riskScore, 5, 95)),
    moodScore: Math.round(clamp(moodScore, 10, 95)),
  };
}

function buildFallbackSummary(messages: ChatMessage[], keywords: string[]) {
  const lastUserMessage = [...messages].reverse().find((message) => message.role === 'user');
  const summaryBase = messages
    .filter((message) => message.role === 'assistant')
    .slice(-2)
    .map((message) => message.text)
    .join(' ');

  const intro = lastUserMessage
    ? `최근 사용자가 "${lastUserMessage.text.slice(0, 40)}"라고 이야기했습니다.`
    : '최근 대화의 핵심을 정리했습니다.';

  const keywordLine = keywords.slice(0, 3).join(', ');
  return `${intro} ${summaryBase || '대화 내용을 기반으로 다음 일정을 관리해보세요.'} 키워드: ${keywordLine}`;
}

export async function summariseConversation(messages: ChatMessage[], keywords: string[]) {
  const fallback = buildFallbackSummary(messages, keywords);
  try {
    const summary = await generateSummary(messages, keywords);
    return summary ?? fallback;
  } catch (error) {
    console.error('대화 요약 생성 실패 – 기본 요약 사용', error);
    return fallback;
  }
}

function pickRandomInternal<T>(array: T[], count: number, ensureItems: T[] = [], fallback: T[] = []): T[] {
  const unique = new Set<T>(ensureItems);
  const candidates = array.filter((item) => !unique.has(item));
  while (unique.size < count && candidates.length) {
    const index = Math.floor(Math.random() * candidates.length);
    unique.add(candidates.splice(index, 1)[0]);
  }

  const result = [...unique];
  let fallbackIndex = 0;
  while (result.length < count && fallbackIndex < fallback.length) {
    const candidate = fallback[fallbackIndex++];
    if (!result.includes(candidate)) result.push(candidate);
  }

  return result.slice(0, count);
}

export function buildQuiz(record: {
  id: string;
  keywords: string[];
  highlights: string[];
  stats: ReturnType<typeof deriveStats>;
}) {
  const { keywords, highlights, stats, id } = record;
  const primaryKeyword = keywords[0] ?? FALLBACK_KEYWORDS[0];

  const questionOneChoices = pickRandomInternal(
    [...FALLBACK_KEYWORDS, ...keywords],
    4,
    [primaryKeyword],
    FALLBACK_KEYWORDS,
  );

  const turns = Math.max(2, stats.totalTurns);
  const turnChoices = pickRandomInternal<number>(
    [Math.max(2, turns - 2), turns, turns + 2, turns + 4],
    4,
    [turns],
    [turns + 1, turns + 3, turns + 5, turns + 7],
  )
    .map((choice) => `${choice}회`)
    .sort();

  const highlight = highlights[0] ?? '일정을 다시 확인하기';
  const highlightChoices = pickRandomInternal(
    [...highlights, ...DISTRACTOR_SENTENCES],
    4,
    [highlight],
    DISTRACTOR_SENTENCES,
  );

  return [
    {
      id: `${id}-quiz-topic`,
      question: '이번 대화의 핵심 주제는 무엇이었나요?',
      choices: questionOneChoices,
      answer: primaryKeyword,
      explanation: '대화에서 가장 자주 언급된 키워드를 중심으로 기억을 점검하세요.',
    },
    {
      id: `${id}-quiz-turns`,
      question: '이번 대화에서 총 몇 번의 대화가 오갔나요?',
      choices: turnChoices,
      answer: `${turns}회`,
      explanation: '대화 횟수를 통해 대화 집중도를 파악할 수 있습니다.',
    },
    {
      id: `${id}-quiz-highlight`,
      question: '대화에서 안내된 후속 행동은 무엇이었나요?',
      choices: highlightChoices,
      answer: highlight,
      explanation: '핵심 행동을 기억하면 일상 관리에 도움이 됩니다.',
    },
  ];
}
