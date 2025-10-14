import { BrandColors, Shadows } from '@/constants/theme';
import { useRecordsStore } from '@/store/recordsStore';
import { useLocalSearchParams, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

export default function RecordDetail() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const getRecord = useRecordsStore((state) => state.getRecord);
  const removeRecord = useRecordsStore((state) => state.removeRecord);
  const updateRecordTitle = useRecordsStore((state) => state.updateRecordTitle);

  const record = id ? getRecord(id) : undefined;
  const [title, setTitle] = useState(record?.title ?? '');

  useEffect(() => {
    setTitle(record?.title ?? '');
  }, [record?.title]);

  if (!record) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          gap: 16,
          backgroundColor: BrandColors.background,
        }}>
        <Text style={{ fontSize: 20, fontWeight: '700', color: BrandColors.textPrimary }}>찾을 수 없는 기록입니다.</Text>
        <Text style={{ color: BrandColors.textSecondary, textAlign: 'center', lineHeight: 20 }}>
          기록이 삭제되었거나 아직 저장되지 않았을 수 있습니다.
        </Text>
        <Pressable
          onPress={() => router.replace('/records')}
          style={{
            paddingHorizontal: 20,
            paddingVertical: 12,
            borderRadius: 16,
            backgroundColor: BrandColors.primary,
          }}>
          <Text style={{ color: '#fff', fontWeight: '600' }}>기록 목록으로 돌아가기</Text>
        </Pressable>
      </View>
    );
  }

  const handleDelete = () => {
    Alert.alert('기록 삭제', '이 기록을 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: () => {
          removeRecord(record.id);
          router.replace('/records');
        },
      },
    ]);
  };

  const handleUpdateTitle = () => {
    const trimmed = title.trim();
    if (!trimmed) {
      Alert.alert('제목', '제목은 비워둘 수 없습니다.');
      setTitle(record.title);
      return;
    }
    if (trimmed !== record.title) {
      updateRecordTitle(record.id, trimmed);
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: BrandColors.background }}
      contentContainerStyle={{ padding: 24, gap: 24, paddingBottom: 48 }}>
      <View
        style={{
          backgroundColor: BrandColors.surface,
          borderRadius: 26,
          padding: 24,
          gap: 16,
          ...Shadows.card,
        }}>
        <View style={{ gap: 10 }}>
          <TextInput
            value={title}
            onChangeText={setTitle}
            onBlur={handleUpdateTitle}
            style={{
              fontSize: 28,
              fontWeight: '800',
              color: BrandColors.textPrimary,
              paddingVertical: 6,
            }}
            placeholder="기록 제목"
            placeholderTextColor={BrandColors.textSecondary}
          />
          <Text style={{ color: BrandColors.textSecondary, fontSize: 13 }}>
            {new Date(record.createdAt).toLocaleString('ko-KR', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 12 }}>
          <StatCard label="치매 위험 지수" value={`${record.stats.riskScore}`} accent={BrandColors.primary} />
          <StatCard label="감정 점수" value={`${record.stats.moodScore}`} accent={BrandColors.accent} />
          <StatCard label="대화 횟수" value={`${record.stats.totalTurns}`} accent={BrandColors.secondary} />
        </View>
      </View>

      <View
        style={{
          backgroundColor: BrandColors.surface,
          borderRadius: 24,
          padding: 22,
          gap: 14,
          borderWidth: 1,
          borderColor: BrandColors.border,
          ...Shadows.card,
        }}>
        <Text style={{ fontSize: 20, fontWeight: '700', color: BrandColors.textPrimary }}>요약</Text>
        <Text style={{ fontSize: 16, lineHeight: 24, color: BrandColors.textSecondary }}>{record.summary}</Text>
      </View>

      <View
        style={{
          backgroundColor: BrandColors.surface,
          borderRadius: 24,
          padding: 22,
          gap: 10,
          borderWidth: 1,
          borderColor: BrandColors.border,
          ...Shadows.card,
        }}>
        <Text style={{ fontSize: 20, fontWeight: '700', color: BrandColors.textPrimary }}>핵심 메모</Text>
        {record.highlights.map((highlight) => (
          <View key={highlight} style={{ paddingVertical: 6 }}>
            <Text style={{ color: BrandColors.primary, fontWeight: '600', lineHeight: 20 }}>• {highlight}</Text>
          </View>
        ))}
      </View>

      <View style={{ gap: 8, flexDirection: 'row', flexWrap: 'wrap' }}>
        {record.keywords.map((keyword) => (
          <View
            key={keyword}
            style={{
              backgroundColor: BrandColors.surface,
              borderRadius: 16,
              paddingHorizontal: 14,
              paddingVertical: 6,
              borderWidth: 1,
              borderColor: BrandColors.border,
            }}>
            <Text style={{ color: BrandColors.textSecondary, fontSize: 13 }}>#{keyword}</Text>
          </View>
        ))}
      </View>

      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Pressable
          onPress={() => router.push({ pathname: '/games', params: { recordId: record.id } })}
          style={{
            flex: 1,
            paddingVertical: 14,
            borderRadius: 16,
            backgroundColor: BrandColors.primary,
            alignItems: 'center',
          }}>
          <Text style={{ color: '#fff', fontWeight: '600' }}>이 기록으로 게임 풀기</Text>
        </Pressable>
        <Pressable
          onPress={handleDelete}
          style={{
            flex: 1,
            paddingVertical: 14,
            borderRadius: 16,
            backgroundColor: BrandColors.surface,
            alignItems: 'center',
            borderWidth: 1,
            borderColor: BrandColors.dangerSoft,
          }}>
          <Text style={{ color: BrandColors.danger, fontWeight: '600' }}>기록 삭제</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <View
      style={{
        flex: 1,
        borderRadius: 18,
        padding: 16,
        gap: 6,
        backgroundColor: BrandColors.primarySoft,
        borderWidth: 1,
        borderColor: BrandColors.border,
        alignItems: 'center',
      }}>
      <Text style={{ color: BrandColors.textSecondary, fontSize: 13 }}>{label}</Text>
      <Text style={{ fontSize: 22, fontWeight: '700', color: accent }}>{value}</Text>
    </View>
  );
}
