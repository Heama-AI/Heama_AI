const CHAT_ENDPOINT = process.env.EXPO_PUBLIC_OPENAI_CHAT_ENDPOINT ?? 'https://api.openai.com/v1/chat/completions';
const CHAT_MODEL = process.env.EXPO_PUBLIC_OPENAI_CHAT_MODEL ?? 'gpt-4o-mini';

type RecallPromptResult = { text: string; speech: string };

export async function buildWarmRecallPrompt(snippet: string): Promise<RecallPromptResult | null> {
  const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
  if (!apiKey) return null;

  const system = `
당신은 사용자의 지난 대화를 짧게 상기시키고, 오늘 하루를 편하게 묻는 코치입니다.
- 번역투 없이 자연스러운 구어체.
- 지난 얘기 요약은 1문장, 디테일 최소(길고 구체적인 상황/이름 나열 금지).
- 전체 2~3문장 이내로, “지난번엔 ~ 얘기했었죠. 그때 ~~ 기억나요? 오늘은 어땠어요? 오늘 한 일이나 계획 말해줄래요?” 톤.
- 대괄호/리스트 없이 말하듯 작성.
반드시 JSON으로만 응답하세요: {"text": "...", "speech": "..."}
text: 화면에 표시할 문장
speech: 음성으로 읽을 때 조금 더 부드럽게 말한 버전
`;
  const user = `
지난 대화 일부(짧게 정리): "${snippet}"
이 내용을 가볍게 상기시키되, 너무 자세히 언급하지 말고 오늘은 어떻게 지냈는지 자연스럽게 물어봐 주세요.
`;

  try {
    const response = await fetch(CHAT_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: CHAT_MODEL,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system.trim() },
          { role: 'user', content: user.trim() },
        ],
      }),
    });
    if (!response.ok) {
      return null;
    }
    const json = await response.json();
    const content = json?.choices?.[0]?.message?.content;
    if (!content) return null;
    const parsed = JSON.parse(content) as RecallPromptResult;
    if (!parsed.text || !parsed.speech) return null;
    return parsed;
  } catch (error) {
    if (__DEV__) {
      console.warn('리콜 프롬프트 생성 실패', error);
    }
    return null;
  }
}
