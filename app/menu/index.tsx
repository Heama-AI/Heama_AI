import CardButton from '@/components/CardButton';
import { BrandColors, Shadows } from '@/constants/theme';
import { router } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';

interface MenuCardConfig {
  title: string;
  description: string;
  route: string;
  accent: string;
}

const PRIMARY_ACTIONS: MenuCardConfig[] = [
  {
    title: '대화 기록 모아보기',
    description: '최근 대화 요약과 메모를 한눈에 관리하세요.',
    route: '/records',
    accent: BrandColors.primarySoft,
  },
  {
    title: '건강 통계 바로가기',
    description: '위험 지수와 감정 변화를 그래프로 확인해요.',
    route: '/stats',
    accent: BrandColors.surfaceSoft,
  },
  {
    title: '게임센터',
    description: '기억력 퀴즈와 두뇌훈련 게임을 선택해요.',
    route: '/games',
    accent: BrandColors.secondarySoft,
  },
];

export default function MenuHub() {
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: BrandColors.background }}
      contentContainerStyle={{ padding: 24, gap: 24, paddingBottom: 80 }}>
      <View style={{ gap: 6 }}>
        <Text style={{ fontSize: 30, fontWeight: '800', color: BrandColors.textPrimary }}>전체 메뉴</Text>
        <Text style={{ color: BrandColors.textSecondary, lineHeight: 20 }}>
          필요한 기능을 빠르게 찾고 이동해보세요.
        </Text>
      </View>

      <View style={{ gap: 16 }}>
        {PRIMARY_ACTIONS.map((item) => (
          <View
            key={item.title}
            style={{
              backgroundColor: item.accent,
              borderRadius: 24,
              padding: 20,
              gap: 8,
              borderWidth: 1,
              borderColor: BrandColors.border,
              ...Shadows.card,
            }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: BrandColors.textPrimary }}>{item.title}</Text>
            <Text style={{ color: BrandColors.textSecondary, lineHeight: 20 }}>{item.description}</Text>
            <CardButton title="바로가기" onPress={() => router.push(item.route)} />
          </View>
        ))}
      </View>

      <View
        style={{
          backgroundColor: BrandColors.surface,
          borderRadius: 24,
          padding: 20,
          gap: 14,
          borderWidth: 1,
          borderColor: BrandColors.border,
          ...Shadows.card,
        }}>
        <Text style={{ fontSize: 18, fontWeight: '700', color: BrandColors.textPrimary }}>빠른 이동</Text>
        <View style={{ gap: 12 }}>
          <CardButton title="새 대화 시작하기" onPress={() => router.push('/chat')} />
          <CardButton title="통계 보기" onPress={() => router.push('/stats')} />
          <CardButton title="기록 저장소" onPress={() => router.push('/records')} />
        </View>
      </View>
    </ScrollView>
  );
}
