import { loadChunks } from '@/lib/storage/recordChunksStorage';

type RecallQuestion = {
  question: string;
  chunkId: string;
  recordId: string;
  chunk: string;
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
  const snippet = trimmed.length > 120 ? `${trimmed.slice(0, 120)}...` : trimmed;

  return {
    question: `지난 대화에서 "${snippet}"에 대해 이야기했어요. 기억나시나요? 조금 더 자세히 들려주실 수 있나요?`,
    chunkId: pick.id,
    recordId: pick.recordId,
    chunk: pick.chunk,
  };
}
