import CardButton from '@/components/CardButton';
import { BrandColors, Shadows } from '@/constants/theme';
import { useRecordsStore } from '@/store/recordsStore';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';

const formatDate = (timestamp: number) =>
  new Date(timestamp).toLocaleString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function Records() {
  const { records } = useRecordsStore();

  const averageRisk = useMemo(() => {
    if (records.length === 0) return 0;
    return Math.round(records.reduce((acc, record) => acc + record.stats.riskScore, 0) / records.length);
  }, [records]);

  return (
    <View style={{ flex: 1, backgroundColor: BrandColors.background }}>
      <View style={{ paddingHorizontal: 24, paddingTop: 28, paddingBottom: 16, gap: 20 }}>
        <View style={{ gap: 6 }}>
          <Text style={{ fontSize: 30, fontWeight: '800', color: BrandColors.textPrimary }}>대화 기록 보관함</Text>
          <Text style={{ color: BrandColors.textSecondary }}>
            저장된 요약과 건강 지표를 한눈에 살펴보세요.
          </Text>
        </View>

        <View
          style={{
            backgroundColor: BrandColors.surface,
            borderRadius: 26,
            padding: 22,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            ...Shadows.card,
          }}>
          <View>
            <Text style={{ fontSize: 15, color: BrandColors.textSecondary }}>총 기록</Text>
            <Text style={{ fontSize: 28, fontWeight: '800', color: BrandColors.textPrimary }}>
              {records.length}개
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 15, color: BrandColors.textSecondary }}>평균 위험 지수</Text>
            <Text style={{ fontSize: 28, fontWeight: '800', color: BrandColors.primary }}>{averageRisk}점</Text>
          </View>
        </View>
      </View>

      {records.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18, paddingHorizontal: 24 }}>
          <Text style={{ color: BrandColors.textSecondary, fontSize: 16 }}>아직 저장된 대화가 없습니다.</Text>
          <CardButton title="대화 시작하러 가기" onPress={() => router.push('/chat')} />
        </View>
      ) : (
        <FlatList
          data={records}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ gap: 16, paddingHorizontal: 24, paddingBottom: 40 }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/records/${item.id}`)}
              style={{
                backgroundColor: BrandColors.surface,
                borderRadius: 22,
                padding: 22,
                gap: 10,
                borderWidth: 1,
                borderColor: BrandColors.border,
                ...Shadows.card,
              }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 18, fontWeight: '700', color: BrandColors.textPrimary }}>{item.title}</Text>
                <Text style={{ color: BrandColors.primary, fontWeight: '700' }}>{item.stats.riskScore}점</Text>
              </View>
              <Text style={{ color: BrandColors.textSecondary, fontSize: 12 }}>{formatDate(item.createdAt)}</Text>
              <Text style={{ color: BrandColors.textPrimary, lineHeight: 20 }} numberOfLines={2}>
                {item.summary}
              </Text>
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                {item.keywords.map((keyword) => (
                  <View
                    key={keyword}
                    style={{
                      backgroundColor: BrandColors.surfaceSoft,
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 14,
                    }}>
                    <Text style={{ color: BrandColors.textSecondary, fontSize: 12 }}>#{keyword}</Text>
                  </View>
                ))}
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}
