import { createId } from '@/lib/conversation';
import { loadPhotoNotes, persistPhotoNotes } from '@/lib/storage/photoNotesStorage';
import { supabase } from '@/lib/supabase';
import * as FileSystem from 'expo-file-system/legacy';
import { create } from 'zustand';
import type { PhotoNote } from '@/types/photoNote';
import type { SpeechMetrics } from '@/types/speech';

const AUDIO_DIRECTORY = `${FileSystem.documentDirectory ?? ''}photo-notes/audio/`;

async function ensureAudioDirectory() {
  if (!AUDIO_DIRECTORY) {
    throw new Error('문서 저장소를 초기화할 수 없습니다.');
  }
  await FileSystem.makeDirectoryAsync(AUDIO_DIRECTORY, { intermediates: true });
}

type CreatePhotoNoteInput = {
  imageId: string;
  description: string;
  audioUri?: string;
  transcript?: string;
  metrics?: SpeechMetrics;
  riskScore?: number | null;
  kind?: 'photo' | 'script';
  scriptPrompt?: string;
  scriptMatchCount?: number;
  scriptTotalCount?: number;
};

type PhotoNotesState = {
  notes: PhotoNote[];
  hasHydrated: boolean;
  hydrate: () => Promise<void>;
  addNote: (input: CreatePhotoNoteInput) => Promise<PhotoNote>;
  updateRiskScore: (id: string, riskScore: number | null) => Promise<void>;
  mergeRemoteNotes: (notes: PhotoNote[]) => Promise<void>;
};

async function persistAudioFile(audioUri?: string): Promise<string | undefined> {
  if (!audioUri) return undefined;
  await ensureAudioDirectory();
  const extension = audioUri.split('.').pop() ?? 'm4a';
  const filename = `${createId()}.${extension}`;
  const destination = `${AUDIO_DIRECTORY}${filename}`;
  await FileSystem.copyAsync({
    from: audioUri,
    to: destination,
  });
  await FileSystem.deleteAsync(audioUri, { idempotent: true }).catch(() => undefined);
  return destination;
}

export const usePhotoNotesStore = create<PhotoNotesState>((set, get) => ({
  notes: [],
  hasHydrated: false,
  hydrate: async () => {
    if (get().hasHydrated) return;
    const existing = await loadPhotoNotes();
    set({ notes: existing, hasHydrated: true });
  },
  addNote: async ({
    imageId,
    description,
    audioUri,
    transcript,
    metrics,
    riskScore,
    kind,
    scriptPrompt,
    scriptMatchCount,
    scriptTotalCount,
  }) => {
    const now = Date.now();
    const persistedAudioUri = await persistAudioFile(audioUri);
    const note: PhotoNote = {
      id: createId(),
      imageId,
      description,
      audioUri: persistedAudioUri,
      transcript,
      metrics,
      riskScore: riskScore ?? null,
      kind: kind ?? 'photo',
      scriptPrompt,
      scriptMatchCount,
      scriptTotalCount,
      createdAt: now,
      updatedAt: now,
    };
    const nextNotes = [note, ...get().notes];
    set({ notes: nextNotes });
    await persistPhotoNotes(nextNotes);
    void syncNoteToSupabase(note);
    return note;
  },
  updateRiskScore: async (id, riskScore) => {
    set((state) => {
      const target = state.notes.find((note) => note.id === id);
      if (!target) {
        if (__DEV__) console.warn('[photoNotes] riskScore update skipped, note not found', id);
        return state;
      }
      return {
        notes: state.notes.map((note) =>
          note.id === id ? { ...note, riskScore } : note,
        ),
      };
    });
    const updated = get().notes.find((n) => n.id === id);
    if (!updated) return;
    await persistPhotoNotes(get().notes);
    void syncNoteToSupabase(updated);
  },
  mergeRemoteNotes: async (remoteNotes) => {
    if (!remoteNotes.length) return;
    set((state) => {
      const merged = new Map<string, PhotoNote>();
      for (const note of state.notes) {
        merged.set(note.id, note);
      }
      for (const remote of remoteNotes) {
        const existing = merged.get(remote.id);
        if (!existing || (remote.updatedAt ?? 0) > (existing.updatedAt ?? 0)) {
          merged.set(remote.id, remote);
        }
      }
      return { notes: Array.from(merged.values()) };
    });
    await persistPhotoNotes(get().notes);
  },
}));

async function syncNoteToSupabase(note: PhotoNote) {
  if (!supabase?.from) return;
  const { data: userData, error: userError } = await supabase.auth.getUser();
  const userId = userData?.user?.id;
  if (userError || !userId) {
    // 로그인 세션이 없으면 동기화하지 않음
    return;
  }
  try {
    const { error } = await supabase
      .from('photo_notes')
      .upsert(
        {
          id: note.id,
          user_id: userId,
          image_id: note.imageId,
          description: note.description,
          transcript: note.transcript,
          metrics: note.metrics ?? null,
          risk_score: note.riskScore ?? null,
          kind: note.kind ?? 'photo',
          script_prompt: note.scriptPrompt ?? null,
          script_match_count: note.scriptMatchCount ?? null,
          script_total_count: note.scriptTotalCount ?? null,
          recorded_at: new Date(note.createdAt ?? Date.now()).toISOString(),
          updated_at: new Date(note.updatedAt ?? Date.now()).toISOString(),
        },
        { onConflict: 'id' },
      );
    if (error && __DEV__) {
      console.warn('사진 노트를 Supabase에 동기화하지 못했습니다.', error.message);
    }
  } catch (error) {
    if (__DEV__) {
      console.warn('사진 노트를 Supabase에 동기화하지 못했습니다.', error);
    }
  }
}
