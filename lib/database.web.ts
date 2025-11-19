const CHAT_STORAGE_KEY = 'heama_chat_messages';
const RECORDS_STORAGE_KEY = 'heama_records';
const CONVERSATION_ID_KEY = 'heama_conversation_id';

type ChatRow = {
  id: string;
  role: string;
  text: string;
  ts: number;
};

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
  fhir_bundle_json: string;
};

type WebDatabase = {
  execAsync: (source: string) => Promise<void>;
  runAsync: (source: string, params?: Record<string, unknown>) => Promise<void>;
  getAllAsync: <T>(source: string) => Promise<T[]>;
  getFirstAsync: <T>(source: string, params?: Record<string, unknown>) => Promise<T | undefined>;
  withExclusiveTransactionAsync: (task: (txn: WebDatabase) => Promise<void>) => Promise<void>;
};

type StoreShape = {
  chatMessages: ChatRow[];
  records: RecordRow[];
  conversationId?: string | null;
};

const memoryStore: StoreShape = {
  chatMessages: [],
  records: [],
  conversationId: null,
};

const hasLocalStorage = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

function loadFromStorage<T>(key: string, fallback: T): T {
  if (!hasLocalStorage) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function persistToStorage(key: string, value: unknown) {
  if (!hasLocalStorage) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore quota/security errors on web
  }
}

let hydrated = false;
function ensureHydrated() {
  if (hydrated) return;
  memoryStore.chatMessages = loadFromStorage<ChatRow[]>(CHAT_STORAGE_KEY, []);
  memoryStore.records = loadFromStorage<RecordRow[]>(RECORDS_STORAGE_KEY, []).map((record) => ({
    ...record,
    fhir_bundle_json: record.fhir_bundle_json ?? '{}',
  }));
  memoryStore.conversationId = loadFromStorage<string | null>(CONVERSATION_ID_KEY, null);
  hydrated = true;
}

function normalize(query: string) {
  return query.replace(/\s+/g, ' ').trim().toUpperCase();
}

function upsertChatRow(params: Record<string, unknown>) {
  ensureHydrated();
  const row: ChatRow = {
    id: String(params.$id ?? ''),
    role: String(params.$role ?? 'user'),
    text: String(params.$text ?? ''),
    ts: Number(params.$ts ?? Date.now()),
  };
  const index = memoryStore.chatMessages.findIndex((item) => item.id === row.id);
  if (index >= 0) {
    memoryStore.chatMessages[index] = row;
  } else {
    memoryStore.chatMessages.push(row);
  }
  memoryStore.chatMessages.sort((a, b) => a.ts - b.ts || a.id.localeCompare(b.id));
  persistToStorage(CHAT_STORAGE_KEY, memoryStore.chatMessages);
}

function upsertRecordRow(params: Record<string, unknown>) {
  ensureHydrated();
  const row: RecordRow = {
    id: String(params.$id ?? ''),
    title: String(params.$title ?? ''),
    summary: String(params.$summary ?? ''),
    highlights_json: String(params.$highlights ?? '[]'),
    keywords_json: String(params.$keywords ?? '[]'),
    created_at: Number(params.$createdAt ?? Date.now()),
    updated_at: Number(params.$updatedAt ?? Date.now()),
    stats_json: String(params.$stats ?? '{}'),
    messages_json: String(params.$messages ?? '[]'),
    quiz_json: String(params.$quiz ?? '[]'),
    fhir_bundle_json: String(params.$fhirBundle ?? '{}'),
  };
  const index = memoryStore.records.findIndex((item) => item.id === row.id);
  if (index >= 0) {
    memoryStore.records[index] = row;
  } else {
    memoryStore.records.push(row);
  }
  memoryStore.records.sort((a, b) => b.created_at - a.created_at || b.updated_at - a.updated_at);
  persistToStorage(RECORDS_STORAGE_KEY, memoryStore.records);
}

const webDatabase: WebDatabase = {
  async execAsync(source: string) {
    ensureHydrated();
    const normalized = normalize(source);
    if (normalized.startsWith('DELETE FROM CHAT_MESSAGES')) {
      memoryStore.chatMessages = [];
      persistToStorage(CHAT_STORAGE_KEY, memoryStore.chatMessages);
    }
    if (normalized.startsWith('DELETE FROM APP_STATE')) {
      memoryStore.conversationId = null;
      persistToStorage(CONVERSATION_ID_KEY, memoryStore.conversationId);
    }
  },
  async runAsync(source: string, params: Record<string, unknown> = {}) {
    ensureHydrated();
    const normalized = normalize(source);
    if (normalized.includes('INSERT OR REPLACE INTO CHAT_MESSAGES') || normalized.startsWith('INSERT INTO CHAT_MESSAGES')) {
      upsertChatRow(params);
      return;
    }
    if (normalized.startsWith('INSERT OR REPLACE INTO RECORDS') || normalized.startsWith('INSERT INTO RECORDS')) {
      upsertRecordRow(params);
      return;
    }
    if (normalized.startsWith('DELETE FROM RECORDS')) {
      const id = String(params.$id ?? '');
      memoryStore.records = memoryStore.records.filter((record) => record.id !== id);
      persistToStorage(RECORDS_STORAGE_KEY, memoryStore.records);
      return;
    }
    if (normalized.startsWith('UPDATE RECORDS SET TITLE')) {
      const id = String(params.$id ?? '');
      const title = String(params.$title ?? '');
      const updatedAt = Number(params.$updatedAt ?? Date.now());
      const fhirBundle = String(params.$fhirBundle ?? '{}');
      memoryStore.records = memoryStore.records.map((record) =>
        record.id === id ? { ...record, title, updated_at: updatedAt, fhir_bundle_json: fhirBundle } : record,
      );
      persistToStorage(RECORDS_STORAGE_KEY, memoryStore.records);
      return;
    }
    if (normalized.startsWith('DELETE FROM CHAT_MESSAGES')) {
      memoryStore.chatMessages = [];
      persistToStorage(CHAT_STORAGE_KEY, memoryStore.chatMessages);
      return;
    }
    if (normalized.startsWith('INSERT OR REPLACE INTO APP_STATE') || normalized.startsWith('INSERT INTO APP_STATE')) {
      const key = String(params.$key ?? '');
      const value = String(params.$value ?? '');
      if (key === 'conversation_id') {
        memoryStore.conversationId = value;
        persistToStorage(CONVERSATION_ID_KEY, memoryStore.conversationId);
      }
      return;
    }
    if (normalized.startsWith('SELECT VALUE FROM APP_STATE')) {
      return;
    }
  },
  async getAllAsync<T>(source: string): Promise<T[]> {
    ensureHydrated();
    const normalized = normalize(source);
    if (normalized.startsWith('SELECT * FROM CHAT_MESSAGES')) {
      return memoryStore.chatMessages.slice() as unknown as T[];
    }
    if (normalized.startsWith('SELECT * FROM RECORDS')) {
      return memoryStore.records.slice() as unknown as T[];
    }
    if (normalized.startsWith('SELECT VALUE FROM APP_STATE')) {
      if (normalized.includes('CONVERSATION_ID')) {
        const value = memoryStore.conversationId ?? null;
        return [{ value }] as unknown as T[];
      }
      return [] as unknown as T[];
    }
    return [];
  },
  async getFirstAsync<T>(source: string, params: Record<string, unknown> = {}): Promise<T | undefined> {
    const normalized = normalize(source);
    if (normalized.startsWith('SELECT VALUE FROM APP_STATE')) {
      ensureHydrated();
      const key = String(params.$key ?? '');
      if (key === 'conversation_id') {
        const value = memoryStore.conversationId ?? null;
        return (value !== null ? [{ value }] : [])?.[0] as unknown as T | undefined;
      }
    }
    const all = await this.getAllAsync<T>(source);
    return all[0];
  },
  async withExclusiveTransactionAsync(task: (txn: WebDatabase) => Promise<void>) {
    await task(this);
  },
};

export async function getDatabase() {
  ensureHydrated();
  return webDatabase;
}
