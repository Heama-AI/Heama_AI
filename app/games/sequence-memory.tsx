import { BrandColors, Shadows } from '@/constants/theme';
import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const CARD_LIBRARY = [
  { id: 'jan', label: '1월 송학', image: require('@/assets/hwatu/jan.png') },
  { id: 'feb', label: '2월 매조', image: require('@/assets/hwatu/feb.png') },
  { id: 'mar', label: '3월 벚꽃', image: require('@/assets/hwatu/mar.png') },
  { id: 'apr', label: '4월 등나무', image: require('@/assets/hwatu/apr.png') },
  { id: 'may', label: '5월 창포', image: require('@/assets/hwatu/may.png') },
  { id: 'jun', label: '6월 모란', image: require('@/assets/hwatu/jun.png') },
  { id: 'jul', label: '7월 칠월', image: require('@/assets/hwatu/jul.png') },
  { id: 'aug', label: '8월 싸리', image: require('@/assets/hwatu/aug.png') },
  { id: 'sep', label: '9월 국화', image: require('@/assets/hwatu/sep.png') },
  { id: 'oct', label: '10월 단풍', image: require('@/assets/hwatu/oct.png') },
  { id: 'nov', label: '11월 버드나무', image: require('@/assets/hwatu/nov.png') },
  { id: 'dec', label: '12월 비꽃', image: require('@/assets/hwatu/dec.png') },
] as const;

const BACK_IMAGE = require('@/assets/hwatu/backside.png');
const SEQUENCE_LENGTH = 4;
const PREVIEW_DURATION = 800;
const PREVIEW_GAP = 250;

type Stage = 'ready' | 'showing' | 'input' | 'result';
type ResultState = 'success' | 'fail' | null;
type CardInfo = (typeof CARD_LIBRARY)[number];

function shuffle<T>(items: readonly T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function pickSequence(): CardInfo[] {
  return shuffle(CARD_LIBRARY).slice(0, SEQUENCE_LENGTH);
}

export default function SequenceMemoryGame() {
  const initialSequence = useMemo(() => pickSequence(), []);
  const [sequence, setSequence] = useState<CardInfo[]>(initialSequence);
  const [gridCards, setGridCards] = useState<CardInfo[]>(initialSequence);
  const [stage, setStage] = useState<Stage>('ready');
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [playerInput, setPlayerInput] = useState<string[]>([]);
  const [incorrectIndex, setIncorrectIndex] = useState<number | null>(null);
  const [result, setResult] = useState<ResultState>(null);
  const [round, setRound] = useState(1);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);

  useEffect(() => {
    if (stage !== 'showing') return;
    const timers: ReturnType<typeof setTimeout>[] = [];

    sequence.forEach((card, index) => {
      const start = index * (PREVIEW_DURATION + PREVIEW_GAP);
      timers.push(
        setTimeout(() => setHighlightedId(card.id), start),
        setTimeout(() => setHighlightedId(null), start + PREVIEW_DURATION - 80),
      );
    });

    timers.push(
      setTimeout(() => {
        setHighlightedId(null);
        setGridCards(shuffle(sequence));
        setStage('input');
      }, sequence.length * (PREVIEW_DURATION + PREVIEW_GAP)),
    );

    return () => timers.forEach(clearTimeout);
  }, [stage, sequence]);

  const selectionBadges = useMemo(() => {
    const map: Record<string, number> = {};
    playerInput.forEach((cardId, index) => {
      map[cardId] = index + 1;
    });
    return map;
  }, [playerInput]);

  const startPreview = ({ reuseSequence = false }: { reuseSequence?: boolean } = {}) => {
    const nextSequence = reuseSequence ? sequence : pickSequence();
    if (!reuseSequence) {
      setSequence(nextSequence);
      setRound((prev) => (stage === 'ready' ? 1 : prev + 1));
    }
    setGridCards(nextSequence);
    setPlayerInput([]);
    setIncorrectIndex(null);
    setResult(null);
    setHighlightedId(null);
    setStage('showing');
  };

  const handleCardPress = (cardId: string) => {
    if (stage !== 'input') return;
    if (playerInput.includes(cardId)) return;

    const nextIndex = playerInput.length;
    const expectedId = sequence[nextIndex].id;
    const nextInput = [...playerInput, cardId];

    setPlayerInput(nextInput);

    if (cardId !== expectedId) {
      setIncorrectIndex(nextIndex);
      setResult('fail');
      setStage('result');
      setStreak(0);
      return;
    }

    if (nextIndex + 1 === sequence.length) {
      setResult('success');
      setStage('result');
      setStreak((prev) => {
        const next = prev + 1;
        setBestStreak((best) => Math.max(best, next));
        return next;
      });
      return;
    }
  };

  const handleReset = () => {
    setRound(1);
    setStreak(0);
    setBestStreak(0);
    setSequence(pickSequence());
    setPlayerInput([]);
    setIncorrectIndex(null);
    setHighlightedId(null);
    setResult(null);
    setStage('ready');
  };

  const instructionText = (() => {
    switch (stage) {
      case 'ready':
        return '카드 4장을 순서대로 보여드릴게요. 준비가 되면 시작하세요.';
      case 'showing':
        return '표시되는 카드 순서를 집중해서 기억해보세요.';
      case 'input':
        return '방금 봤던 순서대로 카드를 눌러보세요.';
      case 'result':
        return result === 'success'
          ? '완벽해요! 다음 라운드도 도전해볼까요?'
          : '순서가 조금 달랐어요. 다시 한번 연습해볼까요?';
      default:
        return '';
    }
  })();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BrandColors.background }} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={{
          padding: 24,
          paddingBottom: 32,
          gap: 20,
        }}>
        <View style={{ gap: 6 }}>
          <Text style={styles.title}>화투 순서 기억하기</Text>
          <Text style={styles.subtitle}>4장의 카드를 보고 같은 순서로 눌러보세요.</Text>
        </View>

        <View style={styles.scoreRow}>
          <ScoreCard label="현재 라운드" value={round.toString()} />
          <ScoreCard label="연속 성공" value={streak.toString()} />
          <ScoreCard label="최고 기록" value={bestStreak.toString()} />
        </View>

        <View style={styles.instructionBox}>
          <Text style={{ color: BrandColors.textPrimary, fontWeight: '600' }}>{instructionText}</Text>
        </View>

        <View style={styles.grid}>
          {gridCards.map((card) => {
            const badge = selectionBadges[card.id];
            const isHighlighted = highlightedId === card.id;
            const isWrong = result === 'fail' && badge !== undefined && incorrectIndex === badge - 1;
            const disabled = stage !== 'input';
            const showFront = stage === 'showing' ? isHighlighted : stage !== 'ready';
            const imageSource = showFront ? card.image : BACK_IMAGE;

            return (
              <Pressable
                key={card.id}
                onPress={() => handleCardPress(card.id)}
                disabled={disabled}
                style={[
                  styles.card,
                  isHighlighted && styles.cardHighlight,
                  badge && styles.cardSelected,
                  isWrong && styles.cardWrong,
                  disabled && stage !== 'showing' && { opacity: stage === 'ready' ? 0.7 : 1 },
                ]}>
                <Image source={imageSource} style={styles.cardImage} resizeMode="contain" />
                {showFront ? (
                  <View style={styles.cardLabel}>
                    <Text style={styles.cardLabelText}>{card.label}</Text>
                  </View>
                ) : null}
                {badge ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{badge}</Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>

        <View style={{ gap: 12 }}>
          {stage === 'ready' ? (
            <PrimaryButton label="시작하기" onPress={() => startPreview()} />
          ) : stage === 'showing' ? null : stage === 'input' ? (
            <PrimaryButton label="기억이 안 나요 (다시 보기)" onPress={() => startPreview({ reuseSequence: true })} />
          ) : (
            <>
              {result === 'fail' ? (
                <PrimaryButton label="같은 순서 다시 보기" onPress={() => startPreview({ reuseSequence: true })} />
              ) : null}
              <PrimaryButton label="새로운 카드로 도전" onPress={() => startPreview()} />
            </>
          )}
          <Pressable onPress={handleReset} style={styles.secondaryButton}>
            <Text style={styles.secondaryText}>기록 초기화</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ScoreCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.scoreCard}>
      <Text style={styles.scoreLabel}>{label}</Text>
      <Text style={styles.scoreValue}>{value}</Text>
    </View>
  );
}

function PrimaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.primaryButton}>
      <Text style={styles.primaryText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: BrandColors.textPrimary,
  },
  subtitle: {
    color: BrandColors.textSecondary,
  },
  scoreRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  scoreCard: {
    flex: 1,
    minWidth: 110,
    backgroundColor: BrandColors.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: BrandColors.border,
    ...Shadows.card,
  },
  scoreLabel: {
    fontSize: 13,
    color: BrandColors.textSecondary,
  },
  scoreValue: {
    fontSize: 22,
    fontWeight: '800',
    color: BrandColors.primary,
  },
  instructionBox: {
    backgroundColor: BrandColors.surfaceSoft,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: BrandColors.border,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    justifyContent: 'center',
  },
  card: {
    width: '46%',
    aspectRatio: 1669 / 1024,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: 'rgba(0,0,0,0.08)',
    backgroundColor: '#fff',
    padding: 10,
    ...Shadows.card,
  },
  cardHighlight: {
    borderColor: BrandColors.primary,
    shadowColor: BrandColors.primary,
  },
  cardSelected: {
    borderColor: BrandColors.primaryDark,
  },
  cardWrong: {
    borderColor: BrandColors.danger,
  },
  cardImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  cardLabel: {
    position: 'absolute',
    left: 12,
    bottom: 12,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  cardLabelText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  badge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: BrandColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#fff',
    fontWeight: '700',
  },
  primaryButton: {
    backgroundColor: BrandColors.primary,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BrandColors.border,
  },
  secondaryText: {
    color: BrandColors.textSecondary,
    fontWeight: '600',
  },
});
