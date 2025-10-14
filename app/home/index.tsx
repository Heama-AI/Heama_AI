import CardButton from '@/components/CardButton';
import { HaemayaMascot } from '@/components/HaemayaMascot';
import { BrandColors, Shadows } from '@/constants/theme';
import { router } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

function HomeAction({
  title,
  description,
  onPress,
}: {
  title: string;
  description: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: BrandColors.surface,
        borderRadius: 24,
        padding: 24,
        borderWidth: 1,
        borderColor: BrandColors.border,
        gap: 10,
        ...Shadows.card,
      }}>
      <Text style={{ fontSize: 22, fontWeight: '800', color: BrandColors.textPrimary }}>{title}</Text>
      <Text style={{ fontSize: 14, color: BrandColors.textSecondary, lineHeight: 20 }}>{description}</Text>
    </Pressable>
  );
}

export default function AuthenticatedHome() {
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: BrandColors.background }}
      contentContainerStyle={{ padding: 24, gap: 24, paddingBottom: 48 }}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 18,
          backgroundColor: BrandColors.surface,
          borderRadius: 24,
          padding: 18,
          ...Shadows.card,
        }}>
        <HaemayaMascot size={86} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 26, fontWeight: '800', color: BrandColors.textPrimary }}>해마 케어 허브</Text>
          <Text style={{ color: BrandColors.textSecondary, marginTop: 6, lineHeight: 20 }}>
            필요한 기능을 선택해 케어를 이어가세요.
          </Text>
        </View>
        <Pressable
          onPress={() => router.push('/mypage')}
          style={{
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderRadius: 999,
            backgroundColor: BrandColors.surface,
            borderWidth: 1,
            borderColor: BrandColors.border,
            ...Shadows.card,
          }}>
          <Text style={{ color: BrandColors.textPrimary, fontWeight: '600' }}>마이페이지</Text>
        </Pressable>
      </View>

      <View style={{ gap: 18 }}>
        <HomeAction
          title="대화 시작"
          description="기억 코치와 음성으로 대화하며 일상을 기록하고, 맞춤 케어를 받아보세요."
          onPress={() => router.push('/chat')}
        />
        <HomeAction
          title="맞춤 퀴즈"
          description="최근 대화를 기반으로 기억력 퀴즈를 생성해 인지 능력을 함께 점검합니다."
          onPress={() => router.push('/games')}
        />
        <HomeAction
          title="기록 모아보기"
          description="저장된 대화 요약과 핵심 메모를 확인하고 필요한 기록을 관리하세요."
          onPress={() => router.push('/records')}
        />
      </View>

      <View style={{ gap: 12 }}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: BrandColors.textPrimary }}>빠른 작업</Text>
        <CardButton title="대화 통계 보기" onPress={() => router.push('/stats')} />
      </View>
    </ScrollView>
  );
}
