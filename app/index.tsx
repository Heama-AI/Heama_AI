import { HaemayaMascot } from '@/components/HaemayaMascot';
import { BrandColors, Shadows } from '@/constants/theme';
import { IS_EXECUTORCH_ASSISTANT } from '@/lib/assistantConfig';
import { useAssistantEngine } from '@/lib/assistantEngine';
import { IS_EXECUTORCH_SUMMARY } from '@/lib/summary/config';
import { useAuthStore } from '@/store/authStore';
import { useSummaryWorkerStore } from '@/store/summaryWorkerStore';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

export default function Home() {
  const userId = useAuthStore((state) => state.userId);
  const { isReady } = useAssistantEngine();
  const isSummaryReady = useSummaryWorkerStore((state) => state.isModelReady);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!userId) return;

    const assistantNotReady = IS_EXECUTORCH_ASSISTANT && !isReady;
    const summaryNotReady = IS_EXECUTORCH_SUMMARY && !isSummaryReady;

    if (assistantNotReady || summaryNotReady) {
      router.replace('/model-setup');
    } else {
      router.replace('/home');
    }
  }, [userId, isReady, isSummaryReady]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BrandColors.background }} edges={['top', 'left', 'right']}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingTop: 24,
          paddingBottom: 40 + insets.bottom,
          gap: 24,
        }}>
        <View
          style={{
            backgroundColor: BrandColors.surface,
            borderRadius: 28,
            padding: 24,
            ...Shadows.card,
            alignItems: 'center',
            gap: 18,
          }}>
          <HaemayaMascot size={160} withBadge />
          <View style={{ alignItems: 'center', gap: 8 }}>
            <Text style={{ fontSize: 32, fontWeight: '800', color: BrandColors.textPrimary }}>해마</Text>
            <Text style={{ fontSize: 16, color: BrandColors.textSecondary, textAlign: 'center', lineHeight: 22 }}>
              음성 기반 케어 코치와 함께 어르신의 기억을 안전하게 기록하세요. 로그인하고 맞춤 케어를 시작해보세요.
            </Text>
          </View>
          <View
            style={{
              marginTop: 24,
              padding: 16,
              borderRadius: 18,
              backgroundColor: BrandColors.surfaceSoft,
              borderWidth: 1,
              borderColor: BrandColors.border,
              gap: 6,
            }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: BrandColors.textPrimary }}>안심 케어 플랫폼</Text>
            <Text style={{ fontSize: 14, color: BrandColors.textSecondary, lineHeight: 20 }}>
              보호자와 함께 연동하여 대화 기록을 공유하고, 건강 지표를 실시간으로 확인할 수 있습니다.
            </Text>
          </View>
        </View>
        <View
          style={{
            backgroundColor: BrandColors.surface,
            borderRadius: 26,
            padding: 24,
            gap: 18,
            ...Shadows.card,
          }}>
          <Text style={{ fontSize: 20, fontWeight: '700', color: BrandColors.textPrimary }}>지금 시작하기</Text>
          <Text style={{ fontSize: 14, color: BrandColors.textSecondary, lineHeight: 20 }}>
            로그인 또는 회원가입 후 맞춤형 치매 케어 서비스를 이용하실 수 있습니다.
          </Text>
          <View style={{ gap: 12 }}>
            <LandingButton label="로그인" onPress={() => router.push('/auth/sign-in')} />
            <LandingButton label="회원가입" variant="outline" onPress={() => router.push('/auth/sign-up')} />
            {/* {__DEV__ ? (
            <LandingButton label="LLM 테스트" variant="outline" onPress={() => router.push('/llm-test')} />
          ) : null} */}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function LandingButton({
  label,
  onPress,
  variant = 'solid',
}: {
  label: string;
  onPress: () => void;
  variant?: 'solid' | 'outline';
}) {
  const backgroundColor = variant === 'solid' ? BrandColors.primary : BrandColors.surface;
  const borderColor = variant === 'solid' ? 'transparent' : BrandColors.border;
  const textColor = variant === 'solid' ? '#fff' : BrandColors.textPrimary;

  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingVertical: 16,
        borderRadius: 18,
        alignItems: 'center',
        backgroundColor,
        borderWidth: 2,
        borderColor,
      }}>
      <Text style={{ fontSize: 16, fontWeight: '700', color: textColor }}>{label}</Text>
    </Pressable>
  );
}
