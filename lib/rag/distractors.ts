import { snippet } from '@/lib/rag/snippet';

const OPENAI_CHAT_ENDPOINT = 'https://api.openai.com/v1/chat/completions';
const OPENAI_MODEL = 'gpt-4o-mini';

export async function generateDistractors(input: {
  answer: string;
  context?: string;
  count?: number;
}): Promise<string[]> {
  const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
  const targetCount = input.count ?? 3;

  if (!apiKey) {
    return buildHeuristicDistractors(input.answer, input.context, targetCount);
  }

  const prompt = `정답과 겹치지 않는 '명확히 다른' 오답 ${targetCount}개를 한국어 단어/구 형태로 만들어 주세요.
정답: "${input.answer}"
문맥: "${snippet(input.context ?? '', 200)}"
- 정답과 동일/동의어/유사 표현 금지
- 핵심 키워드나 대상이 다른 개념이어야 함(예: 장소면 다른 장소, 음식이면 다른 음식)
- 각 오답은 2~8자 정도의 짧은 단어/구
출력: 쉼표로 구분된 목록만`;

  try {
    const response = await fetch(OPENAI_CHAT_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
      }),
    });
    if (!response.ok) {
      throw new Error(await response.text());
    }
    const json = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const raw = json.choices?.[0]?.message?.content ?? '';
    const parsed = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((s) => s !== input.answer);
    if (parsed.length >= targetCount) {
      return parsed.slice(0, targetCount);
    }
  } catch (error) {
    if (__DEV__) {
      console.warn('OpenAI distractor 생성 실패, heuristic으로 대체', error);
    }
  }

  return buildHeuristicDistractors(input.answer, input.context, targetCount);
}

export async function generateParaphrasedDistractors(input: {
  answer: string;
  context?: string;
  count?: number;
}): Promise<string[]> {
  const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
  const targetCount = input.count ?? 3;

  if (!apiKey) {
    return buildSwapHeuristic(input.answer, targetCount);
  }

  const prompt = `정답 문장을 기반으로, 문장 구조는 유사하게 유지하되 핵심 명사/대상을 1~2개 다른 것으로 교체한 오답 ${targetCount}개를 만들어 주세요.
정답: "${input.answer}"
문맥: "${snippet(input.context ?? '', 200)}"
- 정답과 동일/동의어 금지
- 핵심 단어를 다른 장소/음식/인물 등으로 바꾸어 자연스러운 문장으로 작성
- 각 오답은 60자 이내의 완전한 문장
출력: 쉼표로 구분된 목록만`;

  try {
    const response = await fetch(OPENAI_CHAT_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
      }),
    });
    if (!response.ok) throw new Error(await response.text());
    const json = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const raw = json.choices?.[0]?.message?.content ?? '';
    const parsed = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((s) => s !== input.answer);
    if (parsed.length >= targetCount) return parsed.slice(0, targetCount);
  } catch (error) {
    if (__DEV__) {
      console.warn('OpenAI paraphrased distractor 실패, heuristic 사용', error);
    }
  }

  return buildSwapHeuristic(input.answer, targetCount);
}

function buildHeuristicDistractors(answer: string, context: string | undefined, targetCount: number) {
  const pool: string[] = [];
  if (context) {
    pool.push(...extractCandidates(context));
  }
  pool.push('기억이 나지 않습니다', '잘 모르겠어요', '확실하지 않아요');
  const unique = Array.from(new Set(pool.filter((p) => p && p !== answer)));
  shuffle(unique);
  return unique.slice(0, targetCount);
}

function buildSwapHeuristic(answer: string, targetCount: number) {
  const swaps = [
    { targets: ['유채꽃', '장미', '튤립', '벚꽃'], candidates: ['장미꽃', '코스모스', '해바라기', '백합'] },
    { targets: ['아들', '딸', '아이', '아기'], candidates: ['언니', '엄마', '아버지', '친구', '조카'] },
    { targets: ['바다', '해변', '해운대'], candidates: ['산', '공원', '시장', '도서관'] },
    { targets: ['초밥', '피자', '치킨', '떡볶이'], candidates: ['국수', '스테이크', '샐러드', '라면'] },
  ];
  const results: string[] = [];
  for (const group of swaps) {
    for (const target of group.targets) {
      if (answer.includes(target)) {
        for (const cand of group.candidates) {
          if (results.length >= targetCount) break;
          results.push(answer.replace(target, cand));
        }
      }
      if (results.length >= targetCount) break;
    }
    if (results.length >= targetCount) break;
  }
  while (results.length < targetCount) {
    results.push('기억이 나지 않습니다');
  }
  return results.slice(0, targetCount);
}

function extractCandidates(text: string): string[] {
  const tokens = text
    .replace(/[^0-9a-zA-Z가-힣\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 2 && t.length <= 12);
  const counts = new Map<string, number>();
  tokens.forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1));
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([t]) => t)
    .filter(Boolean);
}

function shuffle<T>(arr: T[]) {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}
