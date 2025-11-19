import { BrandColors, Shadows } from '@/constants/theme';
import {
  evaluateSpeechMetricsChange,
  summarizeSpeechMetrics,
  type MetricLevel,
  type SpeechMetricsChangeSummary,
  type SpeechMetricsSummary,
} from '@/lib/analysis/speechMetrics';
import type { GameKind, GameResult } from '@/lib/storage/gameStatsStorage';
import { supabase } from '@/lib/supabase';
import { summarizeGameResults, useGameStatsStore } from '@/store/gameStatsStore';
import { usePhotoNotesStore } from '@/store/photoNotesStore';
import { useRecordsStore } from '@/store/recordsStore';
import type { PhotoNote } from '@/types/photoNote';
import type { SpeechMetrics } from '@/types/speech';
import React, { useEffect, useMemo, useState } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Modal, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

interface DailyDataPoint {
  label: string;
  risk: number;
  count: number;
}

interface PhotoMetricsEntry {
  id: string;
  updatedAt: number;
  description: string;
  summary: SpeechMetricsSummary;
  metrics?: SpeechMetrics;
  trendSummary?: SpeechMetricsChangeSummary | null;
  trendEnabled?: boolean;
}

interface ConversationSummary {
  total: number;
  averageRisk: number;
  peakRisk: number;
  averageMood: number;
  lastConversation?: string;
}

const getLastNDays = (n: number) => {
  const days: Date[] = [];
  const today = new Date();
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    days.push(d);
  }
  return days;
};

const formatDayKey = (date: Date) => date.toISOString().slice(0, 10);

export default function Stats() {
  const { records } = useRecordsStore();
  const photoNotes = usePhotoNotesStore((state) => state.notes);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const stackSummaryCards = width < 520;
  const [activeTab, setActiveTab] = useState<'conversation' | 'game' | 'photo'>('conversation');
  const [photoEntries, setPhotoEntries] = useState<PhotoMetricsEntry[]>([]);
  const [photoMetricsLoading, setPhotoMetricsLoading] = useState(true);
  const [photoMetricsError, setPhotoMetricsError] = useState<string | null>(null);
  const hydrateGameStats = useGameStatsStore((state) => state.hydrate);
  const gameStatsHydrated = useGameStatsStore((state) => state.hasHydrated);
  const gameResults = useGameStatsStore((state) => state.results);
  const [graphKind, setGraphKind] = useState<GameKind | null>(null);

  useEffect(() => {
    if (!gameStatsHydrated) {
      void hydrateGameStats();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameStatsHydrated]);

  const { summary, dailyTrend } = useMemo(() => {
    if (records.length === 0) {
      const emptyDays = getLastNDays(7).map((date) => ({
        label: `${date.getMonth() + 1}/${date.getDate()}`,
        risk: 0,
        count: 0,
      }));

      return {
        summary: {
          total: 0,
          averageRisk: 0,
          peakRisk: 0,
          averageMood: 0,
          lastConversation: undefined as string | undefined,
        },
        dailyTrend: emptyDays,
      };
    }

    const total = records.length;
    const averageRisk = Math.round(records.reduce((acc, record) => acc + record.stats.riskScore, 0) / total);
    const averageMood = Math.round(records.reduce((acc, record) => acc + record.stats.moodScore, 0) / total);
    const peakRecord = records.reduce((prev, current) =>
      current.stats.riskScore > prev.stats.riskScore ? current : prev,
    );

    const lastConversation = records[0]?.summary;

    const days = getLastNDays(7);
    const buckets = new Map<string, { riskSum: number; count: number }>();

    days.forEach((day) => {
      buckets.set(formatDayKey(day), { riskSum: 0, count: 0 });
    });

    records.forEach((record) => {
      const dayKey = formatDayKey(new Date(record.createdAt));
      const bucket = buckets.get(dayKey);
      if (bucket) {
        bucket.riskSum += record.stats.riskScore;
        bucket.count += 1;
      }
    });

    const dailyTrend: DailyDataPoint[] = days.map((day) => {
      const key = formatDayKey(day);
      const bucket = buckets.get(key) ?? { riskSum: 0, count: 0 };
      return {
        label: `${day.getMonth() + 1}/${day.getDate()}`,
        risk: bucket.count === 0 ? 0 : Math.round(bucket.riskSum / bucket.count),
        count: bucket.count,
      };
    });

    return {
      summary: {
        total,
        averageRisk,
        peakRisk: peakRecord.stats.riskScore,
        averageMood,
        lastConversation,
      },
      dailyTrend,
    };
  }, [records]);

  useEffect(() => {
    let cancelled = false;
    async function loadPhotoMetrics() {
      setPhotoMetricsLoading(true);
      setPhotoMetricsError(null);
      try {
        if (!supabase?.from) {
          if (!cancelled) {
            setPhotoEntries(buildEntriesFromLocal(photoNotes));
            setPhotoMetricsLoading(false);
          }
          return;
        }
        const { data, error } = await supabase
          .from('photo_notes')
          .select('id, description, metrics, updated_at, recorded_at')
          .order('recorded_at', { ascending: false });
        if (error) {
          throw new Error(error.message);
        }
        const entries: PhotoMetricsEntry[] = [];
        for (const row of data ?? []) {
          const summary = summarizeSpeechMetrics(row.metrics as any);
          if (!summary) continue;
          const updatedAt = row.updated_at ? new Date(row.updated_at).getTime() : Date.now();
          entries.push({
            id: row.id,
            updatedAt,
            description: row.description ?? '',
            summary,
            metrics: (row.metrics ?? undefined) as SpeechMetrics | undefined,
            trendEnabled: false,
          });
        }
        if (!cancelled) {
          setPhotoEntries(enrichPhotoEntries(entries));
          setPhotoMetricsLoading(false);
        }
      } catch (error) {
        if (!cancelled) {
          setPhotoEntries(buildEntriesFromLocal(photoNotes));
          setPhotoMetricsError(
            error instanceof Error ? error.message : '사진 설명 지표를 불러오지 못했습니다.',
          );
          setPhotoMetricsLoading(false);
        }
      }
    }
    void loadPhotoMetrics();
    return () => {
      cancelled = true;
    };
  }, [photoNotes]);

  const photoMetrics = useMemo(
    () => ({
      entries: photoEntries,
      total: photoEntries.length,
    }),
    [photoEntries],
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BrandColors.background }} edges={['top', 'left', 'right']}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingTop: 24,
          gap: 24,
          paddingBottom: 48 + insets.bottom,
        }}>
      <View style={{ gap: 6 }}>
        <Text style={{ fontSize: 30, fontWeight: '800', color: BrandColors.textPrimary }}>건강 통계</Text>
        <Text style={{ color: BrandColors.textSecondary, lineHeight: 22 }}>
          최근 대화 기록을 기반으로 활동과 위험 지수를 확인하세요.
        </Text>
      </View>

      <View
        style={{
          flexDirection: 'row',
          borderWidth: 1,
          borderColor: BrandColors.border,
          borderRadius: 999,
          padding: 4,
          backgroundColor: BrandColors.surface,
        }}>
        <TabButton label="대화 통계" active={activeTab === 'conversation'} onPress={() => setActiveTab('conversation')} />
        <TabButton label="게임 통계" active={activeTab === 'game'} onPress={() => setActiveTab('game')} />
        <TabButton label="사진 설명" active={activeTab === 'photo'} onPress={() => setActiveTab('photo')} />
      </View>

      {activeTab === 'conversation' ? (
        <ConversationStatsSection
          summary={summary}
          dailyTrend={dailyTrend}
          stackSummaryCards={stackSummaryCards}
        />
      ) : activeTab === 'game' ? (
        <GameStatsSection
          results={gameResults}
          stackSummaryCards={stackSummaryCards}
          onOpenGraph={setGraphKind}
        />
      ) : (
        <PhotoMetricsSection
          photoMetrics={photoMetrics}
          loading={photoMetricsLoading}
          error={photoMetricsError}
        />
      )}
      <GameGraphModal
        visible={graphKind !== null}
        onClose={() => setGraphKind(null)}
        kind={graphKind}
        data={graphKind ? buildGameRunSeries(gameResults, graphKind) : []}
      />
      </ScrollView>
    </SafeAreaView>
  );
}

function ConversationStatsSection({
  summary,
  dailyTrend,
  stackSummaryCards,
}: {
  summary: ConversationSummary;
  dailyTrend: DailyDataPoint[];
  stackSummaryCards: boolean;
}) {
  return (
    <View style={{ gap: 20 }}>
      <View style={{ flexDirection: stackSummaryCards ? 'column' : 'row', gap: 16 }}>
        <SummaryCard
          label="저장된 대화"
          value={`${summary.total}회`}
          accent={BrandColors.primary}
          style={stackSummaryCards ? { width: '100%' } : undefined}
        />
        <SummaryCard
          label="평균 위험 지수"
          value={`${summary.averageRisk}`}
          accent={BrandColors.primaryDark}
          style={stackSummaryCards ? { width: '100%' } : undefined}
        />
        <SummaryCard
          label="평균 감정 점수"
          value={`${summary.averageMood}`}
          accent={BrandColors.accent}
          style={stackSummaryCards ? { width: '100%' } : undefined}
        />
      </View>

      <TrendCard title="주간 위험 지수 추이" data={dailyTrend} valueKey="risk" valueSuffix="" color={BrandColors.primary} />
      <TrendCard
        title="주간 대화 횟수"
        data={dailyTrend}
        valueKey="count"
        valueSuffix="회"
        color={BrandColors.accent}
      />

      {summary.lastConversation ? (
        <View
          style={{
            backgroundColor: BrandColors.surface,
            borderRadius: 22,
            padding: 20,
            gap: 8,
            borderWidth: 1,
            borderColor: BrandColors.border,
            ...Shadows.card,
          }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: BrandColors.textPrimary }}>최근 대화 요약</Text>
          <Text style={{ color: BrandColors.textSecondary, lineHeight: 22 }}>{summary.lastConversation}</Text>
        </View>
      ) : (
        <Text style={{ color: BrandColors.textSecondary }}>기록이 저장되면 맞춤 통계를 보여드릴게요.</Text>
      )}
    </View>
  );
}

function GameStatsSection({
  results,
  stackSummaryCards,
  onOpenGraph,
}: {
  results: GameResult[];
  stackSummaryCards: boolean;
  onOpenGraph: (kind: GameKind) => void;
}) {
  const sequenceSummary = summarizeGameResults(results, 'sequence');
  const matchingSummary = summarizeGameResults(results, 'matching');
  const recent = results.slice(0, 6);

  const renderSummaryRow = (title: string, summary: ReturnType<typeof summarizeGameResults>, kind: GameKind) => (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={{ fontSize: 18, fontWeight: '700', color: BrandColors.textPrimary }}>{title}</Text>
        <Pressable
          onPress={() => onOpenGraph(kind)}
          style={{
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: BrandColors.border,
            backgroundColor: BrandColors.surface,
          }}>
          <Text style={{ color: BrandColors.textSecondary, fontWeight: '600' }}>그래프</Text>
        </Pressable>
      </View>
      {summary.total === 0 ? (
        <Text style={{ color: BrandColors.textSecondary }}>아직 데이터가 없습니다. 게임을 플레이해 주세요.</Text>
      ) : (
        <View style={{ flexDirection: stackSummaryCards ? 'column' : 'row', gap: 12, flexWrap: 'wrap' }}>
          <SummaryCard
            label="총 플레이"
            value={`${summary.total}회`}
            accent={BrandColors.primary}
            style={stackSummaryCards ? { width: '100%' } : undefined}
          />
          <SummaryCard
            label="성공률"
            value={`${summary.successRate}%`}
            accent={BrandColors.primaryDark}
            style={stackSummaryCards ? { width: '100%' } : undefined}
          />
          <SummaryCard
            label="평균 정답률"
            value={`${summary.averageAccuracy}%`}
            accent={BrandColors.accent}
            style={stackSummaryCards ? { width: '100%' } : undefined}
          />
          <SummaryCard
            label="평균 소요 시간"
            value={formatDuration(summary.averageDurationMs)}
            accent={BrandColors.textSecondary}
            style={stackSummaryCards ? { width: '100%' } : undefined}
          />
        </View>
      )}
    </View>
  );

  return (
    <View style={{ gap: 20 }}>
      {renderSummaryRow('순서 기억하기', sequenceSummary, 'sequence')}
      {renderSummaryRow('같은 그림 찾기', matchingSummary, 'matching')}

      <View style={{ gap: 10 }}>
        <Text style={{ fontSize: 18, fontWeight: '700', color: BrandColors.textPrimary }}>최근 기록</Text>
        {recent.length === 0 ? (
          <Text style={{ color: BrandColors.textSecondary }}>기록이 없어요.</Text>
        ) : (
          recent.map((result) => {
            const accuracy = result.totalTasks > 0 ? Math.round((result.correctTasks / result.totalTasks) * 100) : 0;
            return (
              <View
                key={result.id}
                style={{
                  backgroundColor: BrandColors.surface,
                  borderRadius: 16,
                  padding: 14,
                  borderWidth: 1,
                  borderColor: BrandColors.border,
                }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text style={{ fontWeight: '700', color: BrandColors.textPrimary }}>
                    {result.kind === 'sequence' ? '순서 기억하기' : '같은 그림 찾기'}
                  </Text>
                  <Text style={{ color: BrandColors.textSecondary }}>
                    {new Date(result.playedAt).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}
                  </Text>
                </View>
                <Text style={{ color: BrandColors.textSecondary }}>
                  정답률 {accuracy}% · 소요 {formatDuration(result.durationMs)} · 시도 {result.attempts}회
                </Text>
              </View>
            );
          })
        )}
      </View>
    </View>
  );
}

function buildGameRunSeries(results: GameResult[], kind: GameKind, limit = 12) {
  const filtered = results.filter((r) => r.kind === kind);
  const latest = filtered.slice(0, limit).reverse(); // 오래된 순으로
  const totalRuns = filtered.length;
  return latest.map((r, idx) => {
    const runNumber = totalRuns - (latest.length - 1 - idx);
    const base = {
      label: `${runNumber}회차`,
      metric: 0,
      avgDurationMs: r.durationMs,
    };
    if (kind === 'matching') {
      return { ...base, metric: r.attempts ?? 0 };
    }
    // sequence-memory: 연속 성공 라운드(저장된 streak) 기준
    const streak = typeof r.meta?.streak === 'number' ? r.meta.streak : r.success ? 1 : 0;
    return { ...base, metric: streak };
  });
}

function PhotoMetricsSection({
  photoMetrics,
  loading,
  error,
}: {
  photoMetrics: { entries: PhotoMetricsEntry[]; total: number };
  loading: boolean;
  error: string | null;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showTrend, setShowTrend] = useState(false);

  useEffect(() => {
    setSelectedId(photoMetrics.entries[0]?.id ?? null);
  }, [photoMetrics.entries]);

  const activeEntry = selectedId
    ? photoMetrics.entries.find((entry) => entry.id === selectedId) ?? photoMetrics.entries[0]
    : photoMetrics.entries[0];

  const speechTrend = useMemo(() => {
    const chronological = photoMetrics.entries
      .filter((entry) => entry.metrics)
      .sort((a, b) => a.updatedAt - b.updatedAt)
      .map((entry) => ({
        label: new Date(entry.updatedAt).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' }),
        wpm: entry.metrics?.speechRateWpm ? Number(entry.metrics.speechRateWpm.toFixed(0)) : 0,
        pauseSec: entry.metrics?.meanPauseDurationSec ? Number(entry.metrics.meanPauseDurationSec.toFixed(1)) : 0,
      }));
    return {
      points: chronological,
      enabled: chronological.length >= 2,
    };
  }, [photoMetrics.entries]);
  return (
    <View style={{ gap: 20 }}>
      <View style={{ gap: 6 }}>
        <Text style={{ fontSize: 18, fontWeight: '700', color: BrandColors.textPrimary }}>사진 설명 지표</Text>
        <Text style={{ color: BrandColors.textSecondary, lineHeight: 20 }}>
          사진을 보며 말한 내용을 분석해 참고용 지표로 정리했어요. 동일한 조건에서 반복 측정하면 변화를 더 정확히 확인할 수 있습니다.
        </Text>
      </View>

      <Pressable
        onPress={() => speechTrend.enabled && setShowTrend(true)}
        disabled={!speechTrend.enabled}
        style={{
          borderRadius: 22,
          padding: 18,
          borderWidth: 1,
          borderColor: speechTrend.enabled ? BrandColors.border : BrandColors.border,
          backgroundColor: BrandColors.surface,
          gap: 10,
          opacity: speechTrend.enabled ? 1 : 0.6,
          ...Shadows.card,
        }}>
        <Text style={{ color: BrandColors.textSecondary }}>총 측정 횟수</Text>
        <Text style={{ fontSize: 28, fontWeight: '800', color: BrandColors.primary }}>{photoMetrics.total}회</Text>
        <Text style={{ color: BrandColors.textSecondary }}>
          한 달에 한 번 이상 기록하면 추세를 더 정확히 볼 수 있어요.
        </Text>
        <Text style={{ color: BrandColors.textPrimary, fontWeight: '700' }}>
          {speechTrend.enabled ? '탭해서 말하기 추이 보기' : '2회 이상 기록 시 추이 확인 가능'}
        </Text>
      </Pressable>

      {loading ? (
        <Text style={{ color: BrandColors.textSecondary }}>사진 설명 지표를 불러오는 중이에요…</Text>
      ) : error ? (
        <Text style={{ color: BrandColors.textSecondary }}>{error}</Text>
      ) : photoMetrics.total === 0 ? (
        <Text style={{ color: BrandColors.textSecondary }}>
          아직 사진 설명 기록이 없습니다. 포토 노트에서 음성을 기록하면 이곳에서 요약을 볼 수 있어요.
        </Text>
      ) : (
        <View style={{ gap: 16 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
            {photoMetrics.entries.map((entry) => {
              const isActive = entry.id === activeEntry?.id;
              return (
                <Pressable
                  key={entry.id}
                  onPress={() => setSelectedId(entry.id)}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: isActive ? BrandColors.primary : BrandColors.border,
                    backgroundColor: isActive ? BrandColors.primary : BrandColors.surface,
                  }}>
                  <Text
                    style={{
                      color: isActive ? '#fff' : BrandColors.textSecondary,
                      fontWeight: '600',
                    }}>
                    {new Date(entry.updatedAt).toLocaleDateString('ko-KR', {
                      month: 'long',
                      day: 'numeric',
                    })}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {activeEntry ? (
            <PhotoMetricsCard entry={activeEntry} baselineRequiredCount={4} />
          ) : (
            <Text style={{ color: BrandColors.textSecondary }}>기록을 선택하여 자세한 지표를 확인해 주세요.</Text>
          )}
          <SpeechTrendModal visible={showTrend} onClose={() => setShowTrend(false)} points={speechTrend.points} />
        </View>
      )}
    </View>
  );
}

function PhotoMetricsCard({
  entry,
  compact,
  baselineRequiredCount,
}: {
  entry: PhotoMetricsEntry;
  compact?: boolean;
  baselineRequiredCount: number;
}) {
  const [section, setSection] = useState<'current' | 'transcript'>('current');

  useEffect(() => {
    setSection('current');
  }, [entry.id]);

  const renderSection = () => {
    if (section === 'current') {
      return (
        <View style={{ gap: 12 }}>
          <MetricsSummaryView summary={entry.summary} compact={compact} title="이번 녹음 평가" />
          {entry.metrics ? (
            <View
              style={{
                borderRadius: 16,
                borderWidth: 1,
                borderColor: BrandColors.border,
                backgroundColor: BrandColors.surface,
                padding: 14,
                gap: 10,
              }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: BrandColors.textPrimary }}>세부 지표</Text>
              {PHOTO_METRIC_DETAILS.map((detail) => {
                const value = entry.metrics?.[detail.key] ?? 0;
                const formatted = detail.format ? detail.format(value) : `${value}`;
                return (
                  <View
                    key={`${entry.id}-${detail.key}`}
                    style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ color: BrandColors.textSecondary }}>{detail.label}</Text>
                    <Text style={{ fontWeight: '700', color: BrandColors.textPrimary }}>{formatted}</Text>
                  </View>
                );
              })}
            </View>
          ) : null}
        </View>
      );
    }
      return (
        <View
          style={{
            borderRadius: 16,
            borderWidth: 1,
          borderColor: BrandColors.border,
          backgroundColor: BrandColors.surface,
          padding: 16,
        }}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: BrandColors.textPrimary }}>말한 대본</Text>
        <Text style={{ color: BrandColors.textSecondary, lineHeight: 20 }}>
          {entry.description || '대본이 없습니다.'}
        </Text>
      </View>
    );
  };

  return (
    <View style={{ gap: 14 }}>
      <Text style={{ fontSize: 13, color: BrandColors.textSecondary }}>
        {new Date(entry.updatedAt).toLocaleString('ko-KR', {
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })}
      </Text>
        <View
          style={{
            flexDirection: 'row',
            borderRadius: 999,
            borderWidth: 1,
            borderColor: BrandColors.border,
            padding: 4,
            backgroundColor: BrandColors.surface,
          }}>
          <TabButton label="음성 평가" active={section === 'current'} onPress={() => setSection('current')} />
          <TabButton label="말한 대본" active={section === 'transcript'} onPress={() => setSection('transcript')} />
        </View>
      {renderSection()}
    </View>
  );
}

function SpeechTrendModal({
  visible,
  onClose,
  points,
}: {
  visible: boolean;
  onClose: () => void;
  points: Array<{ label: string; wpm: number; pauseSec: number }>;
}) {
  const insets = useSafeAreaInsets();
  const renderDotLabel = (color: string, suffix: string) =>
    ({ x, y, indexData }: { x: number; y: number; indexData: number }) => (
      <Text
        key={`${x}-${y}`}
        style={{
          position: 'absolute',
          left: x - 8,
          top: y - 10,
          fontSize: 10,
          fontWeight: '700',
          color,
        }}>
        {`${indexData}${suffix}`}
      </Text>
    );

  const hasData = points.length >= 2;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View
          style={{
            backgroundColor: '#fff',
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            padding: 20,
            gap: 14,
            maxHeight: '80%',
            paddingBottom: 12 + insets.bottom,
          }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: BrandColors.textPrimary }}>말하기 추이</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Text style={{ color: BrandColors.textSecondary }}>닫기</Text>
            </Pressable>
          </View>
          {!hasData ? (
            <Text style={{ color: BrandColors.textSecondary }}>그래프를 볼 수 있을 만큼 데이터가 부족합니다.</Text>
          ) : (
            <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
              <View style={{ gap: 18 }}>
                <View>
                  <Text style={{ fontWeight: '700', color: BrandColors.textPrimary, marginBottom: 6 }}>말 속도</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <LineChart
                      data={{
                        labels: points.map((p) => p.label),
                        datasets: [{ data: points.map((p) => p.wpm), color: () => BrandColors.primary, strokeWidth: 3 }],
                        legend: ['WPM'],
                      }}
                      width={Math.max(320, points.length * 80)}
                      height={200}
                      yAxisSuffix=" wpm"
                      fromZero
                      yAxisInterval={1}
                      chartConfig={{
                        backgroundColor: '#fff',
                        backgroundGradientFrom: '#fff',
                        backgroundGradientTo: '#fff',
                        decimalPlaces: 0,
                        color: (opacity = 1) => `rgba(51, 51, 51, ${opacity})`,
                        labelColor: (opacity = 1) => `rgba(51, 51, 51, ${opacity})`,
                        propsForDots: { r: '4', fill: BrandColors.primary },
                        propsForBackgroundLines: { stroke: BrandColors.border, strokeWidth: 0.5 },
                      }}
                      style={{ marginVertical: 4, borderRadius: 12 }}
                      renderDotContent={renderDotLabel(BrandColors.primary, '')}
                    />
                  </ScrollView>
                </View>
                <View>
                  <Text style={{ fontWeight: '700', color: BrandColors.textPrimary, marginBottom: 6 }}>말 사이 쉼</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <LineChart
                      data={{
                        labels: points.map((p) => p.label),
                        datasets: [
                          { data: points.map((p) => Number(p.pauseSec.toFixed(1))), color: () => BrandColors.accent, strokeWidth: 3 },
                        ],
                        legend: ['초'],
                      }}
                      width={Math.max(320, points.length * 80)}
                      height={200}
                      yAxisSuffix="초"
                      fromZero
                      yAxisInterval={1}
                      chartConfig={{
                        backgroundColor: '#fff',
                        backgroundGradientFrom: '#fff',
                        backgroundGradientTo: '#fff',
                        decimalPlaces: 1,
                        color: (opacity = 1) => `rgba(51, 51, 51, ${opacity})`,
                        labelColor: (opacity = 1) => `rgba(51, 51, 51, ${opacity})`,
                        propsForDots: { r: '4', fill: BrandColors.accent },
                        propsForBackgroundLines: { stroke: BrandColors.border, strokeWidth: 0.5 },
                      }}
                      style={{ marginVertical: 4, borderRadius: 12 }}
                      renderDotContent={renderDotLabel(BrandColors.accent, '초')}
                    />
                  </ScrollView>
                </View>
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

function SummaryCard({
  label,
  value,
  accent,
  style,
}: {
  label: string;
  value: string;
  accent: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        {
          flex: 1,
          borderRadius: 20,
          padding: 18,
          gap: 6,
          backgroundColor: BrandColors.surface,
          borderWidth: 1,
          borderColor: BrandColors.border,
          ...Shadows.card,
        },
        style,
      ]}>
      <Text style={{ color: BrandColors.textSecondary }}>{label}</Text>
      <Text style={{ fontSize: 24, fontWeight: '800', color: accent }}>{value}</Text>
    </View>
  );
}

function TrendCard({
  title,
  data,
  valueKey,
  valueSuffix,
  color,
}: {
  title: string;
  data: DailyDataPoint[];
  valueKey: keyof DailyDataPoint;
  valueSuffix: string;
  color: string;
}) {
  return (
    <View
      style={{
        backgroundColor: BrandColors.surface,
        borderRadius: 24,
        padding: 20,
        borderWidth: 1,
        borderColor: BrandColors.border,
        gap: 14,
        ...Shadows.card,
      }}>
      <Text style={{ fontSize: 18, fontWeight: '700', color: BrandColors.textPrimary }}>{title}</Text>
      <View style={{ gap: 10 }}>
        {data.map((item) => {
          const value = item[valueKey];
          const safeValue = typeof value === 'number' ? value : 0;
          return (
            <View key={`${title}-${item.label}`} style={{ gap: 4 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: BrandColors.textSecondary }}>{item.label}</Text>
                <Text style={{ fontWeight: '700', color: BrandColors.textPrimary }}>
                  {safeValue}
                  {valueSuffix}
                </Text>
              </View>
              <View
                style={{
                  height: 8,
                  borderRadius: 999,
                  backgroundColor: BrandColors.surfaceSoft,
                  overflow: 'hidden',
                }}>
                <View
                  style={{
                    height: '100%',
                    width: `${Math.min(100, (safeValue / 10) * 100)}%`,
                    backgroundColor: color,
                    borderRadius: 999,
                  }}
                />
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function GameGraphModal({
  visible,
  onClose,
  kind,
  data,
}: {
  visible: boolean;
  onClose: () => void;
  kind: GameKind | null;
  data: Array<{ label: string; metric: number; avgDurationMs: number }>;
}) {
  const title = kind === 'sequence' ? '순서 기억하기' : kind === 'matching' ? '같은 그림 찾기' : '';
  const insets = useSafeAreaInsets();
  const renderDotLabel = (color: string, suffix: string) =>
    ({ x, y, indexData }: { x: number; y: number; indexData: number }) => (
      <Text
        key={`${x}-${y}`}
        style={{
          position: 'absolute',
          left: x - 8,
          top: y,
          fontSize: 14,
          fontWeight: '700',
          color,
        }}>
        {`${indexData}${suffix}`}
      </Text>
    );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.35)',
          justifyContent: 'flex-end',
        }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View
          style={{
            backgroundColor: '#fff',
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            padding: 20,
            gap: 12,
            maxHeight: '78%',
            paddingBottom: 12 + insets.bottom,
            overflow: 'hidden',
          }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: BrandColors.textPrimary }}>
              {title || '게임 통계'}
            </Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Text style={{ color: BrandColors.textSecondary }}>닫기</Text>
            </Pressable>
          </View>
          {data.length === 0 ? (
            <Text style={{ color: BrandColors.textSecondary }}>데이터가 없습니다.</Text>
          ) : (
            <View style={{ gap: 14, position: 'relative' }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontWeight: '700', color: BrandColors.textPrimary }}>
                  {kind === 'matching' ? '시도 횟수 / 소요시간' : '연속 성공 / 소요시간'}
                </Text>
                <Text style={{ color: BrandColors.textSecondary, fontSize: 12 }}>최근이 오른쪽에 표시됩니다.</Text>
              </View>

              <View style={{ position: 'relative' }}>
                {kind === 'matching' ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={{ gap: 10 }}>
                      <View style={{ position: 'relative' }}>
                        <LineChart
                          data={{
                            labels: data.map((d) => d.label),
                            datasets: [{ data: data.map((d) => d.metric), color: () => BrandColors.primary, strokeWidth: 3 }],
                            legend: ['시도 횟수'],
                          }}
                          width={Math.max(300, data.length * 80)}
                          height={180}
                          yAxisSuffix="회"
                          fromZero
                          yAxisInterval={1}
                          chartConfig={{
                            backgroundColor: '#fff',
                            backgroundGradientFrom: '#fff',
                            backgroundGradientTo: '#fff',
                            decimalPlaces: 0,
                            color: (opacity = 1) => `rgba(51, 51, 51, ${opacity})`,
                            labelColor: (opacity = 1) => `rgba(51, 51, 51, ${opacity})`,
                            propsForDots: { r: '4', fill: BrandColors.primary },
                            propsForBackgroundLines: { stroke: BrandColors.border, strokeWidth: 0.5 },
                          }}
                          style={{ marginVertical: 4, borderRadius: 12 }}
                          renderDotContent={renderDotLabel(BrandColors.primary, '회')}
                        />
                      </View>
                      <View style={{ position: 'relative' }}>
                        <LineChart
                          data={{
                            labels: data.map((d) => d.label),
                            datasets: [
                              { data: data.map((d) => Number((d.avgDurationMs / 1000).toFixed(0))), color: () => BrandColors.accent, strokeWidth: 3 },
                            ],
                            legend: ['소요시간(초)'],
                          }}
                          width={Math.max(300, data.length * 80)}
                          height={180}
                          yAxisSuffix="초"
                          fromZero
                          yAxisInterval={1}
                          chartConfig={{
                            backgroundColor: '#fff',
                            backgroundGradientFrom: '#fff',
                            backgroundGradientTo: '#fff',
                            decimalPlaces: 0,
                            color: (opacity = 1) => `rgba(51, 51, 51, ${opacity})`,
                            labelColor: (opacity = 1) => `rgba(51, 51, 51, ${opacity})`,
                            propsForDots: { r: '4', fill: BrandColors.accent },
                            propsForBackgroundLines: { stroke: BrandColors.border, strokeWidth: 0.5 },
                          }}
                          style={{ marginVertical: 4, borderRadius: 12 }}
                          renderDotContent={renderDotLabel(BrandColors.accent, '초')}
                        />
                      </View>
                    </View>
                  </ScrollView>
                ) : (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={{ gap: 10 }}>
                      <View style={{ position: 'relative' }}>
                        <LineChart
                          data={{
                            labels: data.map((d) => d.label),
                            datasets: [{ data: data.map((d) => d.metric), color: () => BrandColors.primary, strokeWidth: 3 }],
                            legend: ['연속 성공(회)'],
                          }}
                          width={Math.max(300, data.length * 80)}
                          height={180}
                          yAxisSuffix="회"
                          fromZero
                          yAxisInterval={1}
                          chartConfig={{
                            backgroundColor: '#fff',
                            backgroundGradientFrom: '#fff',
                            backgroundGradientTo: '#fff',
                            decimalPlaces: 0,
                            color: (opacity = 1) => `rgba(51, 51, 51, ${opacity})`,
                            labelColor: (opacity = 1) => `rgba(51, 51, 51, ${opacity})`,
                            propsForDots: { r: '4', fill: BrandColors.primary },
                            propsForBackgroundLines: { stroke: BrandColors.border, strokeWidth: 0.5 },
                          }}
                          style={{ marginVertical: 4, borderRadius: 12 }}
                          renderDotContent={renderDotLabel(BrandColors.primary, '회')}
                        />
                      </View>
                      <View style={{ position: 'relative' }}>
                        <LineChart
                          data={{
                            labels: data.map((d) => d.label),
                            datasets: [
                              { data: data.map((d) => Number((d.avgDurationMs / 1000).toFixed(0))), color: () => BrandColors.accent, strokeWidth: 3 },
                            ],
                            legend: ['소요시간(초)'],
                          }}
                          width={Math.max(300, data.length * 80)}
                          height={180}
                          yAxisSuffix="초"
                          fromZero
                          yAxisInterval={1}
                          chartConfig={{
                            backgroundColor: '#fff',
                            backgroundGradientFrom: '#fff',
                            backgroundGradientTo: '#fff',
                            decimalPlaces: 0,
                            color: (opacity = 1) => `rgba(51, 51, 51, ${opacity})`,
                            labelColor: (opacity = 1) => `rgba(51, 51, 51, ${opacity})`,
                            propsForDots: { r: '4', fill: BrandColors.accent },
                            propsForBackgroundLines: { stroke: BrandColors.border, strokeWidth: 0.5 },
                          }}
                          style={{ marginVertical: 4, borderRadius: 12 }}
                          renderDotContent={renderDotLabel(BrandColors.accent, '초')}
                        />
                      </View>
                    </View>
                  </ScrollView>
                )}
              </View>

            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

function formatDuration(ms: number) {
  if (!ms || Number.isNaN(ms)) return '0초';
  const seconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(seconds / 60);
  const remain = seconds % 60;
  if (minutes === 0) return `${remain}초`;
  return `${minutes}분 ${remain}초`;
}

const METRIC_LEVEL_COLORS: Record<MetricLevel, { border: string; background: string; text: string }> = {
  normal: { border: '#7DC37D', background: '#F1FFF1', text: '#1B5E20' },
  warning: { border: '#FFC773', background: '#FFF7E6', text: '#8B5E00' },
  risk: { border: '#FF9F9F', background: '#FFF0F0', text: '#B71C1C' },
};

const OVERALL_COLORS = {
  normal: { border: '#7DC37D', background: '#F1FFF1', text: '#1B5E20' },
  warning: { border: '#FFC773', background: '#FFF7E6', text: '#8B5E00' },
  risk: { border: '#FF9F9F', background: '#FFF0F0', text: '#B71C1C' },
  critical: { border: '#D32F2F', background: '#FFE8E8', text: '#9A1B1B' },
} as const;

const SUMMARY_CAUTION_MESSAGE = '이 결과는 참고용이에요. 비슷한 조건에서 반복 측정하면 변화를 더 정확히 볼 수 있습니다.';

const PHOTO_METRIC_DETAILS: Array<{ key: keyof SpeechMetrics; label: string; format?: (v: number) => string }> = [
  { key: 'speechRateWpm', label: '말 속도', format: (v) => `${v} wpm` },
  { key: 'meanPauseDurationSec', label: '말 사이 쉬는 시간', format: (v) => `${v}초` },
  { key: 'mlu', label: '한 문장 길이', format: (v) => `${v} 단어` },
  { key: 'totalWords', label: '총 단어 수', format: (v) => `${v}단어` },
];

function MetricsSummaryView({
  summary,
  compact,
  title,
}: {
  summary: SpeechMetricsSummary;
  compact?: boolean;
  title?: string;
}) {
  const colors = OVERALL_COLORS[summary.overallLevel];
  const headerTitle = title ?? (compact ? '기록 요약' : '이번 측정 요약');
  return (
    <View style={{ gap: 10 }}>
      <View
        style={{
          borderRadius: 18,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.background,
          padding: 16,
          gap: 6,
        }}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>{headerTitle}</Text>
        <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>{summary.overallText}</Text>
      </View>
      {!compact ? <Text style={{ color: BrandColors.textSecondary, fontSize: 13 }}>{SUMMARY_CAUTION_MESSAGE}</Text> : null}
      <View style={{ gap: 8 }}>
        {summary.coreSummaries.map((item) => (
          <MetricStatusCard
            key={item.key}
            label={item.label}
            statusText={item.statusText}
            helperText={item.helperText}
            level={item.level}
          />
        ))}
      </View>
      {summary.suggestions.length > 0 ? (
        <View style={{ gap: 4 }}>
          {summary.suggestions.map((suggestion, index) => (
            <Text key={index} style={{ color: BrandColors.textSecondary, fontSize: 13 }}>
              • {suggestion}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function TrendSummaryView({ summary, title }: { summary: SpeechMetricsChangeSummary; title?: string }) {
  const colors = OVERALL_COLORS[summary.overallLevel];
  const headerTitle = title ?? '최근 변화';
  return (
    <View style={{ gap: 10 }}>
      <View
        style={{
          borderRadius: 18,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.background,
          padding: 16,
          gap: 6,
        }}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>{headerTitle}</Text>
        <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>{summary.overallText}</Text>
      </View>
      <View style={{ gap: 8 }}>
        {summary.details.map((detail) => {
          const detailColors = METRIC_LEVEL_COLORS[detail.level];
          return (
            <View
              key={`trend-${detail.key}`}
              style={{
                borderRadius: 16,
                borderWidth: 1,
                borderColor: detailColors.border,
                backgroundColor: detailColors.background,
                padding: 12,
                gap: 6,
              }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: detailColors.text }}>{detail.label}</Text>
                <Text style={{ color: detailColors.text, fontSize: 12 }}>{detail.changePercent.toFixed(1)}%</Text>
              </View>
              <Text style={{ color: detailColors.text }}>{detail.message}</Text>
            </View>
          );
        })}
      </View>
      <View
        style={{
          borderRadius: 16,
          borderWidth: 1,
          borderColor: BrandColors.border,
          backgroundColor: BrandColors.surface,
          padding: 14,
          gap: 10,
        }}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: BrandColors.textPrimary }}>변화량 세부 지표</Text>
        {summary.details.map((detail) => (
          <View
            key={`trend-detail-${detail.key}`}
            style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: BrandColors.textSecondary }}>{detail.label}</Text>
            <Text style={{ fontWeight: '700', color: BrandColors.textPrimary }}>
              {detail.baselineValue.toFixed(1)} → {detail.currentValue.toFixed(1)}
            </Text>
          </View>
        ))}
      </View>
      {summary.totalWordsFlag ? (
        <Text style={{ color: BrandColors.textSecondary, fontSize: 13 }}>{summary.totalWordsFlag}</Text>
      ) : null}
    </View>
  );
}

function MetricStatusCard({
  label,
  statusText,
  helperText,
  level,
}: {
  label: string;
  statusText: string;
  helperText: string;
  level: MetricLevel;
}) {
  const colors = METRIC_LEVEL_COLORS[level];
  return (
    <View
      style={{
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.background,
        padding: 12,
        gap: 4,
      }}>
      <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text }}>{label}</Text>
      <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>{statusText}</Text>
      <Text style={{ color: colors.text, fontSize: 12 }}>{helperText}</Text>
    </View>
  );
}

function TabButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        paddingVertical: 10,
        borderRadius: 999,
        backgroundColor: active ? BrandColors.primary : 'transparent',
        alignItems: 'center',
      }}>
      <Text style={{ color: active ? '#fff' : BrandColors.textSecondary, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}

function buildEntriesFromLocal(notes: PhotoNote[]): PhotoMetricsEntry[] {
  const entries: PhotoMetricsEntry[] = [];
  notes.forEach((note) => {
    if (!note.metrics) return;
    const summary = summarizeSpeechMetrics(note.metrics);
    if (!summary) return;
    entries.push({
      id: note.id,
      updatedAt: note.updatedAt,
      description: note.description,
      summary,
      metrics: note.metrics,
      trendEnabled: false,
    });
  });
  return enrichPhotoEntries(entries);
}

function enrichPhotoEntries(entries: PhotoMetricsEntry[]): PhotoMetricsEntry[] {
  const chronological = [...entries].sort((a, b) => a.updatedAt - b.updatedAt);
  const baselineMetrics = chronological[0]?.metrics;
  const flags = new Map<string, boolean>();
  chronological.forEach((entry, index) => {
    flags.set(entry.id, index >= 3);
  });
  const sorted = [...entries].sort((a, b) => b.updatedAt - a.updatedAt);
  return sorted.map((entry) => {
    const trendEnabled = (flags.get(entry.id) ?? false) && Boolean(baselineMetrics);
    return {
      ...entry,
      trendEnabled,
      trendSummary:
        trendEnabled && baselineMetrics && entry.metrics
          ? evaluateSpeechMetricsChange(baselineMetrics, entry.metrics)
          : undefined,
    };
  });
}
