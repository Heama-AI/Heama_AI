import CardButton from '@/components/CardButton';
import { BrandColors, Shadows } from '@/constants/theme';
import { generateDistractors, generateParaphrasedDistractors } from '@/lib/rag/distractors';
import { condenseChoiceText } from '@/lib/rag/shorten';
import { snippet } from '@/lib/rag/snippet';
import { loadChunks } from '@/lib/storage/recordChunksStorage';
import { useRecordsStore } from '@/store/recordsStore';
import { ConversationRecord } from '@/types/records';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Easing, Pressable, ScrollView, StyleProp, Text, View, ViewStyle } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

interface GameState {
  questionIndex: number;
  selectedChoice?: string;
  score: number;
  showExplanation: boolean;
  completed: boolean;
}

type MemoryQuestion = {
  id: string;
  question: string;
  choices: string[];
  answer: string;
  explanation?: string;
};

const initialGameState: GameState = {
  questionIndex: 0,
  score: 0,
  showExplanation: false,
  completed: false,
};

function ChoiceButton({
  choice,
  selected,
  onPress,
  disabled,
  style,
  textColor,
}: {
  choice: string;
  selected: boolean;
  onPress: () => void;
  disabled: boolean;
  style?: StyleProp<ViewStyle>;
  textColor: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        {
          borderWidth: 1,
          borderColor: BrandColors.border,
          backgroundColor: BrandColors.surface,
          borderRadius: 14,
          padding: 16,
        },
        selected && !style && { borderColor: BrandColors.primary, backgroundColor: BrandColors.primarySoft },
        style,
      ]}>
      <Text style={{ color: textColor, fontSize: 16 }}>{choice}</Text>
    </Pressable>
  );
}

function pickUniqueChoices(correct: string, pool: string[], count = 4) {
  const unique = new Set<string>();
  const normalized = (text: string) => normalizeText(text);
  unique.add(correct);
  for (const item of pool) {
    if (!item) continue;
    if (unique.size >= count) break;
    if (normalized(item) === normalized(correct)) continue;
    if (isTooSimilar(correct, item)) continue;
    unique.add(item);
  }
  const fallbackChoices = ['기억이 나지 않습니다', '잘 모르겠습니다', '생각이 나지 않아요'];
  for (const fallback of fallbackChoices) {
    if (unique.size >= count) break;
    unique.add(fallback);
  }
  // 만약 여전히 부족하면 숫자 태그로 채움
  let fillerIndex = 1;
  while (unique.size < count) {
    unique.add(`선택지 ${fillerIndex}`);
    fillerIndex += 1;
  }
  const arr = Array.from(unique);
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, count);
}

function normalizeText(text: string) {
  return text.replace(/\s+/g, '').toLowerCase();
}

function isTooSimilar(a: string, b: string) {
  const na = normalizeText(a);
  const nb = normalizeText(b);
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  const intersection = new Set([...na].filter((ch) => nb.includes(ch)));
  const jaccard = intersection.size / Math.max(1, new Set([...na, ...nb]).size);
  return jaccard > 0.7;
}

async function buildMemoryQuizAsync(
  record: ConversationRecord,
  allRecords: ConversationRecord[],
  allChunks: Array<{ id: string; recordId: string; chunk: string }>,
): Promise<MemoryQuestion[]> {
  if (!record) return [];

  // Q1: 요약 기반
  const otherSummaries = allRecords
    .filter((r) => r.id !== record.id)
    .map((r) => snippet(r.summary, 60));
  const answerSummary = await condenseChoiceText(record.summary, 60);
  const summaryDistractors =
    (await generateParaphrasedDistractors({ answer: answerSummary, context: record.summary, count: 3 })) ??
    (await generateDistractors({ answer: answerSummary, context: record.summary, count: 3 }));
  const q1Choices = pickUniqueChoices(answerSummary, [...summaryDistractors, ...otherSummaries], 4);

  // Q2: 키워드 기반
  const keywordPool = allRecords.flatMap((r) => r.keywords ?? []);
  const answerKeyword = record.keywords[0] ?? (keywordPool[0] ?? '기억');
  const keywordDistractors =
    (await generateDistractors({
      answer: answerKeyword,
      context: record.summary,
      count: 3,
    })) ?? [];
  const q2Choices = pickUniqueChoices(answerKeyword, [...keywordDistractors, ...keywordPool], 4);

  // Q3: RAG chunk 기반
  const chunksForRecord = allChunks.filter((c) => c.recordId === record.id);
  const chunkAnswerRaw = chunksForRecord[0]?.chunk ?? record.messages[0]?.text ?? answerSummary;
  const chunkAnswer = await condenseChoiceText(chunkAnswerRaw, 80);
  const chunkDistractorsRaw =
    (await generateParaphrasedDistractors({
      answer: chunkAnswer,
      context: chunkAnswerRaw,
      count: 3,
    })) ?? [];
  const chunkDistractors = chunkDistractorsRaw.length
    ? chunkDistractorsRaw
    : allChunks
        .filter((c) => c.recordId !== record.id)
        .slice(0, 10)
        .map((c) => snippet(c.chunk, 80));
  const q3Choices = pickUniqueChoices(chunkAnswer, chunkDistractors, 4);

  return [
    {
      id: `${record.id}-quiz-summary`,
      question: '최근 대화 핵심 내용은 무엇이었나요?',
      choices: q1Choices,
      answer: answerSummary,
      explanation: '대화 요약을 바탕으로 기억을 점검하세요.',
    },
    {
      id: `${record.id}-quiz-keyword`,
      question: '대화에서 가장 많이 언급된 키워드는 무엇이었나요?',
      choices: q2Choices,
      answer: answerKeyword,
      explanation: '핵심 키워드로 기억을 확인해 보세요.',
    },
    {
      id: `${record.id}-quiz-rag`,
      question: '다음 중 대화에서 실제로 언급된 내용은 무엇인가요?',
      choices: q3Choices,
      answer: snippet(chunkAnswer, 80),
      explanation: '대화의 일부 문장(snippet)을 기반으로 기억력을 체크합니다.',
    },
  ];
}

function LoadingOrbit() {
  const rotate = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const rotateLoop = Animated.loop(
      Animated.timing(rotate, {
        toValue: 1,
        duration: 1600,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    rotateLoop.start();
    return () => rotateLoop.stop();
  }, [rotate]);

  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 900,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    pulseLoop.start();
    return () => pulseLoop.stop();
  }, [pulse]);

  const spin = rotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  const scale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.94, 1.06],
  });
  const glowOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.36, 0.14],
  });

  return (
    <View style={{ width: 180, height: 180, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        style={{
          position: 'absolute',
          width: 150,
          height: 150,
          borderRadius: 999,
          backgroundColor: BrandColors.primarySoft,
          opacity: glowOpacity,
          transform: [{ scale }],
        }}
      />
      <Animated.View
        style={{
          width: 150,
          height: 150,
          borderRadius: 999,
          borderWidth: 12,
          borderColor: BrandColors.primarySoft,
          borderTopColor: BrandColors.primary,
          transform: [{ rotate: spin }],
        }}
      />
      <View
        style={{
          position: 'absolute',
          width: 96,
          height: 96,
          borderRadius: 999,
          backgroundColor: BrandColors.surface,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 1,
          borderColor: BrandColors.border,
          ...Shadows.card,
        }}>
        <Text style={{ color: BrandColors.primary, fontWeight: '800', fontSize: 16 }}>RAG</Text>
        <Text style={{ color: BrandColors.textSecondary, fontWeight: '600', fontSize: 12 }}>Quiz</Text>
      </View>
    </View>
  );
}

export default function MemoryQuiz() {
  const { recordId } = useLocalSearchParams<{ recordId?: string }>();
  const { records } = useRecordsStore();
  const [state, setState] = useState<GameState>(initialGameState);
  const [chunks, setChunks] = useState<
    Array<{ id: string; recordId: string; chunk: string; embedding: number[] | null; createdAt: number }>
  >([]);
  const [questions, setQuestions] = useState<MemoryQuestion[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);

  const insets = useSafeAreaInsets();
  const activeRecord = useMemo(() => {
    if (records.length === 0) return undefined;
    if (recordId) {
      const target = records.find((record) => record.id === recordId);
      if (target) return target;
    }
    return records[0];
  }, [records, recordId]);

  useEffect(() => {
    setState(initialGameState);
  }, [activeRecord?.id]);

  useEffect(() => {
    loadChunks()
      .then((loaded) => setChunks(loaded))
      .catch(() => setChunks([]));
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!activeRecord) {
      setQuestions([]);
      return;
    }
    setLoadingQuestions(true);
    buildMemoryQuizAsync(activeRecord, records, chunks)
      .then((qs) => {
        if (!cancelled) setQuestions(qs);
      })
      .catch(() => {
        if (!cancelled) setQuestions([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingQuestions(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeRecord, records, chunks]);

  if (!activeRecord) {
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
          <Text style={{ fontSize: 20, fontWeight: '700', color: BrandColors.textPrimary }}>퀴즈를 만들 기록이 없어요</Text>
          <Text style={{ color: BrandColors.textSecondary, textAlign: 'center' }}>
            대화를 저장한 뒤 맞춤 퀴즈를 풀어보세요.
          </Text>
          <CardButton title="대화하러 가기" onPress={() => router.push('/chat')} />
        </View>
      </SafeAreaView>
    );
  }

  const currentQuestion = questions[state.questionIndex];

  const handleChoiceSelect = (choice: string) => {
    if (state.showExplanation) return;
    setState((prev) => ({ ...prev, selectedChoice: choice }));
  };

  const handleAction = () => {
    if (!currentQuestion) return;

    if (!state.showExplanation) {
      if (!state.selectedChoice) {
        Alert.alert('선택 필요', '정답이라고 생각되는 답안을 선택해주세요.');
        return;
      }
      const isCorrect = state.selectedChoice === currentQuestion.answer;
      setState((prev) => ({
        ...prev,
        score: isCorrect ? prev.score + 1 : prev.score,
        showExplanation: true,
      }));
      return;
    }

    const nextIndex = state.questionIndex + 1;
    if (nextIndex >= questions.length) {
      setState((prev) => ({ ...prev, completed: true }));
    } else {
      setState({
        questionIndex: nextIndex,
        score: state.score,
        selectedChoice: undefined,
        showExplanation: false,
        completed: false,
      });
    }
  };

  const restartGame = () => {
    setState(initialGameState);
  };

  if (loadingQuestions) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: BrandColors.background }} edges={['top', 'left', 'right']}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <View
            style={{
              width: '100%',
              maxWidth: 360,
              backgroundColor: BrandColors.surface,
              borderRadius: 26,
              padding: 26,
              alignItems: 'center',
              gap: 14,
              borderWidth: 1,
              borderColor: BrandColors.border,
              ...Shadows.card,
            }}>
            <LoadingOrbit />
            <Text style={{ fontSize: 22, fontWeight: '800', color: BrandColors.textPrimary }}>
              퀴즈를 준비하는 중입니다
            </Text>
            <Text style={{ color: BrandColors.textSecondary, textAlign: 'center', lineHeight: 20 }}>
              대화 기록을 분석해서 맞춤형 문제를 만드는 중이에요. 잠시만 기다려 주세요.
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (!currentQuestion) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: BrandColors.background }} edges={['top', 'left', 'right']}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Text style={{ fontSize: 18, fontWeight: '600' }}>퀴즈를 불러오는 중 문제가 발생했습니다.</Text>
          <CardButton title="기록으로 돌아가기" onPress={() => router.push('/records')} />
        </View>
      </SafeAreaView>
    );
  }

  const answerStyle = state.showExplanation
    ? (choice: string): StyleProp<ViewStyle> => {
        if (choice === currentQuestion.answer) return { borderColor: '#51cf66', backgroundColor: '#e6fcf5' };
        if (choice === state.selectedChoice) return { borderColor: '#ff6b6b', backgroundColor: '#ffe3e3' };
        return undefined;
      }
    : () => undefined;

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
        <View>
          <Text style={{ fontSize: 28, fontWeight: '800', color: BrandColors.textPrimary }}>기억력 퀴즈</Text>
          <Text style={{ color: BrandColors.textSecondary }}>
            {activeRecord.title} 기록을 기반으로 생성된 맞춤 문제입니다.
          </Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 16 }}>
          <View
            style={{
              flex: 1,
              backgroundColor: BrandColors.surface,
              borderRadius: 20,
              padding: 18,
              gap: 6,
              borderWidth: 1,
              borderColor: BrandColors.border,
              ...Shadows.card,
            }}>
            <Text style={{ color: BrandColors.textSecondary }}>현재 점수</Text>
            <Text style={{ fontSize: 24, fontWeight: '800', color: BrandColors.primary }}>
              {state.score} / {questions.length}
            </Text>
          </View>
          <View
            style={{
              flex: 1,
              backgroundColor: BrandColors.surface,
              borderRadius: 20,
              padding: 18,
              gap: 6,
              borderWidth: 1,
              borderColor: BrandColors.border,
              ...Shadows.card,
            }}>
            <Text style={{ color: BrandColors.textSecondary }}>현재 문제</Text>
            <Text style={{ fontSize: 24, fontWeight: '800', color: BrandColors.primaryDark }}>
              {state.questionIndex + 1} / {questions.length}
            </Text>
          </View>
        </View>

        <View
          style={{
            backgroundColor: BrandColors.surface,
            borderRadius: 26,
            padding: 24,
            gap: 16,
            borderWidth: 1,
            borderColor: BrandColors.border,
            ...Shadows.card,
          }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: BrandColors.textPrimary }}>
            {currentQuestion.question}
          </Text>
          <View style={{ gap: 12 }}>
            {currentQuestion.choices.map((choice, idx) => {
              const containerStyle = answerStyle(choice);
              const isSelected = state.selectedChoice === choice;
              const isCorrectChoice = state.showExplanation && choice === currentQuestion.answer;
              const isWrongChoice =
                state.showExplanation && choice === state.selectedChoice && choice !== currentQuestion.answer;
              const textColor = isCorrectChoice
                ? BrandColors.success
                : isWrongChoice
                ? BrandColors.danger
                : isSelected
                ? BrandColors.primary
                : BrandColors.textPrimary;

              return (
                <ChoiceButton
                  key={`${currentQuestion.id}-${idx}-${choice}`}
                  choice={choice}
                  selected={isSelected}
                  onPress={() => handleChoiceSelect(choice)}
                  disabled={state.showExplanation}
                  style={containerStyle}
                  textColor={textColor}
                />
              );
            })}
          </View>
          {state.showExplanation ? (
            <View
              style={{
                backgroundColor: BrandColors.surfaceSoft,
                borderRadius: 12,
                padding: 12,
                borderWidth: 1,
                borderColor: BrandColors.border,
              }}>
              <Text style={{ color: BrandColors.primary, fontWeight: '600', marginBottom: 4 }}>
                정답: {currentQuestion.answer}
              </Text>
              <Text style={{ color: BrandColors.textSecondary, lineHeight: 20 }}>{currentQuestion.explanation}</Text>
            </View>
          ) : null}
          {!state.completed ? (
            <Pressable
              onPress={handleAction}
              style={{
                marginTop: 12,
                backgroundColor: BrandColors.primary,
                borderRadius: 16,
                padding: 16,
                alignItems: 'center',
              }}>
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>
                {state.showExplanation ? '다음으로' : '정답 확인'}
              </Text>
            </Pressable>
          ) : null}
        </View>

        {state.completed ? (
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
            <Text style={{ fontSize: 18, fontWeight: '700', color: BrandColors.textPrimary }}>퀴즈 완료!</Text>
            <Text style={{ color: BrandColors.textSecondary }}>
              총 {questions.length}문제 중 {state.score}문제를 맞췄어요. 기록을 복습하고 다시 도전해보세요.
            </Text>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
              <Pressable
                onPress={() => router.replace('/home')}
                style={{
                  flex: 1,
                  backgroundColor: BrandColors.surface,
                  borderRadius: 16,
                  padding: 14,
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: BrandColors.border,
                }}>
                <Text style={{ color: BrandColors.textPrimary, fontWeight: '700' }}>메인으로 나가기</Text>
              </Pressable>
              <Pressable
                onPress={() => router.push(`/records/${activeRecord.id}`)}
                style={{
                  flex: 1,
                  backgroundColor: BrandColors.surface,
                  borderRadius: 16,
                  padding: 14,
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: BrandColors.border,
                }}>
                <Text style={{ color: BrandColors.primary, fontWeight: '700' }}>기록 복습</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
