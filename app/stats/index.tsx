import { BrandColors, Shadows } from '@/constants/theme';
import { useRecordsStore } from '@/store/recordsStore';
import { useMemo } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { VictoryAxis, VictoryBar, VictoryChart, VictoryLine, VictoryTheme } from 'victory-native';

interface DailyDataPoint {
  label: string;
  risk: number;
  count: number;
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

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: BrandColors.background }}
      contentContainerStyle={{ padding: 24, gap: 24, paddingBottom: 48 }}>
      <View style={{ gap: 6 }}>
        <Text style={{ fontSize: 30, fontWeight: '800', color: BrandColors.textPrimary }}>건강 통계</Text>
        <Text style={{ color: BrandColors.textSecondary, lineHeight: 22 }}>
          최근 대화 기록을 기반으로 활동과 위험 지수를 확인하세요.
        </Text>
      </View>

      <View style={{ flexDirection: 'row', gap: 16 }}>
        <SummaryCard label="저장된 대화" value={`${summary.total}회`} accent={BrandColors.primary} />
        <SummaryCard label="평균 위험 지수" value={`${summary.averageRisk}`} accent={BrandColors.primaryDark} />
        <SummaryCard label="평균 감정 점수" value={`${summary.averageMood}`} accent={BrandColors.accent} />
      </View>

      <View
        style={{
          backgroundColor: BrandColors.surface,
          borderRadius: 24,
          padding: 20,
          borderWidth: 1,
          borderColor: BrandColors.border,
          ...Shadows.card,
        }}>
        <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 12, color: BrandColors.textPrimary }}>
          주간 위험 지수 추이
        </Text>
        <VictoryChart
          theme={VictoryTheme.material}
          domainPadding={{ x: 20, y: 20 }}
          padding={{ top: 20, bottom: 50, left: 50, right: 20 }}
          height={240}>
          <VictoryAxis style={{ tickLabels: { fontSize: 12, fill: BrandColors.textSecondary } }} />
          <VictoryAxis
            dependentAxis
            style={{ tickLabels: { fontSize: 12, fill: BrandColors.textSecondary } }}
            tickFormat={(y) => `${y}`}
          />
          <VictoryLine
            data={dailyTrend}
            x="label"
            y="risk"
            style={{ data: { stroke: BrandColors.primary, strokeWidth: 3 } }}
            interpolation="monotoneX"
          />
        </VictoryChart>
      </View>

      <View
        style={{
          backgroundColor: BrandColors.surface,
          borderRadius: 24,
          padding: 20,
          borderWidth: 1,
          borderColor: BrandColors.border,
          ...Shadows.card,
        }}>
        <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 12, color: BrandColors.textPrimary }}>
          주간 대화 횟수
        </Text>
        <VictoryChart
          theme={VictoryTheme.material}
          domainPadding={{ x: 20 }}
          padding={{ top: 20, bottom: 50, left: 50, right: 20 }}
          height={240}>
          <VictoryAxis style={{ tickLabels: { fontSize: 12, fill: BrandColors.textSecondary } }} />
          <VictoryAxis dependentAxis style={{ tickLabels: { fontSize: 12, fill: BrandColors.textSecondary } }} />
          <VictoryBar
            data={dailyTrend}
            x="label"
            y="count"
            style={{ data: { fill: BrandColors.accent, width: 22 } }}
            cornerRadius={6}
          />
        </VictoryChart>
      </View>

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
    </ScrollView>
  );
}

function SummaryCard({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <View
      style={{
        flex: 1,
        borderRadius: 20,
        padding: 18,
        gap: 6,
        backgroundColor: BrandColors.surface,
        borderWidth: 1,
        borderColor: BrandColors.border,
        ...Shadows.card,
      }}>
      <Text style={{ color: BrandColors.textSecondary }}>{label}</Text>
      <Text style={{ fontSize: 24, fontWeight: '800', color: accent }}>{value}</Text>
    </View>
  );
}
