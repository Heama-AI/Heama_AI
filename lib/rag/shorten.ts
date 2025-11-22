const OPENAI_CHAT_ENDPOINT = 'https://api.openai.com/v1/chat/completions';
const OPENAI_MODEL = 'gpt-4o-mini';

/**
 * 선택지에 넣기 좋은 짧은 문장/구로 줄입니다.
 * 실패 시 기본 snippet 반환.
 */
export async function condenseChoiceText(text: string, limit = 60): Promise<string> {
  const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
  const fallback = simpleSnippet(text, limit);
  if (!apiKey || !text || text.length <= limit) return fallback;

  const prompt = `다음 문장을 짧은 한 문장/구로 60자 이내로 요약해 주세요. 불필요한 설명은 빼고 핵심만 남겨주세요.
문장: "${text}"`;

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
        temperature: 0.4,
        max_tokens: 80,
      }),
    });
    if (!response.ok) throw new Error(await response.text());
    const json = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const result = json.choices?.[0]?.message?.content?.trim();
    if (!result) return fallback;
    return result.length > limit ? `${result.slice(0, limit)}...` : result;
  } catch (error) {
    if (__DEV__) {
      console.warn('선택지 요약 실패, fallback 사용', error);
    }
    return fallback;
  }
}

function simpleSnippet(text: string, limit: number) {
  const trimmed = text.replace(/\s+/g, ' ').trim();
  return trimmed.length > limit ? `${trimmed.slice(0, limit)}...` : trimmed;
}
