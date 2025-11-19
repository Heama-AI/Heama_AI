import { HaemayaMascot } from '@/components/HaemayaMascot';
import { BrandColors, Shadows } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuthStore } from '@/store/authStore';
import { useChatStore } from '@/store/chatStore';
import { useRecordsStore } from '@/store/recordsStore';

interface Profile {
  email?: string;
  name?: string;
}

export default function MyPage() {
  const [profile, setProfile] = useState<Profile>({});
  const { reset: resetChat } = useChatStore();
  const { records } = useRecordsStore();
  const setUserId = useAuthStore((state) => state.setUserId);
  const { width } = useWindowDimensions();
  const isCompact = width < 420;
  const stackMetrics = width < 640;
  const stackStatus = width < 720;
  const insets = useSafeAreaInsets();

  useEffect(() => {
    supabase.auth
      .getUser()
      .then(({ data }) => {
        const user = data.user;
        if (user) {
          setProfile({
            email: user.email ?? undefined,
            name: (user.user_metadata as { name?: string } | null)?.name ?? undefined,
          });
        }
      })
      .catch(() => {
        // ignore user fetch errors in offline mode
      });
  }, []);

  const metrics = useMemo(() => {
    if (records.length === 0) {
      return {
        totalConversations: 0,
        averageRisk: 35,
        averageMood: 65,
        weeklyTrend: 0,
      };
    }

    const totalConversations = records.length;
    const averageRisk =
      records.reduce((acc, record) => acc + record.stats.riskScore, 0) / totalConversations;
    const averageMood =
      records.reduce((acc, record) => acc + record.stats.moodScore, 0) / totalConversations;

    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const lastWeekCount = records.filter((record) => record.createdAt >= sevenDaysAgo).length;
    const previousWeekCount = records.filter(
      (record) => record.createdAt < sevenDaysAgo && record.createdAt >= sevenDaysAgo - 7 * 24 * 60 * 60 * 1000,
    ).length;
    const weeklyTrend =
      previousWeekCount === 0
        ? lastWeekCount > 0
          ? 100
          : 0
        : ((lastWeekCount - previousWeekCount) / previousWeekCount) * 100;

    return {
      totalConversations,
      averageRisk: Math.round(averageRisk),
      averageMood: Math.round(averageMood),
      weeklyTrend: Math.round(weeklyTrend),
    };
  }, [records]);

  const lastRecord = records[0];

  const logout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      Alert.alert('로그아웃 실패', error.message);
      return;
    }
    setUserId(undefined);
    resetChat();
    Alert.alert('로그아웃 완료', '로그인 화면으로 이동합니다.');
    router.replace('/auth/sign-in');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BrandColors.background }} edges={['top', 'left', 'right']}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingTop: 24,
          gap: 24,
          paddingBottom: 48 + insets.bottom,
        }}>
      <View
        style={{
          backgroundColor: BrandColors.surface,
          borderRadius: 28,
          padding: 24,
          gap: 14,
          ...Shadows.card,
        }}>
        <View
          style={{
            flexDirection: isCompact ? 'column' : 'row',
            alignItems: isCompact ? 'flex-start' : 'center',
            gap: 16,
          }}>
          <HaemayaMascot size={isCompact ? 72 : 80} />
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={{ fontSize: isCompact ? 26 : 30, fontWeight: '800', color: BrandColors.textPrimary }}>
              {profile.name ? `${profile.name}님,` : '안녕하세요,'}
            </Text>
            <Text style={{ fontSize: 16, color: BrandColors.textSecondary, lineHeight: 22 }}>
              기억 케어 여정을 이어가고 있어요. 오늘도 차분히 기록을 살펴볼까요?
            </Text>
            {profile.email ? <Text style={{ color: BrandColors.textSecondary }}>{profile.email}</Text> : null}
          </View>
        </View>
        <View
          style={{
            width: '100%',
            flexDirection: stackMetrics ? 'column' : 'row',
            gap: 16,
            marginTop: 8,
          }}>
          <DashboardMetric
            label="저장된 대화"
            value={`${records.length}회`}
            style={stackMetrics ? { width: '100%' } : { flex: 1 }}
          />
          <DashboardMetric
            label="평균 위험 지수"
            value={`${metrics.averageRisk}점`}
            accent={BrandColors.primary}
            style={stackMetrics ? { width: '100%' } : { flex: 1 }}
          />
          <DashboardMetric
            label="평균 감정 점수"
            value={`${metrics.averageMood}`}
            accent={BrandColors.accent}
            style={stackMetrics ? { width: '100%' } : { flex: 1 }}
          />
        </View>
      </View>

      <View
        style={{
          backgroundColor: BrandColors.surface,
          borderRadius: 26,
          padding: 22,
          gap: 16,
          ...Shadows.card,
        }}>
        <Text style={{ fontSize: 20, fontWeight: '700', color: BrandColors.textPrimary }}>최근 활동</Text>
        <View
          style={{
            flexDirection: stackStatus ? 'column' : 'row',
            gap: 16,
          }}>
          <StatusCard
            title="주간 대화 변화"
            value={`${metrics.weeklyTrend >= 0 ? '+' : ''}${metrics.weeklyTrend}%`}
            background={BrandColors.primarySoft}
            valueColor={BrandColors.primary}
            style={stackStatus ? { width: '100%' } : { flex: 1 }}
          />
          <StatusCard
            title="최근 기록 요약"
            value={lastRecord ? lastRecord.summary : '아직 저장된 대화가 없습니다.'}
            background={BrandColors.surfaceSoft}
            valueColor={BrandColors.textSecondary}
            multiline
            style={stackStatus ? { width: '100%' } : { flex: 1 }}
          />
        </View>
      </View>

      <View
        style={{
          backgroundColor: BrandColors.surface,
          borderRadius: 26,
          padding: 22,
          gap: 18,
          ...Shadows.card,
        }}>
        <Text style={{ fontSize: 20, fontWeight: '700', color: BrandColors.textPrimary }}>관리 기능</Text>
        <ActionRow label="통계 확인" description="대화 데이터를 기반으로 인지 건강 지표를 살펴보세요." onPress={() => router.push('/stats')} />
        <ActionRow
          label="대화 기록 수정"
          description="저장된 기록 제목과 메모를 관리합니다."
          onPress={() => router.push('/records')}
        />
        <ActionRow
          label="보호자 연동"
          description="보호자와 기록을 공유할 수 있도록 연동 코드를 발급합니다."
          onPress={() => router.push('/mypage/guardian-link')}
        />
        <ActionRow
          label="로그아웃"
          description="안전하게 로그아웃하고 초기 화면으로 돌아갑니다."
          onPress={logout}
          variant="danger"
        />
      </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function DashboardMetric({
  label,
  value,
  accent = BrandColors.textPrimary,
  style,
}: {
  label: string;
  value: string;
  accent?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        {
          borderRadius: 18,
          padding: 16,
          backgroundColor: BrandColors.surfaceSoft,
          borderWidth: 1,
          borderColor: BrandColors.border,
          gap: 4,
        },
        style,
      ]}>
      <Text style={{ color: BrandColors.textSecondary }}>{label}</Text>
      <Text style={{ fontSize: 22, fontWeight: '800', color: accent }}>{value}</Text>
    </View>
  );
}

function StatusCard({
  title,
  value,
  background,
  valueColor,
  multiline,
  style,
}: {
  title: string;
  value: string;
  background: string;
  valueColor: string;
  multiline?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        {
          borderRadius: 18,
          padding: 18,
          backgroundColor: background,
          borderWidth: 1,
          borderColor: BrandColors.border,
          minHeight: 120,
        },
        style,
      ]}>
      <Text style={{ color: BrandColors.textSecondary, marginBottom: 8 }}>{title}</Text>
      <Text
        style={{
          color: valueColor,
          fontWeight: '700',
          fontSize: multiline ? 14 : 20,
          lineHeight: multiline ? 20 : undefined,
        }}>
        {value}
      </Text>
    </View>
  );
}

function ActionRow({
  label,
  description,
  onPress,
  variant = 'default',
}: {
  label: string;
  description: string;
  onPress: () => void;
  variant?: 'default' | 'danger';
}) {
  const textColor = variant === 'danger' ? BrandColors.danger : BrandColors.textPrimary;
  const icon = variant === 'danger' ? '→' : '→';

  return (
    <Pressable
      onPress={onPress}
      style={{
        borderRadius: 18,
        paddingVertical: 16,
        paddingHorizontal: 18,
        borderWidth: 1,
        borderColor: BrandColors.border,
        backgroundColor: BrandColors.surfaceSoft,
        ...Shadows.card,
      }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flex: 1, marginRight: 12 }}>
          <Text style={{ fontSize: 17, fontWeight: '700', color: textColor }}>{label}</Text>
          <Text style={{ fontSize: 13, color: BrandColors.textSecondary, marginTop: 4, lineHeight: 18 }}>
            {description}
          </Text>
        </View>
        <Text style={{ color: textColor, fontSize: 18, fontWeight: '700' }}>{icon}</Text>
      </View>
    </Pressable>
  );
}
