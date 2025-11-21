import * as FileSystem from 'expo-file-system/legacy';
import type { PhotoNote } from '@/types/photoNote';

const STORAGE_FILE = `${FileSystem.documentDirectory ?? ''}photo-notes.json`;

async function ensureStorageFile() {
  if (!STORAGE_FILE) {
    throw new Error('문서 저장소를 초기화할 수 없습니다.');
  }

  const info = await FileSystem.getInfoAsync(STORAGE_FILE);
  if (!info.exists) {
    await FileSystem.writeAsStringAsync(STORAGE_FILE, '[]', {
      encoding: FileSystem.EncodingType.UTF8,
    });
  }
}

export async function loadPhotoNotes(): Promise<PhotoNote[]> {
  try {
    await ensureStorageFile();
    const raw = await FileSystem.readAsStringAsync(STORAGE_FILE, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    const parsed = JSON.parse(raw) as PhotoNote[];
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.map((note) => ({
      ...note,
      kind: note.kind ?? 'photo',
    }));
  } catch (error) {
    console.error('사진 노트 불러오기 실패', error);
    return [];
  }
}

export async function persistPhotoNotes(notes: PhotoNote[]) {
  try {
    await ensureStorageFile();
    await FileSystem.writeAsStringAsync(STORAGE_FILE, JSON.stringify(notes), {
      encoding: FileSystem.EncodingType.UTF8,
    });
  } catch (error) {
    console.error('사진 노트 저장 실패', error);
  }
}
