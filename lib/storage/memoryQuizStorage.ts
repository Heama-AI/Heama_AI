import { getDatabase } from '@/lib/database';
import { MemoryQuizQuestion } from '@/types/memoryQuiz';

type MemoryQuizRow = {
  record_id: string;
  quiz_json: string;
  created_at: number;
};

function safeParseQuiz(input: string): MemoryQuizQuestion[] {
  try {
    const parsed = JSON.parse(input);
    return Array.isArray(parsed) ? (parsed as MemoryQuizQuestion[]) : [];
  } catch {
    return [];
  }
}

export async function loadMemoryQuiz(recordId: string): Promise<MemoryQuizQuestion[] | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<MemoryQuizRow>(
    `SELECT * FROM memory_quizzes WHERE record_id = $recordId LIMIT 1`,
    { $recordId: recordId },
  );
  if (!row) return null;
  return safeParseQuiz(row.quiz_json);
}

export async function saveMemoryQuiz(recordId: string, quiz: MemoryQuizQuestion[]) {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT OR REPLACE INTO memory_quizzes (record_id, quiz_json, created_at)
     VALUES ($recordId, $quiz, $createdAt)`,
    {
      $recordId: recordId,
      $quiz: JSON.stringify(quiz),
      $createdAt: Date.now(),
    },
  );
}

export async function deleteMemoryQuiz(recordId: string) {
  const db = await getDatabase();
  await db.runAsync(`DELETE FROM memory_quizzes WHERE record_id = $recordId`, { $recordId: recordId });
}
