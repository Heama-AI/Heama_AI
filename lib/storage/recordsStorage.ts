import { getDatabase } from '@/lib/database';
import { buildConversationBundle } from '@/lib/fhir/buildConversationBundle';
import type { ConversationRecord } from '@/types/records';

type RecordRow = {
  id: string;
  title: string;
  summary: string;
  highlights_json: string;
  keywords_json: string;
  created_at: number;
  updated_at: number;
  stats_json: string;
  messages_json: string;
  quiz_json: string;
  fhir_bundle_json: string | null;
};

function parseJson<T>(input: string, fallback: T): T {
  try {
    return JSON.parse(input) as T;
  } catch {
    return fallback;
  }
}

function mapRowToRecord(row: RecordRow): ConversationRecord {
  const baseRecord: Omit<ConversationRecord, 'fhirBundle'> = {
    id: row.id,
    title: row.title,
    summary: row.summary,
    highlights: parseJson<string[]>(row.highlights_json, [] as string[]),
    keywords: parseJson<string[]>(row.keywords_json, [] as string[]),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    stats: parseJson<ConversationRecord['stats']>(row.stats_json, {
      totalTurns: 0,
      userTurns: 0,
      assistantTurns: 0,
      durationMinutes: 0,
      riskScore: 0,
      moodScore: 0,
    } as ConversationRecord['stats']),
    messages: parseJson<ConversationRecord['messages']>(row.messages_json, [] as ConversationRecord['messages']),
    quiz: parseJson<ConversationRecord['quiz']>(row.quiz_json, [] as ConversationRecord['quiz']),
  };
  const parsedFhir = row.fhir_bundle_json
    ? parseJson<ConversationRecord['fhirBundle'] | null>(row.fhir_bundle_json, null)
    : null;
  const fhirBundle =
    parsedFhir ??
    buildConversationBundle({
      recordId: baseRecord.id,
      title: baseRecord.title,
      summary: baseRecord.summary,
      highlights: baseRecord.highlights,
      keywords: baseRecord.keywords,
      createdAt: baseRecord.createdAt,
      updatedAt: baseRecord.updatedAt,
      stats: baseRecord.stats,
      messages: baseRecord.messages,
      quiz: baseRecord.quiz,
    });

  return {
    ...baseRecord,
    fhirBundle,
  };
}

export async function loadRecords(): Promise<ConversationRecord[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<RecordRow>('SELECT * FROM records ORDER BY created_at DESC');
  return rows.map(mapRowToRecord);
}

export async function saveRecord(record: ConversationRecord) {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT OR REPLACE INTO records (
      id,
      title,
      summary,
      highlights_json,
      keywords_json,
      created_at,
      updated_at,
      stats_json,
      messages_json,
      quiz_json,
      fhir_bundle_json
    ) VALUES (
      $id,
      $title,
      $summary,
      $highlights,
      $keywords,
      $createdAt,
      $updatedAt,
      $stats,
      $messages,
      $quiz,
      $fhirBundle
    )`,
    {
      $id: record.id,
      $title: record.title,
      $summary: record.summary,
      $highlights: JSON.stringify(record.highlights),
      $keywords: JSON.stringify(record.keywords),
      $createdAt: record.createdAt,
      $updatedAt: record.updatedAt,
      $stats: JSON.stringify(record.stats),
      $messages: JSON.stringify(record.messages),
      $quiz: JSON.stringify(record.quiz),
      $fhirBundle: JSON.stringify(record.fhirBundle),
    },
  );
}

export async function deleteRecord(id: string) {
  const db = await getDatabase();
  await db.runAsync(`DELETE FROM records WHERE id = $id`, { $id: id });
}

export async function updateRecordTitle(input: {
  id: string;
  title: string;
  updatedAt: number;
  fhirBundle: ConversationRecord['fhirBundle'];
}) {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE records
     SET title = $title,
         updated_at = $updatedAt,
         fhir_bundle_json = $fhirBundle
     WHERE id = $id`,
    {
      $title: input.title,
      $id: input.id,
      $updatedAt: input.updatedAt,
      $fhirBundle: JSON.stringify(input.fhirBundle),
    },
  );
}

export async function updateRecordSummary(input: {
  id: string;
  summary: string;
  keywords: string[];
  updatedAt: number;
  fhirBundle: ConversationRecord['fhirBundle'];
}) {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE records
     SET summary = $summary,
         keywords_json = $keywords,
         updated_at = $updatedAt,
         fhir_bundle_json = $fhirBundle
     WHERE id = $id`,
    {
      $summary: input.summary,
      $keywords: JSON.stringify(input.keywords),
      $id: input.id,
      $updatedAt: input.updatedAt,
      $fhirBundle: JSON.stringify(input.fhirBundle),
    },
  );
}
