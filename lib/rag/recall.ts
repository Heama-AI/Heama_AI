import { loadChunks } from '@/lib/storage/recordChunksStorage';
import { buildWarmRecallPrompt } from './recallPrompt';
import { snippet } from './snippet';

type RecallQuestion = {
  question: string;
  chunkId: string;
  recordId: string;
  chunk: string;
  speech?: string;
};

export async function generateRecallQuestion(options?: { excludeChunkIds?: string[] }): Promise<RecallQuestion | null> {
  const { excludeChunkIds = [] } = options ?? {};
  const chunks = await loadChunks();
  if (!chunks.length) return null;

  const filtered = chunks.filter((c) => !excludeChunkIds.includes(c.id));
  const candidates = filtered.length > 0 ? filtered : chunks;

  // 최근순 정렬된 상태에서 상위 몇 개 중 랜덤 추출
  const pool = candidates.slice(0, 50);
  const pick = pool[Math.floor(Math.random() * pool.length)];
  const trimmed = pick.chunk.replace(/\s+/g, ' ').trim();
  const shortSnippet = snippet(trimmed, 90);

  const aiPrompt = await buildWarmRecallPrompt(shortSnippet);
  const question =
    aiPrompt?.text ??
    `지난번에 이런 얘기 나눴어요: "${shortSnippet}". 기억나세요? 오늘은 어떻게 지내셨어요? 조금 더 들려주실 수 있을까요?`;
  const speech =
    aiPrompt?.speech ??
    `지난번에 "${shortSnippet}" 이야기 나눴던 거 기억나세요? 오늘은 어떤 하루였나요? 조금 들려주실래요?`;

  return {
    question,
    chunkId: pick.id,
    recordId: pick.recordId,
    chunk: pick.chunk,
    speech,
  };
}
