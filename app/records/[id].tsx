import { BrandColors, Shadows } from '@/constants/theme';
import { loadMemoryQuiz } from '@/lib/storage/memoryQuizStorage';
import { useRecordsStore } from '@/store/recordsStore';
import { useLocalSearchParams, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

export default function RecordDetail() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const getRecord = useRecordsStore((state) => state.getRecord);
  const removeRecord = useRecordsStore((state) => state.removeRecord);
  const updateRecordTitle = useRecordsStore((state) => state.updateRecordTitle);
  const updateRecordSummary = useRecordsStore((state) => state.updateRecordSummary);
  const hasHydrated = useRecordsStore((state) => state.hasHydrated);

  const record = id ? getRecord(id) : undefined;
  const [title, setTitle] = useState(record?.title ?? '');
  const [summaryText, setSummaryText] = useState(record?.summary ?? '');
  const [keywordsText, setKeywordsText] = useState(record?.keywords.join(', ') ?? '');
  const [hasMemoryQuiz, setHasMemoryQuiz] = useState(false);
  const [editing, setEditing] = useState(false);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const stackStats = width < 520;
  const stackActions = width < 440;

  useEffect(() => {
    setTitle(record?.title ?? '');
    setSummaryText(record?.summary ?? '');
    setKeywordsText(record?.keywords.join(', ') ?? '');
  }, [record?.title]);

  useEffect(() => {
    let cancelled = false;
    if (!record) {
      setHasMemoryQuiz(false);
      return;
    }
    loadMemoryQuiz(record.id)
      .then((quiz) => {
        if (!cancelled) {
          setHasMemoryQuiz(Boolean(quiz && quiz.length > 0));
        }
      })
      .catch(() => {
        if (!cancelled) setHasMemoryQuiz(false);
      });
    return () => {
      cancelled = true;
    };
  }, [record?.id]);

  if (!hasHydrated) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: BrandColors.background }} edges={['top', 'left', 'right']}>
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            gap: 12,
          }}>
          <ActivityIndicator size="large" color={BrandColors.primary} />
          <Text style={{ color: BrandColors.textSecondary }}>기록을 불러오는 중입니다...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!record) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: BrandColors.background }} edges={['top', 'left', 'right']}>
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            gap: 16,
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
      </SafeAreaView>
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

  const handleSaveSummary = () => {
    const summaryTrimmed = summaryText.trim();
    const keywordsParsed = keywordsText
      .split(',')
      .map((kw) => kw.trim())
      .filter((kw) => kw.length > 0);
    if (!summaryTrimmed) {
      Alert.alert('요약', '요약은 비워둘 수 없습니다.');
      setSummaryText(record.summary);
      return;
    }
    updateRecordSummary(record.id, summaryTrimmed, keywordsParsed);
    Alert.alert('저장 완료', '요약과 키워드를 저장했어요.');
  };

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

        <View />
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
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 20, fontWeight: '700', color: BrandColors.textPrimary }}>요약 / 키워드</Text>
            <Pressable
              onPress={() => setEditing((prev) => !prev)}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: BrandColors.border,
                backgroundColor: BrandColors.surfaceSoft,
              }}>
              <Text style={{ color: BrandColors.textSecondary, fontWeight: '700' }}>
                {editing ? '취소' : '내용 수정하기'}
              </Text>
            </Pressable>
          </View>

          {editing ? (
            <>
              <TextInput
                multiline
                value={summaryText}
                onChangeText={setSummaryText}
                style={{
                  borderWidth: 1,
                  borderColor: BrandColors.border,
                  borderRadius: 14,
                  padding: 12,
                  minHeight: 120,
                  textAlignVertical: 'top',
                  color: BrandColors.textPrimary,
                  backgroundColor: BrandColors.surfaceSoft,
                }}
                placeholder="요약을 입력하세요"
                placeholderTextColor={BrandColors.textSecondary}
              />
              <Text style={{ fontSize: 20, fontWeight: '700', color: BrandColors.textPrimary }}>키워드</Text>
              <TextInput
                value={keywordsText}
                onChangeText={setKeywordsText}
                style={{
                  borderWidth: 1,
                  borderColor: BrandColors.border,
                  borderRadius: 14,
                  padding: 12,
                  color: BrandColors.textPrimary,
                  backgroundColor: BrandColors.surfaceSoft,
                }}
                placeholder="쉼표(,)로 구분해 입력하세요"
                placeholderTextColor={BrandColors.textSecondary}
              />
              <Pressable
                onPress={() => {
                  handleSaveSummary();
                  setEditing(false);
                }}
                style={{
                  marginTop: 8,
                  borderRadius: 14,
                  paddingVertical: 12,
                  alignItems: 'center',
                  backgroundColor: BrandColors.primary,
                }}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>저장</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={{ fontSize: 16, lineHeight: 24, color: BrandColors.textSecondary }}>{record.summary}</Text>
              <Text style={{ fontSize: 16, lineHeight: 22, color: BrandColors.textSecondary }}>
                {record.keywords.join(', ')}
              </Text>
            </>
          )}
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

        <View style={{ flexDirection: stackActions ? 'column' : 'row', gap: 12 }}>
          <View style={[stackActions ? { width: '100%' } : { flex: 1 }, { gap: 8 }]}>
            <Pressable
              onPress={() => router.push({ pathname: '/games/memory-quiz', params: { recordId: record.id } })}
              style={{
                paddingVertical: 14,
                borderRadius: 16,
                backgroundColor: BrandColors.primary,
                alignItems: 'center',
              }}>
              <Text style={{ color: '#fff', fontWeight: '600' }}>퀴즈 풀러가기</Text>
            </Pressable>
            {hasMemoryQuiz ? (
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: '/games/memory-quiz',
                    params: { recordId: record.id, regenerate: '1' },
                  })
                }
                style={{
                  paddingVertical: 12,
                  borderRadius: 14,
                  backgroundColor: BrandColors.surface,
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: BrandColors.border,
                }}>
                <Text style={{ color: BrandColors.textPrimary, fontWeight: '600' }}>퀴즈 다시 만들기</Text>
              </Pressable>
            ) : null}
          </View>
          <Pressable
            onPress={handleDelete}
            style={[
              stackActions ? { width: '100%' } : { flex: 1 },
              {
                paddingVertical: 14,
                borderRadius: 16,
                backgroundColor: BrandColors.surface,
                alignItems: 'center',
                borderWidth: 1,
                borderColor: BrandColors.dangerSoft,
              },
            ]}>
            <Text style={{ color: BrandColors.danger, fontWeight: '600' }}>기록 삭제</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
