import { HaemayaMascot } from '@/components/HaemayaMascot';
import { BrandColors, Shadows } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

interface ServiceTile {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  route: string;
}

const SERVICE_TILES: ServiceTile[] = [
  {
    title: '간단 회상',
    subtitle: '음성으로 기록',
    icon: 'mic',
    color: '#FFF4CC',
    route: '/chat',
  },
  {
    title: '기억력 퀴즈',
    subtitle: '맞춤 문제 연습',
    icon: 'game-controller',
    color: '#FFE9A6',
    route: '/games',
  },
  {
    title: '같은 그림 찾기',
    subtitle: '두 그림의 차이를 찾아요',
    icon: 'color-palette',
    color: '#FFE3F1',
    route: '/games/spot-difference',
  },
  {
    title: '순서 기억하기',
    subtitle: '화투 4장 따라 눌러요',
    icon: 'timer',
    color: '#FFE4D3',
    route: '/games/sequence-memory',
  },
  {
    title: '대화 기록',
    subtitle: '요약과 메모 관리',
    icon: 'documents',
    color: '#FFF1D0',
    route: '/records',
  },
  {
    title: '사진 설명',
    subtitle: '이미지 보고 기록',
    icon: 'image-outline',
    color: '#FFE3D6',
    route: '/photo-note',
  },
  {
    title: '건강 통계',
    subtitle: '변화 추이를 한눈에',
    icon: 'stats-chart',
    color: '#FDE69F',
    route: '/stats',
  },
  {
    title: '보호자 연동',
    subtitle: '초대 코드로 연동하기',
    icon: 'people',
    color: '#FFE9C2',
    route: '/mypage',
  },
];

const SUPPORT_CARDS = [
  {
    title: 'AI 치매 예측',
    description: '대화 데이터를 기반으로 위험도를 추정해요.',
    route: '/stats',
    accent: '#FFF7D6',
  },
  {
    title: '요양 등급 메모',
    description: '보호자와 공유할 핵심 메모를 정리하세요.',
    route: '/records',
    accent: '#FFEEC6',
  },
];

export default function AuthenticatedHome() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [displayName, setDisplayName] = useState<string>();
  const isCompact = width < 400;

  useEffect(() => {
    let mounted = true;
    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (!mounted) return;
        const user = data.user;
        if (user) {
          const metadata = (user.user_metadata as { name?: string } | null) ?? {};
          setDisplayName(metadata.name ?? user.email ?? undefined);
        }
      })
      .catch(() => {
        // ignore errors
      });
    return () => {
      mounted = false;
    };
  }, []);

  const heroGreeting = displayName ? `${displayName}님 안녕하세요,` : '안녕하세요,';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BrandColors.background }} edges={['top', 'left', 'right']}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: 24,
          paddingHorizontal: 20,
          gap: 24,
          paddingBottom: 24 + insets.bottom,
        }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            {/* <Text style={{ fontSize: 13, color: BrandColors.textSecondary }}>Haema AI</Text> */}
            <Text style={{ fontSize: 24, fontWeight: '800', color: BrandColors.textPrimary }}>해마 AI</Text>
          </View>
          <Pressable
            onPress={() => router.push('/menu')}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: BrandColors.border,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: BrandColors.surface,
            }}>
            <Ionicons name="menu" size={22} color={BrandColors.textPrimary} />
          </Pressable>
        </View>

        <View
          style={{
            backgroundColor: '#FFF7D1',
            borderRadius: 28,
            padding: 24,
            flexDirection: isCompact ? 'column' : 'row',
            gap: 20,
            alignItems: 'center',
            ...Shadows.card,
          }}>
          <View style={{ flex: 1, gap: 10 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#DCA600' }}>해마와 대화해요!</Text>
            <Text style={{ fontSize: isCompact ? 24 : 28, fontWeight: '900', color: BrandColors.textPrimary }}>
              {heroGreeting} 대화를 시작해볼까요?
            </Text>
            <Text style={{ color: '#7A5C00', lineHeight: 20 }}>
              음성으로 이야기를 들려주면 돌봄 메모를 만들어드려요.
            </Text>
            <Pressable
              onPress={() => router.push('/chat')}
              style={{
                marginTop: 4,
                alignSelf: 'flex-start',
                backgroundColor: BrandColors.primary,
                paddingHorizontal: 18,
                paddingVertical: 10,
                borderRadius: 999,
              }}>
              <Text style={{ color: '#fff', fontWeight: '700' }}>대화 시작하기</Text>
            </Pressable>
          </View>
          <HaemayaMascot size={isCompact ? 96 : 120} />
        </View>

        <View style={{ gap: 12 }}>
          <Text style={{ fontSize: 20, fontWeight: '800', color: BrandColors.textPrimary }}>해마 케어 서비스</Text>
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 14,
            }}>
            {SERVICE_TILES.map((tile) => (
              <Pressable
                key={tile.title}
                onPress={() => router.push(tile.route)}
                style={{
                  width: '47%',
                  minWidth: 150,
                  flex: 1,
                  backgroundColor: tile.color,
                  borderRadius: 22,
                  padding: 16,
                  gap: 8,
                  borderWidth: 1,
                  borderColor: 'rgba(0,0,0,0.04)',
                }}>
                <Ionicons name={tile.icon} size={26} color={BrandColors.textPrimary} />
                <Text style={{ fontSize: 17, fontWeight: '800', color: BrandColors.textPrimary }}>{tile.title}</Text>
                <Text style={{ color: BrandColors.textSecondary, fontSize: 13 }}>{tile.subtitle}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={{ gap: 14, paddingHorizontal: 4 }}>
          <Text style={{ fontSize: 20, fontWeight: '800', color: BrandColors.textPrimary }}>추천 기능</Text>
          {SUPPORT_CARDS.map((card) => (
            <Pressable
              key={card.title}
              onPress={() => router.push(card.route)}
              style={{
                backgroundColor: card.accent,
                borderRadius: 24,
                padding: 20,
                gap: 8,
                borderWidth: 1,
                borderColor: BrandColors.border,
                marginHorizontal: 4,
                ...Shadows.card,
              }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: BrandColors.textPrimary }}>{card.title}</Text>
              <Text style={{ color: BrandColors.textSecondary }}>{card.description}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
