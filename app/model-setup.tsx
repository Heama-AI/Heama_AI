import { BrandColors, Shadows } from '@/constants/theme';
import { IS_EXECUTORCH_ASSISTANT } from '@/lib/assistantConfig';
import { useAssistantEngine } from '@/lib/assistantEngine';
import { IS_EXECUTORCH_SUMMARY } from '@/lib/summary/config';
import { useAuthStore } from '@/store/authStore';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSummaryWorkerStore } from '@/store/summaryWorkerStore';

export default function ModelSetupScreen() {
  const { isReady, downloadProgress, error } = useAssistantEngine();
  const { isModelReady: isSummaryReady, modelDownloadProgress: summaryProgress } =
    useSummaryWorkerStore();
  const userId = useAuthStore((state) => state.userId);

  useEffect(() => {
    if (!userId) {
      router.replace('/');
    }
  }, [userId]);

  useEffect(() => {
    const assistantReady = !IS_EXECUTORCH_ASSISTANT || isReady;
    const summaryReady = !IS_EXECUTORCH_SUMMARY || isSummaryReady;

    if (assistantReady && summaryReady && userId) {
      router.replace('/home');
    }
  }, [isReady, isSummaryReady, userId]);

  const activeDownloads = [
    IS_EXECUTORCH_ASSISTANT ? downloadProgress : null,
    IS_EXECUTORCH_SUMMARY ? summaryProgress : null,
  ].filter((p) => p !== null) as number[];

  const combinedProgress =
    activeDownloads.length > 0
      ? activeDownloads.reduce((a, b) => a + b, 0) / activeDownloads.length
      : 1;

  const percent = Number.isFinite(combinedProgress)
    ? Math.max(0, Math.min(100, Math.round(combinedProgress * 100)))
    : 0;

  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: BrandColors.background,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
      }}>
      <View
        style={{
          width: '100%',
          maxWidth: 360,
          backgroundColor: BrandColors.surface,
          borderRadius: 26,
          padding: 28,
          alignItems: 'center',
          gap: 14,
          ...Shadows.card,
        }}>
        <ActivityIndicator size="large" color={BrandColors.primary} />
        <Text style={{ fontSize: 20, fontWeight: '800', color: BrandColors.textPrimary }}>
          온디바이스 모델을 불러오고 있어요
        </Text>
        <Text style={{ fontSize: 34, fontWeight: '900', color: BrandColors.primary }}>{percent}%</Text>
        <Text style={{ color: BrandColors.textSecondary, textAlign: 'center', lineHeight: 20 }}>
          해마 코치가 기기 안에서 바로 동작할 수 있도록 필요한 모델을 준비 중입니다. 이 작업은 한 번만
          수행되며, 완료되면 자동으로 홈으로 이동합니다.
        </Text>
        {error ? (
          <View
            style={{
              borderWidth: 1,
              borderColor: BrandColors.danger,
              backgroundColor: BrandColors.dangerSoft,
              borderRadius: 18,
              padding: 12,
              width: '100%',
            }}>
            <Text style={{ color: BrandColors.danger, fontWeight: '700', textAlign: 'center' }}>
              모델을 불러오지 못했습니다.
            </Text>
            <Text style={{ color: BrandColors.danger, fontSize: 12, textAlign: 'center', marginTop: 6 }}>
              네트워크 연결을 확인한 뒤 앱을 재시작하거나 잠시 후 다시 시도해주세요.
            </Text>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}
