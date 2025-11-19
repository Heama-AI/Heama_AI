import CardButton from '@/components/CardButton';
import { BrandColors, Shadows } from '@/constants/theme';
import { useRecordsStore } from '@/store/recordsStore';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleProp, Text, View, ViewStyle } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

interface GameState {
  questionIndex: number;
  selectedChoice?: string;
  score: number;
  showExplanation: boolean;
  completed: boolean;
}

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

export default function MemoryQuiz() {
  const { recordId } = useLocalSearchParams<{ recordId?: string }>();
  const { records } = useRecordsStore();
  const [state, setState] = useState<GameState>(initialGameState);

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

  const questions = activeRecord.quiz;
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
            {currentQuestion.choices.map((choice) => {
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
                  key={choice}
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
                onPress={restartGame}
                style={{
                  flex: 1,
                  backgroundColor: BrandColors.primary,
                  borderRadius: 16,
                  padding: 14,
                  alignItems: 'center',
                }}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>다시 도전</Text>
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
