const OPENAI_EMBEDDING_ENDPOINT = 'https://api.openai.com/v1/embeddings';
const OPENAI_EMBEDDING_MODEL = 'text-embedding-3-small';

export async function embedText(text: string): Promise<number[] | null> {
  const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
  if (!apiKey) {
    if (__DEV__) {
      console.warn('EXPO_PUBLIC_OPENAI_API_KEY가 설정되지 않아 임베딩을 건너뜁니다.');
    }
    return null;
  }
  const body = {
    input: text,
    model: OPENAI_EMBEDDING_MODEL,
  };
  try {
    const response = await fetch(OPENAI_EMBEDDING_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'OpenAI 임베딩 호출 실패');
    }
    const json = (await response.json()) as {
      data?: Array<{ embedding: number[] }>;
    };
    const embedding = json.data?.[0]?.embedding;
    if (!embedding || embedding.length === 0) {
      throw new Error('임베딩 결과가 비어 있습니다.');
    }
    return embedding;
  } catch (error) {
    if (__DEV__) {
      console.warn('임베딩 생성 실패', error);
    }
    return null;
  }
}
