import { buildQuiz, createId, deriveHighlights, deriveStats, extractKeywords, summariseConversation } from '@/lib/conversation';
import { buildConversationBundle } from '@/lib/fhir/buildConversationBundle';
import {
  deleteRecord as deleteRecordFromStorage,
  loadRecords,
  saveRecord as saveRecordToStorage,
  updateRecordTitle as updateRecordTitleInStorage,
} from '@/lib/storage/recordsStorage';
import { generateKeywords } from '@/lib/summary';
import { ChatMessage } from '@/types/chat';
import { ConversationRecord } from '@/types/records';
import { create } from 'zustand';

async function createRecord(messages: ChatMessage[], title?: string, recordIdOverride?: string): Promise<ConversationRecord> {
  const now = Date.now();
  const heuristicKeywords = extractKeywords(messages);
  const generatedKeywords = await generateKeywords(messages);
  const keywords = generatedKeywords && generatedKeywords.length > 0 ? generatedKeywords : heuristicKeywords;
  const stats = deriveStats(messages);
  const highlights = deriveHighlights(messages);
  const summary = await summariseConversation(messages, keywords);
  const recordId = recordIdOverride ?? createId();
  const quiz = buildQuiz({ id: recordId, keywords, highlights, stats });

  const baseRecord = {
    id: recordId,
    title: title ?? `대화 기록 ${new Date(now).toLocaleDateString('ko-KR')}`,
    summary,
    highlights,
    keywords,
    createdAt: now,
    updatedAt: now,
    stats,
    messages,
    quiz,
  };

  return {
    ...baseRecord,
    fhirBundle: buildConversationBundle({
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
    }),
  };
}

interface RecordsState {
  records: ConversationRecord[];
  hasHydrated: boolean;
  addRecordFromMessages: (input: { messages: ChatMessage[]; title?: string; conversationId: string }) => Promise<ConversationRecord>;
  removeRecord: (id: string) => void;
  getRecord: (id: string) => ConversationRecord | undefined;
  updateRecordTitle: (id: string, title: string) => void;
  hydrate: () => Promise<void>;
}

export const useRecordsStore = create<RecordsState>((set, get) => ({
  records: [],
  hasHydrated: false,
  addRecordFromMessages: async ({ messages, title, conversationId }) => {
    const record = await createRecord(messages, title, conversationId);
    set((state) => ({
      records: [record, ...state.records.filter((existing) => existing.id !== record.id)],
    }));
    void saveRecordToStorage(record);
    return record;
  },
  removeRecord: (id) => {
    set((state) => ({
      records: state.records.filter((record) => record.id !== id),
    }));
    void deleteRecordFromStorage(id);
  },
  getRecord: (id) => get().records.find((record) => record.id === id),
  updateRecordTitle: (id, title) => {
    const existing = get().records.find((record) => record.id === id);
    if (!existing) {
      return;
    }
    const nextUpdatedAt = Date.now();
    const updatedRecord: ConversationRecord = {
      ...existing,
      title,
      updatedAt: nextUpdatedAt,
    };
    const fhirBundle = buildConversationBundle({
      recordId: updatedRecord.id,
      title: updatedRecord.title,
      summary: updatedRecord.summary,
      highlights: updatedRecord.highlights,
      keywords: updatedRecord.keywords,
      createdAt: updatedRecord.createdAt,
      updatedAt: updatedRecord.updatedAt,
      stats: updatedRecord.stats,
      messages: updatedRecord.messages,
      quiz: updatedRecord.quiz,
    });
    set((state) => ({
      records: state.records.map((record) =>
        record.id === id ? { ...updatedRecord, fhirBundle } : record,
      ),
    }));
    void updateRecordTitleInStorage({ id, title, updatedAt: nextUpdatedAt, fhirBundle });
  },
  hydrate: async () => {
    if (get().hasHydrated) return;
    try {
      const persistedRecords = await loadRecords();
      set((state) => {
        if (state.hasHydrated) {
          return state;
        }
        const merged = new Map<string, ConversationRecord>();
        for (const record of persistedRecords) {
          merged.set(record.id, record);
        }
        for (const record of state.records) {
          merged.set(record.id, record);
        }
        const ordered = Array.from(merged.values()).sort((a, b) => b.createdAt - a.createdAt);
        return { records: ordered, hasHydrated: true };
      });
    } catch (error) {
      console.error('Failed to hydrate records store', error);
      set({ hasHydrated: true });
    }
  },
}));
