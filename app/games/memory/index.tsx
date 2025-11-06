import { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BrandColors, Shadows } from '@/constants/theme';

type Card = {
  id: number;
  emoji: string;
  matched: boolean;
};

const EMOJIS = ['🍎', '🍊', '🍋', '🍉', '🍇', '🍓', '🍒', '🍍'];

function shuffle<T>(array: T[]): T[] {
  const arr = array.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function createDeck(pairCount = 8): Card[] {
  const selected = EMOJIS.slice(0, pairCount);
  const deck = selected.flatMap((emoji, index) => [
    { id: index * 2, emoji, matched: false },
    { id: index * 2 + 1, emoji, matched: false },
  ]);
  return shuffle(deck);
}

export default function MemoryGameRoute() {
  const [deck, setDeck] = useState<Card[]>(() => createDeck(8));
  const [flipped, setFlipped] = useState<number[]>([]);
  const [disabled, setDisabled] = useState(false);
  const [moves, setMoves] = useState(0);
  const [time, setTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);

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

  const isFinished = useMemo(() => deck.length > 0 && deck.every((c) => c.matched), [deck]);
  const minutes = Math.floor(time / 60);
  const seconds = String(time % 60).padStart(2, '0');

  const handleCardPress = (index: number) => {
    if (disabled) return;
    if (flipped.includes(index)) return;
    if (deck[index].matched) return;

    if (!isRunning) setIsRunning(true);

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

      if (firstCard.emoji === secondCard.emoji) {
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

        <View style={styles.grid}>
          {deck.map((card, index) => {
            const isOpen = flipped.includes(index) || card.matched;
            return (
              <Pressable
                key={card.id}
                style={[styles.card, isOpen && styles.cardOpen, card.matched && styles.cardMatched]}
                onPress={() => handleCardPress(index)}
              >
                <Text style={[styles.cardInner, isOpen && styles.cardInnerOpen]}>{isOpen ? card.emoji : '？'}</Text>
              </Pressable>
            );
          })}
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
  },
  card: {
    width: 80,
    height: 100,
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
  cardInner: {
    fontSize: 28,
    color: '#ffffff',
  },
  cardInnerOpen: {
    color: '#111827',
  },
});

