import { BrandColors, Shadows } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const GAME_CARDS = [
  {
    title: '기억력 퀴즈',
    description: '최근 대화를 기반으로 맞춤 문제 풀기',
    icon: 'flash',
    route: '/games/memory-quiz',
    tint: '#FFF0D1',
  },
  {
    title: '같은 그림 맞추기',
    description: '두 그림의 차이를 찾아요',
    icon: 'color-palette',
    route: '/games/spot-difference',
    tint: '#FFE6F0',
  },
  {
    title: '순서 맞추기',
    description: '짜여진 순서를 기억하며 눌러요',
    icon: 'timer',
    route: '/games/sequence-memory',
    tint: '#FFE6D9',
  },
];

export default function GameCenter() {
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BrandColors.background }} edges={['top', 'left', 'right']}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingTop: 24,
          paddingBottom: 40 + insets.bottom,
          gap: 20,
        }}>
        <View
          style={{
            backgroundColor: '#FFE3F1',
            borderRadius: 28,
            padding: 20,
            gap: 14,
            borderWidth: 1,
            borderColor: BrandColors.border,
            ...Shadows.card,
          }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View
              style={{
                width: 86,
                height: 86,
                borderRadius: 24,
                backgroundColor: '#FF7B9E',
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: '#c92a2a',
                shadowOpacity: 0.16,
                shadowOffset: { width: 0, height: 12 },
                shadowRadius: 18,
              }}>
              <Ionicons name="game-controller" size={42} color="#fff" />
            </View>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={{ fontSize: 14, fontWeight: '800', color: '#b1342c' }}>해마 게임 센터</Text>
              <Text style={{ fontSize: 24, fontWeight: '900', color: BrandColors.textPrimary }}>즐겁게 두뇌 운동해요</Text>
              <Text style={{ color: BrandColors.textSecondary, lineHeight: 20 }}>
                오늘은 어떤 게임으로 
                {'\n'}깨울까요?
              </Text>
            </View>
          </View>

        </View>

        <View style={{ gap: 12 }}>
          <Text style={{ fontSize: 17, fontWeight: '800', color: BrandColors.textPrimary }}>오늘의 추천</Text>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            {GAME_CARDS.slice(0, 2).map((game) => (
              <Pressable
                key={game.title}
                onPress={() => router.push(game.route)}
                style={{
                  flex: 1,
                  backgroundColor: game.tint,
                  borderRadius: 18,
                  padding: 16,
                  gap: 8,
                  borderWidth: 1,
                  borderColor: BrandColors.border,
                  ...Shadows.card,
                  minHeight: 108,
                }}>
                <Ionicons name={game.icon as keyof typeof Ionicons.glyphMap} size={22} color={BrandColors.textPrimary} />
                <Text style={{ fontSize: 16, fontWeight: '800', color: BrandColors.textPrimary }}>{game.title}</Text>
                <Text style={{ color: BrandColors.textSecondary, lineHeight: 18 }}>{game.description}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={{ gap: 12 }}>
          <Text style={{ fontSize: 17, fontWeight: '800', color: BrandColors.textPrimary }}>전체 게임</Text>
          {GAME_CARDS.map((game) => (
            <Pressable
              key={`${game.title}-list`}
              onPress={() => router.push(game.route)}
              style={{
                backgroundColor: '#fff',
                borderRadius: 22,
                padding: 18,
                gap: 10,
                borderWidth: 1,
                borderColor: BrandColors.border,
                flexDirection: 'row',
                alignItems: 'center',
                ...Shadows.card,
              }}>
              <View
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 16,
                  backgroundColor: 'rgba(255,255,255,0.88)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: BrandColors.border,
                }}>
                <Ionicons name={game.icon as keyof typeof Ionicons.glyphMap} size={24} color={BrandColors.textPrimary} />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ fontSize: 18, fontWeight: '800', color: BrandColors.textPrimary }}>{game.title}</Text>
                <Text style={{ color: BrandColors.textSecondary, lineHeight: 19 }}>{game.description}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={BrandColors.textSecondary} />
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
