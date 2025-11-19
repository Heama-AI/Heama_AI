import { BrandColors, Shadows } from '@/constants/theme';
import { router, Stack } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

type ActionCardProps = {
  title: string;
  description: string;
  onPress: () => void;
};

function ActionCard({ title, description, onPress }: ActionCardProps) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        borderRadius: 22,
        padding: 20,
        borderWidth: 1,
        borderColor: BrandColors.border,
        backgroundColor: BrandColors.surface,
        gap: 8,
        ...Shadows.card,
      }}>
      <Text style={{ fontSize: 20, fontWeight: '800', color: BrandColors.textPrimary }}>{title}</Text>
      <Text style={{ color: BrandColors.textSecondary, lineHeight: 20 }}>{description}</Text>
      <View
        style={{
          marginTop: 4,
          alignSelf: 'flex-start',
          paddingHorizontal: 14,
          paddingVertical: 8,
          borderRadius: 999,
          backgroundColor: BrandColors.primarySoft,
        }}>
        <Text style={{ color: BrandColors.primaryDark, fontWeight: '700' }}>시작하기</Text>
      </View>
    </Pressable>
  );
}

export default function PredictCenter() {
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BrandColors.background }} edges={['top', 'left', 'right']}>
      <Stack.Screen options={{ title: 'AI 치매 예측 센터' }} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingTop: 28,
          paddingBottom: Math.max(32, insets.bottom + 24),
          gap: 24,
        }}>
        <View style={{ gap: 8 }}>
          <Text style={{ fontSize: 32, fontWeight: '800', color: BrandColors.textPrimary }}>AI 치매 예측 센터</Text>
          <Text style={{ color: BrandColors.textSecondary, lineHeight: 22 }}>
            음성 기반 과제를 수행하면 건강 통계에서 활동 지표와 위험 신호를 확인할 수 있어요.
          </Text>
        </View>

        <ActionCard
          title="사진 설명하기"
          description="사진을 보며 떠오른 이야기를 들려주세요. 말 속도, 휴지 등 다양한 음성 지표를 측정합니다."
          onPress={() => router.push('/photo-note')}
        />

        <ActionCard
          title="지시문 읽어보기"
          description="준비된 짧은 지시문을 읽고 얼마나 정확하게 따라 읽었는지 확인해 보세요."
          onPress={() => router.push('/script-reading')}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
