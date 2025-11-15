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
};

type PhotoNotesState = {
  notes: PhotoNote[];
  hasHydrated: boolean;
  hydrate: () => Promise<void>;
  addNote: (input: CreatePhotoNoteInput) => Promise<PhotoNote>;
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
  addNote: async ({ imageId, description, audioUri, transcript, metrics }) => {
    const now = Date.now();
    const persistedAudioUri = await persistAudioFile(audioUri);
    const note: PhotoNote = {
      id: createId(),
      imageId,
      description,
      audioUri: persistedAudioUri,
      transcript,
      metrics,
      createdAt: now,
      updatedAt: now,
    };
    const nextNotes = [note, ...get().notes];
    set({ notes: nextNotes });
    await persistPhotoNotes(nextNotes);
    void syncNoteToSupabase(note);
    return note;
  },
}));

async function syncNoteToSupabase(note: PhotoNote) {
  if (!supabase?.from) return;
  try {
    const { error } = await supabase
      .from('photo_notes')
      .upsert(
        {
          id: note.id,
          image_id: note.imageId,
          description: note.description,
          transcript: note.transcript,
          metrics: note.metrics ?? null,
          recorded_at: new Date(note.createdAt).toISOString(),
          updated_at: new Date(note.updatedAt).toISOString(),
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
