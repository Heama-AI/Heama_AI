import { createId } from '@/lib/conversation';
import * as FileSystem from 'expo-file-system/legacy';

export type GameKind = 'sequence' | 'matching';

export type GameResult = {
  id: string;
  kind: GameKind;
  playedAt: number;
  durationMs: number;
  success: boolean;
  totalTasks: number;
  correctTasks: number;
  attempts: number;
  meta?: Record<string, unknown>;
};

type GameStatsFile = {
  results: GameResult[];
};

const STORAGE_FILE = `${FileSystem.documentDirectory ?? ''}game-stats-v2.json`;
const DEFAULT_CONTENT: GameStatsFile = { results: [] };
const MAX_RESULTS = 400;

async function ensureStorageFile() {
  if (!STORAGE_FILE) {
    throw new Error('문서 저장소를 초기화할 수 없습니다.');
  }

  const info = await FileSystem.getInfoAsync(STORAGE_FILE);
  if (!info.exists) {
    await FileSystem.writeAsStringAsync(STORAGE_FILE, JSON.stringify(DEFAULT_CONTENT), {
      encoding: FileSystem.EncodingType.UTF8,
    });
  }
}

export async function loadGameResults(): Promise<GameResult[]> {
  try {
    await ensureStorageFile();
    const raw = await FileSystem.readAsStringAsync(STORAGE_FILE, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    const parsed = JSON.parse(raw) as GameStatsFile | undefined;
    if (!parsed?.results || !Array.isArray(parsed.results)) {
      return [];
    }
    return parsed.results;
  } catch (error) {
    console.error('게임 통계 불러오기 실패', error);
    return [];
  }
}

export async function persistGameResult(result: Omit<GameResult, 'id' | 'playedAt'> & { playedAt?: number }) {
  try {
    await ensureStorageFile();
    const existing = await loadGameResults();
    const next: GameResult = {
      ...result,
      id: createId(),
      playedAt: result.playedAt ?? Date.now(),
    };
    const merged = [next, ...existing].slice(0, MAX_RESULTS);
    await FileSystem.writeAsStringAsync(
      STORAGE_FILE,
      JSON.stringify({ results: merged }),
      { encoding: FileSystem.EncodingType.UTF8 },
    );
    return next;
  } catch (error) {
    console.error('게임 통계 저장 실패', error);
    return null;
  }
}

export async function persistAllGameResults(results: GameResult[]) {
  try {
    await ensureStorageFile();
    await FileSystem.writeAsStringAsync(
      STORAGE_FILE,
      JSON.stringify({ results: results.slice(0, MAX_RESULTS) }),
      { encoding: FileSystem.EncodingType.UTF8 },
    );
  } catch (error) {
    console.error('게임 통계 전체 저장 실패', error);
  }
}
