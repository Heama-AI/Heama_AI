import { BrandColors, Shadows } from '@/constants/theme';
import { summarizeSpeechMetrics } from '@/lib/analysis/speechMetrics';
import { usePhotoNotesStore } from '@/store/photoNotesStore';
import { router, Stack } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

type ActionCardProps = {
  title: string;
  description: string;
  onPress: () => void;
};

function getRiskColors(score: number | null) {
  if (score == null) {
    return {
      bg: BrandColors.surfaceSoft,
      border: BrandColors.border,
      text: BrandColors.textSecondary,
    };
  }
  if (score < 30) {
    return { bg: '#E3F6E9', border: '#5DC68A', text: '#0F5132' };
  }
  if (score < 40) {
    return { bg: '#E7F9DC', border: '#9FE37A', text: '#2F7A2F' };
  }
  if (score < 50) {
    return { bg: '#FFF7D1', border: '#FFE08A', text: '#8A6A00' };
  }
  if (score < 60) {
    return { bg: '#FFE7CC', border: '#FFC078', text: '#C25B00' };
  }
  if (score < 70) {
    return { bg: '#FFD8D8', border: '#FFA8A8', text: '#C92A2A' };
  }
  return { bg: '#FFE0E0', border: '#FFA8A8', text: '#C92A2A' };
}

function ActionCard({ title, description, onPress }: ActionCardProps) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        borderRadius: 22,
        padding: 20,
        borderWidth: 1,
        borderColor: BrandColors.border,
        backgroundColor: BrandColors.surface,
        gap: 8,
        ...Shadows.card,
      }}>
      <Text style={{ fontSize: 20, fontWeight: '800', color: BrandColors.textPrimary }}>{title}</Text>
      <Text style={{ color: BrandColors.textSecondary, lineHeight: 20 }}>{description}</Text>
      <View
        style={{
          marginTop: 4,
          alignSelf: 'flex-start',
          paddingHorizontal: 14,
          paddingVertical: 8,
          borderRadius: 999,
          backgroundColor: BrandColors.primarySoft,
        }}>
        <Text style={{ color: BrandColors.primaryDark, fontWeight: '700' }}>시작하기</Text>
      </View>
    </Pressable>
  );
}

export default function PredictCenter() {
  const insets = useSafeAreaInsets();
  const notes = usePhotoNotesStore((state) => state.notes);

  const latestNote = [...notes]
    .filter((note) => note.metrics)
    .sort((a, b) => b.updatedAt - a.updatedAt)[0];
  const latestSummary = summarizeSpeechMetrics(latestNote?.metrics) ?? null;
  const latestUpdatedAt = latestNote ? new Date(latestNote.updatedAt) : null;

  const riskCandidates = [...notes]
    .filter((n) => typeof n.riskScore === 'number')
    .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
    .slice(0, 10);
  const riskSampleCount = riskCandidates.length;
  const avgRisk =
    riskSampleCount > 0
      ? Math.round(riskCandidates.reduce((acc, note) => acc + (note.riskScore ?? 0), 0) / riskSampleCount)
      : null;
  const riskColors = getRiskColors(avgRisk);
  const riskUpdatedAt =
    riskCandidates.length > 0 ? new Date(riskCandidates[0].updatedAt ?? Date.now()) : latestUpdatedAt;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BrandColors.background }} edges={['top', 'left', 'right']}>
      <Stack.Screen options={{ title: 'AI 치매 예측 센터' }} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingTop: 28,
          paddingBottom: Math.max(32, insets.bottom + 24),
          gap: 24,
        }}>
        <View style={{ gap: 8 }}>
          <Text style={{ fontSize: 32, fontWeight: '800', color: BrandColors.textPrimary }}>AI 치매 예측 센터</Text>
          <Text style={{ color: BrandColors.textSecondary, lineHeight: 22 }}>
            음성 기반 과제를 수행하면 건강 통계에서 활동 지표와 위험 신호를 확인할 수 있어요.
          </Text>
        </View>

        <Pressable
          onPress={() => router.push('/stats?tab=script')}
          style={{
            borderRadius: 24,
            padding: 20,
            borderWidth: 1,
            borderColor: BrandColors.border,
            backgroundColor: BrandColors.surface,
            gap: 12,
            ...Shadows.card,
          }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: BrandColors.textPrimary }}>최근 위험도</Text>
            <Text style={{ color: BrandColors.textSecondary, fontSize: 12 }}>
              최근 {riskSampleCount || 0}회(최대 10회) 기준
            </Text>
          </View>
          {avgRisk !== null ? (
            <View
              style={{
                gap: 10,
                padding: 14,
                borderRadius: 16,
                backgroundColor: riskColors.bg,
                borderWidth: 1,
                borderColor: riskColors.border,
                alignItems: 'center',
                alignSelf: 'center',
                width: '55%',
              }}>
              <Text style={{ fontSize: 14, color: BrandColors.textSecondary }}>평균</Text>
              <Text style={{ fontSize: 32, fontWeight: '900', color: riskColors.text }}>{avgRisk}%</Text>
            </View>
          ) : (
            <Text style={{ fontSize: 20, fontWeight: '700', color: BrandColors.textSecondary }}>
              최근 음성 과제 기록이 없어요.
            </Text>
          )}
          <Text style={{ color: BrandColors.textSecondary, lineHeight: 20 }}>
            {riskUpdatedAt
              ? `${riskUpdatedAt.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })} 업데이트`
              : '음성 기반 과제를 완료하면 결과가 표시돼요.'}
          </Text>
          <View
            style={{
              flexDirection: 'row',
              gap: 10,
              marginTop: 4,
            }}>
            <View
              style={{
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 999,
                backgroundColor: BrandColors.primarySoft,
              }}>
              <Text style={{ color: BrandColors.primaryDark, fontWeight: '700' }}>자세히 보기</Text>
            </View>
            <Text style={{ color: BrandColors.textSecondary, fontSize: 12, alignSelf: 'center' }}>
              탭하면 건강 통계로 이동
            </Text>
          </View>
        </Pressable>

        <ActionCard
          title="사진 설명하기"
          description="사진을 보며 떠오른 이야기를 들려주세요. 말 속도, 휴지 등 다양한 음성 지표를 측정합니다."
          onPress={() => router.push('/photo-note')}
        />

        <ActionCard
          title="지시문 읽어보기"
          description="준비된 짧은 지시문을 읽고 얼마나 정확하게 따라 읽었는지 확인해 보세요."
          onPress={() => router.push('/script-reading')}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
