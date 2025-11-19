import { loadGameResults, persistAllGameResults, persistGameResult, type GameKind, type GameResult } from '@/lib/storage/gameStatsStorage';
import { create } from 'zustand';

type AddResultInput = Omit<GameResult, 'id' | 'playedAt'> & { playedAt?: number };

type GameStatsState = {
  results: GameResult[];
  hasHydrated: boolean;
  addResult: (input: AddResultInput) => Promise<GameResult | null>;
  hydrate: () => Promise<void>;
  reset: () => Promise<void>;
};

export const useGameStatsStore = create<GameStatsState>((set, get) => ({
  results: [],
  hasHydrated: false,
  hydrate: async () => {
    if (get().hasHydrated) return;
    let loaded = await loadGameResults();
    if (__DEV__ && loaded.length === 0) {
      loaded = seedGameResults();
      await persistAllGameResults(loaded);
    }
    set({ results: loaded, hasHydrated: true });
  },
  addResult: async (input) => {
    const saved = await persistGameResult(input);
    if (!saved) return null;
    set((state) => ({ results: [saved, ...state.results].slice(0, 400) }));
    return saved;
  },
  reset: async () => {
    set({ results: [], hasHydrated: true });
    await persistAllGameResults([]);
  },
}));

export function summarizeGameResults(results: GameResult[], kind?: GameKind) {
  const filtered = kind ? results.filter((r) => r.kind === kind) : results;
  if (filtered.length === 0) {
    return {
      total: 0,
      successCount: 0,
      successRate: 0,
      averageAccuracy: 0,
      averageDurationMs: 0,
      bestAccuracy: 0,
      lastPlayedAt: null as number | null,
    };
  }

  const total = filtered.length;
  const successCount = filtered.filter((r) => r.success).length;
  const averageAccuracy = Math.round(
    filtered.reduce((acc, r) => acc + (r.totalTasks > 0 ? (r.correctTasks / r.totalTasks) * 100 : 0), 0) / total,
  );
  const averageDurationMs = Math.round(filtered.reduce((acc, r) => acc + r.durationMs, 0) / total);
  const bestAccuracy = Math.round(
    filtered.reduce((acc, r) => Math.max(acc, r.totalTasks > 0 ? (r.correctTasks / r.totalTasks) * 100 : 0), 0),
  );
  const lastPlayedAt = filtered[0]?.playedAt ?? null;

  return {
    total,
    successCount,
    successRate: Math.round((successCount / total) * 100),
    averageAccuracy,
    averageDurationMs,
    bestAccuracy,
    lastPlayedAt,
  };
}

export function buildDailyGameTrend(results: GameResult[], kind: GameKind) {
  const filtered = results.filter((r) => r.kind === kind);
  const buckets = new Map<string, { accuracySum: number; durationSum: number; count: number }>();

  filtered.forEach((r) => {
    const dateKey = new Date(r.playedAt).toISOString().slice(0, 10);
    const accuracy = r.totalTasks > 0 ? (r.correctTasks / r.totalTasks) * 100 : 0;
    const bucket = buckets.get(dateKey) ?? { accuracySum: 0, durationSum: 0, count: 0 };
    bucket.accuracySum += accuracy;
    bucket.durationSum += r.durationMs;
    bucket.count += 1;
    buckets.set(dateKey, bucket);
  });

  return Array.from(buckets.entries())
    .sort(([a], [b]) => (a > b ? -1 : 1))
    .map(([date, data]) => ({
      label: date.slice(5).replace('-', '/'),
      accuracy: Math.round(data.accuracySum / data.count),
      avgDurationMs: Math.round(data.durationSum / data.count),
    }));
}

function seedGameResults(): GameResult[] {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const make = (
    kind: GameKind,
    daysAgo: number,
    accuracy: number,
    durationMs: number,
    attempts: number,
  ): GameResult => ({
    id: `${kind}-${daysAgo}`,
    kind,
    playedAt: now - day * daysAgo,
    durationMs,
    success: accuracy >= 60,
    totalTasks: 10,
    correctTasks: Math.round((accuracy / 100) * 10),
    attempts,
  });

  return [
    make('sequence', 0, 90, 52000, 10),
    make('sequence', 1, 70, 61000, 10),
    make('sequence', 2, 80, 58000, 10),
    make('matching', 0, 95, 46000, 14),
    make('matching', 1, 60, 70000, 18),
    make('matching', 3, 85, 52000, 15),
  ];
}
