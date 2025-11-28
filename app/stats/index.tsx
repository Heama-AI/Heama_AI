import { BrandColors, Shadows } from '@/constants/theme';
import { useRiskPrediction } from '@/lib/analysis/riskModel';
import {
  evaluateSpeechMetricsChange,
  summarizeSpeechMetrics,
  type MetricLevel,
  type SpeechMetricsChangeSummary,
  type SpeechMetricsSummary,
} from '@/lib/analysis/speechMetrics';
import type { GameKind, GameResult } from '@/lib/storage/gameStatsStorage';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { summarizeGameResults, useGameStatsStore } from '@/store/gameStatsStore';
import { usePhotoNotesStore } from '@/store/photoNotesStore';
import { useRecordsStore } from '@/store/recordsStore';
import type { PhotoNote } from '@/types/photoNote';
import type { SpeechMetrics } from '@/types/speech';
import { useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Alert, Modal, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

interface DailyDataPoint {
  label: string;
  count: number;
}

interface PhotoMetricsEntry {
  id: string;
  updatedAt: number;
  createdAt?: number;
  description: string;
  kind: 'photo' | 'script';
  scriptPrompt?: string | null;
  scriptMatchCount?: number | null;
  scriptTotalCount?: number | null;
  summary: SpeechMetricsSummary;
  metrics?: SpeechMetrics;
  trendSummary?: SpeechMetricsChangeSummary | null;
  trendEnabled?: boolean;
  riskScore?: number | null;
}

function ensureSummary(metrics?: SpeechMetrics | null): SpeechMetricsSummary {
  const fallback: SpeechMetricsSummary = {
    overallLevel: 'normal',
    overallText: '지표가 충분하지 않습니다.',
    coreSummaries: [],
    suggestions: [],
    totalWords: metrics?.totalWords ?? 0,
  };
  if (!metrics) return fallback;
  const summary = summarizeSpeechMetrics(metrics);
  return summary ?? fallback;
}

interface ConversationSummary {
  total: number;
  averageMood: number;
  lastConversation?: string;
}

interface ParticipationMetrics {
  weeklyCount: number;
  weeklyTrend: number;
  averageDuration: number;
}

interface LanguageMetrics {
  averageWordsPerUtterance: number;
  estimatedWpm: number;
  topKeywords: string[];
}

function getRiskColors(score: number | null | undefined) {
  if (score == null) {
    return {
      bg: BrandColors.surfaceSoft,
      border: BrandColors.border,
      text: BrandColors.textSecondary,
      pillBg: BrandColors.surface,
    };
  }
  if (score < 30) {
    return {
      bg: '#E3F6E9', // 진초록
      border: '#5DC68A',
      text: '#0F5132',
      pillBg: '#C8F0D8',
    };
  }
  if (score < 40) {
    return {
      bg: '#E7F9DC', // 초록
      border: '#9FE37A',
      text: '#2F7A2F',
      pillBg: '#D1F1B7',
    };
  }
  if (score < 50) {
    return {
      bg: '#FFF7D1', // 노랑
      border: '#FFE08A',
      text: '#8A6A00',
      pillBg: '#FFEDAA',
    };
  }
  if (score < 60) {
    return {
      bg: '#FFE7CC', // 주황
      border: '#FFC078',
      text: '#C25B00',
      pillBg: '#FFD8A8',
    };
  }
  if (score < 70) {
    return {
      bg: '#FFD8D8', // 연한 빨강
      border: '#FFA8A8',
      text: '#C92A2A',
      pillBg: '#FFC2C2',
    };
  }
  return {
    bg: '#FFE0E0', // 빨강
    border: '#fb6c6cff',
    text: '#4e1212ff',
    pillBg: '#fb6c6cff',
  };
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
  const { tab: initialTabParam } = useLocalSearchParams<{ tab?: string }>();
  const { records } = useRecordsStore();
  const photoNotes = usePhotoNotesStore((state) => state.notes);
  const hydratePhotoNotes = usePhotoNotesStore((state) => state.hydrate);
  const photoNotesHydrated = usePhotoNotesStore((state) => state.hasHydrated);
  const mergeRemotePhotoNotes = usePhotoNotesStore((state) => state.mergeRemoteNotes);
  const updateRiskScore = usePhotoNotesStore((state) => state.updateRiskScore);
  const userId = useAuthStore((state) => state.userId);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const stackSummaryCards = width < 520;
  const [activeTab, setActiveTab] = useState<'conversation' | 'game' | 'photo' | 'script'>(
    initialTabParam === 'game' || initialTabParam === 'photo' || initialTabParam === 'script' || initialTabParam === 'conversation'
      ? (initialTabParam as 'conversation' | 'game' | 'photo' | 'script')
      : 'photo',
  );
  const [photoMetricsLoading, setPhotoMetricsLoading] = useState(true);
  const [photoMetricsError, setPhotoMetricsError] = useState<string | null>(null);
  const [riskLoadingId, setRiskLoadingId] = useState<string | null>(null);
  const [riskToast, setRiskToast] = useState<{ visible: boolean; score: number | null }>({
    visible: false,
    score: null,
  });
  const riskToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hydrateGameStats = useGameStatsStore((state) => state.hydrate);
  const gameStatsHydrated = useGameStatsStore((state) => state.hasHydrated);
  const gameResults = useGameStatsStore((state) => state.results);
  const [graphKind, setGraphKind] = useState<GameKind | null>(null);

  useEffect(() => {
    if (!gameStatsHydrated) {
      void hydrateGameStats();
    }
    if (!photoNotesHydrated) {
      void hydratePhotoNotes();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameStatsHydrated, photoNotesHydrated]);

  useEffect(() => {
    return () => {
      if (riskToastTimer.current) {
        clearTimeout(riskToastTimer.current);
      }
    };
  }, []);

  const { summary, dailyTrend, participation, language } = useMemo(() => {
    if (records.length === 0) {
      const emptyDays = getLastNDays(7).map((date) => ({
        label: `${date.getMonth() + 1}/${date.getDate()}`,
        count: 0,
      }));

      return {
        summary: {
          total: 0,
          averageMood: 0,
          lastConversation: undefined as string | undefined,
        },
        dailyTrend: emptyDays,
        participation: {
          weeklyCount: 0,
          weeklyTrend: 0,
          averageDuration: 0,
          userSpeechRatio: 0,
        },
        language: {
          averageWordsPerUtterance: 0,
          topKeywords: [],
        },
      };
    }

    const total = records.length;
    const averageMood = Math.round(records.reduce((acc, record) => acc + record.stats.moodScore, 0) / total);

    const lastConversation = records[0]?.summary;

    const days = getLastNDays(7);
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const previousWeekStart = sevenDaysAgo - 7 * 24 * 60 * 60 * 1000;
    let lastWeekCount = 0;
    let previousWeekCount = 0;
    let durationSum = 0;
    let userTurnsSum = 0;
    let userWordSum = 0;
    let userMessageCount = 0;
    const keywordCounts = new Map<string, number>();

    records.forEach((record) => {
      const dayKey = formatDayKey(new Date(record.createdAt));
      if (record.createdAt >= sevenDaysAgo) {
        lastWeekCount += 1;
      } else if (record.createdAt < sevenDaysAgo && record.createdAt >= previousWeekStart) {
        previousWeekCount += 1;
      }
      durationSum += record.stats.durationMinutes ?? 0;
      userTurnsSum += record.stats.userTurns ?? 0;
      // 언어량: 사용자 발화 단어 수 집계
      if (Array.isArray(record.messages)) {
        for (const message of record.messages) {
          if (message.role === 'user' && typeof message.text === 'string') {
            const words = message.text.trim().split(/\s+/).filter(Boolean).length;
            userWordSum += words;
            userMessageCount += 1;
          }
        }
      }
      // 키워드 집계
      if (Array.isArray(record.keywords)) {
        for (const kw of record.keywords) {
          if (!kw) continue;
          const normalized = kw.toString().trim();
          if (!normalized) continue;
          keywordCounts.set(normalized, (keywordCounts.get(normalized) ?? 0) + 1);
        }
      }
    });

    const weeklyTrend =
      previousWeekCount === 0
        ? lastWeekCount > 0
          ? 100
          : 0
        : ((lastWeekCount - previousWeekCount) / previousWeekCount) * 100;

    const averageDuration =
      total === 0 ? 0 : Math.round(durationSum / total);
    const averageWordsPerUtterance =
      userMessageCount === 0 ? 0 : Math.round((userWordSum / userMessageCount) * 10) / 10;
    const estimatedWpm =
      durationSum <= 0 ? 0 : Math.round(userWordSum / Math.max(durationSum, 1e-6));
    const topKeywords = [...keywordCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([kw]) => kw);

    return {
      summary: {
        total,
        averageMood,
        lastConversation,
      },
      dailyTrend: [],
      participation: {
        weeklyCount: lastWeekCount,
        weeklyTrend: Math.round(weeklyTrend),
        averageDuration,
      },
      language: {
        averageWordsPerUtterance,
        estimatedWpm,
        topKeywords,
      },
    };
  }, [records]);

  useEffect(() => {
    let cancelled = false;
    async function loadPhotoMetrics() {
      setPhotoMetricsLoading(true);
      setPhotoMetricsError(null);
      try {
        if (__DEV__) {
          const currentNotes = usePhotoNotesStore.getState().notes;
          console.log('[stats] loadPhotoMetrics start', { userId, localCount: currentNotes.length });
        }
        if (!userId || !supabase?.from) {
          if (!cancelled) {
            setPhotoMetricsLoading(false);
          }
          return;
        }
        const { data, error } = await supabase
          .from('photo_notes')
          .select(
            'id, description, transcript, metrics, risk_score, updated_at, recorded_at, kind, script_prompt, script_match_count, script_total_count',
          )
          .eq('user_id', userId)
          .order('recorded_at', { ascending: false });
        if (__DEV__) {
          console.log('[stats] supabase photo_notes', {
            len: data?.length ?? 0,
            error: error?.message,
          });
        }
        if (error) {
          throw new Error(error.message);
        }
        const remoteNotes: PhotoNote[] = [];
        for (const row of data ?? []) {
          const kind = row.kind === 'script' ? 'script' : 'photo';
          const createdAt = row.recorded_at ? new Date(row.recorded_at).getTime() : Date.now();
          const updatedAt = row.updated_at ? new Date(row.updated_at).getTime() : createdAt;
          remoteNotes.push({
            id: row.id,
            imageId: row.id, // 서버에는 이미지 파일이 없어 placeholder
            description: row.description ?? '',
            transcript: row.transcript ?? undefined,
            metrics: (row.metrics ?? undefined) as SpeechMetrics | undefined,
            riskScore: typeof row.risk_score === 'number' ? row.risk_score : null,
            kind,
            scriptPrompt: row.script_prompt ?? undefined,
            scriptMatchCount: row.script_match_count ?? undefined,
            scriptTotalCount: row.script_total_count ?? undefined,
            createdAt,
            updatedAt,
          });
        }
        if (!cancelled && remoteNotes.length) {
          await mergeRemotePhotoNotes(remoteNotes);
        }
      } catch (error) {
        if (!cancelled) {
          if (__DEV__) {
            console.warn('[stats] loadPhotoMetrics error', error);
          }
          setPhotoMetricsError(
            error instanceof Error ? error.message : '사진 설명 지표를 불러오지 못했습니다.',
          );
        }
      } finally {
        if (!cancelled) {
          setPhotoMetricsLoading(false);
        }
      }
    }
    void loadPhotoMetrics();
    return () => {
      cancelled = true;
    };
  }, [mergeRemotePhotoNotes, userId]);

  useEffect(() => {
    if (!initialTabParam) return;
    if (initialTabParam === 'conversation' || initialTabParam === 'game' || initialTabParam === 'photo' || initialTabParam === 'script') {
      setActiveTab(initialTabParam);
    }
  }, [initialTabParam]);

  const photoMetrics = useMemo(() => {
    const mergedEntries = enrichPhotoEntries(buildEntriesFromLocal(photoNotes));
    return { entries: mergedEntries, total: mergedEntries.length };
  }, [photoNotes]);
  const riskModel = useRiskPrediction();
  const showRiskToast = useCallback((score: number) => {
    if (riskToastTimer.current) {
      clearTimeout(riskToastTimer.current);
    }
    setRiskToast({ visible: true, score });
    riskToastTimer.current = setTimeout(() => {
      setRiskToast({ visible: false, score: null });
    }, 1800);
  }, []);

  const handleRiskPrediction = useCallback(
    async (entry: PhotoMetricsEntry) => {
      if (!entry.metrics) {
        Alert.alert('계산 불가', '음성 지표가 없는 기록입니다.');
        return;
      }
      if (!riskModel.isReady) {
        Alert.alert('모델 준비 중', '위험도 모델을 불러오는 중입니다. 잠시 후 다시 시도해주세요.');
        return;
      }
      try {
        setRiskLoadingId(entry.id);
        const predicted = riskModel.predict(entry.metrics);
        if (typeof predicted !== 'number' || Number.isNaN(predicted)) {
          Alert.alert('계산 실패', '위험도 예측 결과가 올바르지 않습니다.');
          return;
        }
        const riskScore = Math.round(Math.max(0, Math.min(1, predicted)) * 100);
        console.log('[RiskModel] predicted risk', { entryId: entry.id, riskScore });
        await updateRiskScore(entry.id, riskScore);
        showRiskToast(riskScore);
      } catch (error) {
        console.error('위험도 예측 실패', error);
        Alert.alert('계산 실패', '위험도 예측 중 오류가 발생했습니다.');
      } finally {
        setRiskLoadingId(null);
      }
    },
    [riskModel, showRiskToast, updateRiskScore],
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
          최근 기록을 기반으로 활동과 주요 지표를 확인하세요.
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
        <TabButton label="사진 설명" active={activeTab === 'photo'} onPress={() => setActiveTab('photo')} />
        <TabButton label="지시문 읽기" active={activeTab === 'script'} onPress={() => setActiveTab('script')} />
        <TabButton label="게임 통계" active={activeTab === 'game'} onPress={() => setActiveTab('game')} />
        <TabButton label="대화 통계" active={activeTab === 'conversation'} onPress={() => setActiveTab('conversation')} />
      </View>

      {activeTab === 'conversation' ? (
        <ConversationStatsSection
          summary={summary}
          dailyTrend={dailyTrend}
          stackSummaryCards={stackSummaryCards}
          participation={participation}
          language={language}
        />
      ) : activeTab === 'game' ? (
        <GameStatsSection
          results={gameResults}
          stackSummaryCards={stackSummaryCards}
          onOpenGraph={setGraphKind}
        />
      ) : activeTab === 'photo' ? (
        <PhotoMetricsSection
          photoMetrics={photoMetrics}
          filterKind="photo"
          loading={photoMetricsLoading}
          error={photoMetricsError}
          onCalculateRisk={handleRiskPrediction}
          riskLoadingId={riskLoadingId}
        />
      ) : (
        <PhotoMetricsSection
          photoMetrics={photoMetrics}
          filterKind="script"
          loading={photoMetricsLoading}
          error={photoMetricsError}
          onCalculateRisk={handleRiskPrediction}
          riskLoadingId={riskLoadingId}
        />
      )}
      <GameGraphModal
        visible={graphKind !== null}
        onClose={() => setGraphKind(null)}
        kind={graphKind}
        data={graphKind ? buildGameRunSeries(gameResults, graphKind) : []}
      />
      <Modal visible={riskToast.visible} transparent animationType="fade">
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.35)',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}>
          <View
            style={{
              width: '100%',
              maxWidth: 380,
              backgroundColor: BrandColors.surface,
              borderRadius: 26,
              padding: 26,
              gap: 12,
              borderWidth: 1,
              borderColor: BrandColors.border,
              ...Shadows.card,
            }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: BrandColors.textSecondary, textAlign: 'center' }}>
              계산 완료
            </Text>
            <Text style={{ fontSize: 46, fontWeight: '900', color: BrandColors.primary, textAlign: 'center' }}>
              {riskToast.score ?? 0}%
            </Text>
            <Text style={{ color: BrandColors.textSecondary, textAlign: 'center', lineHeight: 20 }}>
              방금 계산된 위험도예요! 꾸준히 기록해 주세요.
            </Text>
          </View>
        </View>
      </Modal>
      </ScrollView>
    </SafeAreaView>
  );
}

function ConversationStatsSection({
  summary,
  dailyTrend,
  stackSummaryCards,
  participation,
  language,
}: {
  summary: ConversationSummary;
  dailyTrend: DailyDataPoint[];
  stackSummaryCards: boolean;
  participation: ParticipationMetrics;
  language: LanguageMetrics;
}) {
  return (
    <View style={{ gap: 20 }}>
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

      <View
        style={{
          backgroundColor: BrandColors.surface,
          borderRadius: 22,
          padding: 20,
          gap: 14,
          borderWidth: 1,
          borderColor: BrandColors.border,
          ...Shadows.card,
        }}>
        <Text style={{ fontSize: 18, fontWeight: '700', color: BrandColors.textPrimary }}>참여도</Text>
        <View style={{ flexDirection: stackSummaryCards ? 'column' : 'row', gap: 12 }}>
          <SummaryCard
            label="최근 7일 대화"
            value={`${participation.weeklyCount}회`}
            accent={BrandColors.primary}
            style={stackSummaryCards ? { width: '100%' } : undefined}
          />
          <SummaryCard
            label="평균 세션 길이"
            value={`${participation.averageDuration}분`}
            accent={BrandColors.accent}
            style={stackSummaryCards ? { width: '100%' } : undefined}
          />
          <SummaryCard
            label="추정 말 속도"
            value={`${language.estimatedWpm} wpm`}
            accent={BrandColors.primaryDark}
            style={stackSummaryCards ? { width: '100%' } : undefined}
          />
        </View>
        <Text style={{ color: BrandColors.textSecondary, fontSize: 13 }}>
          지난주 대비 변화율: {participation.weeklyTrend >= 0 ? '+' : ''}
          {participation.weeklyTrend}% (비슷한 조건에서 대화를 이어가 보세요)
        </Text>
      </View>

      <View
        style={{
          backgroundColor: BrandColors.surface,
          borderRadius: 22,
          padding: 20,
          gap: 14,
          borderWidth: 1,
          borderColor: BrandColors.border,
          ...Shadows.card,
        }}>
        <Text style={{ fontSize: 18, fontWeight: '700', color: BrandColors.textPrimary }}>언어량</Text>
        <View style={{ flexDirection: stackSummaryCards ? 'column' : 'row', gap: 12 }}>
          <SummaryCard
            label="평균 발화 길이"
            value={`${language.averageWordsPerUtterance}단어`}
            accent={BrandColors.primary}
            style={stackSummaryCards ? { width: '100%' } : undefined}
          />
          <SummaryCard
            label="상위 키워드"
            value={language.topKeywords.length > 0 ? language.topKeywords.join(', ') : '없음'}
            accent={BrandColors.textSecondary}
            style={stackSummaryCards ? { width: '100%' } : undefined}
          />
        </View>
        <Text style={{ color: BrandColors.textSecondary, fontSize: 13 }}>
          발화 길이는 사용자 메시지 기준입니다. 키워드는 최근 대화에서 많이 언급된 단어를 집계했습니다.
        </Text>
      </View>
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
  filterKind,
  loading,
  error,
  onCalculateRisk,
  riskLoadingId,
}: {
  photoMetrics: { entries: PhotoMetricsEntry[]; total: number };
  filterKind: 'photo' | 'script';
  loading: boolean;
  error: string | null;
  onCalculateRisk: (entry: PhotoMetricsEntry) => Promise<void>;
  riskLoadingId: string | null;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showTrend, setShowTrend] = useState(false);

  const activeEntries = useMemo(
    () => photoMetrics.entries.filter((entry) => entry.kind === filterKind),
    [filterKind, photoMetrics.entries],
  );
  const total = activeEntries.length;

  useEffect(() => {
    setSelectedId((prev) => {
      if (!activeEntries.length) return null;
      if (prev && activeEntries.some((entry) => entry.id === prev)) {
        return prev;
      }
      return activeEntries[0]?.id ?? null;
    });
  }, [activeEntries]);

  const activeEntry = selectedId
    ? activeEntries.find((entry) => entry.id === selectedId) ?? activeEntries[0]
    : activeEntries[0];

  const speechTrend = useMemo(() => {
    const chronological = activeEntries
      .filter((entry) => entry.metrics)
      .sort((a, b) => a.updatedAt - b.updatedAt)
      .map((entry) => ({
        label: new Date(entry.updatedAt).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' }),
        wpm: entry.metrics?.speechRateWpm ? Number(entry.metrics.speechRateWpm.toFixed(0)) : 0,
        pauseSec: entry.metrics?.meanPauseDurationSec ? Number(entry.metrics.meanPauseDurationSec.toFixed(1)) : 0,
        mlu: entry.metrics?.mlu ? Number(entry.metrics.mlu.toFixed(1)) : 0,
        pausePerMin: entry.metrics?.pausesPerMinute ? Number(entry.metrics.pausesPerMinute.toFixed(1)) : 0,
        ttr: entry.metrics?.ttr ? Number(entry.metrics.ttr.toFixed(2)) : 0,
        totalWords: entry.metrics?.totalWords ? Number(entry.metrics.totalWords) : 0,
      }));
    return {
      points: chronological,
      enabled: chronological.length >= 2,
    };
  }, [activeEntries]);
  return (
    <View style={{ gap: 20 }}>
      <View style={{ gap: 6 }}>
        <Text style={{ fontSize: 18, fontWeight: '700', color: BrandColors.textPrimary }}>
          {filterKind === 'script' ? '지시문 읽기 지표' : '사진 설명 지표'}
        </Text>
        <Text style={{ color: BrandColors.textSecondary, lineHeight: 20 }}>
          {filterKind === 'script'
            ? '날짜/회차별 지시문 정확도와 음성 추출 문장을 함께 확인할 수 있습니다.'
            : '날짜/회차별 사진 설명 지표와 음성 추출 문장을 함께 확인할 수 있습니다.'}
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
        <Text style={{ fontSize: 28, fontWeight: '800', color: BrandColors.primary }}>{total}회</Text>
        <Text style={{ color: BrandColors.textSecondary }}>
          한 달에 한 번 이상 기록하면 추세를 더 정확히 볼 수 있어요.
        </Text>
        <Text style={{ color: BrandColors.textPrimary, fontWeight: '700' }}>
          {speechTrend.enabled ? '탭해서 말하기 추이 보기' : '2회 이상 기록 시 추이 확인 가능'}
        </Text>
      </Pressable>

      {loading ? (
        <Text style={{ color: BrandColors.textSecondary }}>지표를 불러오는 중이에요…</Text>
      ) : error ? (
        <Text style={{ color: BrandColors.textSecondary }}>{error}</Text>
      ) : total === 0 ? (
        <Text style={{ color: BrandColors.textSecondary }}>
          아직 데이터가 없습니다. {filterKind === 'script' ? '지시문 읽어보기에서' : '포토 노트에서'} 음성을 기록하면 이곳에서 요약을 볼 수 있어요.
        </Text>
      ) : (
        <View style={{ gap: 16 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
            {activeEntries.map((entry, index) => {
              const isActive = entry.id === activeEntry?.id;
              const runNumber = activeEntries.length - index;
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
                      fontWeight: '700',
                    }}>
                    {runNumber}회차 ·{' '}
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
            <PhotoMetricsCard
              entry={activeEntry}
              baselineRequiredCount={4}
              onCalculateRisk={onCalculateRisk}
              calculating={riskLoadingId === activeEntry.id}
            />
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
  onCalculateRisk,
  calculating,
}: {
  entry: PhotoMetricsEntry;
  compact?: boolean;
  baselineRequiredCount: number;
  onCalculateRisk: (entry: PhotoMetricsEntry) => Promise<void>;
  calculating: boolean;
}) {
  const hasScore = entry.riskScore != null;
  const riskColors = getRiskColors(entry.riskScore ?? null);
  return (
    <View style={{ gap: 14 }}>
      <Text style={{ fontSize: 13, color: BrandColors.textSecondary }}>
        {new Date(entry.createdAt ?? entry.updatedAt).toLocaleString('ko-KR', {
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })}
      </Text>

      <View
        style={{
          borderRadius: 22,
          borderWidth: 1,
          borderColor: riskColors.border,
          backgroundColor: riskColors.bg,
          padding: 18,
          gap: 14,
          ...Shadows.card,
        }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: 15, fontWeight: '800', color: hasScore ? BrandColors.textPrimary : BrandColors.textSecondary }}>
            위험도 예측
          </Text>
          <Text style={{ color: hasScore ? BrandColors.textSecondary : BrandColors.textSecondary, fontSize: 12 }}>
            TFLite 기반
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View
            style={{
              width: 96,
              height: 96,
              borderRadius: 999,
              backgroundColor: riskColors.pillBg,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: riskColors.border,
              ...Shadows.card,
            }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: riskColors.text }}>RISK</Text>
            <Text style={{ fontSize: 32, fontWeight: '900', color: riskColors.text }}>
              {entry.riskScore != null ? `${entry.riskScore}%` : '--'}
            </Text>
          </View>
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={{ color: hasScore ? BrandColors.textPrimary : BrandColors.textSecondary, fontSize: 16, fontWeight: '700' }}>
              {hasScore ? '최근 계산된 위험도' : '아직 계산되지 않았습니다.'}
            </Text>
            <Text style={{ color: BrandColors.textSecondary, lineHeight: 20 }}>
              건강 추적에 핵심이 되는 지표예요. 계산 버튼을 눌러 최신 값을 확인해 주세요.
            </Text>
          </View>
        </View>
        <Pressable
          onPress={() => onCalculateRisk(entry)}
          disabled={calculating || !entry.metrics}
          style={{
            marginTop: 4,
            paddingVertical: 14,
            borderRadius: 14,
            alignItems: 'center',
            backgroundColor: calculating ? riskColors.pillBg : riskColors.pillBg,
            opacity: entry.metrics ? 1 : 0.6,
            borderWidth: 1,
            borderColor: calculating ? riskColors.border : riskColors.border,
          }}>
            <Text
              style={{
                color: riskColors.text,
                fontWeight: '800',
                fontSize: 15,
                letterSpacing: 0.3,
              }}>
            {entry.metrics
              ? calculating
                ? '위험도 계산 중...'
                : hasScore
                ? '위험도 다시 계산'
                : '위험도 계산하기'
              : '지표 없음'}
          </Text>
        </Pressable>
      </View>
      <MetricsSummaryView summary={entry.summary} compact={compact} title="이번 녹음 평가" />

      {entry.kind === 'script' && entry.scriptTotalCount ? (
        <View
          style={{
            borderRadius: 16,
            borderWidth: 1,
            borderColor: BrandColors.border,
            backgroundColor: BrandColors.surfaceSoft,
            padding: 12,
            gap: 8,
          }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: BrandColors.textPrimary }}>지시문 정확도</Text>
          <Text style={{ fontSize: 22, fontWeight: '800', color: BrandColors.primary }}>
            {Math.round(((entry.scriptMatchCount ?? 0) / (entry.scriptTotalCount || 1)) * 100)}%
          </Text>
          <Text style={{ color: BrandColors.textSecondary }}>
            {entry.scriptMatchCount ?? 0}/{entry.scriptTotalCount ?? 0} 단어 일치
          </Text>
          {entry.scriptPrompt ? (
            <Text style={{ color: BrandColors.textSecondary, fontSize: 12 }}>
              지시문 발췌: {entry.scriptPrompt.slice(0, 60)}...
            </Text>
          ) : null}
        </View>
      ) : null}

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

      <View
        style={{
          borderRadius: 16,
          borderWidth: 1,
          borderColor: BrandColors.border,
          backgroundColor: BrandColors.surface,
          padding: 16,
          gap: 8,
        }}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: BrandColors.textPrimary }}>
          말한 내용 (음성 추출)
        </Text>
        <Text style={{ color: BrandColors.textSecondary, lineHeight: 20 }}>
          {entry.description || '대본이 없습니다.'}
        </Text>
      </View>
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
  points: Array<{ label: string; wpm: number; pauseSec: number; mlu: number; totalWords: number }>;
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
                {[
                  { title: '말 속도', key: 'wpm', color: BrandColors.primary, suffix: ' wpm', decimals: 0 },
                  { title: '말 사이 쉼', key: 'pauseSec', color: BrandColors.accent, suffix: '초', decimals: 1 },
                  { title: '평균 문장 길이', key: 'mlu', color: BrandColors.primaryDark, suffix: ' 단어', decimals: 1 },
                  { title: '분당 쉬는 횟수', key: 'pausePerMin', color: BrandColors.secondary, suffix: '회', decimals: 1 },
                  { title: '어휘 다양도', key: 'ttr', color: BrandColors.textSecondary, suffix: '', decimals: 2 },
                  { title: '총 단어 수', key: 'totalWords', color: BrandColors.textSecondary, suffix: '단어', decimals: 0 },
                ].map((chart) => (
                  <View key={chart.key}>
                    <Text style={{ fontWeight: '700', color: BrandColors.textPrimary, marginBottom: 6 }}>{chart.title}</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <LineChart
                        data={{
                          labels: points.map((p) => p.label),
                          datasets: [
                            {
                              data: points.map((p: any) => {
                                const raw = Number(p[chart.key] ?? 0);
                                return chart.decimals === 0 ? raw : Number(raw.toFixed(chart.decimals));
                              }),
                              color: () => chart.color,
                              strokeWidth: 3,
                            },
                          ],
                          legend: [chart.title],
                        }}
                        width={Math.max(320, points.length * 80)}
                        height={200}
                        yAxisSuffix={chart.suffix}
                        fromZero
                        yAxisInterval={1}
                        chartConfig={{
                          backgroundColor: '#fff',
                          backgroundGradientFrom: '#fff',
                          backgroundGradientTo: '#fff',
                          decimalPlaces: chart.decimals,
                          color: (opacity = 1) => `rgba(51, 51, 51, ${opacity})`,
                          labelColor: (opacity = 1) => `rgba(51, 51, 51, ${opacity})`,
                          propsForDots: { r: '4', fill: chart.color },
                          propsForBackgroundLines: { stroke: BrandColors.border, strokeWidth: 0.5 },
                        }}
                        style={{ marginVertical: 4, borderRadius: 12 }}
                        renderDotContent={renderDotLabel(chart.color, chart.suffix.trim())}
                      />
                    </ScrollView>
                  </View>
                ))}
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
  { key: 'pausesPerMinute', label: '분당 쉬는 횟수', format: (v) => `${v}회` },
  { key: 'mlu', label: '한 문장 길이', format: (v) => `${v} 단어` },
  { key: 'ttr', label: '어휘 다양도', format: (v) => `${v}` },
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
    const summary = ensureSummary(note.metrics);
    entries.push({
      id: note.id,
      updatedAt: note.createdAt ?? note.updatedAt,
      createdAt: note.createdAt ?? note.updatedAt,
      description: note.description,
      kind: note.kind === 'script' ? 'script' : 'photo',
      scriptPrompt: note.scriptPrompt,
      scriptMatchCount: note.scriptMatchCount,
      scriptTotalCount: note.scriptTotalCount,
      summary: summary as SpeechMetricsSummary,
      metrics: note.metrics,
      riskScore: note.riskScore ?? null,
      trendEnabled: false,
    });
  });
  return enrichPhotoEntries(entries);
}

function enrichPhotoEntries(entries: PhotoMetricsEntry[]): PhotoMetricsEntry[] {
  const chronological = [...entries].sort((a, b) => (a.createdAt ?? a.updatedAt) - (b.createdAt ?? b.updatedAt));
  const baselineMetrics = chronological[0]?.metrics;
  const flags = new Map<string, boolean>();
  chronological.forEach((entry, index) => {
    flags.set(entry.id, index >= 3);
  });
  const sorted = [...entries].sort((a, b) => (b.createdAt ?? b.updatedAt) - (a.createdAt ?? a.updatedAt));
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
