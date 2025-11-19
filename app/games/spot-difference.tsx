import { BrandColors, Shadows } from '@/constants/theme';
import { useGameStatsStore } from '@/store/gameStatsStore';
import { Image } from 'expo-image';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const CARD_IMAGES = [
  require('@/assets/hwatu/jan.png'),
  require('@/assets/hwatu/feb.png'),
  require('@/assets/hwatu/mar.png'),
  require('@/assets/hwatu/apr.png'),
  require('@/assets/hwatu/may.png'),
  require('@/assets/hwatu/jun.png'),
  require('@/assets/hwatu/jul.png'),
  require('@/assets/hwatu/aug.png'),
  require('@/assets/hwatu/sep.png'),
  require('@/assets/hwatu/oct.png'),
  require('@/assets/hwatu/nov.png'),
  require('@/assets/hwatu/dec.png'),
] as const;
const BACK_IMAGE = require('@/assets/hwatu/backside.png');

type Card = {
  id: number;
  image: (typeof CARD_IMAGES)[number];
  matched: boolean;
};

function shuffle<T>(array: readonly T[]): T[] {
  const arr = array.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function createDeck(pairCount = 8): Card[] {
  const shuffledImages = shuffle(CARD_IMAGES).slice(0, pairCount);
  const deck = shuffledImages.flatMap((image, index) => [
    { id: index * 2, image, matched: false },
    { id: index * 2 + 1, image, matched: false },
  ]);
  return shuffle(deck);
}

export default function MemoryGameRoute() {
  const { width } = useWindowDimensions();
  const [deck, setDeck] = useState<Card[]>(() => createDeck(8));
  const [flipped, setFlipped] = useState<number[]>([]);
  const [disabled, setDisabled] = useState(false);
  const [moves, setMoves] = useState(0);
  const [time, setTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [gridLayout, setGridLayout] = useState({ width: 0, height: 0 });
  const addGameResult = useGameStatsStore((state) => state.addResult);
  const startTimeRef = useRef<number | null>(null);
  const [hasRecorded, setHasRecorded] = useState(false);

  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(() => setTime((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [isRunning]);

  useEffect(() => {
    if (deck.length > 0 && deck.every((c) => c.matched)) {
      setIsRunning(false);
    }
  }, [deck]);

  useEffect(() => {
    if (deck.length === 0) return;
    if (!deck.every((c) => c.matched)) return;
    if (hasRecorded) return;
    const end = Date.now();
    const durationMs =
      startTimeRef.current !== null ? end - startTimeRef.current : time * 1000;
    const pairCount = deck.length / 2;

    void addGameResult({
      kind: 'matching',
      durationMs,
      success: true,
      totalTasks: pairCount,
      correctTasks: pairCount,
      attempts: moves,
      meta: { pairCount },
      playedAt: end,
    });
    setHasRecorded(true);
  }, [addGameResult, deck, hasRecorded, moves, time]);

  const isFinished = useMemo(() => deck.length > 0 && deck.every((c) => c.matched), [deck]);
  const minutes = Math.floor(time / 60);
  const seconds = String(time % 60).padStart(2, '0');

  const handleCardPress = (index: number) => {
    if (disabled) return;
    if (flipped.includes(index)) return;
    if (deck[index].matched) return;

    if (!isRunning) setIsRunning(true);
    if (startTimeRef.current === null) {
      startTimeRef.current = Date.now();
    }

    if (flipped.length === 0) {
      setFlipped([index]);
      return;
    }

    if (flipped.length === 1) {
      const firstIndex = flipped[0];
      const secondIndex = index;
      const firstCard = deck[firstIndex];
      const secondCard = deck[secondIndex];

      setFlipped([firstIndex, secondIndex]);
      setDisabled(true);
      setMoves((m) => m + 1);

      if (firstCard.image === secondCard.image) {
        setTimeout(() => {
          setDeck((prev) =>
            prev.map((c, i) => (i === firstIndex || i === secondIndex ? { ...c, matched: true } : c)),
          );
          setFlipped([]);
          setDisabled(false);
        }, 500);
      } else {
        setTimeout(() => {
          setFlipped([]);
          setDisabled(false);
        }, 600);
      }
    }
  };

  const handleRestart = () => {
    setDeck(createDeck(8));
    setFlipped([]);
    setDisabled(false);
    setMoves(0);
    setTime(0);
    setIsRunning(false);
    setHasRecorded(false);
    startTimeRef.current = null;
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BrandColors.background }} edges={['top', 'left', 'right']}>
      <View style={styles.container}>
        <Text style={styles.title}>카드 짝맞추기 게임</Text>

        <View style={styles.infoRow}>
          <Text style={styles.infoText}>시도 횟수: <Text style={styles.infoStrong}>{moves}</Text></Text>
          <Text style={styles.infoText}>
            시간: <Text style={styles.infoStrong}>{minutes}:{seconds}</Text>
          </Text>
          <Pressable onPress={handleRestart} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>다시 시작</Text>
          </Pressable>
        </View>

        {isFinished ? (
          <View style={styles.finishBox}>
            <Text style={styles.finishText}>축하합니다! 모든 카드를 맞췄어요!</Text>
          </View>
        ) : null}

        <View
          style={styles.grid}
          onLayout={(event) => setGridLayout(event.nativeEvent.layout)}
        >
          {deck.map((card, index) => {
            const isOpen = flipped.includes(index) || card.matched;
            return (
              <Pressable
                key={card.id}
                style={[
                  styles.card,
                  getCardSizeStyle(width, gridLayout.width, gridLayout.height),
                  isOpen && styles.cardOpen,
                  card.matched && styles.cardMatched,
                ]}
                onPress={() => handleCardPress(index)}
              >
                <Image
                  source={isOpen ? card.image : BACK_IMAGE}
                  style={styles.cardImage}
                  contentFit="contain"
                  cachePolicy="memory-disk"
                />
              </Pressable>
            );
          })}
        </View>

        <View style={styles.helperBox}>
          <Text style={styles.helperTitle}>기억력 챌린지 팁</Text>
          <Text style={styles.helperText}>
            색깔과 무늬를 묶어서 기억하면 더 빨리 짝을 찾을 수 있어요. 카드 위치를 머릿속으로 스케치해보세요.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    gap: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: BrandColors.textPrimary,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoText: {
    color: BrandColors.textSecondary,
  },
  infoStrong: {
    color: BrandColors.textPrimary,
    fontWeight: '700',
  },
  primaryButton: {
    marginLeft: 'auto',
    backgroundColor: BrandColors.primary,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  finishBox: {
    backgroundColor: BrandColors.surface,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: BrandColors.border,
    ...Shadows.card,
  },
  finishText: {
    color: BrandColors.success,
    fontWeight: '700',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginTop: 8,
    alignSelf: 'center',
    flex: 1,
    width: '100%',
  },
  card: {
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: BrandColors.border,
    ...Shadows.card,
  },
  cardOpen: {
    backgroundColor: '#ffffff',
  },
  cardMatched: {
    backgroundColor: '#bbf7d0',
  },
  cardImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  helperBox: {
    marginTop: 16,
    backgroundColor: BrandColors.surface,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: BrandColors.border,
    ...Shadows.card,
  },
  helperTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: BrandColors.textPrimary,
    marginBottom: 4,
  },
  helperText: {
    color: BrandColors.textSecondary,
    lineHeight: 20,
  },
});

const GRID_COLUMNS = 4;
const GRID_ROWS = 4;
const GRID_GAP = 12;
const HORIZONTAL_PADDING = 24;
const CARD_ASPECT_RATIO = 1669 / 1024; // height / width

function getCardSizeStyle(screenWidth: number, containerWidth: number, containerHeight: number) {
  const safeWidth = Math.max(screenWidth, 320);
  const effectiveWidth = containerWidth > 0 ? containerWidth : safeWidth - HORIZONTAL_PADDING * 2;
  const availableWidth = Math.max(effectiveWidth, 1);
  const totalWidthGap = GRID_GAP * (GRID_COLUMNS - 1);
  const widthLimit = (availableWidth - totalWidthGap) / GRID_COLUMNS;

  const fallbackHeight = widthLimit * CARD_ASPECT_RATIO * GRID_ROWS + GRID_GAP * (GRID_ROWS - 1);
  const effectiveHeight = containerHeight > 0 ? containerHeight : fallbackHeight;
  const totalHeightGap = GRID_GAP * (GRID_ROWS - 1);
  const heightLimit = (effectiveHeight - totalHeightGap) / GRID_ROWS;

  let cardWidth = widthLimit;
  let cardHeight = cardWidth * CARD_ASPECT_RATIO;

  if (cardHeight > heightLimit) {
    cardHeight = heightLimit;
    cardWidth = cardHeight / CARD_ASPECT_RATIO;
  }

  return {
    width: Math.floor(cardWidth),
    height: Math.floor(cardHeight),
  };
}
