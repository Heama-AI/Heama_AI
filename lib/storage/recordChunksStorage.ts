import { getDatabase } from '@/lib/database';

type RecordChunk = {
  id: string;
  recordId: string;
  chunk: string;
  embedding: number[];
  createdAt: number;
};

export async function saveRecordChunks(chunks: RecordChunk[]) {
  if (chunks.length === 0) return;
  const db = await getDatabase();
  await db.withExclusiveTransactionAsync(async (txn) => {
    for (const chunk of chunks) {
      await txn.runAsync(
        `INSERT OR REPLACE INTO record_chunks (id, record_id, chunk, embedding_json, created_at)
         VALUES ($id, $recordId, $chunk, $embedding, $createdAt)`,
        {
          $id: chunk.id,
          $recordId: chunk.recordId,
          $chunk: chunk.chunk,
          $embedding: JSON.stringify(chunk.embedding),
          $createdAt: chunk.createdAt,
        },
      );
    }
  });
}

export async function deleteChunksForRecord(recordId: string) {
  const db = await getDatabase();
  await db.runAsync(`DELETE FROM record_chunks WHERE record_id = $recordId`, { $recordId: recordId });
}

export async function loadChunks() {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    id: string;
    record_id: string;
    chunk: string;
    embedding_json: string;
    created_at: number;
  }>(`SELECT * FROM record_chunks ORDER BY created_at DESC`);
  return rows.map((row) => ({
    id: row.id,
    recordId: row.record_id,
    chunk: row.chunk,
    embedding: safeParseEmbedding(row.embedding_json),
    createdAt: row.created_at,
  }));
}

function safeParseEmbedding(input: string): number[] {
  try {
    const parsed = JSON.parse(input);
    return Array.isArray(parsed) ? (parsed as number[]) : [];
  } catch {
    return [];
  }
}
